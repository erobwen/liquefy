/**
 * Fountain's user model: users, the super user, sessions, signing in, the session's remote
 * methods, and authorization through the methods of the application's own classes. Specified
 * in documents/user-model.md; designed in the whitepaper, section 4.
 *
 *   class AppSession extends Session {
 *     publish(document) { ... }                       // every method here is a remote method
 *   }
 *   const fountain = createFountain({ well, Session: AppSession, superUser: { name: "admin", password } });
 *
 *   const session = fountain.createSession();          // anonymous
 *   fountain.call(session, "signIn", ["admin", password]);
 *   fountain.as(session, () => { document.title = "New"; });   // asks document.canWrite(user, ...)
 *
 * There is no network here yet. `call` and `as` are what the protocol will do with a client's
 * calls and writes; until then they are how server code, and tests, act as a user.
 */

import { Synchronized, synchronized, Index, registerClasses, model, world } from "@liquefy/deepwell";
import { AuthenticationError, DEFAULT_SCRYPT, hashPassword, verifyPassword, newToken, tokenHash, jwtVerifier } from "./credentials.js";
import { ChangeSet, ALL, recordReads, touches, makeDelivery, applyDelivery, clientRecord } from "./observation.js";
import { isPart, withParts, wholeSelection } from "./selections.js";
import { ServerConnection, PROTOCOL, classesDigest } from "./protocol.js";

export { AuthenticationError, jwtVerifier, ChangeSet, ALL, applyDelivery, ServerConnection, PROTOCOL, classesDigest };

export class AuthorizationError extends Error {
  constructor(message) {
    super(message);
    this.name = "AuthorizationError";
  }
}

/**
 * An error whose message a session's method means for the client: a failed call carries it
 * (protocol M3). Any other error is reported to the client without its message.
 */
export class RemoteError extends Error {
  constructor(message) {
    super(message);
    this.name = "RemoteError";
  }
}

for (const PublicError of [AuthorizationError, RemoteError, AuthenticationError]) PublicError.prototype.isPublic = true;

/*------------------------------------------------------------------
 *  Users (user-model.md section 2)
 *-----------------------------------------------------------------*/

/**
 * A user: an ordinary stored object, which authorization methods are given and compare with
 * references in the data. An application may extend it with fields of its own, and with its
 * own `canRead` and `canWrite`.
 *
 * `name` is what the user is shown as. What the user signs in with is in the account.
 */
export class User extends Synchronized {
  constructor(fields = {}) {
    super();
    this.name = null;
    this.disabled = false;
    this.account = null;
    for (const [key, value] of Object.entries(fields)) this[key] = value;
  }

  /** A user may write their own fields, other than those that are Fountain's to decide. */
  canWrite(user, property) {
    return user === this && property !== "disabled" && property !== "account";
  }
}

/**
 * What a user signs in with, kept apart from the user: no client can read or select it
 * (`serverOnly`). The name the user signs in by, the hash of the password, the identities at
 * external login services, and the tokens that have been issued.
 */
export class Account extends Synchronized {
  static serverOnly = true;

  constructor(user, name) {
    super();
    this.user = user;
    this.name = name;
    this.password = null;
    this.identities = synchronized([]);
    this.tokens = synchronized([]);
  }
}

/** A user as an external login service knows them: the service, and its name for the user. */
export class Identity extends Synchronized {
  static serverOnly = true;

  constructor(account, issuer, subject) {
    super();
    this.account = account;
    this.issuer = issuer;
    this.subject = subject;
  }
}

/** A token that was issued at a sign-in, as the server keeps it: its hash, and when it ends. */
export class Token extends Synchronized {
  static serverOnly = true;

  constructor(account, hash, expires) {
    super();
    this.account = account;
    this.hash = hash;
    this.expires = expires;
  }
}

class AccountsByName extends Index {
  static serverOnly = true;
  keyOf(account) { return account.name; }
}

class IdentitiesBySubject extends Index {
  static serverOnly = true;
  keyOf(identity) { return [identity.issuer, identity.subject]; }
}

class TokensByHash extends Index {
  static serverOnly = true;
  keyOf(token) { return token.hash; }
}

/** Fountain's own part of the database, at `root.fountain`. */
class FountainState extends Synchronized {
  static serverOnly = true;

  constructor() {
    super();
    this.superUser = null;
    this.accounts = new AccountsByName();
    this.identities = new IdentitiesBySubject();
    this.tokens = new TokensByHash();
  }
}

/*------------------------------------------------------------------
 *  Sessions (user-model.md section 3)
 *-----------------------------------------------------------------*/

/**
 * What the server keeps about a session that is not synchronized state: its grants (M5), the
 * effects of the method that is running, its token, and its views.
 */
const sessionStates = new WeakMap();

/**
 * A view is what one client of a session holds (protocol.md section 5.1). A connection has one;
 * a session has one of its own, for server code and tests that act as its user without a
 * connection. Every function that takes "a session or a connection" works on the view:
 *
 *   subscriptions  its subscriptions, and `subs`, by number
 *   holders        held object → the subscriptions whose selections contain it
 *   outgoing       held object, or the session → the identities it refers to
 *   incoming       identity → how many held objects, and the session, refer to it
 *   pending...     what the client is to be sent (observation.md section 4)
 *
 * `holders`, `outgoing` and `incoming` are what "holds" and "knows of" are answered from,
 * without looking through anything (user-model.md S5). They are kept up to date as selections
 * change, through Deepwell's onChange, and as what is held is written, through its commits.
 */
export const VIEW = Symbol.for("fountain.view");

/** The view of a session (its own one) or of a connection (or a view itself). */
function viewOf(target) {
  if (target !== null && typeof(target) === "object") {
    const state = sessionStates.get(target);
    if (state !== undefined) return state.view;
    const view = target[VIEW];
    if (view !== undefined) return view;
  }
  throw new Error("Expected a session or a connection of a Fountain.");
}

function stateOf(session) {
  const state = sessionStates.get(session);
  if (state === undefined) throw new Error("This session was not made by a Fountain: use fountain.createSession().");
  return state;
}

/**
 * A session: one sign-in. It is a volatile object, synchronized with its own clients and never
 * stored. The application extends it, and every method of the application's class is a
 * remote method (whitepaper section 4.5): trusted code, which runs with full access, as one
 * transaction that is made whole or not at all.
 *
 * `user` is the user that is signed in, or null.
 */
export class Session extends Synchronized {
  static volatile = true;

  /** The methods of this base class that a client may call. In a subclass, every method is one. */
  static remote = ["signIn", "signInWith", "resume", "signOut", "createUser", "changePassword"];

  constructor() {
    super();
    this.user = null;
  }

  /** The Fountain this session belongs to. */
  get fountain() {
    return stateOf(this).fountain;
  }

  /**
   * Signs in with a name and a password. Returns a token for the client to keep, with which
   * the sign-in can be taken up again (`resume`), or null if the name and the password do
   * not belong together. The user interface follows `session.user`.
   */
  signIn(name, password) {
    const fountain = this.fountain;
    const account = fountain.accountNamed(name);
    // The same work whether the name is known or not, so that the time says nothing.
    const stored = account && account.password ? account.password : fountain.decoyPassword;
    const right = verifyPassword(password, stored);
    if (!right || !account || !account.password || account.user.disabled) return null;
    return fountain.bind(this, account);
  }

  /**
   * Signs in with an access token from an external login service. `issuer` names one of the
   * services the Fountain was given a verifier for. Returns a token, or null if the service's
   * user is not known here and the application does not make users for them.
   */
  signInWith(issuer, accessToken) {
    const fountain = this.fountain;
    const verify = fountain.identityProviders[issuer];
    if (typeof(verify) !== "function") throw new AuthenticationError("No login service \"" + issuer + "\" is known.");
    const { subject, claims } = verify(accessToken);
    let identity = fountain.state.identities.get([issuer, subject])[0];
    if (identity === undefined) {
      const fields = fountain.externalUser ? fountain.externalUser(issuer, claims) : null;
      if (!fields) return null;
      const user = fountain.makeUser(fields, null);
      identity = fountain.addIdentity(user, issuer, subject);
    }
    if (identity.account.user.disabled) return null;
    return fountain.bind(this, identity.account);
  }

  /** Takes a sign-in up again, with the token it gave. Returns whether the token was good. */
  resume(token) {
    const fountain = this.fountain;
    const found = fountain.state.tokens.get(tokenHash(token))[0];
    if (found === undefined) return false;
    if (found.expires <= fountain.now() || found.account.user.disabled) {
      fountain.forgetToken(found);
      return false;
    }
    fountain.bind(this, found.account, found);
    return true;
  }

  /** Signs out: the session has no user, its subscriptions end, and its token is good no more. */
  signOut() {
    this.fountain.unbind(this, true);
  }

  /**
   * Creates a user who signs in by `name` with `password`, with the other fields given. The
   * super user may, and whoever `mayCreateUsers()` allows. Names are unique.
   */
  createUser({ name, password, ...fields }) {
    if (!this.mayCreateUsers()) throw new AuthorizationError("This session may not create users.");
    if (typeof(name) !== "string" || name === "") throw new AuthenticationError("A user who signs in with a password needs a name to sign in by.");
    return this.fountain.makeUser({ name, ...fields }, name, password);
  }

  /** Changes the password of the user that is signed in, who gives the present one. */
  changePassword(present, next) {
    const account = this.user && this.user.account;
    if (!account || !account.password || !verifyPassword(present, account.password)) return false;
    account.password = hashPassword(next, this.fountain.scrypt);
    return true;
  }

  /**
   * Whether this session may subscribe with a selector from a starting object (whitepaper
   * section 4.5, "The session also governs subscriptions"). Asked after the starting object has
   * been found to be one the session knows of and may read. `selector` is the selector's name,
   * or null for a table of rules given by server code. Any, by default.
   */
  maySubscribe(selector, start) {
    return true;
  }

  /**
   * Called each time the session is bound to a user: by signing in, and by a token taken up
   * again, also after the server has restarted and the session is made anew. An application
   * sets here the fields that refer to the user's roots (whitepaper section 4.5, "The session is
   * where a client starts"), so that a client that reconnects finds them again.
   */
  signedIn() {}

  /** Whether this session may create users. The super user may; an application may allow others. */
  mayCreateUsers() {
    return this.fountain.isSuperUser(this.user);
  }

  /**
   * Gives this session the right to read an object for as long as it lasts, whatever the
   * object's `canRead` says of its user (whitepaper section 4.5). For a session's own methods.
   */
  grant(object) {
    stateOf(this).grants.add(object);
  }

  /** Registers something to do after the transaction of the method that is running has been stored. */
  afterCommit(effect) {
    stateOf(this).effects.push(effect);
  }
}

// What the base class has that is not for clients, by any name a subclass might leave it.
const NOT_REMOTE = new Set(["constructor", "mayCreateUsers", "maySubscribe", "signedIn", "grant", "afterCommit", "canRead", "canWrite"]);

/*------------------------------------------------------------------
 *  Fountain
 *-----------------------------------------------------------------*/

let registered = false;


function isServerOnly(object) {
  return !isPart(object) && object.constructor.serverOnly === true;
}

/** The identities that an encoded value refers to. */
function encodedReferences(encoded, into) {
  if (encoded === null || typeof(encoded) !== "object") return;
  if (Array.isArray(encoded)) {
    for (const item of encoded) encodedReferences(item, into);
    return;
  }
  const keys = Object.keys(encoded);
  if (keys.length === 1 && (keys[0] === "$ref" || keys[0] === "$weak")) into.add(encoded[keys[0]]);
  else for (const key of keys) encodedReferences(encoded[key], into);
}

/**
 * The identities an object refers to, strongly or weakly, read from its target: without loading
 * a field that was never read, and without being observed. A reference to an object that is not
 * stored has no identity, and is left out: it is a part of what the client made.
 */
function outgoingIdentities(object) {
  const ids = new Set();
  const add = (value) => {
    for (const referred of referencesIn(value, [])) {
      const id = model.identityOf(referred);
      if (id !== undefined) ids.add(id);
    }
  };
  // The target says which fields were never read, without loading them; the values of the rest
  // are read through the object, since a value that a repeater has read lives on its timeline
  // and no longer on the target.
  world.withoutRecording(() => {
    if (Array.isArray(object)) {
      for (const item of object) add(item);
      return;
    }
    const target = world.innerMeta(object).target;
    for (const key of Object.keys(object)) {
      const descriptor = Object.getOwnPropertyDescriptor(target, key);
      if (descriptor && descriptor.get && descriptor.get.encoded !== undefined) encodedReferences(descriptor.get.encoded, ids);
      else add(object[key]);
    }
  });
  return ids;
}

/** The synchronized objects a value holds references to: the value itself, or inside a map, a set or a weak reference. */
function referencesIn(value, into) {
  if (model.isSynchronized(value)) into.push(value);
  else if (value instanceof model.WeakReference) {
    const target = value.deref();
    if (target) into.push(target);
  } else if (value instanceof Map) {
    for (const [key, item] of value) { referencesIn(key, into); referencesIn(item, into); }
  } else if (value instanceof Set) {
    for (const item of value) referencesIn(item, into);
  }
  return into;
}

export class Fountain {
  constructor({ well, Session: SessionClass = Session, superUser, identityProviders = {}, externalUser = null, scrypt = DEFAULT_SCRYPT, tokenLifetime = 30 * 24 * 60 * 60 * 1000, now = () => Date.now(), code = null } = {}) {
    if (!well) throw new Error("createFountain() needs a Deepwell store: { well }.");
    if (SessionClass !== Session && !(SessionClass.prototype instanceof Session)) throw new Error("A Fountain's session class extends Session.");
    if (!registered) {
      registerClasses({ "Fountain.User": User, "Fountain.Account": Account, "Fountain.Identity": Identity, "Fountain.Token": Token,
        "Fountain.AccountsByName": AccountsByName, "Fountain.IdentitiesBySubject": IdentitiesBySubject, "Fountain.TokensByHash": TokensByHash,
        "Fountain.State": FountainState, "Fountain.Session": Session });
      registered = true;
    }
    // The application's session class is registered like any class, under a name of its own.
    // Clients are told of every session as a Fountain.Session: they never have its code.
    try {
      model.classNameOf(Object.create(SessionClass.prototype));
    } catch (error) {
      model.registerClass(SessionClass, { name: "Fountain.Session." + SessionClass.name });
    }
    this.well = well;
    this.Session = SessionClass;
    this.identityProviders = identityProviders;
    this.externalUser = externalUser;
    this.scrypt = scrypt;
    this.tokenLifetime = tokenLifetime;
    this.now = now;
    this.code = code; // the application's code version, which clients must have (protocol section 4.1)
    this.connections = new Set();
    this.views = new Set(); // every view not yet closed: released when the Fountain is
    this.liveSessions = new Map(); // token hash → the session made for it, while it has connections
    this.actor = null; // the session whose user is acting, or null: the system, with full access
    this.sessions = new Map(); // user → the sessions that are signed in as that user
    this.decoyPassword = hashPassword(newToken(), scrypt);
    this.watchers = new WeakMap(); // object → the views that hold it, or whose session it is

    this.selectors = new Map(); // name → { name, rules, whole }: see registerSelector()
    this.observers = new Set(); // see observe()
    this.touched = new Set(); // the views whose selections changed since the last commit
    this.changeSetListeners = [];

    // After each commit (observation.md): what a held object refers to is counted again, the
    // commit's change set is made, observers whose reads it touches run again, and each session
    // that holds something it wrote, or whose selections changed, is given its delivery. All of
    // it once the transaction is stored, and its new objects have their identities.
    this.removeCommitListener = well.onCommit((change) => this.committed(change));

    // A new database is made with one user, the super user (U3).
    if (well.root.fountain === undefined) {
      if (!superUser || typeof(superUser.name) !== "string" || typeof(superUser.password) !== "string") {
        throw new Error("A new database needs its super user: createFountain({ well, superUser: { name, password } }).");
      }
      well.atomic(() => {
        well.root.fountain = new FountainState();
        const { name, password, ...fields } = superUser;
        well.root.fountain.superUser = this.makeUser({ name, ...fields }, name, password);
      });
    }
    this.state = well.root.fountain;
    this.removeCheck = well.checkWrites((write) => this.checkWrite(write));
  }

  close() {
    for (const connection of [...this.connections]) connection.close();
    for (const view of [...this.views]) this.closeView(view);
    this.removeCheck();
    this.removeCommitListener();
    this.observers.clear();
  }

  /*------------------------------------------------------------------
   *  Connections (protocol.md)
   *-----------------------------------------------------------------*/

  /**
   * A new connection, for one client: `send(message)` is how its messages leave, and the
   * connection's `receive(message)` is how the client's arrive. Call its `close()` when the
   * transport closes.
   */
  connect(send) {
    return new ServerConnection(this, send);
  }

  openConnection(connection, session) {
    this.connections.add(connection);
    return this.createView(session);
  }

  closeConnection(connection) {
    this.connections.delete(connection);
    const session = connection.view.session;
    this.closeView(connection.view);
    // A session that no connection uses any more is made anew from its token, if one comes back.
    const state = stateOf(session);
    if ([...state.views].every((view) => view === state.view)) {
      for (const [hash, live] of this.liveSessions) if (live === session) this.liveSessions.delete(hash);
    }
  }

  /**
   * The session for a token a client presents (protocol section 4.3): the one its connections
   * share, if it has one, or one made anew for the token's user. Null if the token is not good.
   */
  sessionForToken(token) {
    const live = this.liveSessions.get(tokenHash(token));
    if (live !== undefined && live.user !== null) return live;
    const session = this.createSession();
    return this.call(session, "resume", [token]) === true ? session : null;
  }

  /** The object with an identity, stored or volatile, or null. It may be loaded. */
  objectFor(id) {
    if (typeof(id) !== "string") return null;
    const inMemory = this.well.inMemory(id);
    if (inMemory !== undefined) return inMemory;
    if (id.startsWith("v")) return null;
    return this.well.objectFor(id);
  }

  /** Makes an object a root that a client may name: a session's method returned it (whitepaper section 4.5). */
  give(target, object) {
    stateOf(viewOf(target).session).given.add(object);
  }

  /*------------------------------------------------------------------
   *  Observation (observation.md)
   *-----------------------------------------------------------------*/

  committed(change) {
    const eventsByState = new Map(); // state → Map(object → its events in this commit)
    for (const event of change.events) {
      const states = this.watchers.get(event.object);
      if (states === undefined) continue;
      for (const state of states) {
        let byObject = eventsByState.get(state);
        if (byObject === undefined) eventsByState.set(state, byObject = new Map());
        if (!byObject.has(event.object)) byObject.set(event.object, []);
        byObject.get(event.object).push(event);
      }
    }
    for (const object of change.changed) {
      const states = this.watchers.get(object);
      if (states !== undefined) for (const state of [...states]) this.retrack(state, object);
    }

    const changeSet = ChangeSet.fromCommit(change);
    for (const listener of this.changeSetListeners) listener(changeSet);
    for (const observer of [...this.observers]) {
      if (this.observers.has(observer) && touches(changeSet, observer.reads)) observer.run(changeSet);
    }

    const states = new Set([...this.touched, ...eventsByState.keys()]);
    this.touched.clear();
    for (const state of states) this.deliver(state, change.commit, eventsByState.get(state) || new Map());
  }

  deliver(state, commit, eventsByObject) {
    const delivery = makeDelivery(this.well, state, commit, eventsByObject);
    if (delivery === null) return;
    // Kept until taken only where nothing listens: a connection sends each as it is made.
    if (state.deliveryListeners.length === 0) state.outbox.push(delivery);
    for (const listener of [...state.deliveryListeners]) listener(delivery);
  }

  /** Calls `listener(changeSet)` after every commit, with what it wrote. Returns a remover. */
  onChangeSet(listener) {
    this.changeSetListeners.push(listener);
    return () => { this.changeSetListeners = this.changeSetListeners.filter((other) => other !== listener); };
  }

  /**
   * Observes a computation by what it reads (observation.md section 3): runs `compute`,
   * records what it read by identity and field, and after every commit whose change set touches
   * that, runs it again and calls `changed(value, changeSet)`. It holds no object in memory:
   * what it read may be unloaded, and is read again when it runs. Returns
   * `{ value, reads, stop() }`.
   */
  observe(compute, changed = () => {}) {
    const fountain = this;
    const observer = {
      value: undefined,
      reads: new Map(),
      run(changeSet) {
        const { value, reads } = recordReads(compute);
        observer.value = value;
        observer.reads = reads;
        if (changeSet !== undefined) changed(value, changeSet);
      },
      stop() { fountain.observers.delete(observer); },
    };
    observer.run();
    this.observers.add(observer);
    return observer;
  }

  /**
   * The deliveries of a session not yet taken, in order: what a client is to be sent
   * (observation.md section 4). What changed since the last commit, such as a new session, is
   * made into a delivery first.
   */
  takeDeliveries(target) {
    const state = viewOf(target);
    if (state.pendingJoined.size > 0 || state.pendingLeft.size > 0 || state.pendingMemberships.size > 0) {
      this.touched.delete(state);
      this.deliver(state, this.well.lastCommit, new Map());
    }
    const outbox = state.outbox;
    state.outbox = [];
    return outbox;
  }

  /** Calls `listener(delivery)` for each delivery of a session as it is made. Returns a remover. */
  onDelivery(target, listener) {
    const state = viewOf(target);
    state.deliveryListeners.push(listener);
    return () => { state.deliveryListeners = state.deliveryListeners.filter((other) => other !== listener); };
  }

  /** The records of what a session holds, by identity, as its client should have them: for tests and diagnosis. */
  clientView(target) {
    const state = viewOf(target);
    const view = new Map();
    for (const object of [state.session, ...state.holders.keys()]) {
      const id = model.identityOf(object);
      if (id !== undefined) view.set(id, clientRecord(this.well, object));
    }
    return view;
  }

  get superUser() {
    return this.state.superUser;
  }

  isSuperUser(user) {
    return user !== null && user !== undefined && user === this.state.superUser;
  }

  /*------------------------------------------------------------------
   *  Users and accounts (user-model.md sections 2 and 4)
   *-----------------------------------------------------------------*/

  /** The state at `root.fountain`, while a database is being made: `this.state` is not set yet. */
  get stored() {
    return this.state || this.well.root.fountain;
  }

  accountNamed(name) {
    return typeof(name) === "string" ? this.stored.accounts.get(name)[0] || null : null;
  }

  /**
   * Makes a user, with an account. `signInName` is the name the user signs in by with a
   * password, or null for a user who signs in through an external service only. The user's
   * class is the one registered as the application's, if `fields` is not a user already.
   */
  makeUser(fields, signInName, password) {
    return this.well.atomic(() => {
      if (signInName !== null && this.accountNamed(signInName) !== null) {
        throw new AuthenticationError("There is already a user who signs in as \"" + signInName + "\".");
      }
      const user = fields instanceof User ? fields : new User(fields);
      if (user.account !== null) throw new AuthenticationError("This user has an account already.");
      const account = new Account(user, signInName);
      if (password !== undefined) account.password = hashPassword(password, this.scrypt);
      user.account = account;
      this.stored.accounts.add(account);
      return user;
    });
  }

  /** Records that a user is the one an external login service calls `subject`. */
  addIdentity(user, issuer, subject) {
    return this.well.atomic(() => {
      if (this.state.identities.get([issuer, subject]).length > 0) throw new AuthenticationError("That identity belongs to a user already.");
      const identity = new Identity(user.account, issuer, subject);
      user.account.identities.push(identity);
      this.state.identities.add(identity);
      return identity;
    });
  }

  /** Disables a user: they cannot sign in, their sessions end, and their tokens are good no more. */
  disable(user) {
    this.well.atomic(() => {
      user.disabled = true;
      for (const token of [...user.account.tokens]) this.forgetToken(token);
    });
    for (const session of [...(this.sessions.get(user) || [])]) this.unbind(session, false);
  }

  enable(user) {
    user.disabled = false;
  }

  forgetToken(token) {
    this.well.atomic(() => {
      this.state.tokens.delete(token);
      const tokens = token.account.tokens;
      const at = tokens.indexOf(token);
      if (at !== -1) tokens.splice(at, 1);
    });
  }

  /*------------------------------------------------------------------
   *  Sessions (user-model.md section 3)
   *-----------------------------------------------------------------*/

  /** A new session, with no user: what a connection starts with. */
  createSession() {
    const session = new this.Session();
    const state = { fountain: this, session, grants: new Set(), given: new Set(), effects: [], token: null, views: new Set(), view: null };
    sessionStates.set(session, state);
    this.well.volatile(session);
    state.view = this.createView(session);
    return session;
  }

  /** A new view of a session: what one more client of it holds. A connection makes one. */
  createView(session) {
    const view = {
      fountain: this, session, closed: false,
      subscriptions: new Set(), subs: new Map(), nextSub: 1,
      holders: new Map(), outgoing: new Map(), incoming: new Map(),
      // What the client is to be sent (observation.md section 4).
      pendingJoined: new Set([session]), pendingLeft: new Set(), sentIds: new Map(), outbox: [], deliveryListeners: [],
      // Which of its subscriptions hold what (selections.md section 4).
      pendingMemberships: new Set(),
    };
    view[VIEW] = view;
    stateOf(session).views.add(view);
    this.views.add(view);
    this.track(view, session); // a client knows of what its session refers to (S1)
    return view;
  }

  /** Ends a view: its subscriptions are released, and it is forgotten. */
  closeView(view) {
    if (view.closed) return;
    for (const subscription of [...view.subscriptions]) subscription.release();
    this.untrack(view, view.session);
    view.closed = true;
    this.views.delete(view);
    this.touched.delete(view);
    stateOf(view.session).views.delete(view);
  }

  /*------------------------------------------------------------------
   *  What a session holds, and knows of (user-model.md section 8)
   *-----------------------------------------------------------------*/

  /** Starts counting what an object refers to, for a session that holds it. */
  track(state, object) {
    const ids = outgoingIdentities(object);
    state.outgoing.set(object, ids);
    for (const id of ids) state.incoming.set(id, (state.incoming.get(id) || 0) + 1);
    let states = this.watchers.get(object);
    if (states === undefined) this.watchers.set(object, states = new Set());
    states.add(state);
  }

  untrack(state, object) {
    const ids = state.outgoing.get(object);
    if (ids === undefined) return;
    state.outgoing.delete(object);
    for (const id of ids) {
      const count = state.incoming.get(id) - 1;
      if (count > 0) state.incoming.set(id, count);
      else state.incoming.delete(id);
    }
    const states = this.watchers.get(object);
    if (states !== undefined) states.delete(state);
  }

  /** An object a session holds was written: what it refers to is counted again. */
  retrack(state, object) {
    this.untrack(state, object);
    this.track(state, object);
  }

  /** Objects joined and left the selection of one of a session's subscriptions. */
  selectionChanged(state, subscription, joined, left) {
    for (const object of joined) state.pendingMemberships.add(object);
    for (const object of left) state.pendingMemberships.add(object);
    if (joined.length > 0 || left.length > 0) this.touched.add(state);
    for (const object of joined) {
      let holders = state.holders.get(object);
      if (holders === undefined) {
        state.holders.set(object, holders = new Set());
        if (!state.outgoing.has(object)) this.track(state, object);
        if (state.pendingLeft.has(object)) state.pendingLeft.delete(object); // held all along
        else state.pendingJoined.add(object);
        this.touched.add(state);
      }
      holders.add(subscription);
    }
    for (const object of left) {
      const holders = state.holders.get(object);
      if (holders === undefined) continue;
      holders.delete(subscription);
      if (holders.size > 0) continue;
      state.holders.delete(object);
      if (object === state.session) continue;
      this.untrack(state, object);
      if (state.pendingJoined.has(object)) state.pendingJoined.delete(object); // never sent
      else state.pendingLeft.add(object);
      this.touched.add(state);
    }
  }

  /** A session for a given user, for server code that acts as that user, and for tests. */
  sessionFor(user) {
    const session = this.createSession();
    this.setUser(session, user);
    return session;
  }

  setUser(session, user) {
    const before = session.user;
    if (before === user) return;
    if (before !== null) {
      const sessions = this.sessions.get(before);
      sessions.delete(session);
      if (sessions.size === 0) this.sessions.delete(before);
    }
    if (user !== null) {
      if (!this.sessions.has(user)) this.sessions.set(user, new Set());
      this.sessions.get(user).add(session);
    }
    session.user = user;
  }

  /** Binds a session to the user of an account, and issues a token unless it resumes one. */
  bind(session, account, resumed = null) {
    this.unbind(session, false);
    let token = null;
    if (resumed === null) {
      token = newToken();
      resumed = new Token(account, tokenHash(token), this.now() + this.tokenLifetime);
      account.tokens.push(resumed);
      this.state.tokens.add(resumed);
    }
    stateOf(session).token = resumed;
    this.liveSessions.set(resumed.hash, session);
    this.setUser(session, account.user);
    session.signedIn();
    return token;
  }

  /** Ends a session's sign-in: no user, no subscriptions, no grants. With `forget`, its token ends too. */
  unbind(session, forget) {
    const state = stateOf(session);
    for (const view of state.views) for (const subscription of [...view.subscriptions]) subscription.release();
    state.grants.clear();
    state.given.clear();
    if (state.token !== null && this.liveSessions.get(state.token.hash) === session) this.liveSessions.delete(state.token.hash);
    if (forget && state.token !== null && this.state.tokens.has(state.token)) this.forgetToken(state.token);
    state.token = null;
    this.setUser(session, null);
  }

  /** The sessions that are signed in as a user. */
  sessionsOf(user) {
    return [...(this.sessions.get(user) || [])];
  }

  /*------------------------------------------------------------------
   *  Remote methods (user-model.md section 6)
   *-----------------------------------------------------------------*/

  /** The names of the methods a client may call on a session of the given class. */
  remoteMethods(SessionClass = this.Session) {
    const names = new Set(Session.remote);
    for (let scan = SessionClass.prototype; scan !== Session.prototype && scan !== null; scan = Object.getPrototypeOf(scan)) {
      for (const name of Object.getOwnPropertyNames(scan)) {
        const descriptor = Object.getOwnPropertyDescriptor(scan, name);
        if (typeof(descriptor.value) === "function" && !NOT_REMOTE.has(name)) names.add(name);
      }
    }
    return [...names].sort();
  }

  /**
   * Calls a remote method of a session, as a client's call does: trusted code, with full
   * access, as one transaction that is made whole or not at all. What the method registered
   * with `afterCommit` is done when the transaction has been stored.
   */
  call(target, name, args = []) {
    const session = viewOf(target).session;
    const state = stateOf(session);
    if (state.fountain !== this) throw new Error("This session belongs to another Fountain.");
    if (typeof(name) !== "string" || !this.remoteMethods(session.constructor).includes(name)) {
      throw new AuthorizationError("A session has no remote method \"" + String(name) + "\".");
    }
    const actor = this.actor;
    const effects = state.effects;
    state.effects = [];
    let result;
    let after;
    this.actor = null; // a session's method is trusted code
    try {
      result = this.well.atomic(() => session[name](...args));
      after = state.effects;
    } finally {
      this.actor = actor;
      state.effects = effects;
    }
    for (const effect of after) effect();
    return result;
  }

  /*------------------------------------------------------------------
   *  Authorization (user-model.md section 7)
   *-----------------------------------------------------------------*/

  /** Whether a session's user may read an object: what a selection may contain, and pass through. */
  mayRead(target, object) {
    const session = viewOf(target).session;
    if (isPart(object)) return true; // delivered as a part of what it is reached through (Z5)
    if (isServerOnly(object)) return false;
    if (object instanceof Session) return object === session;
    const user = session.user;
    if (this.isSuperUser(user)) return true;
    if (stateOf(session).grants.has(object)) return true;
    return typeof(object.canRead) === "function" ? object.canRead(user) === true : true;
  }

  /** Whether a session's user may write a property of an object it holds. */
  mayWrite(target, object, property, value) {
    const user = viewOf(target).session.user;
    if (isPart(object)) {
      // An array or a classless object is written under the roots through which it is held.
      const roots = this.rootsHolding(target, object);
      if (roots.length === 0) return false;
      if (this.isSuperUser(user)) return true;
      return roots.some((root) => isPart(root) || (!isServerOnly(root) && !(root instanceof Session)
        && (typeof(root.canWrite) !== "function" || root.canWrite(user) === true)));
    }
    if (isServerOnly(object) || object instanceof Session) return false;
    if (this.isSuperUser(user)) return true;
    return typeof(object.canWrite) === "function" ? object.canWrite(user, property, value) === true : true;
  }

  /** The roots of the subscriptions of a session whose selections contain an object. */
  rootsHolding(target, object) {
    const holders = viewOf(target).holders.get(object);
    return holders === undefined ? [] : [...holders].map((subscription) => subscription.root);
  }

  /** Whether a session holds an object: it is the session itself, or in one of its selections. */
  holds(target, object) {
    const view = viewOf(target);
    return object === view.session || view.holders.has(object);
  }

  /**
   * Whether a session knows of an object: it holds it, was granted it, or it or an object it
   * holds refers to it. A client can refer to, and subscribe from, what it knows of only.
   * Knowing of an object says nothing of whether it may be read (user-model.md E1).
   */
  knows(target, object) {
    const view = viewOf(target);
    const state = stateOf(view.session);
    if (this.holds(view, object) || state.grants.has(object) || state.given.has(object)) return true;
    const id = model.identityOf(object);
    return id !== undefined && view.incoming.has(id);
  }

  /**
   * Runs `action` as the user of a session: every write it makes to an object of the store is
   * a client's write, and is asked about (Z1 to Z4). It is one transaction, made whole or not
   * at all.
   */
  as(target, action) {
    const view = viewOf(target);
    const actor = this.actor;
    this.actor = view;
    try {
      return this.well.atomic(action);
    } finally {
      this.actor = actor;
    }
  }

  checkWrite({ object, key, value }) {
    const session = this.actor;
    if (session === null) return;
    const refuse = (why) => { throw new AuthorizationError(why); };
    if (!this.holds(session, object)) refuse("A client can write only to an object that it holds (user-model.md Z3).");
    if (!this.mayWrite(session, object, key, value)) {
      refuse("The user may not write " + (key === undefined ? "this object" : "\"" + String(key) + "\"") + " (user-model.md Z2).");
    }
    for (const referred of referencesIn(value, [])) {
      if (model.identityOf(referred) === undefined) continue; // made by the client itself
      if (!this.knows(session, referred)) refuse("A client can refer only to an object that it knows of (user-model.md Z4).");
    }
  }

  /*------------------------------------------------------------------
   *  Subscriptions (user-model.md section 8)
   *-----------------------------------------------------------------*/

  /**
   * Registers a selector under a name, by which clients subscribe (whitepaper section 3.4): a
   * table of local rules by class name. With `{ whole: true }`, its selection is computed
   * from nothing each time anything it read changes, as one repeater; otherwise each rule is a
   * repeater of its own, and a change runs the rule of the changed object only. The two give
   * the same selection (selections.md R1), so a selector can start out whole.
   */
  registerSelector(name, rules, { whole = false } = {}) {
    if (typeof(name) !== "string" || name === "") throw new Error("A selector is registered under a name.");
    if (rules === null || typeof(rules) !== "object") throw new Error("A selector is a table of rules by class name.");
    if (this.selectors.has(name)) throw new Error("A selector is already registered as \"" + name + "\".");
    this.selectors.set(name, { name, rules, whole });
  }

  /**
   * Subscribes a session to what a selector selects from an object it knows of and may read.
   * `selector` is the name of a registered selector, as a client gives it, or a table of rules,
   * for server code. The selection passes only through objects the user may read, takes the
   * parts of what it selects along, and follows both the data and the rights as they change.
   *
   * Options: `sub`, the subscription's number, which the client chooses, unique within the
   * session (one is given if it is left out); and `whole`, for a table of rules.
   *
   * Returns `{ sub, selector, root, selection, release() }`.
   */
  subscribe(target, start, selector, options = {}) {
    const state = viewOf(target);
    const session = state.session;
    let entry;
    if (typeof(selector) === "string") {
      entry = this.selectors.get(selector);
      if (entry === undefined) throw new AuthorizationError("No selector is registered as \"" + selector + "\" (selections.md N1).");
    } else if (selector !== null && typeof(selector) === "object") {
      entry = { name: null, rules: selector, whole: options.whole === true };
    } else {
      throw new Error("A subscription's selector is the name of a registered selector, or a table of rules by class name.");
    }
    if (!this.knows(state, start)) throw new AuthorizationError("A client can subscribe only from an object that it knows of (user-model.md S1).");
    if (!this.mayRead(state, start)) throw new AuthorizationError("The user may not read the object to subscribe from (user-model.md S2).");
    if (session.maySubscribe(entry.name, start) !== true) throw new AuthorizationError("The session does not allow this subscription (selections.md N2).");
    const sub = options.sub === undefined ? state.nextSub++ : options.sub;
    if (state.subs.has(sub)) throw new Error("There is a subscription numbered " + String(sub) + " already.");

    const subscription = {
      sub,
      selector: entry.name,
      whole: entry.whole,
      root: start,
      handle: null,
      get selection() { return subscription.handle.selection; },
      release: () => {
        if (!state.subscriptions.has(subscription)) return;
        state.subscriptions.delete(subscription);
        state.subs.delete(sub);
        subscription.handle.release();
      },
    };
    state.subscriptions.add(subscription);
    state.subs.set(sub, subscription);
    const filter = (object) => this.mayRead(state, object);
    const onChange = (joined, left) => this.selectionChanged(state, subscription, joined, left);
    try {
      subscription.handle = entry.whole
        ? this.well.load(start, (from, selection) => wholeSelection(this.well, from, entry.rules, filter, selection), { onChange })
        : this.well.load(start, withParts(this.well, entry.rules), { filter, onChange });
      subscription.handle.rules = entry.rules;
    } catch (error) {
      state.subscriptions.delete(subscription);
      state.subs.delete(sub);
      throw error;
    }
    return subscription;
  }

  subscriptionsOf(target) {
    return [...viewOf(target).subscriptions];
  }

  /** The subscription of a session with a given number, or undefined. */
  subscription(target, sub) {
    return viewOf(target).subs.get(sub);
  }

  /** The numbers of the subscriptions of a session that hold an object, in order. */
  subscriptionsHolding(target, object) {
    const holders = viewOf(target).holders.get(object);
    return holders === undefined ? [] : [...holders].map((subscription) => subscription.sub).sort(compareSubs);
  }

  /**
   * What a session's subscriptions hold, as its client should know it: for each object held
   * through a subscription, by identity, the numbers of the subscriptions that hold it. For
   * tests and diagnosis.
   */
  membershipsOf(target) {
    const memberships = new Map();
    for (const object of viewOf(target).holders.keys()) {
      const id = model.identityOf(object);
      if (id !== undefined) memberships.set(id, this.subscriptionsHolding(target, object));
    }
    return memberships;
  }

  /**
   * The selection of a subscription computed from nothing, with the rights as they are now:
   * what the incremental one must equal (selections.md R1). For tests and diagnosis.
   */
  recomputeSelection(target, subscription) {
    const entry = subscription.selector === null ? null : this.selectors.get(subscription.selector);
    const rules = entry !== null ? entry.rules : subscription.handle.rules;
    return world.withoutRecording(() => wholeSelection(this.well, subscription.root, rules, (object) => this.mayRead(target, object)));
  }
}

function compareSubs(a, b) {
  return typeof(a) === "number" && typeof(b) === "number" ? a - b : String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}

export function createFountain(options) {
  return new Fountain(options);
}

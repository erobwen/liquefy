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

export { AuthenticationError, jwtVerifier };

export class AuthorizationError extends Error {
  constructor(message) {
    super(message);
    this.name = "AuthorizationError";
  }
}

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
 * What the server keeps about a session that is not synchronized state:
 *
 *   grants         objects the session may read, whatever their canRead says (M5)
 *   subscriptions  its subscriptions
 *   holders        held object → the subscriptions whose selections contain it
 *   outgoing       held object, or the session → the identities it refers to
 *   incoming       identity → how many held objects, and the session, refer to it
 *
 * The last three are what "holds" and "knows of" are answered from, without looking through
 * anything (user-model.md section 8). They are kept up to date as selections change, through
 * Deepwell's onChange, and as what is held is written, through its commits.
 */
const sessionStates = new WeakMap();

function stateSession(state) {
  return state.session;
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
const NOT_REMOTE = new Set(["constructor", "mayCreateUsers", "grant", "afterCommit", "canRead", "canWrite"]);

/*------------------------------------------------------------------
 *  Fountain
 *-----------------------------------------------------------------*/

let registered = false;

/** Whether an object is neither an instance of an application class, nor Fountain's: an array, or a classless object. */
function isPart(object) {
  if (Array.isArray(object)) return true;
  const prototype = Object.getPrototypeOf(object);
  return prototype === Object.prototype || prototype === null;
}

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
  const target = world.innerMeta(object).target;
  if (Array.isArray(target)) {
    for (const item of target) add(item);
    return ids;
  }
  for (const key of Object.keys(target)) {
    const descriptor = Object.getOwnPropertyDescriptor(target, key);
    if (descriptor.get && descriptor.get.encoded !== undefined) encodedReferences(descriptor.get.encoded, ids);
    else add(descriptor.value);
  }
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
  constructor({ well, Session: SessionClass = Session, superUser, identityProviders = {}, externalUser = null, scrypt = DEFAULT_SCRYPT, tokenLifetime = 30 * 24 * 60 * 60 * 1000, now = () => Date.now() } = {}) {
    if (!well) throw new Error("createFountain() needs a Deepwell store: { well }.");
    if (SessionClass !== Session && !(SessionClass.prototype instanceof Session)) throw new Error("A Fountain's session class extends Session.");
    if (!registered) {
      registerClasses({ "Fountain.User": User, "Fountain.Account": Account, "Fountain.Identity": Identity, "Fountain.Token": Token,
        "Fountain.AccountsByName": AccountsByName, "Fountain.IdentitiesBySubject": IdentitiesBySubject, "Fountain.TokensByHash": TokensByHash,
        "Fountain.State": FountainState, "Fountain.Session": Session });
      registered = true;
    }
    this.well = well;
    this.Session = SessionClass;
    this.identityProviders = identityProviders;
    this.externalUser = externalUser;
    this.scrypt = scrypt;
    this.tokenLifetime = tokenLifetime;
    this.now = now;
    this.actor = null; // the session whose user is acting, or null: the system, with full access
    this.sessions = new Map(); // user → the sessions that are signed in as that user
    this.decoyPassword = hashPassword(newToken(), scrypt);
    this.watchers = new WeakMap(); // object → the states of the sessions that hold it, or are it

    // What a held object refers to changes when it is written: what the sessions that hold it
    // know of changes with it. Read once the transaction is stored, and its new objects have
    // their identities.
    this.removeCommitListener = well.onCommit((change) => {
      for (const object of change.changed) {
        const states = this.watchers.get(object);
        if (states !== undefined) for (const state of [...states]) this.retrack(state, object);
      }
    });

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
    this.removeCheck();
    this.removeCommitListener();
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
    const state = { fountain: this, grants: new Set(), subscriptions: new Set(), effects: [], token: null, holders: new Map(), outgoing: new Map(), incoming: new Map() };
    state.session = session;
    sessionStates.set(session, state);
    this.well.volatile(session);
    this.track(state, session); // a session knows of what it refers to (S1)
    return session;
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
    for (const object of joined) {
      let holders = state.holders.get(object);
      if (holders === undefined) {
        state.holders.set(object, holders = new Set());
        if (!state.outgoing.has(object)) this.track(state, object);
      }
      holders.add(subscription);
    }
    for (const object of left) {
      const holders = state.holders.get(object);
      if (holders === undefined) continue;
      holders.delete(subscription);
      if (holders.size > 0) continue;
      state.holders.delete(object);
      if (object !== stateSession(state)) this.untrack(state, object);
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
    this.setUser(session, account.user);
    return token;
  }

  /** Ends a session's sign-in: no user, no subscriptions, no grants. With `forget`, its token ends too. */
  unbind(session, forget) {
    const state = stateOf(session);
    for (const subscription of [...state.subscriptions]) subscription.release();
    state.grants.clear();
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
  call(session, name, args = []) {
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
  mayRead(session, object) {
    if (isPart(object)) return true; // delivered as a part of what it is reached through (Z5)
    if (isServerOnly(object)) return false;
    if (object instanceof Session) return object === session;
    const user = session.user;
    if (this.isSuperUser(user)) return true;
    if (stateOf(session).grants.has(object)) return true;
    return typeof(object.canRead) === "function" ? object.canRead(user) === true : true;
  }

  /** Whether a session's user may write a property of an object it holds. */
  mayWrite(session, object, property, value) {
    const user = session.user;
    if (isPart(object)) {
      // An array or a classless object is written under the roots through which it is held.
      const roots = this.rootsHolding(session, object);
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
  rootsHolding(session, object) {
    const holders = stateOf(session).holders.get(object);
    return holders === undefined ? [] : [...holders].map((subscription) => subscription.root);
  }

  /** Whether a session holds an object: it is the session itself, or in one of its selections. */
  holds(session, object) {
    return object === session || stateOf(session).holders.has(object);
  }

  /**
   * Whether a session knows of an object: it holds it, was granted it, or it or an object it
   * holds refers to it. A client can refer to, and subscribe from, what it knows of only.
   * Knowing of an object says nothing of whether it may be read (user-model.md E1).
   */
  knows(session, object) {
    const state = stateOf(session);
    if (this.holds(session, object) || state.grants.has(object)) return true;
    const id = model.identityOf(object);
    return id !== undefined && state.incoming.has(id);
  }

  /**
   * Runs `action` as the user of a session: every write it makes to an object of the store is
   * a client's write, and is asked about (Z1 to Z4). It is one transaction, made whole or not
   * at all.
   */
  as(session, action) {
    stateOf(session);
    const actor = this.actor;
    this.actor = session;
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
   * Subscribes a session to what a table of rules selects from an object it knows of and may
   * read. The selection passes only through objects the user may read, and follows both the
   * data and the rights as they change. Returns `{ root, selection, release() }`.
   */
  subscribe(session, start, rules) {
    const state = stateOf(session);
    if (rules === null || typeof(rules) !== "object") throw new Error("A subscription's selector is a table of rules by class name.");
    if (!this.knows(session, start)) throw new AuthorizationError("A client can subscribe only from an object that it knows of (user-model.md S1).");
    if (!this.mayRead(session, start)) throw new AuthorizationError("The user may not read the object to subscribe from (user-model.md S2).");
    const subscription = {
      root: start,
      handle: null,
      get selection() { return subscription.handle.selection; },
      release: () => {
        state.subscriptions.delete(subscription);
        subscription.handle.release();
      },
    };
    state.subscriptions.add(subscription);
    subscription.handle = this.well.load(start, rules, {
      filter: (object) => this.mayRead(session, object),
      onChange: (joined, left) => this.selectionChanged(state, subscription, joined, left),
    });
    return subscription;
  }

  subscriptionsOf(session) {
    return [...stateOf(session).subscriptions];
  }
}

export function createFountain(options) {
  return new Fountain(options);
}

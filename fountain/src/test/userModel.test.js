import assert from "assert";
import { generateKeyPairSync, createSign, createHmac } from "node:crypto";
import { MemoryStore } from "@liquefy/aquifer";
import { open, transaction, Synchronized, synchronized, registerClasses } from "@liquefy/deepwell";
import { createFountain, Session, User, Account, AuthorizationError, AuthenticationError, jwtVerifier } from "../index.js";

class Document extends Synchronized {
  constructor(owner, title) {
    super();
    this.owner = owner;
    this.title = title;
    this.isPublic = false;
    this.paragraphs = synchronized([]);
    this.settings = synchronized({ margin: 20 });
  }
  canRead(user) { return this.isPublic || this.owner === user; }
  canWrite(user, property, value) {
    if (property === "title" && typeof(value) !== "string") return false; // validation is the same mechanism
    return this.owner === user;
  }
}
class Note extends Synchronized {
  constructor(text) {
    super();
    this.text = text;
  }
}
class AppSession extends Session {
  documentCount() { return this.fountain.well.root.documents.length; }
  createDocument(title) {
    const document = new Document(this.user, title);
    this.fountain.well.root.documents.push(document);
    return document;
  }
  failHalfway(document) {
    document.title = "half";
    throw new Error("Halfway.");
  }
  share(document) { this.grant(document); return document; }
  notify(log) { this.afterCommit(() => log.push("sent")); log.push("registered"); }
  mayCreateUsers() { return super.mayCreateUsers() || (this.user !== null && this.user.isAdministrator === true); }
}
registerClasses({ Document, Note });

const SCRYPT = { N: 1 << 10, r: 8, p: 1 }; // cheap, for tests
const selectDocument = { Document: (document, selection) => selection.add(document.paragraphs, document.settings) };

const opened = [];
function setUp(options = {}) {
  const store = options.store || new MemoryStore();
  const well = open({ store });
  const fountain = createFountain({ well, Session: AppSession, superUser: { name: "admin", password: "secret" }, scrypt: SCRYPT, ...options.fountain });
  opened.push({ well, fountain });
  if (well.root.documents === undefined) well.root.documents = synchronized([]);
  return { well, fountain, store };
}
afterEach(() => { while (opened.length) { const { well, fountain } = opened.pop(); fountain.close(); well.close(); } });

function signedIn(fountain, name, password) {
  const session = fountain.createSession();
  assert.notEqual(fountain.call(session, "signIn", [name, password]), null);
  return session;
}

function withUsers(fountain) {
  const admin = signedIn(fountain, "admin", "secret");
  const alice = fountain.call(admin, "createUser", [{ name: "alice", password: "alice-pw" }]);
  const bob = fountain.call(admin, "createUser", [{ name: "bob", password: "bob-pw" }]);
  return { admin, alice, bob, aliceSession: signedIn(fountain, "alice", "alice-pw"), bobSession: signedIn(fountain, "bob", "bob-pw") };
}

describe("users and the super user", function () {

  it("makes a new database with one user, the super user", function () {
    const { fountain, well } = setUp();
    assert.ok(fountain.superUser instanceof User);
    assert.equal(fountain.superUser.name, "admin");
    assert.equal(fountain.isSuperUser(fountain.superUser), true);
    assert.equal(well.isStored(fountain.superUser), true);
    assert.throws(() => createFountain({ well: open({ store: new MemoryStore() }) }), /needs its super user/);
  });

  it("finds the same users when the database is opened again", function () {
    const { fountain, well, store } = setUp();
    withUsers(fountain);
    fountain.close();
    well.close();
    opened.pop();
    const again = setUp({ store, fountain: { superUser: undefined } });
    assert.equal(again.fountain.superUser.name, "admin");
    const session = signedIn(again.fountain, "alice", "alice-pw");
    assert.equal(session.user.name, "alice");
  });

  it("stores a hash of the password, never the password", function () {
    const { fountain } = setUp();
    const account = fountain.superUser.account;
    assert.ok(account instanceof Account);
    assert.equal(JSON.stringify(account.password).includes("secret"), false);
    assert.equal(typeof(account.password.hash), "string");
    assert.notEqual(account.password.salt, withUsers(fountain).alice.account.password.salt, "a salt of its own for each");
  });

  it("keeps names to sign in by unique", function () {
    const { fountain } = setUp();
    const { admin } = withUsers(fountain);
    assert.throws(() => fountain.call(admin, "createUser", [{ name: "alice", password: "x" }]), AuthenticationError);
  });

  it("lets the super user create users, and whoever the application allows", function () {
    const { fountain } = setUp();
    const { admin, alice, aliceSession, bobSession } = withUsers(fountain);
    assert.throws(() => fountain.call(aliceSession, "createUser", [{ name: "carol", password: "x" }]), AuthorizationError);
    assert.throws(() => fountain.call(fountain.createSession(), "createUser", [{ name: "carol", password: "x" }]), AuthorizationError);
    alice.isAdministrator = true;
    const carol = fountain.call(aliceSession, "createUser", [{ name: "carol", password: "x", team: "blue" }]);
    assert.equal(carol.team, "blue");
    assert.equal(bobSession.user.name, "bob");
    assert.equal(admin.user, fountain.superUser);
  });
});

describe("signing in", function () {

  it("starts anonymous, and binds the session to a user", function () {
    const { fountain, well } = setUp();
    const session = fountain.createSession();
    assert.equal(session.user, null);
    assert.equal(well.isVolatile(session), true);
    assert.equal(fountain.call(session, "signIn", ["admin", "wrong"]), null);
    assert.equal(fountain.call(session, "signIn", ["nobody", "secret"]), null);
    assert.equal(session.user, null);
    const token = fountain.call(session, "signIn", ["admin", "secret"]);
    assert.equal(typeof(token), "string");
    assert.equal(session.user, fountain.superUser);
    assert.deepEqual(fountain.sessionsOf(fountain.superUser), [session]);
  });

  it("takes a sign-in up again with its token, and not with any other", function () {
    const { fountain } = setUp();
    const first = fountain.createSession();
    const token = fountain.call(first, "signIn", ["admin", "secret"]);
    const second = fountain.createSession();
    assert.equal(fountain.call(second, "resume", ["not-a-token"]), false);
    assert.equal(fountain.call(second, "resume", [token]), true);
    assert.equal(second.user, fountain.superUser);
    assert.equal(JSON.stringify(fountain.superUser.account.tokens.map((stored) => stored.hash)).includes(token), false, "the token itself is not stored");
  });

  it("ends a token when it is signed out, and when it is old", function () {
    let time = 1000;
    const { fountain } = setUp({ fountain: { now: () => time, tokenLifetime: 500 } });
    const session = fountain.createSession();
    const token = fountain.call(session, "signIn", ["admin", "secret"]);
    fountain.call(session, "signOut");
    assert.equal(session.user, null);
    assert.equal(fountain.call(fountain.createSession(), "resume", [token]), false);
    const later = fountain.call(session, "signIn", ["admin", "secret"]);
    time += 501;
    assert.equal(fountain.call(fountain.createSession(), "resume", [later]), false);
    assert.equal(fountain.superUser.account.tokens.length, 0);
  });

  it("changes a password, for the one who knows the present one", function () {
    const { fountain } = setUp();
    const { aliceSession } = withUsers(fountain);
    assert.equal(fountain.call(aliceSession, "changePassword", ["wrong", "new-pw"]), false);
    assert.equal(fountain.call(aliceSession, "changePassword", ["alice-pw", "new-pw"]), true);
    assert.equal(fountain.call(fountain.createSession(), "signIn", ["alice", "alice-pw"]), null);
    assert.notEqual(fountain.call(fountain.createSession(), "signIn", ["alice", "new-pw"]), null);
  });

  it("ends the sessions of a user who is disabled, and their tokens", function () {
    const { fountain } = setUp();
    const { alice } = withUsers(fountain);
    const session = fountain.createSession();
    const token = fountain.call(session, "signIn", ["alice", "alice-pw"]);
    fountain.disable(alice);
    assert.equal(session.user, null);
    assert.deepEqual(fountain.sessionsOf(alice), []);
    assert.equal(fountain.call(fountain.createSession(), "resume", [token]), false);
    assert.equal(fountain.call(fountain.createSession(), "signIn", ["alice", "alice-pw"]), null);
    fountain.enable(alice);
    assert.notEqual(fountain.call(fountain.createSession(), "signIn", ["alice", "alice-pw"]), null);
  });
});

describe("signing in through an external login service", function () {
  const issuer = "https://login.example.com";
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const part = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  function token(claims, { alg = "RS256", kid = "k1", key = privateKey } = {}) {
    const input = part({ alg, kid, typ: "JWT" }) + "." + part(claims);
    const signature = alg === "HS256"
      ? createHmac("sha256", key).update(input).digest("base64url")
      : createSign("RSA-SHA256").update(input).sign(key).toString("base64url");
    return input + "." + signature;
  }
  const now = 1_700_000_000_000;
  const good = { iss: issuer, aud: "app", sub: "u-17", exp: now / 1000 + 600, email: "ann@example.com" };
  const verifier = jwtVerifier({ issuer, audience: "app", keys: { k1: publicKey }, now: () => now });

  it("verifies the signature, the issuer, the audience and the time", function () {
    assert.equal(verifier(token(good)).subject, "u-17");
    assert.throws(() => verifier(token({ ...good, iss: "https://evil.example.com" })), /another issuer/);
    assert.throws(() => verifier(token({ ...good, aud: "other" })), /another audience/);
    assert.throws(() => verifier(token({ ...good, exp: now / 1000 - 600 })), /expired/);
    assert.throws(() => verifier(token({ ...good, nbf: now / 1000 + 600 })), /not valid yet/);
    assert.throws(() => verifier(token(good, { kid: "unknown" })), /not known/);
    const other = generateKeyPairSync("rsa", { modulusLength: 2048 });
    assert.throws(() => verifier(token(good, { key: other.privateKey })), /signature/);
    const [header, payload, signature] = token(good).split(".");
    assert.throws(() => verifier(header + "." + part({ ...good, sub: "u-1" }) + "." + signature), /signature/);
    assert.equal(payload.length > 0, true);
  });

  it("refuses a token that chooses its own algorithm", function () {
    // The classic attack: sign with HS256, using the public key as the shared secret.
    const pem = publicKey.export({ type: "spki", format: "pem" });
    assert.throws(() => verifier(token(good, { alg: "HS256", key: pem })), /algorithm/);
    assert.throws(() => verifier(part({ alg: "none" }) + "." + part(good) + "."), /algorithm/);
  });

  it("signs in the user recorded for the issuer and subject", function () {
    const { fountain } = setUp({ fountain: { identityProviders: { [issuer]: verifier } } });
    const { alice } = withUsers(fountain);
    const session = fountain.createSession();
    assert.equal(fountain.call(session, "signInWith", [issuer, token(good)]), null, "not known here, and none is made");
    fountain.addIdentity(alice, issuer, "u-17");
    assert.equal(typeof(fountain.call(session, "signInWith", [issuer, token(good)])), "string");
    assert.equal(session.user, alice);
    assert.throws(() => fountain.call(session, "signInWith", ["https://other.example.com", token(good)]), AuthenticationError);
    assert.throws(() => fountain.addIdentity(fountain.superUser, issuer, "u-17"), AuthenticationError);
  });

  it("makes a user for an unknown subject if the application says so", function () {
    const { fountain } = setUp({ fountain: { identityProviders: { [issuer]: verifier }, externalUser: (from, claims) => ({ name: claims.email }) } });
    const session = fountain.createSession();
    assert.equal(typeof(fountain.call(session, "signInWith", [issuer, token(good)])), "string");
    assert.equal(session.user.name, "ann@example.com");
    const again = fountain.createSession();
    fountain.call(again, "signInWith", [issuer, token(good)]);
    assert.equal(again.user, session.user, "the same user the second time");
    assert.equal(fountain.call(fountain.createSession(), "signIn", ["ann@example.com", ""]), null, "such a user has no password to sign in with");
  });
});

describe("the session's remote methods", function () {

  it("are the methods of the application's session class, and the base class's own few", function () {
    const { fountain } = setUp();
    assert.deepEqual(fountain.remoteMethods(), ["changePassword", "createDocument", "createUser", "documentCount", "failHalfway", "notify", "resume", "share", "signIn", "signInWith", "signOut"]);
    const session = fountain.createSession();
    for (const name of ["grant", "afterCommit", "mayCreateUsers", "constructor", "toString", "hasOwnProperty", "fountain", "user"]) {
      assert.throws(() => fountain.call(session, name, []), AuthorizationError, name);
    }
  });

  it("run with full access, whatever the user may do", function () {
    const { fountain, well } = setUp();
    const { alice, bobSession } = withUsers(fountain);
    well.root.documents.push(new Document(alice, "Private"));
    assert.equal(fountain.call(bobSession, "documentCount"), 1);
    const made = fountain.call(bobSession, "createDocument", ["Bob's"]);
    assert.equal(made.owner, bobSession.user);
    assert.equal(well.isStored(made), true);
  });

  it("are made whole or not at all", function () {
    const { fountain, well } = setUp();
    const { alice, aliceSession } = withUsers(fountain);
    const document = new Document(alice, "Whole");
    well.root.documents.push(document);
    const before = well.lastCommit;
    assert.throws(() => fountain.call(aliceSession, "failHalfway", [document]), /Halfway/);
    assert.equal(document.title, "Whole");
    assert.equal(well.lastCommit, before, "nothing was stored");
  });

  it("do what they registered after the commit, and not if they fail", function () {
    const { fountain } = setUp();
    const session = fountain.createSession();
    const log = [];
    fountain.call(session, "notify", [log]);
    assert.deepEqual(log, ["registered", "sent"]);
  });
});

describe("authorization", function () {

  function library(fountain, well) {
    const users = withUsers(fountain);
    const document = new Document(users.alice, "Alice's");
    document.paragraphs.push("One");
    well.root.documents.push(document);
    return { ...users, document };
  }

  it("asks canWrite of a write made as a user, with the property and the value", function () {
    const { fountain, well } = setUp();
    const { aliceSession, bobSession, document } = library(fountain, well);
    fountain.call(aliceSession, "share", [document]);
    const mine = fountain.subscribe(aliceSession, document, selectDocument);
    fountain.as(aliceSession, () => { document.title = "Renamed"; });
    assert.equal(document.title, "Renamed");
    assert.throws(() => fountain.as(aliceSession, () => { document.title = 7; }), AuthorizationError, "a value the class refuses");
    document.isPublic = true;
    fountain.call(bobSession, "share", [document]);
    fountain.subscribe(bobSession, document, selectDocument);
    assert.throws(() => fountain.as(bobSession, () => { document.title = "Bob's now"; }), AuthorizationError);
    assert.equal(document.title, "Renamed");
    mine.release();
  });

  it("does not ask about the super user, nor about the system", function () {
    const { fountain, well } = setUp();
    const { admin, document } = library(fountain, well);
    fountain.call(admin, "share", [document]);
    fountain.subscribe(admin, document, selectDocument);
    fountain.as(admin, () => { document.title = "By the super user"; });
    document.title = "By the system";
    assert.equal(document.title, "By the system");
  });

  it("leaves an object of a class without security methods open to whoever holds it", function () {
    const { fountain, well } = setUp();
    const { bobSession } = withUsers(fountain);
    const note = well.root.note = new Note("open");
    fountain.call(bobSession, "share", [note]);
    fountain.subscribe(bobSession, note, {});
    fountain.as(bobSession, () => { note.text = "edited"; });
    assert.equal(note.text, "edited");
  });

  it("lets a client write only what it holds", function () {
    const { fountain, well } = setUp();
    const { bobSession } = withUsers(fountain);
    const note = well.root.note = new Note("open");
    assert.throws(() => fountain.as(bobSession, () => { note.text = "edited"; }), /holds/);
    assert.equal(note.text, "open");
  });

  it("writes an array or a classless object under the root it is held through", function () {
    const { fountain, well } = setUp();
    const { aliceSession, bobSession, document } = library(fountain, well);
    document.isPublic = true;
    for (const session of [aliceSession, bobSession]) {
      fountain.call(session, "share", [document]);
      fountain.subscribe(session, document, selectDocument);
    }
    fountain.as(aliceSession, () => { document.paragraphs.push("Two"); document.settings.margin = 30; });
    assert.throws(() => fountain.as(bobSession, () => { document.paragraphs.push("Bob's"); }), AuthorizationError);
    assert.throws(() => fountain.as(bobSession, () => { document.settings.margin = 0; }), AuthorizationError);
    assert.deepEqual([...document.paragraphs], ["One", "Two"]);
    assert.equal(document.settings.margin, 30);
  });

  it("lets a client refer only to what it knows of, or has made", function () {
    const { fountain, well } = setUp();
    const { alice, aliceSession, bob } = library(fountain, well);
    const mine = new Document(alice, "Mine");
    const secret = new Document(bob, "Bob's secret");
    well.root.documents.push(mine, secret);
    fountain.call(aliceSession, "share", [mine]);
    fountain.subscribe(aliceSession, mine, selectDocument);
    // A guessed identity, written into a document of her own, would deliver the object as a part of it.
    assert.throws(() => fountain.as(aliceSession, () => { mine.attachment = secret; }), /knows of/);
    assert.throws(() => fountain.as(aliceSession, () => { mine.paragraphs.push(secret); }), /knows of/);
    fountain.as(aliceSession, () => { mine.attachment = new Note("made by the client"); mine.author = alice; });
    assert.equal(mine.attachment.text, "made by the client");
  });

  it("undoes the whole of a client's transaction when one write is refused", function () {
    const { fountain, well } = setUp();
    const { aliceSession, document } = library(fountain, well);
    fountain.call(aliceSession, "share", [document]);
    fountain.subscribe(aliceSession, document, selectDocument);
    assert.throws(() => fountain.as(aliceSession, () => {
      document.paragraphs.push("Kept?");
      document.title = 7;
    }), AuthorizationError);
    assert.deepEqual([...document.paragraphs], ["One"]);
  });

  it("never lets a client read or write what is the server's only, nor another session", function () {
    const { fountain } = setUp();
    const { admin, alice, aliceSession, bobSession } = withUsers(fountain);
    for (const session of [admin, aliceSession]) {
      assert.equal(fountain.mayRead(session, alice.account), false);
      assert.equal(fountain.mayRead(session, fountain.state), false);
      assert.equal(fountain.mayWrite(session, alice.account, "password", null), false);
    }
    assert.equal(fountain.mayRead(aliceSession, aliceSession), true);
    assert.equal(fountain.mayRead(aliceSession, bobSession), false);
    assert.equal(fountain.mayRead(admin, bobSession), false);
    assert.throws(() => fountain.as(aliceSession, () => { aliceSession.user = fountain.superUser; }), AuthorizationError);
    assert.equal(aliceSession.user, alice);
  });

  it("lets a user write their own fields, but not disable or re-account themselves", function () {
    const { fountain } = setUp();
    const { alice, bob, aliceSession, admin } = withUsers(fountain);
    fountain.subscribe(aliceSession, alice, {});
    fountain.as(aliceSession, () => { alice.name = "Alice A."; });
    assert.throws(() => fountain.as(aliceSession, () => { alice.disabled = true; }), AuthorizationError);
    assert.throws(() => fountain.as(aliceSession, () => { alice.account = null; }), AuthorizationError);
    fountain.call(aliceSession, "share", [bob]);
    fountain.subscribe(aliceSession, bob, {});
    assert.throws(() => fountain.as(aliceSession, () => { bob.name = "Robert"; }), AuthorizationError);
    assert.equal(alice.name, "Alice A.");
    assert.equal(admin.user.disabled, false);
  });
});

describe("subscriptions of a session", function () {

  it("start from what the session knows of, and may read", function () {
    const { fountain, well } = setUp();
    const { alice, aliceSession, bobSession } = withUsers(fountain);
    const document = new Document(alice, "Alice's");
    well.root.documents.push(document);
    assert.throws(() => fountain.subscribe(bobSession, document, selectDocument), /knows of/);
    fountain.call(bobSession, "share", [document]);
    fountain.subscribe(bobSession, document, selectDocument); // granted: a session's method decided
    aliceSession.home = document; // the server gives a root, by referring to it from the session
    const subscription = fountain.subscribe(aliceSession, document, selectDocument);
    assert.deepEqual(new Set(subscription.selection), new Set([document, document.paragraphs, document.settings]));
    assert.equal(fountain.holds(aliceSession, document.paragraphs), true);
    assert.deepEqual(fountain.rootsHolding(aliceSession, document.settings), [document]);
  });

  it("refuse an object that is known of but may not be read", function () {
    const { fountain, well } = setUp();
    const { alice, bobSession } = withUsers(fountain);
    const document = new Document(alice, "Alice's");
    well.root.documents.push(document);
    bobSession.home = document;
    assert.throws(() => fountain.subscribe(bobSession, document, selectDocument), /may not read/);
  });

  it("pass only through objects the user may read, and follow the rights as they change", function () {
    const { fountain, well } = setUp();
    const { alice, bob, bobSession } = withUsers(fountain);
    const folder = well.root.folder = synchronized({ documents: synchronized([]) });
    const open = new Document(alice, "Open");
    open.isPublic = true;
    const closed = new Document(alice, "Closed");
    folder.documents.push(open, closed);
    bobSession.home = folder;
    const rules = {
      Object: (object, selection) => selection.add(object.documents),
      Array: (array, selection) => selection.add(...array),
      Document: selectDocument.Document,
    };
    const subscription = fountain.subscribe(bobSession, folder, rules);
    assert.equal(subscription.selection.has(open), true);
    assert.equal(subscription.selection.has(closed), false);
    assert.equal(subscription.selection.has(closed.paragraphs), false, "nor what is reached only through it");
    closed.owner = bob;
    assert.equal(subscription.selection.has(closed), true, "the right came, and the object with it");
    open.isPublic = false;
    assert.equal(subscription.selection.has(open), false, "the right went, and the object with it");
  });

  it("end when the session signs out", function () {
    const { fountain, well } = setUp();
    const { alice, aliceSession } = withUsers(fountain);
    const document = new Document(alice, "Alice's");
    well.root.documents.push(document);
    aliceSession.home = document;
    fountain.subscribe(aliceSession, document, selectDocument);
    fountain.call(aliceSession, "signOut");
    assert.deepEqual(fountain.subscriptionsOf(aliceSession), []);
    assert.equal(fountain.holds(aliceSession, document), false);
    assert.equal(well.holdsOf(document), 0);
  });
});

describe("what a session knows of", function () {

  it("follows what the objects it holds refer to, as they are written", function () {
    const { fountain, well } = setUp();
    const { alice, aliceSession } = withUsers(fountain);
    const document = new Document(alice, "Alice's");
    const other = new Note("elsewhere");
    well.root.documents.push(document);
    well.root.other = other;
    aliceSession.home = document;
    fountain.subscribe(aliceSession, document, selectDocument);
    assert.equal(fountain.knows(aliceSession, other), false);
    document.related = other; // the system refers to it from what she holds
    assert.equal(fountain.knows(aliceSession, other), true);
    delete document.related;
    assert.equal(fountain.knows(aliceSession, other), false);
    document.paragraphs.push(other); // and through a part of it
    assert.equal(fountain.knows(aliceSession, other), true);
  });

  it("forgets what a subscription brought when it is released", function () {
    const { fountain, well } = setUp();
    const { alice, aliceSession } = withUsers(fountain);
    const document = new Document(alice, "Alice's");
    document.related = well.root.other = new Note("referred to");
    well.root.documents.push(document);
    fountain.call(aliceSession, "share", [document]);
    const subscription = fountain.subscribe(aliceSession, document, selectDocument);
    assert.equal(fountain.knows(aliceSession, document.related), true);
    subscription.release();
    assert.equal(fountain.knows(aliceSession, document.related), false);
    assert.equal(fountain.knows(aliceSession, document), true, "still granted");
  });

  it("does not reach inside an object the user may not read: the two step rule", function () {
    const { fountain, well } = setUp();
    const { alice, bobSession } = withUsers(fountain);
    // The folder is open: Bob may see that the closed document exists, as one sees a door
    // marked "staff only". What is behind that door, he may not know exists.
    const folder = well.root.folder = synchronized({ documents: synchronized([]) });
    const closed = new Document(alice, "Closed");
    const hidden = new Note("behind the door");
    closed.attachment = hidden;
    folder.documents.push(closed);
    bobSession.home = folder;
    fountain.subscribe(bobSession, folder, { Object: (object, selection) => selection.add(object.documents), Array: (array, selection) => selection.add(...array) });
    assert.equal(fountain.knows(bobSession, closed), true, "its existence is visible");
    assert.equal(fountain.mayRead(bobSession, closed), false, "its contents are not");
    assert.equal(fountain.knows(bobSession, hidden), false, "and what is inside it does not exist for him");
    assert.throws(() => fountain.subscribe(bobSession, hidden, {}), /knows of/);
  });

  it("knows of what its own session refers to, as the server changes it", function () {
    const { fountain, well } = setUp();
    const { aliceSession } = withUsers(fountain);
    const note = well.root.note = new Note("given");
    assert.equal(fountain.knows(aliceSession, note), false);
    aliceSession.home = note;
    assert.equal(fountain.knows(aliceSession, note), true);
    aliceSession.home = null;
    assert.equal(fountain.knows(aliceSession, note), false);
  });
});

# The user model

*Specification, draft. Part of [Fountain](../README.md). It details [the whitepaper](../whitepaper.md), section 4, for the fourth step of its roadmap: users, the super user, sessions, signing in, the session's remote methods, and authorization. It is implemented in `src/index.js` and `src/credentials.js`, on [Deepwell](../../deepwell#readme).*

This document states what a user and a session are, how a session comes to act as a user, what a client can make the server do, and what is asked before a client's write is made. Each rule that can be checked is stated as an invariant, with who maintains it and how it is verified, in the style of Deepwell's [data model](../../deepwell/documents/data-model.md).

There is no network in this step. What a client will do through [the protocol](protocol.md), it does here through two functions: `fountain.call(session, name, args)`, for a call to a method of the session, and `fountain.as(session, action)`, for writes. Server code and tests act as users the same way (whitepaper section 4.5, "Code that no client called"). What is not done is listed in section 9.

---

# 1. Terms

- **User.** A stored object of the class `User`, or of a class of the application's that extends it.
- **Super user.** The one user a new database is made with.
- **Account.** What a user signs in with: a stored object that no client can read.
- **Session.** One sign-in: a volatile object, of the application's class that extends `Session`. Its `user` is the user that is signed in, or null.
- **Anonymous.** A session whose user is null.
- **The system.** Code that runs as no user, with full access: the application's server code, a session's methods, migrations, indexes, the collector.
- **Acting as a user.** Code that runs inside `fountain.as(session, ...)`: its writes are a client's writes.
- **Part.** A synchronized array, or a synchronized object without a class. It has no methods, and so no security methods of its own.
- **Holds.** A session holds an object that is in the selection of one of its subscriptions, and it holds itself.
- **Knows of.** A session knows of an object that it holds, that it was granted, or that the session itself, or an object it holds, refers to.
- **Server only.** A class with `static serverOnly = true`. No client reads or writes an object of it, whoever its user is.

---

# 2. Users

```javascript
const fountain = createFountain({ well, Session: AppSession, superUser: { name: "admin", password } });
```

**U1. A user is an ordinary stored object.** A user has an identity, is referred to like any object, and is given to the authorization methods, which compare it with references in the data. `name` is what the user is shown as, and `disabled` whether the user is kept from signing in. An application adds fields of its own.

**U2. What a user signs in with is kept apart.** A user's account holds the name the user signs in by, the hash of the password, the user's identities at external login services, and the tokens issued. `Account`, `Identity` and `Token` are server only, and so are Fountain's indexes of them and its own object at `root.fountain`. A user refers to its account, so a client that holds a user knows that the account exists, and nothing else of it (E1). What the account refers to, the identities and the tokens, is behind it, and does not exist for any client.
*Maintained by:* `mayRead` and `mayWrite`, which answer no for a server-only class before anything else is asked. *Verified by:* a test that asks for every session, the super user's among them.

**U3. A new database has one user, the super user.** `createFountain` on a database without `root.fountain` makes it, with a super user of the name and password given, and refuses to make it without them. On a database that has it, the super user is the one that was made.
*Verified by:* tests of a new database, and of one that is opened again.

**U4. The authorization methods are not asked about the super user.** The super user may read and write everything that is not server only, and may create users.

**U5. Names to sign in by are unique.** No two accounts have the same name. Creating a user checks, and makes the user, in one transaction on the server, which is what makes a rule across several objects hold (whitepaper section 4.5).
*Maintained by:* `makeUser`, with Fountain's index of accounts by name. *Verified by:* a test.

**U6. A user decides over their own fields, and not over Fountain's.** `User.canWrite` allows a user to write their own fields, except `disabled` and `account`. An application that extends `User` may decide otherwise.

---

# 3. Sessions

**N1. A session is a volatile object.** It is synchronized, and never stored (Deepwell's design, section 2). It is gone after a restart; what survives is the token (A4).

**N2. A session starts anonymous.** `fountain.createSession()` makes a session whose user is null. Only signing in, by one of the ways of section 4, gives it a user; `fountain.sessionFor(user)` does for server code that is to act as a user.

**N3. A client reads its own session, and no other, and writes none.** `mayRead` of a session is true for that session only, the super user's included. No client writes a field of a session: what a session's fields hold is decided by the server.
*Verified by:* a test.

**N4. A session's sign-in ends as a whole.** When a session is signed out, or signed in anew, or its user is disabled, its subscriptions are released, its grants forgotten, and its user is null, together.
*Maintained by:* `unbind`. *Verified by:* tests of signing out and of disabling a user.

**N5. Disabling a user ends everything of theirs.** Every session of the user ends (N4), every token of theirs is forgotten, and no sign-in of theirs succeeds until they are enabled again.

A connection, which lasts for one browser tab and holds the order of a client's messages, belongs to the protocol, and is not in this step.

---

# 4. Signing in

Signing in is a call to a method of the session. Each way ends in the same place: the session's `user` is set, and a token is returned for the client to keep.

**A1. A password is stored as a slow, salted hash.** The account holds the salt, the cost and the hash of scrypt, and never the password. Each password has a salt of its own. The cost is the Fountain's to set, and is stored with each hash, so that it can be raised without the old hashes failing.
*Verified by:* a test that looks for the password in what is stored.

**A2. A failed sign-in says nothing of why.** `signIn` returns null whether the name is unknown, the password wrong, the user disabled, or the user one that has no password. A hash is computed in every case, so the time it takes does not say whether the name exists.

**A3. An access token from an external login service is verified before it is believed.** `signInWith(issuer, accessToken)` gives the token to the verifier the Fountain was given for that issuer. `jwtVerifier` makes one for JSON Web Tokens: it checks the signature, with a key the application gave for the issuer; that the algorithm is one the verifier accepts, never one the token chose; the issuer; the audience; and the time. The user is the one recorded for that issuer and subject. If there is none, one is made only if the application gave a function that says with which fields; otherwise the sign-in fails.
Fetching an issuer's keys is the application's: Fountain verifies without waiting.
*Verified by:* tests of each check, of a token signed with HS256 using the public key as the secret, and of a token with no algorithm.

**A4. A token stands for a sign-in, and the server keeps only its hash.** A token is 32 random bytes. The server stores its SHA-256 hash, the account, and when it expires. `resume(token)` gives a session the user of a token that is known, not expired, and whose user is not disabled. Signing out forgets the session's token.
*Verified by:* tests of resuming, of a wrong token, of a token after signing out, and of one that is old.

---

# 5. Creating users, and passwords

`session.createUser({ name, password, ...fields })` makes a user who signs in by that name. It is allowed if `session.mayCreateUsers()` says so: by default for the super user only, and for whoever else the application's session class allows.

`session.changePassword(present, next)` changes the password of the user that is signed in, who gives the present one.

`fountain.makeUser`, `fountain.addIdentity`, `fountain.disable` and `fountain.enable` are the same operations for the application's server code, which runs as the system.

---

# 6. The session's remote methods

```javascript
class AppSession extends Session {
    createDocument(title) { ... }      // every method of this class is a remote method
}

fountain.call(session, "createDocument", ["Notes"]);
```

**M1. What a client can call is the methods of the session class, and nothing else.** The remote methods of a session are every method that the application's session class, and its classes down to `Session`, define themselves; and of `Session`, the six it names: `signIn`, `signInWith`, `resume`, `signOut`, `createUser` and `changePassword`. A call to any other name is refused: a method of `Session` that is for the server (`grant`, `afterCommit`, `mayCreateUsers`), a getter, a field, or anything an object inherits.
*Maintained by:* `remoteMethods`, which `call` asks. *Verified by:* a test of the list, and of calls to names that are not on it.

**M2. A session's method is trusted code.** While it runs, nothing is asked: it reads and writes with full access, and decides itself what it returns (whitepaper section 4.5).

**M3. A session's method is made whole or not at all.** It runs as one transaction. If it throws, every write it made is undone, nothing is stored, and the error is the call's.
*Maintained by:* Deepwell's `well.atomic`. *Verified by:* a test of a method that throws after writing.

**M4. External effects happen after the commit.** What a method registers with `session.afterCommit(effect)` is done when the method's transaction has been stored, and not at all if it failed.

**M5. A grant lasts as long as the sign-in.** `session.grant(object)` lets the session read an object whatever its `canRead` says of the user. It ends with the sign-in (N4).

Arguments and results are not yet checked to be data that can be sent; that belongs with the protocol.

---

# 7. Authorization

```javascript
class Document extends Synchronized {
    canRead(user) { return this.isPublic || this.owner === user; }
    canWrite(user, property, value) { return this.owner === user; }
}
```

**Z1. The system is not asked.** A write made outside `fountain.as` is the system's, and is made.

**Z2. A write as a user is asked about before it is made.** Inside `fountain.as(session, ...)`, before every write to an object of the store, in this order:

1. An object of a server-only class, and a session, are never written.
2. The super user may write anything else.
3. An object of a class that defines `canWrite` is written if `canWrite(user, property, value)` is true. For a delete, the value is undefined. A class decides over values as well as over rights this way.
4. An object of a class that defines no `canWrite` is open: whoever holds it may write it.
5. A part is written if one of the roots through which the session holds it has no `canWrite`, or answers true to `canWrite(user)`, with no property.

*Maintained by:* `checkWrite`, which Deepwell asks before every write (its design, section 4). *Verified by:* tests of each case.

**Z3. A client writes only what it holds.** A write as a user to an object that the session does not hold is refused, whatever the object's methods would say.

**Z4. A client refers only to what it knows of, or has made.** A write as a user whose value refers to a stored object, directly or inside a map, a set or a weak reference, is refused unless the session knows of that object. An object the client made itself, which is not yet stored, may be referred to.
*Why:* otherwise a client could write a guessed identity into an object of its own, and be sent the object as a part of it (whitepaper section 4.2).
*Verified by:* a test that tries, through a field and through an array.

**Z5. Reading is asked when a selection is made.** `mayRead(session, object)` is, in this order: false for a server-only class; for a session, whether it is this one; true for the super user; true for an object the session was granted; `canRead(user)` for a class that defines it; and true otherwise. A part is read as a part of what it was reached through: it is asked nothing itself.
On the server, code reads what it likes: `canRead` governs what is delivered, not what server code can see.

**E1. Existence is visible; contents are not. The two step rule hides existence.** Whoever cannot read an object may still know that it exists, and of what class: from a reference held by an object they may read. That holds for every object, and is accepted (whitepaper section 3.4), as a visitor in a shop sees the door marked "staff only". To hide that an object exists, every reference to it is put inside objects that are already protected: a door inside a room the visitor cannot enter. A selection passes only through objects the user may read (S3), so a session never holds an object that it may not read, and does not know of what only such an object refers to.
*Verified by:* a test of an object referred to only from a document the user may not read, which the session does not know of, and cannot subscribe from.

**Z6. A client's transaction is made whole or not at all.** If one write of `fountain.as(session, action)` is refused, every write that `action` made is undone.
*Verified by:* a test.

The authorization methods are asked against the state before the write. They are the application's code, and must not write.

---

# 8. Subscriptions

A subscription is what makes a session hold objects. Selections per session, with their counts and their delivery to clients, are steps of their own in the roadmap; what is here is what authorization needs of them.

```javascript
const subscription = fountain.subscribe(session, document, {
    Document: (document, selection) => selection.add(document.chapters),
    Array: (array, selection) => selection.add(...array),
});
subscription.selection;   // the objects the session holds through it
subscription.release();
```

**S1. A subscription starts from what the session knows of.** The roots of what a client holds come from the server: an object the session's own fields refer to, an object a method of the session granted, or an object that something the session already holds refers to.

**S2. A subscription starts from what the user may read.**

**S3. A selection passes only through what the user may read.** An object that `mayRead` refuses is not in the selection, and neither is anything that is reached through it only.
*Maintained by:* Deepwell's `load`, with `mayRead` as its filter.

**S4. A selection follows the rights as well as the data.** When what `canRead` reads changes, so that its answer changes, the object joins or leaves the selection, with what is reached through it.
*Verified by:* a test that gives a right, and takes one away.

**S5. What a session holds and knows of is kept, not searched for.** For each session, Fountain keeps which subscriptions hold each object, and, for every object it holds and for the session itself, the identities it refers to, with a count of the references to each. Holding, and knowing of an object, are then a look-up. The record follows what joins and leaves each selection (Deepwell's `onChange`), and what is written to the objects held, once each transaction is stored.
These are back-references, which Aquifer does not keep for the whole database, since one object can be referred to by millions. Within what one session holds, they are bounded by the selection.
*Verified by:* tests that write and remove references from what is held, release a subscription, and change the session's own fields.
What is written in a transaction is counted once it is stored, so a client's transaction is checked against what the session knew of when it began.

---

# 9. Not done

- **The protocol:** connections, messages, sending a session and its selections to its clients, and checking that arguments and results are data.
- **Selections per session as the roadmap means them:** named selectors, subscription counts, and telling a client to drop what it no longer may read.
- **Limits** on sign-in attempts and on calls (whitepaper section 8.12).
- **Reporting an authorization method that reads outside the client's selection**, which is the client's side.
- **Keeping an authorization method from writing.**
- **More than one way to sign in by name:** a user has one name to sign in by, and any number of external identities.

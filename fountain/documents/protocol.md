# Protocol

*Specification, draft. Part of [Fountain](../README.md); it details [the whitepaper](../whitepaper.md), sections 3.4 to 3.11, 4.1, 4.5 and 8.14. It is built on [the data model](../../deepwell/documents/data-model.md). What the server implements of it, and where it differs, is in [its status](protocol-status.md).*

This document specifies the conversation between a client and the server: the messages, their order, what each side keeps, how changes travel in both directions, and how a client reconnects. It is the contract between the client store and the server store (whitepaper section 3.8).

Invariants are numbered, with who maintains them and how they are verified. Most are verified by **the simulator**: a test harness that runs one server and several clients in one process, connects them through channels that it can delay, reorder between connections, and cut, drives them with random transactions, subscriptions and calls, and checks the invariants at every quiet point (section 14).

Open points are marked **Open**, and collected in section 15.

---

# 1. Scope and layers

```text
  application code
        |
  client store  ----------- this protocol -----------  server store
  (Cascade world)          one WebSocket per tab        (Fountain, on Deepwell, on Aquifer)
```

Covered here: what travels over the connection, and the state each side keeps in order to send and receive it.

Not covered: how the server evaluates selectors and authorization (it is enough that it can), how the server holds and stores objects (Deepwell and Aquifer, whitepaper section 2.6), and how the client store hooks into Cascade (it uses `onEventGlobal`, `onTransactionEnd` and `meta()`, whitepaper sections 2.4 and 3.8).

---

# 2. Terms

- **Connection.** One WebSocket between one client (a browser tab) and the server. It belongs to a session (whitepaper section 4.1).
- **Session.** A sign-in. Several connections, in several tabs, can belong to one session.
- **Client identity.** A random string that a client chooses once per tab and keeps across reconnections, for example in `sessionStorage`. It names the client's transactions across connections.
- **Stored object** and **volatile object.** A stored object has a record in Aquifer. A volatile object is synchronized but never stored: a session, a connection, a presence object (section 12).
- **Commit.** A transaction applied by the server that changed stored objects. Commits are numbered by one counter for the whole server, increasing, never reused. Changes to volatile objects are not commits and have no number.
- **Client transaction.** The writes a client makes in one Cascade transaction, sent as one message (whitepaper section 3.8). It is named by a **transaction identity** that the client chooses: its client identity, a dot, and a counter.
- **Temporary identity.** The name of an object that a client has made and the server has not yet named: `t` followed by the object's local id ([data model](../../deepwell/documents/data-model.md) section 1). It is unique for the lifetime of the client identity, and never reused.
- **Subscription.** A selector and a starting object, held by a connection, with options. Named by a **subscription number** chosen by the client, unique within the connection.
- **Subscription forest.** A selection is a shallow tree: its starting object is the root, and its members are under it (whitepaper section 3.4). A connection's selections together are its forest. Its roots are what the session refers to and what session methods have returned.
- **Held object.** An object whose fields the client has: the union of its subscriptions' selections. An object that the client knows only by a reference is a **stub** (data model section 7).
- **Saved value.** The value of a field as of the last change the client has received from the server: what the server has, as far as the client knows.
- **Local value.** The value of a field in the client's objects, which application code reads. It differs from the saved value where the client has writes that are not yet confirmed.
- **Pending transaction.** A client transaction that has been sent, or is waiting to be sent, and has neither been confirmed nor refused.

---

# 3. Transport

**T1. One WebSocket per client.** Messages are sent as text frames. Each frame holds one message, a JSON object whose `type` field names its kind. Values inside messages are encoded as in the data model (section 8).

**T2. Order.** Each direction of a connection delivers messages in the order they were sent, without loss or duplication, for as long as the connection lasts. That is what a WebSocket gives. Nothing is assumed across connections: messages sent on a connection that was lost may or may not have arrived.

**T3. Heartbeat.** Either side may send `{ "type": "ping" }`, and the other answers `{ "type": "pong" }`. A side that hears nothing for a configured time considers the connection lost. The server's `pong` carries its latest commit (section 8.4).

**Open.** Whether messages should be compressed, or encoded in a binary format, once the format has settled. JSON first.

---

# 4. Connection lifecycle

```text
client                                   server
  | -- hello ------------------------------> |
  | <------------------------------ welcome -- |   or reload, or refused
  | <------------ volatile (the session) --- |
  | -- subscribe, transaction, call ------> |
  | <-- selection, commit, volatile, result - |
  |                 ...                      |
```

## 4.1 Hello

The client opens the connection and sends:

```json
{
  "type": "hello",
  "protocol": 1,
  "code": "2026-11-25.3",
  "classes": "sha256 of the registered class names and versions",
  "client": "k3f9...",
  "token": "session token, if the client has one",
  "resume": { ... }
}
```

- `protocol`: the version of this protocol.
- `code`: the application's code version (whitepaper section 8.6).
- `classes`: a digest of the registered class names and versions (data model C1, C5), so that the server can tell cheaply whether the client's classes match its own. The session's class is not part of it (section 4.3).
- `client`: the client identity.
- `token`: a session token from an earlier sign-in, if the client has one.
- `resume`: present when the client is reconnecting (section 11).

## 4.2 Welcome, reload, refused

The server answers with exactly one of:

- **`welcome`**: the connection is open.

  ```json
  { "type": "welcome", "commit": 18240, "session": "v81", "methods": ["signIn", "signOut", "publish"] }
  ```

  `commit` is the server's latest commit. `session` is the identity of the session object. `methods` are the names of the session's remote methods (section 9).

- **`reload`**: the client's code is too old, or its classes do not match. The client should reload, and reconnect with new code (whitepaper section 8.6). The server closes the connection.

  ```json
  { "type": "reload", "reason": "classes" }
  ```

- **`refused`**: the token is invalid, the client is over a limit, or the server is shutting down. The server closes the connection.

**L1. Nothing before welcome.** The client sends nothing but `hello` until it has received `welcome`. The server sends nothing but the answer to `hello` before `welcome`.
*Maintained by:* both stores. *Verified:* the simulator, with a protocol checker on every channel.

## 4.3 The session

Immediately after `welcome`, the server delivers the session object to the client, in a `volatile` message (section 12): the session, its connection, its user if any, and whatever fields the application's session class adds. The client did not ask for it, and holds it for as long as the connection is open.

The session's class is server-only code (whitepaper section 4.5). The client does not have it, and does not register it. On the client, the session is an object of a built-in class, with the fields the server delivers, and one method for each name in `methods`, which sends a `call` (section 9).

A client without a token gets an anonymous session. It signs in by calling a session method, which binds the session to a user and returns a token for later connections. Signing in changes the session object, which reaches every client of the session as a `volatile` message.

**Tokens outlive sessions.** A session is not stored, and is gone after a restart. A token is: the server keeps, for each token it has issued and not revoked, a stored record naming the user. A connection that presents a valid token gets a session for that user, made anew if the server has none.

**L2. A client holds its session.** For as long as a connection is open, the client holds its session object, and can read the references it holds to the user's roots (whitepaper section 4.5).

## 4.4 Closing

Either side may close the connection. When a connection closes, the server forgets its subscriptions and what it held, and removes its presence objects (section 12). It keeps only the table of applied transactions (section 10).

---

# 5. What each side keeps

## 5.1 The server, per connection

- The session it belongs to, and its client identity.
- Its subscriptions: number, selector, starting object, options, and the set of identities in the selection.
- The set of objects it holds (the union of its selections), and the set of objects it knows only as stubs.
- The last commit sent to it.

None of this is stored, and none of it outlives the connection.

**K1. The server knows what the client holds.** The server's record of a connection's held objects equals the union of that connection's selections, as of the last message sent to the client.
*Maintained by:* the server store, which updates both together. *Verified:* the simulator (P2).

## 5.2 The server, persistently

- The table of applied transactions (section 10).
- The table of session tokens (section 4.3).
- For each array changed by positional splices, the recent splices committed to it (section 7.3).

## 5.3 The client

- Its objects, in its Cascade world, with their metadata (section 13).
- For each field it has written and not had confirmed: the saved value (`meta(object, field).saved`), and the number of its pending writes (`meta(object, field).saving`).
- For each array with pending changes: a copy of the array as saved, and the pending changes, in order, as sent (section 8.2).
- Its pending transactions, in order.
- For each subscription: its number, selector, starting object, options, and the identities in its selection, as the server last said.
- The last commit received.
- Its map from temporary identities to objects, for objects it has made and the server has not yet named.

For a field without pending writes, the local value is the saved value, and no copy is kept.

---

# 6. Subscriptions

## 6.1 Subscribing

```json
{ "type": "subscribe", "sub": 7, "selector": "document", "start": "n123", "options": { "gated": true } }
```

- `selector`: the name of a registered selector (whitepaper section 3.4). A client names selectors; it does not have their code, and does not run them.
- `start`: the identity of the starting object. It must be an object the client holds or knows as a stub, which includes what its session refers to.
- `options`: `gated` (boolean), `send` (`"immediate"` or `"explicit"`), whitepaper section 3.10. `send` concerns the client only; the server needs `gated`, to check base values.

A client cannot name an object by an identity it has not been given. Identities therefore need not be secret.

**F1. A client reaches only its forest.** A client can subscribe only from an object in its forest or a root it has been given, write only to an object it holds, and write a reference only to an object it holds, knows as a stub, or has made. A message that names any other identity is refused, with reason `missing`, and the refusal does not say whether the identity exists.
*Maintained by:* the server store, which checks every identity in every message against the connection's record (K1). *Verified:* the simulator, with a client that sends identities it was never given, in every place a message can hold one.

The server answers with a `selection`, or with:

```json
{ "type": "subscribeRefused", "sub": 7, "reason": "start" }
```

The session may refuse a selector or a starting object (whitepaper section 4.5), and the server refuses a starting object that the user may not read.

## 6.2 The selection message

```json
{
  "type": "selection",
  "sub": 7,
  "commit": 18240,
  "members": ["n123", "n124", "n130"],
  "objects": [ { "id": "n124", "$class": "Chapter", "$version": 0, "title": "One" } ],
  "stubs": { "n99": "User" }
}
```

- `commit`: the commit the selection was computed at. It is never later than the commits the client receives after it, and never earlier than those it has received before it.
- `members`: every identity in the selection.
- `objects`: the records of members the client did not already hold, as of `commit`, each with its identity under `id`.
- `stubs`: for every identity that a delivered record refers to and that the client neither holds nor already knows as a stub, its class name.

Arrays and classless objects that a member refers to are members too, without the selector having added them (whitepaper section 3.4), and so are never stubs of the objects they are parts of.

**S1. A selection arrives whole.** A client receives a subscription's whole selection in one message before it uses any of it (whitepaper section 3.4). The subscription's action runs when the `selection` message has been applied.

**S2. Every reference can be resolved.** After applying any message, every reference in every object the client holds names an object the client holds or knows as a stub.
*Maintained by:* the server, which includes `stubs`. *Verified:* the simulator (P2).

**S3. Selections pass only through readable objects.** Every member of a selection is an object that the session's user may read, at the selection's commit.
*Maintained by:* the server's selector evaluation. *Verified:* the simulator (P3), with an authorization oracle.

## 6.3 Unsubscribing

```json
{ "type": "unsubscribe", "sub": 7 }
```

The server forgets the subscription, and answers `{ "type": "left", "sub": 7, "ids": [...] }`, listing the objects that are no longer in any of the client's selections as a result. They leave (section 8.3).

---

# 7. Writes from a client

## 7.1 The transaction message

At the end of each Cascade transaction that changed shared objects (`onTransactionEnd`), the client store sends:

```json
{
  "type": "transaction",
  "tx": "k3f9.412",
  "base": 18240,
  "create": [ { "temp": "t5521", "$class": "Paragraph", "$version": 0, "text": "Hello" } ],
  "writes": [
    { "id": "n130", "set": { "title": "New title" }, "was": { "title": "Old title" } },
    { "id": "n130", "delete": ["subtitle"], "was": { "subtitle": "Draft" } },
    { "id": "n124", "insert": { "after": "n131", "before": "n132", "at": 3, "elements": [ { "$temp": "t5521" } ] } },
    { "id": "n124", "remove": { "element": "n135", "at": 7 } },
    { "id": "n140", "splice": { "at": 5, "remove": 2, "insert": ["a", "b"] } }
  ]
}
```

- `tx`: the transaction identity.
- `base`: the last commit the client had received when it made the transaction (whitepaper section 8.9).
- `create`: local objects that became shared in the transaction, because a shared object came to refer to them (data model O2), each with its temporary identity and its whole state.
- `writes`: changes to shared objects, in the order they were made, coalesced: a field written several times appears once, with its last value.
- `was`: only for objects in gated subscriptions (section 7.5): for each field written or deleted, the value it had on the client just before this transaction. A field that was absent is given as `{ "$absent": true }`.
- A reference to an object that has only a temporary identity, whether made in this transaction or in an earlier one that is still pending, is written `{ "$temp": "t5521" }`.

**W1. Direct writes only.** A transaction contains the writes application code made, and the writes of client-side repeaters it set off. By the assumption of whitepaper section 3.8, client-side repeaters do not write shared objects; in development, a client repeater's write to a shared object is reported.

**W2. The server resolves temporary identities it has named.** A `$temp` names an object made in this transaction's `create`, or in an earlier transaction of the same client identity. The server resolves the second kind through the table of applied transactions (section 10), which records the identities each transaction's objects were given. A `$temp` it cannot resolve refuses the transaction, with reason `missing`.

**W3. A client's transactions are applied in the order it made them.** The client sends them in order on one connection (T2), and the server processes a connection's messages in order.

## 7.2 Kinds of write

| Write | Meaning |
|---|---|
| `set` | Set fields of a record object. |
| `delete` | Delete fields of a record object (data model V1). |
| `insert` | Insert elements into an array of objects, anchored by identity (whitepaper section 3.9). `after` and `before` are the neighbours as the client saw them, `null` at the ends; `at` is the client's position, used only if both anchors are gone. |
| `remove` | Remove an element from an array of objects, by identity. `at` is the client's position, for checking. |
| `splice` | A positional splice of an array of other values. |

An array whose elements are synchronized objects, all distinct, is anchored: its changes are sent as `insert` and `remove`. Any other array is positional: its changes are sent as `splice`. Writing to an index of an anchored array is a `remove` and an `insert`.

**Open.** The anchoring rule needs each element of an anchored array to occur once. An array that holds the same object twice falls back to positional splices; whether the client store detects this per write, or per array, is to be decided.

## 7.3 What the server does with a transaction

On receiving a transaction, the server, in one Deepwell transaction:

1. Checks that `tx` has not been applied (section 10). If it has, it sends the answer it sent before, and stops.
2. Checks every value (data model V9) and every class (data model C4), resolves temporary identities (W2), and checks that every object written, and every object referred to, is one the client may name (F1).
3. Makes the objects in `create`. They are local until a write makes a stored object refer to them.
4. Takes the writes one at a time, in order. For each:
   1. If the object is in a gated subscription of this connection, compares the field's current value with `was` (section 7.5).
   2. Asks `canWrite`, with the user, the field, and the new value, against the state as it is now, before this write (whitepaper section 4.2). For an array or a classless object, which has no `canWrite`, it asks the root of the selection through which the connection holds it, with the user and no field; if the connection holds it through several selections, the write is allowed if any root allows it, and if a root has no `canWrite`, it allows it.
   3. Applies the write: resolving anchors against its own array, or transforming a positional splice (below).
5. Lets the repeaters that the writes set off run: the selections of every connection, and the persistent repeaters that run inside the transaction (Deepwell's [design](../../deepwell/documents/design.md), section 5).
6. Commits, recording the transaction and its answer in the table of applied transactions, in the same Aquifer transaction.

If any check refuses, the writes already applied are taken back, nothing is committed, and the server answers `refused` (section 7.4). Otherwise it answers with the commit (section 8.1).

Each write is judged against the state that the writes before it, in the same transaction, have left. A transaction that takes a lock and then writes under it therefore passes.

**W4. All or nothing.** A client transaction is either committed whole, in one commit, or not at all (whitepaper section 8.10).
*Maintained by:* the server store. *Verified:* the simulator (P4).

**W5. Judged before applied.** No write is applied to an object that its user may not write, as decided by `canWrite` against the state before the write, and no gated write is applied to a field whose value is not the one the writer saw.
*Maintained by:* the order of step 4. *Verified:* the simulator, with the lock of whitepaper section 3.9 taken by several clients at once: exactly one succeeds.

**Anchors.** An `insert` is placed after `after` if it is still in the array, else before `before` if it is still there, else at `at`, limited to the array's length. Inserting an element that is already in the array moves it. Removing an element that is not in the array does nothing.

**Positional splices.** A `splice` was made against the array as the client had it: the array as of `base`, with the client's own earlier pending splices applied. The server has by then applied those earlier splices too (W3). It shifts the splice past every splice committed to the same array since `base` by other clients: one at a lower position moves it by the difference in length; one that removed the elements it removes makes it remove fewer. It does not shift it past the client's own.

If an earlier transaction of the same client that changed the same array was refused, the positions of a later splice cannot be trusted, and the later transaction is refused, with reason `missing`.

This requires the server to keep the splices of each positional array for a while (section 5.2). To avoid keeping them forever for a client that is idle, the server also keeps, per positional array, the commit that last changed it, and transforms nothing if that commit is not later than `base`.

**Open.** The exact transformation of positional splices against each other, and how long their history is kept. It is the classical operational transformation of insert and delete against insert and delete, with the server's order as the tie-breaker. A splice whose `base` is older than the kept history, on an array that has changed since, is refused.

## 7.4 Refusal

```json
{
  "type": "refused",
  "tx": "k3f9.412",
  "reason": "gated",
  "at": { "id": "n130", "field": "title" },
  "current": [ { "id": "n130", "title": "Someone else's title" } ]
}
```

- `reason`: `gated` (a gated check failed), `authorization` (`canWrite` refused), `value` (a value or class failed the check), `missing` (a written object no longer exists, is not held, or depends on something refused), or `limit`.
- `at`: the first write that failed.
- `current`: the server's current values of every field the transaction wrote, for objects the client may still read.

The client, on receiving `refused` for a reason other than `gated`:

1. Takes back the transaction's writes: each field it wrote returns to the saved value, or, if later pending transactions also wrote it, to the value they wrote. Arrays are rebuilt from their saved copies and the remaining pending changes. Objects that became shared only through this transaction are local again.
2. Applies `current` as saved values.
3. Records the refusal in the metadata of the field named in `at`: `meta(object, field).error`.

For `gated`, the client keeps its work (whitepaper section 3.10):

1. The transaction is no longer pending, but its writes stay as local values.
2. `current` is applied as saved values. Every field the transaction wrote whose local value now differs from its saved value is marked `outOfSync`.
3. The application resolves each with `pull` or `force` (section 7.5).

Later pending transactions that depended on the refused one, by referring to its temporary identities or by splicing an array it spliced, are refused by the server in turn, with reason `missing`.

## 7.5 Gated subscriptions

**G1. Outgoing check.** For a write to a field of an object in a gated subscription, the server applies the write only if the field's current value equals the value in `was` (data model Q1).

`was` is the value the field had on the client just before the transaction: the saved value, or, if the client has earlier pending writes to the field, the value its last pending write gave it. A client that writes a field twice in quick succession therefore does not refuse itself: by the time the second write arrives, the server has applied the first (W3), and holds the value the second names.

For an array in a gated subscription, a change is applied only if no other client has changed the array since `base`. The client's own earlier changes do not count.
*Maintained by:* the server store. *Verified:* the simulator, with clients that write concurrently to the same fields, and with one client writing the same field repeatedly.

**G2. Incoming hold.** On a client, a change from the server to a field of an object in a gated subscription, where the field's local value differs from its saved value, is not applied to the local value. The saved value is updated, and the field is marked `outOfSync`.
*Maintained by:* the client store. *Verified:* the simulator.

**G3. Resolving.** `pull(object, field)` sets the local value to the saved value, clears `outOfSync`, and drops the field from writes not yet sent. `force(object, field)` writes the local value again in a new transaction, with the saved value as its `was`. Both can be applied to an object or a subscription at once.

**Drafts.** With `send: "explicit"`, the client store does not send transactions at the end of Cascade transactions. It accumulates writes, coalesced, until the application calls `send(subscription)`, and then sends them as one transaction, whose `was` holds the saved values. Until then, they are local values, and incoming changes to them are held (G2).

---

# 8. Changes from the server

## 8.1 The commit message

For every commit that changes something a client holds, or that changes a client's selections, the server sends that client one message:

```json
{
  "type": "commit",
  "commit": 18241,
  "tx": "k3f9.412",
  "created": { "t5521": "n150" },
  "changes": [
    { "id": "n131", "set": { "title": "Changed by someone else" } },
    { "id": "n124", "insert": { "at": 3, "elements": [ { "$ref": "n150" } ] } }
  ],
  "objects": [ ... ],
  "stubs": { ... },
  "joined": { "7": ["n150"] },
  "left": { "7": ["n135"] },
  "reclaimed": ["n99"]
}
```

- `commit`: the commit's number.
- `tx` and `created`: present only on the client whose transaction this commit is. `created` maps its temporary identities to the identities the server gave.
- `changes`: changes to objects the client holds, in the order they are to be applied. Array changes are positional, `insert`, `remove` and `splice`, and each position is in the array as the changes before it in the same message have left it.
- `objects`: records of objects that joined the client's selections in this commit and that it did not hold.
- `stubs`: classes of newly referenced objects that the client neither holds nor knows (S2).
- `joined` and `left`: per subscription, the identities that joined or left its selection.
- `reclaimed`: identities that the collector has reclaimed, of objects the client knows as stubs or holds weak references to (data model V4). Reclaims are reported with the next commit message, or in a message with no other content.

**C1. Every commit, in order.** A client receives a `commit` message for every commit that changes what it holds or its selections, in increasing order of commit number, and no message for a commit that does not. The commit numbers it receives therefore have gaps.
*Maintained by:* the server store. *Verified:* the simulator.

**C2. What the client's own commit contains.** The commit that applied a client transaction carries its `tx`. For that client, `changes` contains:

- no `set` or `delete` that the transaction itself made, since the client has them;
- every array change of the commit, resolved, including those the transaction made. The client does not guess how the server resolved its anchors; it is told;
- everything the server added: the effects of repeaters and of other code.

## 8.2 Applying a commit on the client

The client applies a `commit` message in one Cascade transaction, marked so that the client store does not take its changes for the application's own writes:

1. If `tx` is present: the transaction is confirmed, and is no longer pending. Each object in `created` gets its identity (data model O5). The count of pending writes, `saving`, is decreased for each field the transaction wrote; when it reaches zero, the saved value is the local value, and the copy is dropped.
2. For each `set` and `delete`: the saved value is updated. The local value is updated too, unless the field has pending writes of the client's own (whitepaper section 3.9), or the object is gated and the field's local value differs from its saved value (G2).
3. For each array change: it is applied to the saved copy of the array. If the client has pending changes to the array, the local array is then rebuilt: the saved copy, with the pending changes applied again in order, their anchors resolved anew, and their positional splices transformed past the server's change as the server would (whitepaper section 3.9). If it has none, the local array is the saved copy.
4. Objects in `objects` are made (data model K2). Stubs are made for `stubs` (data model S1).
5. Subscription memberships are updated from `joined` and `left`, and objects that no longer belong to any selection leave (section 8.3).
6. For `reclaimed`, stubs are dropped and weak references cleared.
7. The last commit received becomes `commit`.

A client's own array change, when its commit arrives, is in `changes` (C2) and is no longer pending: it is applied to the saved copy as the server resolved it, and the remaining pending changes are applied on top.

**A1. Pending writes survive older values.** A server value for a field with pending writes of the client's own never replaces the local value. When the client's last pending write to the field is confirmed, the local value equals the saved value, unless a later commit has changed it, which then replaces it.
*Maintained by:* the client store. *Verified:* the simulator, with delayed confirmations and concurrent writers.

**A2. Arrays converge.** When a client has no pending changes to an array, its local array equals its saved copy, which equals the server's array as of the last commit received.
*Maintained by:* step 3. *Verified:* the simulator, with several clients inserting into, removing from, and moving within the same arrays at once.

## 8.3 Leaving

An object that no longer belongs to any of the client's selections leaves:

- If an object the client still holds refers to it, it becomes a stub (data model S5): its fields are removed, and its metadata says it is not loaded.
- Otherwise it is dropped from the client's identity map.

If the client has pending writes to an object that leaves, they stay pending, and the server confirms or refuses them as usual. A gated object that leaves with local changes keeps them, marked out of sync.

**Open.** What the user interface should be told when an object that the user is editing leaves, because it was moved out of the document, or because its permissions changed. A metadata flag, `meta(object).sync.left`, may be enough.

## 8.4 Keeping `base` current

A client receives only the commits that concern it. An idle client's last commit received would otherwise fall ever further behind the server's, and its next transaction would name a `base` that is hours old, though nothing it holds has changed.

The server therefore tells a client where it stands: `pong` carries the server's latest commit, and the server may send `{ "type": "at", "commit": 18300 }` at any time. Either means that the client has been sent everything that concerns it up to that commit. The client's last commit received becomes that number.

---

# 9. Calls on the session

```json
{ "type": "call", "call": 31, "method": "publish", "args": [ { "$ref": "n123" } ], "create": [] }
```

- `call`: a number chosen by the client, unique within the connection.
- `method`: one of the names in `welcome.methods` (whitepaper section 4.5).
- `args`: arguments, encoded as values (data model section 8.2). References name objects the client holds or knows.
- `create`: local objects that the arguments refer to, as in a transaction (section 7.1). The method receives them as local objects. They are stored only if the method makes a stored object refer to them.

The server runs the method synchronously, in one transaction, and answers:

```json
{ "type": "result", "call": 31, "value": true }
{ "type": "error", "call": 31, "message": "Not allowed." }
```

**M1. Effects before the result.** If the method changed anything the caller holds, the `commit` or `volatile` messages for it are sent to the caller before the `result`. When the client's call resolves, its objects already show the method's effects.
*Maintained by:* the server store. *Verified:* the simulator.

**M2. A call sees the caller's earlier writes.** A call is processed after every transaction that the client sent before it on the same connection.
*Maintained by:* T2, and the server processing a connection's messages in order. *Verified:* the simulator.

**M3. A failed call writes nothing.** A method that throws commits nothing, and the error returned carries only what the method chose to put in it, not the server's internal error.

**Open.** Calls are not idempotent across reconnection: a call that was sent on a lost connection may or may not have run. The proposal is that calls are not resent automatically; the promise is rejected with a connection error, and the application decides. A method that must not run twice can take an identity as an argument, and check it.

**External effects.** A method registers external effects, which run after its commit (whitepaper section 4.5). They are not part of the protocol.

---

# 10. Applying a transaction once

**O1. At most once, and answered the same.** The server applies each transaction identity at most once. A transaction that arrives again, on the same or another connection, is answered as it was the first time: with its commit number and its `created` map, or with its refusal.
*Maintained by:* the server's table of applied transactions. *Verified:* the simulator, which resends transactions after cutting connections.

The table is stored. An entry holds the transaction identity, the commit number or the refusal, and the `created` map. It is written in the same Aquifer transaction as the commit, so that a crash cannot apply a transaction without recording it, or record it without applying it. The `created` maps are also what resolves temporary identities in later transactions (W2).

An answer given again is the short form: `{ "type": "commit", "commit": 18241, "tx": "...", "created": {...} }` without changes. The changes reach the client through the resumed subscriptions (section 11).

**Open.** For how long applied transactions are remembered. It bounds how long a client may be away and still resend safely. A client away for longer reconnects without resending, and loses its pending writes, which it reports.

---

# 11. Reconnecting

There is one way to reconnect, and it assumes nothing about what the server remembers of the client, apart from the table of applied transactions. It is the same after a brief loss of the network as after a restart of the server.

## 11.1 What the client sends

When a connection is lost, the client keeps its objects, its pending transactions and its subscriptions, and reconnects with:

```json
"resume": {
  "commit": 18234,
  "subscriptions": [ { "sub": 7, "selector": "document", "start": "n123", "options": { "gated": true } } ],
  "held": ["n123", "n124", "n130"],
  "stubs": ["n99"]
}
```

- `commit`: the last commit received.
- `subscriptions`: its subscriptions, to be made again.
- `held`: the identities of the stored objects it holds.
- `stubs`: the identities of the stubs it knows, and of the targets of its weak references.

After `welcome`, it sends its pending transactions again, in order, with the same transaction identities and temporary identities.

## 11.2 What the server does

1. Makes the subscriptions in `resume.subscriptions`.
2. Sends one `selection` message for each, at one commit, with its complete membership. `objects` holds the record of every member that the client does not hold according to `held`, or that has changed since `resume.commit`. This covers an object that joined a selection while the client was away without itself having changed, such as a paragraph moved into the document.
3. Lists, in the first of those messages, under `reclaimed`, the identities in `held` and `stubs` that no longer exist.
4. Answers resent transactions as usual: from the table of applied transactions (O1), or by applying them.

The client applies each `selection`: members it holds are kept or updated, objects it holds that are in none of the new memberships leave, and reclaimed identities are dropped.

A record that arrives for an object with pending writes is treated like a commit (section 8.2): the saved values are replaced, and pending writes keep their local values. A record that arrives for an array with pending changes replaces the saved copy, and the pending changes are applied on top.

This requires the commit that last changed each object, which Aquifer keeps (data model section 8.1).

**R1. After reconnecting, the client converges.** Once the server has answered the resumed subscriptions and the resent transactions, and no further changes are in flight, the client's held objects equal the server's (P1).
*Maintained by:* both stores. *Verified:* the simulator, which cuts connections at random points, and restarts the server.

---

# 12. Volatile objects

Some synchronized objects are never stored: the session and the connection (whitepaper section 4.1), and presence objects such as cursors (whitepaper section 3.11). They are a kind of their own: synchronized, like stored objects, and in memory only, like the server's selections.

**VO1. Volatile objects have identities of their own.** Fountain gives a volatile object an identity beginning with `v`, from a counter of its own. Aquifer's identities never begin with `v`. A volatile identity is meaningless after the server restarts.

**VO2. Volatile objects are never stored, and stored objects never refer to them.** A write that would make a stored object refer to a volatile one is refused, with reason `value` (data model R1). A volatile object may refer to stored objects: a cursor refers to the paragraph it is in.

**VO3. Changes to volatile objects are not commits.** They have no commit number, and travel in a message of their own:

```json
{
  "type": "volatile",
  "tx": "k3f9.413",
  "created": { "t5530": "v212" },
  "objects": [ { "id": "v212", "$class": "Cursor", "$version": 0, "paragraph": { "$ref": "n131" }, "offset": 4 } ],
  "changes": [ { "id": "v81", "set": { "user": { "$ref": "n7" } } } ],
  "left": ["v200"]
}
```

`tx` and `created` are present on the client whose transaction made the change, and confirm it, as a commit does. A `volatile` message is ordered among the other messages on its connection, but not numbered.

**VO4. Who holds which volatile objects.** A client holds its own session and connection (L2). A presence object is selected with the object it refers to: every client whose selections contain that object holds the presence object too, and receives it, its changes, and its leaving.

**VO5. Presence ends with its session.** When a session ends, or a connection closes, the presence objects it made are removed, and every client that holds one is sent a `volatile` message with it under `left`.

**Writes from clients.** A client changes its own presence objects in ordinary transactions (section 7.1): a local object of a volatile class becomes shared when a volatile object, such as its connection, comes to refer to it. A transaction that changes only volatile objects is answered with a `volatile` message, and one that changes both with a `commit` and a `volatile` message.

**VO6. Presence may be throttled.** The server may coalesce changes to presence objects and send them less often than they are made. Since they are not numbered, nothing depends on each one arriving.

**After reconnecting,** a client's volatile objects are gone with the old connection. It gets its session anew, makes its presence objects again, and receives the others' with its selections.

---

# 13. Metadata

The client store keeps its state about an object in the object's metadata (whitepaper section 2.4), where the user interface can read it. These are all the fields it defines.

Per object, in an observable record at `meta(object).sync`:

| Field | Meaning |
|---|---|
| `loaded` | `"unloaded"` for a stub, `"loading"` while a subscription that will deliver it is being answered, `"loaded"` when its fields are present. |
| `subscriptions` | The number of the client's subscriptions whose selection contains the object. |
| `gated` | Whether one of those subscriptions is gated. |
| `left` | Set when the object has left every selection while the client had unconfirmed changes to it (section 8.3). |

Per field, in the observable record `meta(object, field)`, made only for fields that need it:

| Field | Meaning |
|---|---|
| `saved` | The saved value: what the server has, as far as the client knows. Present while it differs from the local value, or while writes are pending. |
| `saving` | The number of the client's pending writes to the field. |
| `error` | The reason of the last refusal of a write to the field, until the next write. |
| `outOfSync` | In a gated subscription: the local value differs from the saved value, and no write is pending that would make them equal. |

"Unsaved" is not stored: a field is unsaved while its local value differs from `saved`.

Not per object, on the store: `untrackedMeta(object).store` names the store an object belongs to (whitepaper section 3.8).

---

# 14. Invariants verified by the simulator

The simulator checks these at every quiet point: when no message is in flight and no transaction is pending.

**P1. Convergence.** For every client, every held object's local fields equal the server's fields of that object, except fields marked out of sync in gated subscriptions, whose `saved` equals the server's field instead.

**P2. Closure.** For every client, the set of held objects equals the union of its subscriptions' selections as the server computes them now, the server's record of it agrees (K1), and every reference in a held object names a held object or a known stub (S2).

**P3. Security.** No client has ever received a field of an object that its user could not read at the commit it was sent, according to an authorization oracle that evaluates `canRead` independently.

**P4. Atomicity.** For every client transaction, either all of its writes are reflected in exactly one commit, or none in any (W4), and the client has received exactly one answer for it.

**P5. Counts.** For every client and held object, `meta(object).sync.subscriptions` equals the number of that client's subscriptions whose selection contains the object.

**P6. Once only.** No transaction identity is applied twice (O1), whatever the cuts and resends.

**P7. Order.** Every client has received the commits that concern it in increasing order (C1), and every call's result after the messages of its effects (M1).

**P8. No silent loss in gated subscriptions.** In a gated subscription, no committed write of one client was overwritten by another client's write that was made without having seen it.

**P9. No write without leave.** No write was applied that `canWrite` would have refused against the state before it (W5), where for an array or a classless object the `canWrite` is that of the root of a selection through which the writer holds it.

**P10. Nothing from outside the forest.** No client has subscribed from, written to, or written a reference to an object that was not in its forest at the time (F1).

The simulator also runs every scenario a second time with a model: a single in-memory object graph to which every commit is applied directly, against which the server's state is compared.

---

# 15. Open points

| Point | Section |
|---|---|
| Compression or a binary encoding | 3 |
| Arrays holding the same object twice: per write or per array fallback | 7.2 |
| The transformation of positional splices, and how long their history is kept | 7.3 |
| What the user interface is told when an edited object leaves | 8.3 |
| Calls after a lost connection | 9 |
| How long applied transactions are remembered | 10 |

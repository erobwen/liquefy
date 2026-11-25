# Protocol

*Specification, draft. Part of [Fountain](../README.md); it details [the whitepaper](../whitepaper.md), sections 3.4 to 3.11, 4.1, 4.5 and 8.14. It is built on [the data model](../../wellspring/documents/data-model.md).*

This document specifies the conversation between a client and the server: the messages, their order, what each side keeps, how changes travel in both directions, and how a client reconnects. It is the contract between the client store and the server store (whitepaper section 3.8).

Invariants are numbered, with who maintains them and how they are verified. Most are verified by **the simulator**: a test harness that runs one server and several clients in one process, connects them through channels that it can delay, reorder between connections, and cut, drives them with random transactions, subscriptions and calls, and checks the invariants at every quiet point (section 13).

Open points are marked **Open**, and collected in section 14.

---

# 1. Scope and layers

```text
  application code
        |
  client store  ----------- this protocol -----------  server store
  (Cascade world)          one WebSocket per tab        (Wellspring, over Aquifer)
```

Covered here: what travels over the connection, and the state each side keeps in order to send and receive it.

Not covered: how the server evaluates selectors and authorization (it is enough that it can), how the server holds and stores objects (Wellspring and Aquifer, whitepaper section 2.6), and how the client store hooks into Cascade (it uses `onEventGlobal`, `onTransactionEnd` and `meta()`, whitepaper sections 2.4 and 3.8).

---

# 2. Terms

- **Connection.** One WebSocket between one client (a browser tab) and the server. It belongs to a session (whitepaper section 4.1).
- **Session.** A sign-in. Several connections, in several tabs, can belong to one session.
- **Client identity.** A random string that a client chooses once per tab and keeps across reconnections, for example in `sessionStorage`. It names the client's state on the server between connections.
- **Commit.** A transaction applied by the server. Commits are numbered by one counter for the whole server, increasing by one per commit, never reused.
- **Client transaction.** The writes a client makes in one Cascade transaction, sent as one message (whitepaper section 3.8). It is named by a **transaction identity** that the client chooses, unique within the client identity.
- **Subscription.** A selector and a starting object, held by a connection, with options. Named by a **subscription number** chosen by the client, unique within the connection.
- **Held object.** An object whose fields the client has: the union of its subscriptions' selections. An object that the client knows only by a reference is a **stub** (data model section 7).
- **Confirmed value.** The value of a field as of the last commit the client has received.
- **Local value.** The value of a field in the client's objects, which application code reads. It differs from the confirmed value where the client has writes that are not yet confirmed.
- **Pending transaction.** A client transaction that has been sent, or is waiting to be sent, and has neither been confirmed nor refused.

---

# 3. Transport

**T1. One WebSocket per client.** Messages are sent as text frames. Each frame holds one message, a JSON object whose `type` field names its kind. Values inside messages are encoded as in the data model (section 8).

**T2. Order.** Each direction of a connection delivers messages in the order they were sent, without loss or duplication, for as long as the connection lasts. That is what a WebSocket gives. Nothing is assumed across connections: messages sent on a connection that was lost may or may not have arrived.

**T3. Heartbeat.** Either side may send `{ "type": "ping" }`, and the other answers `{ "type": "pong" }`. A side that hears nothing for a configured time considers the connection lost.

**Open.** Whether messages should be compressed, or encoded in a binary format, once the format has settled. JSON first.

---

# 4. Connection lifecycle

```text
client                                   server
  | -- hello ------------------------------> |
  | <------------------------------ welcome -- |   or reload, or refused
  | <---------- selection (the session) ---- |
  | -- subscribe, transaction, call ------> |
  | <------- selection, commit, result ----- |
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
  "resume": { "commit": 18234, "subscriptions": [ ... ], "pending": [ ... ] }
}
```

- `protocol`: the version of this protocol.
- `code`: the application's code version (whitepaper section 8.6).
- `classes`: a digest of the registered class names and versions (data model C1, C5), so that the server can tell cheaply whether the client's classes match its own.
- `client`: the client identity.
- `token`: a session token from an earlier sign-in, if the client has one.
- `resume`: present when the client is reconnecting (section 11).

## 4.2 Welcome, reload, refused

The server answers with exactly one of:

- **`welcome`**: the connection is open.

  ```json
  { "type": "welcome", "commit": 18240, "session": "s81...", "connection": "c7..." }
  ```

  `commit` is the server's latest commit. `session` is the identity of the session object. `connection` names the connection, for diagnostics.

- **`reload`**: the client's code is too old, or its classes do not match. The client should reload, and reconnect with new code (whitepaper section 8.6). The server closes the connection.

  ```json
  { "type": "reload", "reason": "classes" }
  ```

- **`refused`**: the token is invalid, the client is over a limit, or the server is shutting down. The server closes the connection.

**L1. Nothing before welcome.** The client sends nothing but `hello` until it has received `welcome`. The server sends nothing but the answer to `hello` before `welcome`.
*Maintained by:* both stores. *Verified:* the simulator, with a protocol checker on every channel.

## 4.3 The session is the first subscription

Immediately after `welcome`, the server delivers the session object to the client as subscription 0, with the session's selector (whitepaper section 4.1): the session, its connection, its user if any, and whatever the application's session class selects. The client did not ask for it, and cannot release it.

A client without a token gets an anonymous session. It signs in by calling a session method (section 9), which binds the session to a user and returns a token for later connections. Signing in changes the session object, which reaches the client as an ordinary commit.

**L2. Subscription 0 is the session.** For as long as a connection is open, the client holds its session object.

## 4.4 Closing

Either side may close the connection. The server keeps the client's state, under its client identity, for a configured time after a connection is lost (section 11). A client that closes on purpose sends `{ "type": "bye" }` first, and the server then forgets its state at once.

---

# 5. What each side keeps

## 5.1 The server, per client identity

- The session it belongs to.
- Its subscriptions: number, selector, starting object, options, and the set of identities in the selection.
- The set of objects it holds (the union of its selections), and the set of objects it knows only as stubs.
- The last commit sent to it.
- Its applied transactions: for each transaction identity applied in the last configured period, the answer that was sent (section 10).

**K1. The server knows what the client holds.** The server's record of a client's held objects equals the union of that client's selections, as of the last commit sent to the client.
*Maintained by:* the server store, which updates both together. *Verified:* the simulator (P2).

## 5.2 The client

- Its objects, in its Cascade world, with their metadata.
- For each field it has written and not had confirmed: the confirmed value, and its pending writes, in order (`meta(object, field).saving` counts them).
- For each array with pending splices: the splices, in order, as sent (section 7.3).
- Its pending transactions, in order.
- For each subscription: its number, selector, starting object, options, and the identities in its selection, as the server last said.
- The last commit received.
- Its map from temporary identities to objects, for objects it has created and not yet had confirmed.

The client needs no copy of every confirmed value: for fields without pending writes, the local value is the confirmed value.

---

# 6. Subscriptions

## 6.1 Subscribing

```json
{ "type": "subscribe", "sub": 7, "selector": "document", "start": "n123", "options": { "gated": true } }
```

- `selector`: the name of a registered selector (whitepaper section 3.4).
- `start`: the identity of the starting object. It must be an object the client holds or has as a stub, or a root the session has granted (whitepaper section 4.5).
- `options`: `gated` (boolean), `send` (`"immediate"` or `"explicit"`), whitepaper section 3.10. Both are client-side behaviours as well; the server needs to know `gated`, to check base values.

The server answers with a `selection`, or with:

```json
{ "type": "subscribeRefused", "sub": 7, "reason": "start" }
```

The session may refuse a selector or a starting object (whitepaper section 4.5).

## 6.2 The selection message

```json
{
  "type": "selection",
  "sub": 7,
  "commit": 18240,
  "members": ["n123", "n124", "n130"],
  "objects": [ { "id": "n124", "$class": "Chapter", "$version": 0, "fields": { ... } } ],
  "stubs": { "n99": "User" }
}
```

- `commit`: the commit the selection was computed at. It is never later than the commits the client receives after it, and never earlier than those it has received before it.
- `members`: every identity in the selection.
- `objects`: the records of members the client did not already hold, as of `commit`.
- `stubs`: for every identity that a delivered record refers to and that the client neither holds nor already knows as a stub, its class name.

**S1. A selection arrives whole.** A client receives a subscription's whole selection in one message before it uses any of it (whitepaper section 3.4). The subscription's action runs when the `selection` message has been applied.

**S2. Every reference can be resolved.** After applying any message, every reference in every object the client holds names an object the client holds or knows as a stub.
*Maintained by:* the server, which includes `stubs`. *Verified:* the simulator (P2).

**S3. Selections pass only through readable objects.** Every member of a selection is an object that the session's user may read, at the selection's commit.
*Maintained by:* the server's selector evaluation. *Verified:* the simulator (P3), with an authorization oracle.

## 6.3 Unsubscribing

```json
{ "type": "unsubscribe", "sub": 7 }
```

The server forgets the subscription. Objects that no longer belong to any of the client's selections leave (section 8.3). The server answers with a `commit`-less `left` notice, `{ "type": "left", "sub": 7, "ids": [...] }`, listing the objects the client no longer holds as a result.

---

# 7. Writes from a client

## 7.1 The transaction message

At the end of each Cascade transaction that changed synchronized objects (`onTransactionEnd`), the client store sends:

```json
{
  "type": "transaction",
  "tx": "k3f9.412",
  "base": 18240,
  "create": [ { "temp": "t1", "$class": "Paragraph", "$version": 0, "fields": { "text": "Hello" } } ],
  "writes": [
    { "id": "n130", "set": { "title": "New title" } },
    { "id": "n130", "delete": ["subtitle"] },
    { "id": "n124", "insert": { "after": "n131", "before": "n132", "at": 3, "elements": [ { "$temp": "t1" } ] } },
    { "id": "n124", "remove": { "element": "n135", "at": 7 } },
    { "id": "n140", "splice": { "at": 5, "remove": 2, "insert": ["a", "b"] } }
  ],
  "gatedBase": { "n130": { "title": "Old title", "subtitle": "Draft" } }
}
```

- `tx`: the transaction identity.
- `base`: the last commit the client had received when it made the transaction (whitepaper section 8.9).
- `create`: objects created in the transaction, with temporary identities. Fields of a created object are its whole state; they are not repeated in `writes`.
- `writes`: changes to existing objects, in the order they were made, coalesced: a field written several times appears once, with its last value.
- A reference to an object created in the same transaction, or in an earlier transaction that is still pending, is written `{ "$temp": "t1" }`.
- `gatedBase`: for objects in gated subscriptions, the confirmed value of every field the transaction writes, as the client saw it (section 7.5). A field that was absent is listed with `{ "$absent": true }`.

**W1. Direct writes only.** A transaction contains the writes application code made, and the writes of client-side repeaters it set off. By the assumption of whitepaper section 3.8, client-side repeaters do not write synchronized objects; in development, a client repeater's write to a synchronized object is reported.

**W2. Temporary identities are scoped to the client identity.** A temporary identity is unique among the client's pending transactions, and is meaningless to other clients.

## 7.2 Kinds of write

| Write | Meaning |
|---|---|
| `set` | Set fields of a record object. |
| `delete` | Delete fields of a record object (data model V1). |
| `insert` | Insert elements into an array object of objects, anchored by identity (whitepaper section 3.9). `after` and `before` are the neighbours as the client saw them, `null` at the ends; `at` is the client's position, used only if both anchors are gone. |
| `remove` | Remove an element from an array object of objects, by identity. `at` is the client's position, for checking. |
| `splice` | A positional splice of an array of primitive values, made against `base`. |

An array whose elements are synchronized objects, all distinct, is anchored: its changes are sent as `insert` and `remove`. Any other array is positional: its changes are sent as `splice`. Writing to an index of an anchored array is a `remove` and an `insert`.

**Open.** The anchoring rule needs each element of an anchored array to occur once. An array that holds the same object twice falls back to positional splices; whether the client store detects this per write, or per array, is to be decided.

## 7.3 What the server does with a transaction

On receiving a transaction, the server, in one Aquifer transaction:

1. Checks that `tx` has not been applied (section 10). If it has, it sends the answer it sent before, and stops.
2. Checks every value (data model V9) and every class (data model C4).
3. Creates the objects in `create`, assigning permanent identities.
4. Applies the writes in order, resolving temporary identities, resolving anchors against its own arrays, and transforming positional splices past the splices committed since `base`.
5. For objects in gated subscriptions, compares each field's current value with `gatedBase` (section 7.5).
6. Asks `canWrite` for each write (whitepaper section 4.2).
7. Runs the server's repeaters that the writes set off: selections, indexes (whitepaper section 3.8).
8. Commits.

If any step refuses, nothing is committed, and the server answers `refused` (section 7.4). Otherwise it answers with the commit (section 8.1).

**W3. All or nothing.** A client transaction is either committed whole, in one commit, or not at all (whitepaper section 8.10).
*Maintained by:* the server store, which applies a transaction in one Aquifer transaction. *Verified:* the simulator (P4).

**Anchors.** An `insert` is placed after `after` if it is still in the array, else before `before` if it is still there, else at `at`, limited to the array's length. Inserting an element that is already in the array moves it. Removing an element that is not in the array does nothing.

**Positional splices.** A `splice` was made against the array as of `base`. The server shifts its position past every splice committed to the same array since `base`: a splice committed earlier at a lower position moves it by the difference in length; one that removed the elements it removes makes it remove fewer. This requires the server to keep the splices of each positional array for a while (section 11.3).

**Open.** The exact transformation of positional splices against each other, and how long their history is kept. It is the classical operational transformation of insert and delete against insert and delete, with the server's order as the tie-breaker.

## 7.4 Refusal

```json
{
  "type": "refused",
  "tx": "k3f9.412",
  "reason": "gated",
  "at": { "id": "n130", "field": "title" },
  "current": [ { "id": "n130", "fields": { "title": "Someone else's title" } } ]
}
```

- `reason`: `gated` (a gated check failed), `authorization` (`canWrite` refused), `value` (a value or class failed the check), `missing` (a written object no longer exists, or is not held), or `limit`.
- `at`: the first write that failed.
- `current`: the server's current values of every field the transaction wrote, for objects the client may still read.

The client, on receiving `refused`:

1. Takes back the transaction's writes: each field it wrote returns to the confirmed value, or, if later pending transactions also wrote it, to the value they wrote. Objects created only in this transaction are dropped.
2. Applies `current` as confirmed values.
3. Records the refusal in metadata: `meta(object, field).error` for `authorization` and `value`; `outOfSync` and `serverValue` for `gated` (section 7.5).

Later pending transactions that depended on the refused one, by referring to its temporary identities, are refused by the server in turn, with reason `missing`.

**Open.** Whether a refused gated transaction should keep the client's values as local values, marked out of sync, rather than taking them back, so that the user's work stays on screen until it is resolved. The whitepaper implies it should (section 3.10); the steps above then differ for `gated`: the writes are kept, the fields are marked, and nothing is taken back until the application pulls.

## 7.5 Gated subscriptions

**G1. Outgoing check.** For a write to a field of an object in a gated subscription, the server applies the write only if the field's current value equals the value in `gatedBase` (data model Q1). For an anchored or positional array in a gated subscription, the write is applied only if the array has not changed since `base`.
*Maintained by:* the server store. *Verified:* the simulator, with clients that write concurrently to the same fields.

**G2. Incoming hold.** On a client, a change from the server to a field of an object in a gated subscription, where the field has a local value different from its confirmed value, is not applied to the local value. The new confirmed value is recorded as `meta(object, field).serverValue`, and the field is marked `outOfSync`.
*Maintained by:* the client store. *Verified:* the simulator.

**G3. Resolving.** `pull(object, field)` sets the local value to the server value, clears `outOfSync`, and drops the field from pending writes not yet sent. `force(object, field)` writes the local value again in a new transaction, with the server value as its gated base. Both can be applied to an object or a subscription at once.

**Drafts.** With `send: "explicit"`, the client store does not send transactions at the end of Cascade transactions. It accumulates writes, coalesced, until the application calls `send(subscription)`, and then sends them as one transaction. Until then, they are local values, and incoming changes to them are held (G2).

---

# 8. Changes from the server

## 8.1 The commit message

For every commit that changes something a client holds, or that changes a client's selections, the server sends that client one message:

```json
{
  "type": "commit",
  "commit": 18241,
  "tx": "k3f9.412",
  "created": { "t1": "n150" },
  "changes": [
    { "id": "n130", "set": { "title": "New title" } },
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
- `tx` and `created`: present only on the client whose transaction this commit is. `created` maps its temporary identities to permanent ones.
- `changes`: the changes to objects the client holds, after the commit, in a resolved form: `set`, `delete`, and positional `insert`, `remove` and `splice` with positions as of the server's array before the commit's changes to it.
- `objects`: records of objects that joined the client's selections in this commit and that it did not hold.
- `stubs`: classes of newly referenced objects that the client neither holds nor knows (S2).
- `joined` and `left`: per subscription, the identities that joined or left its selection.
- `reclaimed`: identities that the collector has reclaimed, of objects the client knows as stubs or holds weak references to (data model V4).

**C1. Every commit, in order.** A client receives a `commit` message for every commit that changes what it holds or its selections, in increasing order of commit number, and no message for a commit that does not. Commits whose changes it may not read are not sent to it, and the commit numbers it receives therefore have gaps.
*Maintained by:* the server store. *Verified:* the simulator.

**C2. The client's own transaction is confirmed by its commit.** The commit that applied a client transaction carries its `tx`. The server does not repeat the transaction's own writes in `changes`, since the client has them; `changes` contains only what the server added: the effects of server repeaters, and the resolution of anchors and splices where it differs from what the client did.

**Open.** Whether, for simplicity, `changes` should always contain every change of the commit, including the client's own, and leave it to the client to recognize its own. It would cost size and make the client's rule simpler. It also matters for rebasing arrays (section 8.2).

## 8.2 Applying a commit on the client

The client applies a `commit` message in one Cascade transaction, without emitting events to the client store (they are not the client's writes):

1. If `tx` is present: the transaction is confirmed. Its writes are no longer pending. Temporary identities in `created` are replaced by permanent ones (data model O3). Pending counts (`saving`) are decreased.
2. For each `set` and `delete`: the confirmed value is updated. The local value is updated too, unless the field has pending writes of the client's own (whitepaper section 3.9), or the object is gated and the field has a local change (G2).
3. For each array change: the client takes back its pending splices on that array, applies the server's changes, and applies its pending splices again, resolving their anchors anew (whitepaper section 3.9). Positional pending splices are transformed past the server's changes in the same way the server transforms.
4. Objects in `objects` are made (data model K2). Stubs are made for `stubs` (data model S1).
5. Subscription memberships are updated from `joined` and `left`, and objects that no longer belong to any selection leave (section 8.3).
6. For `reclaimed`, stubs are dropped and weak references cleared.
7. The last commit received becomes `commit`.

**A1. Pending writes survive older values.** A server value for a field with pending writes of the client's own never replaces the local value. When the client's last pending write to the field is confirmed, the local value equals the confirmed value, unless a later commit has changed it, which then replaces it.
*Maintained by:* the client store. *Verified:* the simulator, with delayed confirmations and concurrent writers.

## 8.3 Leaving

An object that no longer belongs to any of the client's selections leaves:

- If an object the client still holds refers to it, it becomes a stub (data model S5): its fields are removed, and its metadata says it is not loaded.
- Otherwise it is dropped from the client's identity map.

If the client has pending writes to an object that leaves, they stay pending, and the server confirms or refuses them as usual. A gated object that leaves with local changes keeps them, marked out of sync.

**Open.** What the user interface should be told when an object that the user is editing leaves, because it was moved out of the document, or because its permissions changed. A metadata flag, `meta(object).left`, may be enough.

---

# 9. Calls on the session

```json
{ "type": "call", "call": 31, "method": "anyOtherEmployeeWithHigherSalaryThanMe", "args": [] }
```

- `call`: a number chosen by the client, unique within the connection.
- `method`: the name of a method of the session's class (whitepaper section 4.5).
- `args`: arguments, encoded as values (data model section 8.2). References name objects the client holds or knows.

The server runs the method synchronously, in one transaction, and answers:

```json
{ "type": "result", "call": 31, "value": true }
{ "type": "error", "call": 31, "message": "Not allowed." }
```

**M1. Effects before the result.** If the method committed changes, the `commit` message for them is sent to the caller before the `result`. When the client's call resolves, its objects already show the method's effects.
*Maintained by:* the server store. *Verified:* the simulator.

**M2. A call sees the caller's earlier writes.** A call is processed after every transaction that the client sent before it on the same connection.
*Maintained by:* T2, and the server processing a connection's messages in order. *Verified:* the simulator.

**M3. A failed call writes nothing.** A method that throws commits nothing, and the error returned carries only what the method chose to put in it, not the server's internal error.

**Open.** Calls are not idempotent across reconnection: a call that was sent on a lost connection may or may not have run. The proposal is that calls are not resent automatically; the promise is rejected with a connection error, and the application decides. A method that must not run twice can take an identity as an argument, and check it.

**External effects.** A method registers external effects, which run after its commit (whitepaper section 4.5). They are not part of the protocol.

---

# 10. Applying a transaction once

**O1. At most once, and answered the same.** The server applies each transaction identity of a client identity at most once. A transaction that arrives again, on the same or another connection, is answered with the answer sent the first time: the `commit` message's confirmation (its number and `created`), or the `refused` message.
*Maintained by:* the server's table of applied transactions, kept per client identity for a configured period. *Verified:* the simulator, which resends transactions after cutting connections.

The table entry for a transaction is written in the same Aquifer transaction as its commit, so that a crash cannot apply a transaction without recording it, or record it without applying it.

**Open.** For how long applied transactions are remembered. It bounds how long a client may be away and still resend safely. A client away for longer reconnects without resending (section 11.2), and loses its pending writes, which it reports.

---

# 11. Reconnecting

## 11.1 What the client sends

When a connection is lost, the client keeps its objects, its pending transactions and its subscriptions, and reconnects with:

```json
"resume": {
  "commit": 18234,
  "subscriptions": [ { "sub": 7, "selector": "document", "start": "n123", "options": { "gated": true } } ],
  "pending": ["k3f9.412", "k3f9.413"]
}
```

After `welcome`, it sends its pending transactions again, in order, with the same transaction identities and temporary identities.

## 11.2 What the server does

The server finds the client's state by its client identity.

**If it still has the state** (the client was away briefly, and the server has not restarted), it sends one `commit` message per commit after `resume.commit` that concerns the client, as if the connection had not been lost. Resent transactions are answered from the table of applied transactions (O1), or applied if they never arrived.

**If it no longer has the state** (the server restarted, or the client was away longer than the state is kept), it:

1. Recreates the subscriptions in `resume.subscriptions`.
2. Sends, for each, a `selection` message with its complete membership (whitepaper section 8.14), and the records of every member that has changed since `resume.commit`. The client drops objects that are in none of the new memberships.
3. Answers resent transactions as usual. Those it remembers in its table of applied transactions (which is persistent, O1) are answered from it; others are applied.

This requires every record to carry the number of the commit that last changed it.

**R1. After reconnecting, the client converges.** Once the server has answered the resumed subscriptions and the resent transactions, and no further changes are in flight, the client's held objects equal the server's (P1).
*Maintained by:* both stores. *Verified:* the simulator, which cuts connections at random points, and restarts the server.

**Open.** The data model's record (section 8.1) must then include the commit that last changed the object, `$commit`. To be added there.

## 11.3 What the server must keep for reconnection

- Per client identity, for a configured time: its subscriptions, memberships, held objects, and the last commit sent.
- Persistently, for a configured period: the table of applied transactions.
- Per positional array, for a configured period: the splices committed to it, for transforming splices made against an older `base` (section 7.3).
- Per record: the commit that last changed it.

---

# 12. Presence

Presence objects (whitepaper section 3.11) are synchronized objects of a kind that is never stored. They travel in the same messages as other objects: created in `create`, changed in `writes`, delivered in `objects` and `changes`.

**PR1. Presence is never stored and never referred to by stored objects.** The server keeps presence objects in memory, with the session that created them, and removes them when the session ends, sending a `left` for them to every client that holds them. A write that would make a persistent object refer to a presence object is refused, with reason `value`.

**PR2. Presence may be throttled.** The server may coalesce changes to presence objects and send them at a lower rate than other changes, and may send them in a commit message of their own. Presence changes do not need commit numbers of their own.

**Open.** Whether presence should share the commit sequence at all, or travel in a separate, unnumbered message type, which would make throttling and dropping simpler and keep the commit numbers to persistent changes.

---

# 13. Invariants verified by the simulator

The simulator checks these at every quiet point: when no message is in flight and no transaction is pending.

**P1. Convergence.** For every client, every held object's local fields equal the server's fields of that object, except fields marked out of sync in gated subscriptions, whose `serverValue` equals the server's field instead.

**P2. Closure.** For every client, the set of held objects equals the union of its subscriptions' selections as the server computes them now, the server's record of it agrees (K1), and every reference in a held object names a held object or a known stub (S2).

**P3. Security.** No client has ever received a field of an object that its user could not read at the commit it was sent, according to an authorization oracle that evaluates `canRead` independently.

**P4. Atomicity.** For every client transaction, either all of its writes are reflected in exactly one commit, or none in any (W3), and the client has received exactly one answer for it.

**P5. Counts.** For every client and held object, `meta(object).sync.subscriptions` equals the number of that client's subscriptions whose selection contains the object.

**P6. Once only.** No transaction identity is applied twice (O1), whatever the cuts and resends.

**P7. Order.** Every client has received the commits that concern it in increasing order (C1), and every call's result after the commit of its effects (M1).

**P8. No silent loss in gated subscriptions.** In a gated subscription, no committed write of one client was overwritten by another client's write that was made without having seen it.

The simulator also runs every scenario a second time with a model: a single in-memory object graph to which every commit is applied directly, against which the server's state is compared.

---

# 14. Open points

| Point | Section |
|---|---|
| Compression or a binary encoding | 3 |
| Arrays holding the same object twice: per write or per array fallback | 7.2 |
| The transformation of positional splices, and how long their history is kept | 7.3 |
| Whether a refused gated transaction keeps the client's values | 7.4 |
| Whether a commit message repeats the client's own writes | 8.1 |
| What the user interface is told when an edited object leaves | 8.3 |
| Calls after a lost connection | 9 |
| How long applied transactions are remembered | 10 |
| `$commit` in the data model's record | 11.2 |
| Presence in the commit sequence, or in messages of its own | 12 |

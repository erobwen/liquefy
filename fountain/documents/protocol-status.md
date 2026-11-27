# The protocol: what is implemented

*Part of [Fountain](../README.md). [The protocol](protocol.md) is the specification; this document says how much of it the server implements, in `src/protocol.js`, and where the implementation differs from it. It covers the seventh step of [the whitepaper](../whitepaper.md)'s roadmap: authenticated connections, subscribing, receiving a selection and its changes, and reconnecting, for read-only clients.*

```javascript
const connection = fountain.connect((message) => socket.send(JSON.stringify(message)));
socket.on("message", (text) => connection.receive(JSON.parse(text)));
socket.on("close", () => connection.close());
```

The server takes any transport that delivers JSON messages in order. A WebSocket server is not part of Fountain yet; the lines above are all it takes.

`PlainClient` (`src/plainClient.js`) is a client that keeps plain records, with no Cascade world. It is what the simulator checks the server against, and what a script can use. The client store of step 8 does the same inside a Cascade world.

---

# Implemented

| Section | What |
|---|---|
| 4.1, 4.2 | `hello`; `welcome` with the latest commit, the session's identity and its methods; `reload` for other code or other classes; `refused` for another protocol version or a token that is not good. Nothing is accepted before `hello` (L1). |
| 4.3 | The session in a `volatile` message right after `welcome`. A token gives the session that the token's other connections share, or one made anew for its user, also after a restart. |
| 4.4, 5.1 | Closing a connection releases its subscriptions and forgets what it held. Each connection is a view of its session: its own subscriptions, held objects and deliveries. |
| 6.1, 6.2 | `subscribe`, answered with a whole `selection`: its members, the records the client does not hold, and the stubs they refer to. Refusals with reasons `selector`, `missing`, `start` and `sub`. A client subscribes only from what it knows of (F1): what its session refers to, what a method returned, or what something it holds refers to. |
| 6.3 | `unsubscribe`, answered with `left` and the identities that left every selection. |
| 8.1 | `commit` messages: `changes` as `set`, `delete`, `insert`, `remove` and `splice`, in order; `objects`; `stubs`; and `joined` and `left` per subscription. In increasing order (C1), only for commits that concern the client. |
| 8.4 | `pong` carries the latest commit. |
| 9 | `call`, answered with `result` or `error`. Effects arrive before the result (M1). A failed call says only what the method chose to say, through `RemoteError`, `AuthorizationError` or `AuthenticationError`; any other error is "The call failed." (M3). A reference that a method returns is a root that the client may subscribe from. |
| 11 | `resume`: the subscriptions are made again, each answered with a `selection` whose `objects` hold only the members the client does not hold, or that changed since its last commit, by Aquifer's `lastChanged`; what was reclaimed meanwhile is listed under `reclaimed`. |
| 12 | Changes to the session travel in `volatile` messages, to every connection of the session. |

**Verified by** tests of each message, and a simulator (section 14): three clients of two users, over channels that copy each message through JSON, deliver in random order across connections, and can be cut. The world changes notes, rights and owners at random; clients rename notes through calls, subscribe and unsubscribe, lose their connections and reconnect with `resume`; and the server restarts on the same store. At every quiet point it checks P1 (every record the client holds equals the server's), P2 (each subscription's members equal the selection computed from nothing, and every reference resolves), P3 (no record or change was sent of an object that an independent oracle says the user may not read, at the moment it was sent), P5 (what the client counts equals the server's memberships) and P7 (commits in order). Each run must have made at least five cuts, two restarts, five calls and a hundred commit messages.

---

# Different from the specification

- **Roots after reconnecting.** A root that a session method returned is remembered by the session, for as long as it lives. After a restart, the session is made anew from the token, and only what its fields refer to is known. An application sets those fields in `session.signedIn()`, which is called each time the session is bound to a user, also when a token is taken up again. A resumed subscription whose start the client may no longer name is refused with `missing`.
- **A commit message without a new commit.** Selections can change in a transaction that changed only volatile objects. What that changed of stored objects is sent as a `commit` message carrying the last commit number sent, so commit numbers never decrease, though they can repeat (C1 says increasing).
- **Stubs in more messages.** `volatile` and `result` messages carry `stubs`, for references to objects the client does not know: the session's user, and what a method returned.
- **`protocolError`.** A message that cannot be understood, or one sent before `hello`, is answered with `{ "type": "protocolError", "message": ... }`, and the connection is closed. A `transaction` is answered with `protocolError`, and the connection stays open: clients are read-only.
- **No connection object.** The session is delivered alone; the volatile connection object of section 4.3 does not exist yet.
- **`at`** is sent only to carry `reclaimed` after resuming, when no selection did.

---

# Not done

- **Writes from clients** (section 7): the `transaction` message, temporary identities, refusals, and the table of applied transactions (section 10). Step 8 of the roadmap.
- **Gated subscriptions** (sections 6.1 and 7.5).
- **Presence objects** (section 12, VO4 to VO6).
- **`reclaimed` during a connection.** Reclaims are reported only on resuming.
- **Heartbeat timeouts** (T3), which are the transport's.
- **`create` in calls:** a call's arguments are values and references to what the client knows of.
- **Metadata on the client** (section 13), which is the client store's.

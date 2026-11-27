# Fountain

*In progress - the user model is implemented: users, the super user, sessions, signing in with a password or through an external login service, the session's remote methods, and authorization through `canRead` and `canWrite`; observation: change sets, observers, and what each session is to be sent after each commit; selections: named selectors, parts that come along, which subscriptions hold what, and incremental selections tested against whole ones; and the protocol, for read-only clients: connections, subscriptions, changes, calls and reconnecting. Clients cannot write yet.*

Fountain is the server Liquefy is heading toward: full stack reactivity, with
persistent JavaScript objects as the one model shared by the database, the
server and every connected client.

- A central server holds the authoritative object graph. It is built in three
  layers: [Aquifer](../aquifer) stores records and collects garbage,
  [Deepwell](../deepwell#readme) (in progress) makes them persistent JavaScript objects that server
  code loads and writes like any others, and Fountain adds users and clients.
- Clients subscribe to selections of objects over WebSockets, and receive
  incremental updates as the data changes. On both sides, the reactivity is
  [cascade.reactive](../cascade.reactive#readme)'s.
- What a client holds is defined by data selectors: functions that select the
  objects that belong together, such as everything in a document. A selection
  follows the graph as it changes.
- Writes are one real-time stream to the server, and the last write wins.
  Locks and anything stricter are built by applications on top.
- Indexes are ordinary persistent objects, kept live by persistent repeaters
  (pure computations, such as an index key, whose dependencies are stored), so
  the result of a query can be updated as the data changes.
- Users and sessions are built in. Authorization is per object, written as
  methods of the application's own classes, and runs the same on both sides.
- A client calls the server through methods of its session object, which is
  the server's API and its security gateway.
- Schemas migrate lazily, one object at a time, as objects are loaded.

## What exists

```javascript
import { open } from "@liquefy/deepwell";
import { createFountain, Session } from "@liquefy/fountain";

class AppSession extends Session {
    createDocument(title) { ... }          // every method here is a remote method
}

const fountain = createFountain({ well, Session: AppSession, superUser: { name: "admin", password } });

const session = fountain.createSession();                 // anonymous
fountain.call(session, "signIn", ["admin", password]);   // what a client's call will do
fountain.as(session, () => { document.title = "New"; });  // what a client's write will do: asks canWrite
```

A session's method runs as trusted code, as one transaction that is made whole
or not at all. A write made as a user is asked about first: the object's
`canWrite`, that the session holds the object, and that it refers only to what
it knows of. `fountain.registerSelector(name, rules)` registers a selector, and
`fountain.subscribe(session, start, name)` is what makes a session hold
objects; its selection passes only through what the user may read, takes the
arrays and classless objects of what it selects along, and follows the rights
as they change. After each commit, each session
that holds something the commit wrote is given a delivery: what joined and left
its selections, and the fields that changed (`fountain.takeDeliveries(session)`,
`fountain.onDelivery(session, listener)`). A client that applies them converges
with what the server holds for it. `fountain.observe(compute, changed)` runs a
computation again when a commit writes what it read.

`fountain.connect(send)` opens a connection of the protocol, over any transport
that carries JSON messages in order; `PlainClient` is a client of it that keeps
plain records. A simulator cuts connections and restarts the server, and checks
that clients converge.

```console
npm test -w @liquefy/fountain
```

## Documents

The design is in [the whitepaper](whitepaper.md), which lists the decisions
made so far and what is still open. The specifications, written one layer at a
time before each is built, are in [documents](documents):
[the user model](documents/user-model.md),
[observation](documents/observation.md),
[selections](documents/selections.md) and
[the protocol](documents/protocol.md), with [its status](documents/protocol-status.md), here, on
[the data model](../deepwell/documents/data-model.md), which is Deepwell's. The storage and garbage collection layer
was built first, in Aquifer, and is described in
[its own documents](../aquifer/documents/persistent-garbage-collection.md).

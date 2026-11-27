# Fountain

*Planned - nothing here runs yet.*

Fountain is the server Liquefy is heading toward: full stack reactivity, with
persistent JavaScript objects as the one model shared by the database, the
server and every connected client.

- A central server holds the authoritative object graph. It is built in three
  layers: [Aquifer](../aquifer) stores records and collects garbage,
  [Deepwell](../deepwell#readme) (planned) makes them persistent JavaScript objects that server
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

The design is in [the whitepaper](whitepaper.md), which lists the decisions
made so far and what is still open. The specifications, written one layer at a
time before each is built, are in [documents](documents):
[the protocol](documents/protocol.md) here, on
[the data model](../deepwell/documents/data-model.md), which is Deepwell's. The storage and garbage collection layer
was built first, in Aquifer, and is described in
[its own documents](../aquifer/documents/persistent-garbage-collection.md).

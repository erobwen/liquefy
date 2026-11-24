# Fountain

*Planned - nothing here runs yet.*

Fountain is the server Liquefy is heading toward: full stack reactivity, with
persistent JavaScript objects as the one model shared by the database, the
server and every connected client.

- A central server holds the authoritative object graph, stored in
  [Frozen](../frozen), Liquefy's garbage collected object database.
- Clients subscribe to objects, or to reactive projections of them, over
  WebSockets, and receive incremental updates as the data changes. On both
  sides, the reactivity is [cascade.reactive](../cascade.reactive#readme)'s.
- What a client holds is defined by data selectors: functions that select the
  objects that belong together, such as everything in a document. A selection
  follows the graph as it changes.
- Writes are one real-time stream to the server, and the last write wins.
  Locks and anything stricter are built by applications on top.
- Indexes are ordinary persistent objects, kept live by persistent repeaters
  (pure computations, such as an index key, whose dependencies are stored), so
  the result of a query can be updated as the data changes.
- Authorization is per object, written as methods of the application's own
  classes.
- Shared, immutable snapshots serve large numbers of passive readers without a
  live subscription each.
- Schemas migrate lazily, one object at a time, as objects are loaded.

The design is in [the whitepaper](whitepaper.md). Its garbage collection part
(sections 8-15) is the one being built first, in Frozen. Its
[design document](../frozen/documents/persistent-garbage-collection.md) takes
it further.

# Aquifer

*A prototype - not published.*

A JavaScript-first persistent object database with change-driven garbage
collection. It is the first piece of Liquefy's full stack reactivity: the storage under
[Wellspring](../wellspring#readme), the planned layer of persistent JavaScript objects, and
[Fountain](../fountain#readme), the planned server on top of that.

Aquifer works with records: ids, fields, and strong and weak references. It
knows nothing of classes or reactivity, and does not depend on Cascade.

Objects are stored as plain JavaScript objects whose references to each other
are strong or weak (`ref`, `weak`). Anything that can't be reached from `ROOT`
is garbage. It is found incrementally, as references change, without scanning
the whole database:

- a spanning tree of reachable objects is kept up to date, together with
  every object's incoming references;
- cutting a tree edge makes the subtree under it unstable; that subtree is
  then checked for another way back to the tree, and whatever can't find one
  is reclaimed, cycles included;
- objects are grouped into regions, and regions into meta-regions, so that
  heavily shared objects and large subtrees stay cheap to collect. A whole
  region can be suspended, checked and reclaimed as one.

Stores: `MemoryStore`, and `LmdbStore` on [LMDB](https://github.com/kriszyp/lmdb-js).

```console
npm test -w @liquefy/aquifer
```

[aquifer.visualizer](../aquifer.visualizer#readme) shows the collector step by step.

## For the layer above

Besides transactions over records, Aquifer offers what [Wellspring](../wellspring#readme)
needs from it:

- **Volatile roots:** `tx.pin(id)` keeps an object alive though nothing
  refers to it, until `tx.unpin(id)`, or until the database is opened again.
- **Commit numbers:** `tx.commit` and `db.lastCommit`, one per application
  transaction; `db.lastChanged(id)`, the commit that last changed an object.
- **`onReclaimed(ids)`:** called after a collector step that reclaimed objects
  has committed.
- **`db.collector.backlog()`:** how much collector work is pending, so that a
  caller that runs the collector in a ratio to its own work can tell when it
  falls behind.
- **`db.getMany(ids)`:** many objects in one read, as a Map from id to
  fields. This is the read that is meant to be able to wait, when a store
  on a slow disk or on another machine needs it to; today it answers at once.

## Documents

- [persistent-garbage-collection.md](documents/persistent-garbage-collection.md) - the collector's design
- [invariants.md](documents/invariants.md) - what the store and the collector keep true
- [backlog.md](documents/backlog.md) - what is left to do
- [original-proposal.md](documents/original-proposal.md) - the proposal the design started from, moved here from the Fountain whitepaper
- [The Fountain whitepaper](../fountain/whitepaper.md) - the larger system this is part of

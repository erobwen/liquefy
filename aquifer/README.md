# Aquifer

*A prototype - not published.*

A JavaScript-first persistent object database with change-driven garbage
collection. It is the first piece of Liquefy's full stack reactivity, and the
storage of [Fountain](../fountain#readme), the server that is planned on top of it.

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

## Documents

- [persistent-garbage-collection.md](documents/persistent-garbage-collection.md) - the collector's design
- [invariants.md](documents/invariants.md) - what the store and the collector keep true
- [backlog.md](documents/backlog.md) - what is left to do
- [original-proposal.md](documents/original-proposal.md) - the proposal the design started from, moved here from the Fountain whitepaper
- [The Fountain whitepaper](../fountain/whitepaper.md) - the larger system this is part of

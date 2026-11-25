# Wellspring

*Planned - nothing here runs yet.*

Wellspring makes persistent JavaScript objects out of
[Aquifer](../aquifer#readme)'s records: objects that server code loads, reads
and writes like any others, and that are stored without the application saying
so.

It is the middle of Liquefy's three layers for full stack reactivity:

- [Aquifer](../aquifer#readme) stores records, runs transactions, and collects
  garbage. It knows nothing of classes or reactivity.
- **Wellspring** turns records into objects: instances of registered classes,
  one per identity, observable through
  [cascade.reactive](../cascade.reactive#readme).
- [Fountain](../fountain#readme) adds users, sessions, security, and clients
  that stay in sync over WebSockets.

Wellspring can be used on its own, by an application with no clients: a
server-side tool, a desktop application, a single-user editor that keeps its
documents as objects.

```javascript
// The interface is illustrative.
const spring = open({ store: new LmdbStore("./data"), classes: { Document, Chapter } });

load(spring.root, selectLibrary, () => {
    // Everything the selector selects is in memory here, and stays there
    // for as long as the load is held.
    for (const document of spring.root.documents) {
        document.title = document.title.trim();   // stored at the end of the transaction
    }
});
```

- **Persistence by reachability.** An object becomes persistent when a
  persistent object refers to it, and is garbage when it can no longer be
  reached from the root. Nothing is saved or deleted by calling a method.
- **Explicit loading.** `load` names a starting object and a selector, and
  holds what the selector selects in memory, following the graph as it
  changes. It is to a server what `subscribe` is to a Fountain client.
- **Classes and migrations.** Classes are registered by name, constructors run
  once, and objects of older versions are migrated when they are loaded.
- **Indexes as ordinary objects**, kept up to date by persistent repeaters:
  pure computations, such as an index key, whose dependencies are stored, so
  that they are evaluated again when something they read changes, also after a
  restart.

## Documents

- [design.md](documents/design.md) - what Wellspring is for, loading and
  unloading, transactions, observation, indexes and persistent repeaters,
  migration, and what it asks of Aquifer and offers Fountain
- [data-model.md](documents/data-model.md) - the specification of what a
  persistent object is, which values its fields can hold, and how they are
  stored and sent, with invariants
- [The Fountain whitepaper](../fountain/whitepaper.md) - the larger system
  this is part of

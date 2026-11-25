# Wellspring

*In progress - the data model and objects over Aquifer's records are implemented; loading and unloading, migrations, and indexes are planned.*

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
// load() is planned; the rest exists.
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

## What exists

**Objects over records** (`src/spring.js`): open a store, and its root is an
object like any other. What a stored object comes to refer to is stored with
it; a reference is loaded when it is first read; each Cascade transaction is
written as one Aquifer transaction.

```javascript
import { MemoryStore } from "@liquefy/aquifer";
import { open, transaction, Synchronized, synchronized } from "@liquefy/wellspring";

class Document extends Synchronized { title = "Untitled"; }

const spring = open({ store: new MemoryStore(), classes: { Document } });
transaction(() => {
    spring.root.documents = synchronized([]);
    spring.root.documents.push(new Document());   // stored: reachable from the root
});
```

**The data model** ([specification](documents/data-model.md), `src/dataModel.js`),
which Fountain's clients share, and which loads without Aquifer as
`@liquefy/wellspring/dataModel`: `Synchronized` and `synchronized()`, the
check on what a field may hold, the registry of classes, weak references, and
the encoding of values and records.

```console
npm test -w @liquefy/wellspring
```

## Documents

- [design.md](documents/design.md) - what Wellspring is for, loading and
  unloading, transactions, observation, indexes and persistent repeaters,
  migration, and what it asks of Aquifer and offers Fountain
- [data-model.md](documents/data-model.md) - the specification of what a
  persistent object is, which values its fields can hold, and how they are
  stored and sent, with invariants
- [The Fountain whitepaper](../fountain/whitepaper.md) - the larger system
  this is part of

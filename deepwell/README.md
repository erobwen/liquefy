# Deepwell

*In progress - the data model, objects over Aquifer's records, loading and unloading, selectors as local rules, checks before writes, volatile objects, migrations, and indexes, also with keys that read other objects, are implemented.*

Deepwell makes persistent JavaScript objects out of
[Aquifer](../aquifer#readme)'s records: objects that server code loads, reads
and writes like any others, and that are stored without the application saying
so.

It is the middle of Liquefy's three layers for full stack reactivity:

- [Aquifer](../aquifer#readme) stores records, runs transactions, and collects
  garbage. It knows nothing of classes or reactivity.
- **Deepwell** turns records into objects: instances of registered classes,
  one per identity, observable through
  [cascade.reactive](../cascade.reactive#readme).
- [Fountain](../fountain#readme) adds users, sessions, security, and clients
  that stay in sync over WebSockets.

Deepwell can be used on its own, by an application with no clients: a
server-side tool, a desktop application, a single-user editor that keeps its
documents as objects.

```javascript
const well = open({ store: new LmdbStore("./data"), classes: { Document, Chapter } });

load(well.root, selectLibrary, () => {
    // Everything the selector selects is in memory here, and stays there
    // for as long as the load is held.
    for (const document of well.root.documents) {
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

**Objects over records** (`src/well.js`): open a store, and its root is an
object like any other. What a stored object comes to refer to is stored with
it; a reference is loaded when it is first read; each Cascade transaction is
written as one Aquifer transaction. `load(start, selector, action)` holds a
selection in memory, and pins it in Aquifer, until it is released; what
nothing holds is unloaded, and read from its record again when needed. A
selector is a function that fills the whole selection, or a table of local
rules by class name, `{ Node: (node, selection) => selection.add(node.left, node.right) }`,
which is applied in rounds, with one read of the store for each level, and
which also works when the store has to wait for a read.
`well.checkWrites(check)` sees every write before it is made, and can refuse
it; `well.atomic(action)` is a transaction that is made whole or not at all; `well.volatile(object)` makes an object that is synchronized but never
stored. A class with `static version` and `static migrations` has its older
objects migrated as they are loaded, each in a transaction of its own;
`well.completeMigrations()` finishes the rest in the background.

**Indexes** (`src/indexes.js`, specified in [documents/indexes.md](documents/indexes.md)):
a class that extends `Index` and defines `keyOf(member)` is a B-tree of
persistent objects. `index.add(product)` files a member under its key; a write
to the member that changes its key moves it, in the same transaction;
`index.members({ from: 10, to: 20 })` and `index.keys(...)` answer ranges in
key order, reading one node for each level of the tree. A key may read other
objects, such as `product.price * product.currency.rate`: a write to the
currency moves the products whose keys read it, in the same transaction if
they are few, and in the background, with the index saying it is stale, if
they are many.

```javascript
import { MemoryStore } from "@liquefy/aquifer";
import { open, transaction, Synchronized, synchronized } from "@liquefy/deepwell";

class Document extends Synchronized { title = "Untitled"; }

const well = open({ store: new MemoryStore(), classes: { Document } });
transaction(() => {
    well.root.documents = synchronized([]);
    well.root.documents.push(new Document());   // stored: reachable from the root
});
```

**The data model** ([specification](documents/data-model.md), `src/dataModel.js`),
which Fountain's clients share, and which loads without Aquifer as
`@liquefy/deepwell/dataModel`: `Synchronized` and `synchronized()`, the
check on what a field may hold, the registry of classes, weak references, and
the encoding of values and records.

```console
npm test -w @liquefy/deepwell
```

## Documents

- [design.md](documents/design.md) - what Deepwell is for, loading and
  unloading, transactions, observation, indexes and persistent repeaters,
  migration, and what it asks of Aquifer and offers Fountain
- [data-model.md](documents/data-model.md) - the specification of what a
  persistent object is, which values its fields can hold, and how they are
  stored and sent, with invariants
- [indexes.md](documents/indexes.md) - the specification of indexes: keys,
  the tree, what a member knows of its indexes, and when a key is evaluated
  again, with invariants
- [The Fountain whitepaper](../fountain/whitepaper.md) - the larger system
  this is part of

# Wellspring design

*Design, draft. Nothing here runs yet. Sections 6 to 8 were moved here from [the Fountain whitepaper](../../fountain/whitepaper.md) in November 2026, where they were sections 5.1 to 5.4, 5.7 and 6.*

Wellspring is the layer between [Aquifer](../../aquifer#readme) and [Fountain](../../fountain#readme). Aquifer stores records and collects garbage. Wellspring turns those records into persistent JavaScript objects that server code loads, reads and writes like any others. Fountain adds users, sessions and clients.

This document says what Wellspring is for, what its interface looks like, how loading and unloading work, and how derived data, such as indexes, is kept up to date. What exactly an object is, and how it is stored, is in [the data model](data-model.md).

---

# 1. Purpose and scope

**What Wellspring does**

- Makes objects from records, and records from objects ([data model](data-model.md)).
- Keeps one object per identity.
- Stores changes without the application saying so: a property write is a write to the database.
- Decides what is in memory: `load` brings a selection of objects in and holds it there; what nothing holds can be dropped.
- Registers classes by name, and migrates objects of older versions when they are loaded (section 8).
- Records what computations read, and triggers them when it changes (section 5).
- Maintains derived data that must survive restarts, such as indexes, through persistent repeaters (sections 6 and 7).

**What it does not do**

It has no users, no sessions, no authorization, no network, and no clients. Those are Fountain's. It does not collect garbage, and does not know how records are stored; those are Aquifer's.

**Who can use it alone**

An application with no clients: a server-side tool, a desktop application, a single-user editor that keeps its documents as objects. Such an application opens a store, loads what it works on, and changes it.

**What it is built from**

- Aquifer, for records, transactions, and garbage collection.
- cascade.reactive, for two things. Its change events are how an ordinary property write becomes a write to the database. Its recording of reads is how a selection, or a persistent repeater, knows what it depends on. Only plain, timeless observables are needed; the temporal signals that order a rendering pipeline are not.

---

# 2. The interface

The interface is illustrative. It shows the shape, not the final names.

```javascript
import { open, load, transaction } from "@liquefy/wellspring";
import { LmdbStore } from "@liquefy/aquifer/src/store/LmdbStore.js";

class Document {
    title = "Untitled";
    chapters = observable([]);
}

const spring = open({
    store: new LmdbStore("./data"),
    classes: { Document, Chapter, Paragraph },
});

// Creating: the document becomes persistent when a persistent object refers to it.
transaction(() => {
    const document = observable(new Document());
    spring.root.documents.push(document);
});

// Loading: everything the selector selects is in memory inside the action.
load(spring.root, selectLibrary, () => {
    for (const document of spring.root.documents) {
        console.log(document.title);
    }
});

// Writing: an ordinary assignment, stored at the end of its transaction.
document.title = "A New Title";
```

**The root.** A database has one root object, `spring.root`, which always exists and is always loaded. Everything persistent is reachable from it (whitepaper section 4.5).

**Transactions.** A transaction is Cascade's: `transaction(() => {...})`. At its end, after the repeaters it set off have run, its changes are written as one Aquifer transaction. A write made outside any transaction is a transaction of its own.

**Persistence by reachability.** An object becomes persistent when a persistent object comes to refer to it. At the end of a transaction, Wellspring follows the new references from stored objects and stores every object they reach that is not yet stored. Nothing is saved by calling a method, and nothing is deleted by calling one: an object that can no longer be reached from the root is garbage, and Aquifer reclaims it.

An observable that no persistent object refers to is an ordinary object in memory, and is never stored. This is how the same world can hold both the application's data and objects that must not be stored, such as Fountain's sessions and selections.

**Open.** Whether persistence by reachability is enough, or whether a class should also be able to say that its instances are never persistent, so that a reference to one from a persistent object is an error rather than a request to store it. Fountain's presence objects need the second (whitepaper section 3.11).

---

# 3. Loading and unloading

## 3.1 Load

Code must have an object before it can work on it, and the object's fields must be in memory.

```javascript
load(document, selectDocument, () => {
    // Everything selectDocument selects from document is in memory,
    // and stays there for as long as this load is held.
});
```

A selector is a function that takes an object and a set, and fills the set with every object that belongs with it (whitepaper section 3.4). `load` runs the selector, reads from Aquifer whatever is not in memory, and then runs the action. Since Aquifer reads synchronously, `load` is synchronous: the action has run when it returns.

`load` is to a server what `subscribe` is to a client (whitepaper section 3.7). The two have the same shape, so code written against a selection runs on either side.

## 3.2 A load is held, and follows the graph

A load is not a one-off read. It holds its selection until it is released, and the selection follows the graph: running the selector is a reactive computation, which records what it reads, and when that changes, objects that join the selection are loaded, and objects that leave it are let go.

Every object counts the loads that hold it. When the count falls to zero, the object can be unloaded.

A load made inside a reactive computation belongs to that computation: it is released when the computation is disposed, and kept when the computation runs again and makes the same load. A load made outside one returns a handle with which it is released.

## 3.3 Held objects are volatile roots

An object that a load holds must not be reclaimed, though nothing in the database may refer to it any longer: code is working on it, and may link it in again. Wellspring pins it in Aquifer for as long as it is held (Aquifer's volatile roots).

## 3.4 Unloading

An object that nothing holds can be dropped from memory. Its record stays in Aquifer.

The identity map must still give the same object for the same identity for as long as any code has a reference to it. The proposal is that the map holds unheld objects weakly, through JavaScript's `WeakRef`: an unheld object stays in the map until the JavaScript engine finds that nothing refers to it, and is then gone. An object that is held is referred to strongly.

**Open.** Whether weak holding by the JavaScript engine is enough, or whether memory must also be bounded explicitly, by dropping the fields of unheld objects that have not been used for a while and leaving them as stubs. The earlier attempts kept a list of the least recently used objects for this.

## 3.5 Reading what is not loaded

A reference that leaves a loaded selection names an object whose fields may not be in memory: a stub ([data model](data-model.md) section 7).

On a server, the fields could be read on demand, since Aquifer reads synchronously. Whether to do so is a choice between convenience and discipline:

- **Load on demand.** Reading a field of a stub loads the object. Code never fails for lack of a load. But nothing holds the object, and code that works here would fail on a client, where loading cannot be synchronous.
- **Report.** Reading a field of a stub is an error in development, as on a client.

The proposal is to load on demand, and to report it in development when Wellspring is used under Fountain, where the same code may run on clients. Used alone, loading on demand is simply a convenience.

---

# 4. Transactions and the store

Wellspring is a store in the sense of whitepaper section 3.8: it receives every change to every object that belongs to it, through Cascade's `onEventGlobal`, collects the changes of a transaction, and at the transaction's end (`onTransactionEnd`) writes them.

Writing a transaction means, in one Aquifer transaction:

1. Storing every object that has become reachable from a stored object (section 2).
2. Encoding the changed fields ([data model](data-model.md) section 8) and writing the records.
3. Running the persistent repeaters that the changes trigger, when they are of the kind that runs inside the transaction (section 7.3), and writing what they change.

If any of it fails, nothing is written, and the objects in memory are returned to their state before the transaction.

**Open.** Returning objects in memory to their earlier state requires the old values, which Cascade's change events carry. Whether that is done by replaying the events backwards, or by reloading the objects from their records, is to be decided.

Aquifer reports the change set of the commit, and its commit number (section 9). Wellspring passes it on, in terms of objects, to whoever listens: its own observers (section 5), and Fountain.

---

# 5. Observation

Wellspring needs to know when something that a selection or a persistent repeater has read is changed.

It does not need the temporal signals that Cascade uses to order a rendering pipeline. On a server, order is given by commits. Plain observation is sufficient: what was read, and whether it has since been written.

**The change set of a commit is the source of all triggers.** Every transaction produces a change set: the objects and fields it wrote. Everything that reacts to data does so by matching what it read against committed change sets.

**Volatile observers.** A load's selection, and anything Fountain builds on top, such as a session's selections and live queries, is in memory only. What it read is kept in memory, in a table from object and field to observer, beside the objects rather than in their records. Nothing about it is stored. After a restart it is gone, which is correct, because the code that made it is gone too.

**Persistent observers.** A persistent repeater maintains something that is stored, so it must be triggered by every relevant change, also after a restart, and also when the objects involved are not in memory. Its dependencies cannot be references to observers in memory. Section 7.2 describes what is stored instead.

**When observers run.** A persistent repeater that maintains a transactional index runs inside the transaction that triggered it, before the commit. Volatile observers run after the commit, and see only committed state.

---
# 6. Indexes

## 6.1 Indexes as ordinary objects

The database should not require every index to be implemented as a special database-engine feature.

Instead, indexes can be ordinary persistent JavaScript data structures.

Examples include:

- B-trees.
- Quadtrees.
- Search trees.
- Lookup tables.
- Application-specific navigation structures.

An index can maintain references to ordinary persistent objects.

## 6.2 Live indexes

An index has three parts:

- **A member set:** the objects it covers. This is a collection, or more generally a selection (whitepaper section 3.4).
- **A key:** a function of a member. It may be computed, and it may read other objects.
- **An ordered structure:** for example a B-tree whose nodes are persistent objects, holding the members sorted by key.

```javascript
defineIndex("productsByPrice", {
    members: catalog => catalog.products,
    key: product => product.price * product.currency.rate
});
```

The API is illustrative.

The index is live: when the key of a member changes, the member moves to its new position, and when the member set changes, entries are added and removed.

---

# 7. Persistent repeaters

## 7.1 A computed value and a reaction

What keeps an index up to date is a set of persistent repeaters: one per member, each computing that member's key.

A Cascade repeater runs again when something it read changes, and may do anything when it runs. A persistent repeater runs again when something it read changes, also after a restart, and also when what it read is no longer in memory. It therefore cannot be allowed to do anything.

**A computed value, and a reaction to its change**

A persistent repeater is split in two:

- **compute** is a pure, read-only function from the repeater's subject to a value. Its last value and what it read are stored.
- **changed** is called, with the old and the new value, when an evaluation gives a value different from the stored one. It belongs to the owner of the repeater, such as the index, and it does the actual work.

This mirrors the split in Cascade's components between building and reconciling. The persistent part is a function; the part with effects is ordinary code in the owner.

**A closure is an object and a method**

A closure cannot be stored. A persistent repeater is therefore defined by an object and the names of its methods, not by functions:

```javascript
class PriceIndex extends PersistentIndex {
    keyOf(product) {                       // compute: pure, writing throws
        return product.price * product.currency.rate;
    }
    keyChanged(product, oldKey, newKey) {  // changed: the index does the work
        this.remove(product, oldKey);
        this.insert(product, newKey);
    }
}
```

The API is illustrative.

An instance of a persistent repeater is stored as the owner, the method names, the subject, the version of the owner's class, the last value, and the dependency records for what it read (section 7.2). The owner's class is registered by name, as all persistent classes are, so the code can be found again after a restart.

An instance is created when its subject joins the member set, and removed when its subject leaves the set or is reclaimed.

**Granularity**

There is one key repeater per index and member. A key that reads only its member needs no stored dependencies at all (section 7.2). That is the common case, and it is cheap.

A single repeater for a whole index would be the same as rebuilding it on every change. It is useful only as the test oracle.

The same structure, at the level of selections, gives rule repeaters: one per selection and object, computing which objects are selected along with it (whitepaper section 3.5).

**Maintaining the tree**

The nodes of the index are not persistent repeaters.

What a node holds is not a pure function of a small set of reads. It is the result of an algorithm, such as insertion with node splits or the rotations of an AVL tree, that writes. That algorithm is the index's own ordinary code: the `insert` and `remove` methods that `keyChanged` calls, and the rebalancing they do.

It runs as part of the transaction that triggered the key repeater, or in a background step (section 7.2). Its writes to the nodes are ordinary writes, committed like any others. A query that read a node it rewrote is triggered (whitepaper section 5.5); a rotation that does not change a query's result gives the query an evaluation that finds nothing to send.

The kind of tree matters more for a persistent index than for one in memory. Every node that an operation touches has to be loaded and written. A B-tree, with many keys per node, touches a few nodes per operation; a binary tree such as an AVL tree touches one per level, and rebalancing touches more. B-trees are therefore the default. Other structures can be written the same way.

**Three restrictions**

1. **A computed value is a pure function of persistent state.** It reads objects and nothing else: no clock, no session, no randomness. It is evaluated in a context where writing fails.

2. **The owner is the only writer of what it maintains.** Nothing but the index's own code modifies its nodes.

3. **What a persistent repeater maintains can be rebuilt from nothing.** This follows from the first two.

The third property carries a great deal. It is the recovery strategy if an index is damaged. It is the migration strategy when the definition of an index changes: the stored index records the version of its class, and a newer version causes a rebuild. And it is the test oracle: an incrementally maintained index can be compared with one built from scratch, under random mutation.

The same restrictions allow persistent repeaters that maintain other derived data, such as counters or denormalized fields. Persistent repeaters that write arbitrary shared objects in response to changes are deliberately not proposed. Their order, termination, and recovery are much harder to reason about.

**The name**

These were first called index demons. A demon, or a daemon, suggests an ongoing process, and nothing here runs continuously. Something is awakened when what it read changes, computes, and is still again: that is what a Cascade repeater is, with dependencies that outlive memory. "Persistent repeater" says exactly that. The two kinds are key repeaters and rule repeaters.

## 7.2 Triggering a persistent repeater without stored observers

A persistent repeater must be triggered by changes to objects that are not in memory, and after a restart.

Storing a reference to an observer in each observed object is not possible, and is not necessary.

**Keys that read only the member itself**

For each member, the index stores the key it was last filed under. This is needed in any case, to find the entry.

Any committed write to a member causes its key to be evaluated again and compared with the stored one. If they differ, the entry moves.

No dependencies are stored at all. Membership is the trigger.

This is the common case, and it costs one key evaluation per written member per index.

**Keys that read other objects**

A key such as `product.price * product.currency.rate` depends on an object other than the member.

When the key is evaluated, the objects it read are recorded. For each one other than the member itself, a dependency record is stored: from the object read, to the index and the member.

These are records in the store, keyed by the identity of the object read, like the collector's edge index. They are not part of the objects, and they are changed only when an evaluation reads a different set of objects than the previous one did, which is rare.

A committed write to an object looks up its dependency records and triggers the members they name.

**Objects that many keys depend on**

If a million product keys read one currency rate, a change of the rate moves a million entries. That work is inherent in the index, whoever performs it.

It cannot be done inside the transaction that changed the rate. It is done in the background, in bounded steps from a persistent worklist, in the same way the garbage collector works. Meanwhile, the index is known to be stale for those members.

The million dependency records are not inherent, however. They can be replaced by a single coarse record saying that the index as a whole depends on the rate, at the price of evaluating every key again when it changes. This is the trade-off the collector makes with its abstract incoming references (whitepaper section 7).

**Members that are reclaimed**

An index holds its members weakly, unless the index is itself the collection that owns them.

When a member is reclaimed, its entry and its dependency records are removed.

Removing an entry is not the same as clearing a reference. The tree may have to be rebalanced, and node summaries updated. A note from an earlier attempt (whitepaper section 9.1) says that indexes therefore cannot hold weak references at all. They can, but only if the collector, before it reclaims a member, calls the index's own removal code, as it would call `keyChanged` for a key that had disappeared. The weak reference marks what does not keep the member alive; the index's code does the removal.

## 7.3 Consistency

Required index maintenance must participate in the database's consistency model.

An index that is expected to be complete and authoritative cannot simply update whenever a background reactive scheduler happens to execute.

The architecture should distinguish:

1. Synchronously maintained transactional indexes. A key repeater that reads only its member, or a few other objects, runs inside the triggering transaction.
2. Eventually consistent derived indexes. Work caused by a widely read object is done in the background, and the index records which members are stale.
3. Lazy indexes whose coverage is explicitly tracked. An index being built, or rebuilt after its definition changed, records how much of its member set it covers.

This distinction also applies to schema migrations.

---

# 8. Lazy schema migration

Because objects are loaded individually, the database can support per-object schema evolution.

A class might define:

```javascript
class Book extends PersistentObject {
    static type = "Book";
    static version = 3;

    static migrations = {
        1(book) {
            book.language = "en";
        },

        2(book) {
            book.author = new Author({
                name: book.authorName
            });

            delete book.authorName;
        }
    };
}
```

When an older object is loaded, its migrations can be applied incrementally.

A migration may:

- Add or remove properties.
- Change object structure.
- Create new persistent objects.
- Remove or introduce references.
- Update indexes.

Migrations must be coordinated with persistence transactions and garbage-collection bookkeeping.

Lazy migration is particularly attractive because it avoids requiring a complete database rewrite whenever application schemas evolve.

However, an index over a newly introduced property must account for objects that have not yet been migrated. Index completeness is a separate concern from the correctness of any individual migrated object.

---

# 9. Between the layers

## 9.1 What Wellspring asks of Aquifer

Most of what Wellspring needs exists in Aquifer: transactions, `create`, `get`, `set`, `delete`, `replace`, strong and weak references. Four things are missing, and are in [Aquifer's backlog](../../aquifer/documents/backlog.md):

1. **Volatile roots.** Pinning an object across transactions, for as long as a load holds it (section 3.3).
2. **A change set per transaction**, with a commit number. Everything in section 5 is triggered from it.
3. **Notification of a reclaim inside the transaction that performs it**, so that an index removes its entry for a member (section 7.2), and weak references are cleared, together with the reclaim.
4. **The commit that last changed each record.** Wellspring does not need it itself. Fountain does, for reconnecting clients, and it is Aquifer that knows.

Aquifer finds references in records by their `$ref` tag. Wellspring's encoding guarantees that the tag appears nowhere else ([data model](data-model.md) E4), so the two agree on the graph.

## 9.2 What Wellspring offers Fountain

- Objects, classes, and `load`.
- A transaction around a client's writes, with everything stored or nothing.
- The change set of each commit, in terms of objects and fields.
- The table of volatile observers, so that Fountain's selections are triggered like Wellspring's own.
- A way to run a selector with a filter on which objects it may pass through, which Fountain uses to pass only through what a user may read. Wellspring itself knows nothing of users.
- Indexes and persistent repeaters. Fountain delivers their contents to clients as live queries (whitepaper sections 5.5 and 5.6).

## 9.3 What is shared with clients

The data model, which is the encoding, the registry of classes, the check on what a field may hold, and the making of an object from a record, runs on Fountain's clients as well. It depends on neither Aquifer nor a network. It is either a part of Wellspring that a browser can load, or a small package of its own. To be decided when it is written.

---

# 10. Open questions

| Question | Section |
|---|---|
| Classes whose instances are never persistent | 2 |
| Bounding memory: weak holding alone, or least-recently-used unloading as well | 3.4 |
| Loading on demand, or reporting reads of what is not loaded | 3.5 |
| How objects in memory are returned to their earlier state when a transaction fails | 4 |
| How dependency records are coarsened for objects that many keys read, and when | 7.2 |
| At what size or rate of change a live index stops being the right tool | 7.2 |
| What happens to a member whose key computation throws: it must not stop the index, and must not stay filed under a key that is no longer true (whitepaper section 8.16) | 7.1 |
| Large arrays: chunked storage in Aquifer, or only the documented advice to use trees | [data model](data-model.md) A4 |
| Where the code shared with clients lives | 9.3 |
| The open points of the data model | [data model](data-model.md) section 11 |

---

# 11. Roadmap

Each step is tested against a model before the next is begun, as Aquifer was: a fuzzer makes random changes to objects, and an oracle compares what Wellspring has stored with a plain object graph kept in memory. Closing the store and opening it again must give the same graph.

1. **The data model's code**: encoding and decoding, the write check, the registry of classes, making an object from a record. No Aquifer, no network. Round-trip tests over generated values.
2. **Aquifer's interface upward** (section 9.1): volatile roots, change sets, reclaim notifications, the commit per record.
3. **Objects over records**: the identity map, persistence by reachability, the store that writes each transaction as one Aquifer transaction, failing transactions.
4. **Loading**: `load`, hold counts, volatile roots, selections that follow the graph, first by running the whole selector again, unloading.
5. **Observation**: the table of volatile observers, triggered from change sets.
6. **Migrations** (section 8).
7. **Indexes**: a B-tree of persistent objects, with key repeaters that read only their member (sections 6 and 7). Every index tested against one rebuilt from nothing.
8. **Keys that read other objects**: stored dependency records, background work, tracked staleness.

A specification with invariants is written for each step before it is begun. The data model's is [written](data-model.md).

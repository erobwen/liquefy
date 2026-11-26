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
import { open, load, transaction, synchronized, Synchronized } from "@liquefy/wellspring";
import { LmdbStore } from "@liquefy/aquifer/src/store/LmdbStore.js";

class Document extends Synchronized {
    title = "Untitled";
    chapters = synchronized([]);
}

const spring = open({
    store: new LmdbStore("./data"),
    classes: { Document, Chapter, Paragraph },
});

// Making: the document is local until a stored object refers to it.
transaction(() => {
    const document = new Document();
    spring.root.documents.push(document);   // now it is stored
});

// Loading: everything the selector selects is in memory inside the action,
// which runs when it is (section 3.7).
load(spring.root, selectLibrary, () => {
    for (const document of spring.root.documents) {
        console.log(document.title);
    }
});

// Writing: an ordinary assignment, stored at the end of its transaction.
document.title = "A New Title";
```

**Synchronized objects.** An object that Wellspring can store is a synchronized object: an instance of a class that extends `Synchronized`, or a plain object or array passed to `synchronized()` ([data model](data-model.md) section 2.1). Both are Cascade observables. `Synchronized` returns the observable from its constructor, as Cascade's components do, so `this` is already the observable inside a subclass's constructor.

**The root.** A database has one root object, `spring.root`, which always exists and is always loaded. Everything stored is reachable from it (whitepaper section 4.5).

**Transactions.** A transaction is Cascade's: `transaction(() => {...})`. At its end, after the repeaters it set off have run, its changes are written as one Aquifer transaction. A write made outside any transaction is a transaction of its own.

**Persistence by reachability.** A synchronized object is local when it is made, and is stored when a stored object comes to refer to it ([data model](data-model.md) O2). At the end of a transaction, Wellspring follows the new references from stored objects and stores every local object they reach. Nothing is saved by calling a method, and nothing is deleted by calling one: an object that can no longer be reached from the root is garbage, and Aquifer reclaims it. The criterion is always reachability from the root, as for a file in a file system.

A synchronized object that no stored object refers to is an ordinary object in memory, and is never stored. This is how the same world can hold both the application's data and objects that must not be stored.

**Volatile objects.** Some synchronized objects must never be stored, though they are synchronized with clients: Fountain's sessions, connections, and presence objects (whitepaper section 2.3). Wellspring lets an object be marked volatile when it is made. A volatile object is never stored, and a write that would make a stored object refer to one is refused ([data model](data-model.md) R1).

**The same names at every level**

The layers are meant to read alike. An object is made ready in the same way whether it is to be shown in a user interface, stored, or sent to other machines: with `synchronized()`, or by extending `Synchronized`. Code gets hold of a structure of objects in the same way on a server and on a client: `load` here, `subscribe` in Fountain, each with a starting object and a selector. And there is one Cascade world on each machine, so that an object that is stored, or sent, is the same object that a component reads and a repeater watches.

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

A selector is a function that takes an object and a set, and fills the set with every object that belongs with it (whitepaper section 3.4). `load` runs the selector, reads from Aquifer whatever is not in memory, and then runs the action.

The action runs when the selection is in memory. With a store that answers a read at once, as Aquifer's stores do today, that is before `load` returns. With a store that may have to wait for a read, it is later (section 3.7). Code that is to work with both does not rely on the action having run when `load` returns.

`load` is to a server what `subscribe` is to a client (whitepaper section 3.7). The two have the same shape, so code written against a selection runs on either side.

## 3.2 A load is held, and follows the graph

A load is not a one-off read. It holds its selection until it is released, and the selection follows the graph: running the selector is a reactive computation, which records what it reads, and when that changes, objects that join the selection are loaded, and objects that leave it are let go.

Every object counts the loads that hold it. When the count falls to zero, the object can be unloaded.

A load made inside a reactive computation belongs to that computation: it is released when the computation is disposed, and kept when the computation runs again and makes the same load. A load made outside one returns a handle with which it is released.

## 3.3 Held objects are volatile roots

An object that a load holds must not be reclaimed, though nothing in the database may refer to it any longer: code is working on it, and may link it in again. Wellspring pins it in Aquifer for as long as it is held (Aquifer's volatile roots).

Pins are kept in memory only. They are gone when the process ends, and there are none when a store is opened.

Only loads pin. A JavaScript variable that refers to an object does not keep its record.

## 3.4 Unloading

An object that nothing holds can be dropped from memory. Its record stays in Aquifer.

The identity map must still give the same object for the same identity for as long as any code has a reference to it. The map therefore holds unheld objects weakly, through JavaScript's `WeakRef`: an unheld object stays in the map until the JavaScript engine finds that nothing refers to it, and is then gone. An object that is held is referred to strongly.

For that to work, the objects in memory must not hold each other strongly through their stored references. A field that holds one reference therefore stays an accessor for as long as it is not written: each read looks the object up in the identity map, and makes it from its record if it is not there. An object is kept in memory by a load that holds it, by a JavaScript variable, by a repeater that has read it, by an array that contains it (an array's elements are resolved when it is made), and by a field written in memory since it was loaded; by nothing else. When none of these holds it, it is unloaded, and made again from its record when it is next read. Its metadata goes with it.

**Open.** Whether weak holding by the JavaScript engine is enough, or whether memory must also be bounded explicitly, by dropping the fields of unheld objects that have not been used for a while. The earlier attempts kept a list of the least recently used objects for this.

## 3.5 An object in memory whose record is reclaimed

Code can keep a reference to an object after the load that held it has been released. If the object then becomes unreachable from the root, Aquifer reclaims its record, while the JavaScript object is still in memory.

Wellspring is told of every reclaim (section 9.1). An object in memory whose record is reclaimed becomes local again ([data model](data-model.md) O3): it keeps the fields it has, and loses its identity. If code later makes a stored object refer to it, it is stored anew, by reachability, under a new identity, like any other local object.

What was persistent has become volatile, because its persistence was pulled from under it. Nothing dangles in the database, and nothing is kept alive by a variable.

The cost is in what the object referred to. Objects that were reclaimed with it and were in memory are local again too, and still referred to. Objects that were reclaimed with it and were not in memory are gone, and a reference to one of them names nothing ([data model](data-model.md), the open point of section 2.2).

Code that means to detach a structure and attach it somewhere else later holds it with a load in the meantime, which pins all of it. For the common case of a move within one or a few transactions, Aquifer's time-limited hold is enough, and Wellspring applies it to what a transaction detaches.

## 3.6 Following a reference that is not loaded

On a server whose store answers a read at once, a reference can always be followed. A stored reference is an identity; when the field that holds it is read, Wellspring takes the object from the identity map, or reads its record from Aquifer and makes it ([data model](data-model.md) K7). Aquifer reads synchronously, so application code sees an ordinary property read. There are no stubs on a server.

An object reached this way is in memory, but nothing holds it. It is correct to read and write it. Two things are different from an object that a load holds: it may be unloaded when nothing refers to it, and a selection does not follow it.

Under Fountain, the same code may run on a client, where a reference outside the subscribed selection cannot be followed. Wellspring therefore reports, in development and when asked to, every reference followed outside a load, so that code that works on a server does not fail on a client. Used alone, following references freely is simply a convenience.

The same report serves a server whose store may have to wait for a read (section 3.7). There, as on a client, a reference outside what is loaded cannot be followed.

## 3.7 When a read may have to wait

Aquifer's stores answer a read at once: a memory store, and LMDB, which maps its file into memory. Everything above is written for that, and it will not always hold.

- **A large database on disk.** A read of a page that is not in memory stops the whole process while the disk is read. A selector that walks a million such objects stops the server for seconds. Waiting does not make the walk faster, but it lets other work run meanwhile.
- **A store on another machine.** When several servers share a database, a server may have to ask for a record over the network. That read cannot be answered at once.

The earlier attempts met this with fibers: a property read that found nothing in memory suspended the code that made it. Fibers are gone from Node, and the alternative, `await` at every read, would mark every function that touches an object, and Cascade cannot record what a computation reads across an `await`.

**Only `load` waits.** A property read never waits. Inside the action, everything selected is in memory, and the code is ordinary synchronous JavaScript. A reference that leads out of what is loaded cannot be followed there, and says so. This is the situation of a client under `subscribe`, so a server with such a store is the same case, not a new one.

**A selector is a local rule.** For `load` to wait, the engine must be able to run a selector over objects that have not arrived. A selector written as one function that walks the whole structure cannot be stopped halfway. A selector written as a local rule can (whitepaper section 3.5): given one object, which of the objects it refers to are selected along with it.

```javascript
const selectTree = {
    Node: (node, selection) => selection.add(node.left, node.right),
};
```

The rule adds references. It does not read through them. The engine applies it transitively, in rounds:

1. Run the rule for every object that has joined the selection and is in memory. Collect the references it adds.
2. Ask the store for all of those not in memory, in one batch.
3. When they have arrived, make the objects, and go to 1. When a round adds nothing, the selection is complete, and the action runs.

There is one round, and one question to the store, for each level of the structure, not one for each object. A rule can depend on data: the path to a key in a search tree is the rule `key < node.key ? node.left : node.right`, and costs one round per level, which is what such a search costs anyway.

A reference to an object that is not in memory reads, inside a rule, as a stub: an object with an identity and nothing else. A rule may add a stub to the selection. A rule that reads a field of a stub, to decide by a neighbour's contents, is stopped; the engine asks for the object and runs that rule again when it has arrived. A rule is small, so this is cheap. It is avoided altogether by letting the neighbour's own rule decide.

**The same rules give three more things**, each of which was wanted already:

- A selection is updated incrementally. Each application of a rule is a Cascade repeater of its own, and a change to one object runs the rule for that object only (section 7.1, "Granularity").
- Fountain's filter (section 9.2) is a condition in the engine: it does not apply the rule to an object the user may not read.
- A client names a selector, and the server applies the rules. The client never has them (whitepaper section 3.4).

**A selector written as one function** remains, for a store that answers at once. It is the simplest to write, and it is the reference that the rules are tested against: a selection built from rules must equal the one the whole function gives.

**More inside an action.** An algorithm that finds, while it runs, that it needs objects outside its selection makes another `load`, and continues in that load's action. It does not follow the reference.

**Open.**

- **A selection that grows by a write.** A write can make a held selection reach objects that are not in memory: a held chapter is given a note whose own parts were never loaded. With a store that waits, the selection is then incomplete until they have arrived. The load's handle says so, in `handle.loaded`. Whether that is enough, or the code that made the write should have to load them first, is not decided.
- **Writes.** A transaction's writes go to Aquifer at its end. With a store on another machine, the commit itself waits, and can fail because another server changed the same records. That belongs to the design of several servers on one database, which is not begun.
- **Whether a server's stub and a client's are the same thing.** A server's stub is not the object it stands for: it exists inside rules only, and the field reads as the object itself once that has arrived. A reference does not say what class its object has, so a stub cannot be turned into the object.
- **Maps and sets of references**, with a store that waits. A field that holds references inside a map or a set is made whole when it is read, and so needs every object it names in memory. A rule cannot yet add them without that.

No store waits yet. Wellspring can be opened as if its store did (`options.wait`), which is how the rounds are tested: reads then arrive when the test says, and a reference is followed only to what is in memory.

---

# 4. Transactions and the store

Wellspring is a store in the sense of whitepaper section 3.8: it receives every change to every synchronized object, through Cascade's `onEventGlobal`, collects the changes of a transaction, and at the transaction's end (`onTransactionEnd`) writes them.

Writing a transaction means, in one Aquifer transaction:

1. Storing every local object that has become reachable from a stored object (section 2).
2. Encoding the changed fields ([data model](data-model.md) section 8) and writing the records.
3. Writing what persistent repeaters changed (section 7.3). Those that maintain a transactional index have already run, as part of the Cascade transaction.

**The change set comes from Cascade's events.** The changes of a transaction, as Wellspring passes them on, are built from the events Cascade emitted: which fields of which objects were set and deleted, with their old and new values, and which splices were made to which arrays. Aquifer could not supply this. It sees a record with fields, and an array as one field, so a splice would be lost.

From Aquifer, Wellspring takes the commit number, and what the collector did: the objects it reclaimed.

**Checks before writes.** A layer above can ask to see each write before it is applied, and refuse it. Fountain uses this for authorization and for gated writes, which must be judged against the state before the write ([protocol](../../fountain/documents/protocol.md) section 7.3). A write that is refused before it is applied leaves nothing to undo.

**Failing after the fact.** If the Aquifer transaction itself fails, nothing is written, and the objects in memory are returned to their state before the transaction, from the old values that Cascade's events carry. This should be rare: values are checked when they are written, and refusals are made before applying.

---

# 5. Observation

Wellspring needs to know when something that a selection or a persistent repeater has read is changed.

It does not need the temporal signals that Cascade uses to order a rendering pipeline. On a server, order is given by commits. Plain observation is sufficient: what was read, and whether it has since been written.

**Volatile observers are Cascade repeaters.** A load's selection, and anything Fountain builds on top, such as a session's selections and live queries, is a Cascade repeater, used as it is. Cascade records what it read, in memory, and runs it again when that is written. Nothing about it is stored. After a restart it is gone, which is correct, because the code that made it is gone too.

A repeater runs again inside the Cascade transaction that changed what it read, before that transaction's end. A selection is therefore up to date when the transaction is written, and what joined and left it is part of the transaction's result. What is sent to anyone, and what is loaded and let go, is acted on after the Aquifer commit.

**Persistent observers.** A persistent repeater maintains something that is stored, so it must be triggered by every relevant change, also after a restart, and also when the objects involved are not in memory. Its dependencies cannot be Cascade's observers in memory. Section 7.2 describes what is stored instead.

**When persistent repeaters run.** One that maintains a transactional index runs inside the transaction that triggered it. Others run in the background, in transactions of their own (section 7.3).

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

The same split into a pure computation and a reaction is used, in memory and without storing anything, for the rules of a selection: one repeater per selection and object, computing which objects are selected along with it (whitepaper section 3.5). Those are ordinary Cascade repeaters, not persistent ones.

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

Because objects are loaded individually, a class can change without the database being rewritten.

```javascript
class Book extends Synchronized {
    static version = 2;

    static migrations = {
        // From version 0 to 1.
        0(book) {
            book.language = "en";
        },

        // From version 1 to 2.
        1(book) {
            book.author = new Author({ name: book.authorName });
            delete book.authorName;
        }
    };
}
```

A class has a version, 0 unless it says otherwise, and every record stores the version it was written under ([data model](data-model.md) C5). A migration is named by the version it migrates from. When a record older than its class is loaded, the migrations from its version up to the class's are applied in order, and the record is written back under the class's version, before application code sees the object.

A migration may add or remove fields, change the structure of an object, make new objects, and remove or introduce references. The objects it makes become stored by reachability, like any others.

**A migration is a transaction of its own.** It is written by Wellspring, as the system, whatever the code that caused the load was doing. A load made inside a computation that must not write, such as a key (section 7.1), still migrates what it loads: the migration is not that computation's write. It goes through Aquifer's write barrier like any other transaction.

**A migration is a pure function of the object.** It reads and writes the object it is given, and the objects it makes. It does not depend on when it runs, since objects of one class are migrated at different times, as they happen to be loaded.

**Indexes.** An index over a field that a migration introduces must account for objects that have not yet been migrated. Whether an index is complete is a separate question from whether each object is correct (section 7.3): an index over a new field is built by loading its members, which migrates them.

**A migration that fails.** If a migration throws, or what it wrote cannot be stored, its changes are undone, nothing is written, and the object is dropped from memory. The read that caused the load fails with the migration's error, and the next read tries again from the record. The same happens to a record that has no migration from its version. A record of a newer version than the registered class is refused: the code running is older than the data.

Lazy migration avoids rewriting the database whenever a class changes. A migration that must be finished, so that an old version can be dropped, is completed in the background: `spring.completeMigrations()` starts a pass over every stored record, which `work` (section 9.4) carries out a batch at a time, loading each object of an older version than its class. When the pass has ended, no older record is left, and the migrations from those versions can be removed from the classes.

---

# 9. Between the layers

## 9.1 What Wellspring asks of Aquifer

Most of what Wellspring needs exists in Aquifer: transactions, `create`, `get`, `set`, `delete`, `replace`, strong and weak references. Five things were missing. They are now built ([Aquifer's backlog](../../aquifer/documents/backlog.md), "The interface upward"):

1. **Volatile roots.** Pinning an object across transactions, for as long as a load holds it (section 3.3). Pins are in memory only, and are cleared when a store is opened.
2. **A commit number per transaction**, from one counter, and a report of what the collector did. The field-level change set is built by Wellspring itself, from Cascade's events (section 4).
3. **Notification of a reclaim**, `onReclaimed(ids)`, so that an index removes its entry for a member (section 7.2), weak references are cleared, and an object still in memory becomes local again (section 3.5). It comes right after the collector's step has committed, before anything else runs, rather than inside the step: what Wellspring does with it is in memory, and must not act on a reclaim that could still be rolled back. An index's entry for a reclaimed member is removed in Wellspring's next transaction, and dangles, weakly, until then.
4. **The commit that last changed each record.** Wellspring does not need it itself. Fountain does, for reconnecting clients, and it is Aquifer that knows.
5. **The size of the collector's backlog**, so that Wellspring can report pressure (section 9.4). Collector steps already exist (`collector.run`), are bounded, and end when there is nothing to do.

One more was added later:

6. **A read of many records in one call**, given their identities: `db.getMany(ids)`. `load` asks for each round of a selection this way (section 3.7). Today it answers at once. It is the one place in the interface that is meant to be able to wait, when a store on disk or on another machine needs it to.

Aquifer finds references in a record by looking, at any depth, for an object with a `$ref` key. Wellspring's encoding escapes every key of the application's that begins with `$`, so that the tag appears only where a reference is ([data model](data-model.md) E1 and E4), and the two agree on the graph.

## 9.2 What Wellspring offers Fountain

- Objects, classes, and `load`.
- A transaction around a client's writes, with everything stored or nothing.
- The change set of each commit, in terms of objects and fields.
- A check on each write before it is applied, which Fountain uses for authorization and gated writes (section 4).
- Volatile objects, which are synchronized but never stored (section 2).
- A way to run a selector with a filter on which objects it may pass through, which Fountain uses to pass only through what a user may read. Wellspring itself knows nothing of users.
- Indexes and persistent repeaters. Fountain delivers their contents to clients as live queries (whitepaper sections 5.5 and 5.6).

## 9.3 What is shared with clients

The data model, which is the encoding, the registry of classes, the check on what a field may hold, and the making of an object from a record, runs on Fountain's clients as well. It depends on neither Aquifer nor a network. It is either a part of Wellspring that a browser can load, or a small package of its own. To be decided when it is written.

## 9.4 Background work, and who schedules it

Aquifer's collector does its work in steps. Each step is one transaction of bounded size, roughly constant in time, and steps can be interleaved with the application's transactions in any order (Aquifer's invariant B1). Wellspring has background work of the same kind: persistent repeaters that catch up in the background (section 7.3), and migrations that are being completed (section 8).

Nothing runs on its own. Background work stays synchronous, and the program at the top decides when background work is done. Wellspring offers one call for all of it:

```javascript
const result = spring.work(steps);   // { steps, remaining, pressure }
```

`work` runs up to `steps` steps of background work, collector steps through Aquifer's `collector.run`, and returns at once when there is nothing to do. It reports how many steps it ran, whether work remains, and whether there is **pressure**: the collector's backlog has grown beyond a configured size, or memory is near a configured limit.

**A quota, in the normal case.** The program at the top calls `work` between the things it does, in a configured ratio: one step after every event it handles, or one after every fifth. When it is idle, it calls `work` until nothing remains.

**Pressure, in the rare case.** When `work` reports pressure, the program may stop taking new requests and call `work` until the pressure is gone. That is a decision for the program, which knows what stalling costs; Wellspring only reports.

Used alone, Wellspring's application decides the ratio. Under Fountain, Fountain's main loop does (whitepaper section 2.6).

**Open.** The defaults: the ratio, the backlog size that counts as pressure, and how memory is measured. To be set from measurements.

---

# 10. Open questions

| Question | Section |
|---|---|
| Bounding memory: weak holding alone, or least-recently-used unloading as well | 3.4 |
| What a local-again object's references to reclaimed objects read as | 3.5 |
| A held selection that a write makes reach objects not in memory, with a store that waits | 3.7 |
| Writes and commits against a store on another machine | 3.7 |
| Whether a server's stub and a client's are the same thing | 3.7 |
| Maps and sets of references, with a store that waits | 3.7 |
| How dependency records are coarsened for objects that many keys read, and when | 7.2 |
| At what size or rate of change a live index stops being the right tool | 7.2 |
| What happens to a member whose key computation throws: it must not stop the index, and must not stay filed under a key that is no longer true (whitepaper section 8.16) | 7.1 |
| Large arrays: chunked storage in Aquifer, or only the documented advice to use trees | [data model](data-model.md) A4 |
| Where the code shared with clients lives | 9.3 |
| Defaults for background work: the ratio, and what counts as pressure | 9.4 |
| The open points of the data model | [data model](data-model.md) section 11 |

---

# 11. Roadmap

Each step is tested against a model before the next is begun, as Aquifer was: a fuzzer makes random changes to objects, and an oracle compares what Wellspring has stored with a plain object graph kept in memory. Closing the store and opening it again must give the same graph.

1. **The data model's code**: encoding and decoding, the write check, the registry of classes, making an object from a record. No Aquifer, no network. Round-trip tests over generated values. *Done*, in `src/dataModel.js` and `src/values.js`, on cascade.reactive's `meta(object).checkWrite`.
2. **Aquifer's interface upward** (section 9.1): volatile roots, commit numbers, reclaim notifications, the commit per record, the collector's backlog. *Done.*
3. **Objects over records**: `Synchronized` and `synchronized()`, the identity map, references resolved on read, persistence by reachability, the store that writes each transaction as one Aquifer transaction and reports its change set, objects whose records are reclaimed. *Done*, in `src/spring.js`. How it came out:
   - **Events.** Wellspring's default world is made with an event hook that hands Cascade's change events to every open store; each store keeps those of the objects it owns. At `onTransactionEnd`, it stores the local objects that have become reachable from what changed, and writes every changed object's record, in one Aquifer transaction.
   - **References resolved on read.** A field of a record object that holds a reference is an accessor on the target until it is first read; the accessor decodes the field, puts the value in its place, and returns it. Writing such a field first puts the value in place, then writes through the observable, so that the write has its event. A field that was never read is written back as it was stored, without loading what it names.
   - **Arrays are resolved when they are made**, since Cascade copies an array's elements then. A cycle of arrays that contain each other cannot be loaded, and says so.
   - **Failed transactions are rolled back** in memory, from the old values the events carry.
   - **Not yet:** the open question of what a local-again object's references to objects reclaimed with it read as (they read as `null`); explicit loading and unloading (step 4). Classes are registered per data model, so two stores in one process share their classes.
4. **Loading**: `load`, hold counts, volatile roots, selections as Cascade repeaters that follow the graph, first by running the whole selector again, unloading. *Done*, in `src/spring.js`. How it came out:
   - `load(start, selector, action)` runs the selector in an independent repeater, holds what it selects, pins the stored objects among it in Aquifer, and runs `action(selection)`. It returns a handle with `selection` and `release()`. When the selection changes, joined objects are held and pinned and left objects let go, in the same Aquifer transaction as the write that changed it.
   - Objects that are held but still local are pinned in the transaction that stores them.
   - Unloading is section 3.4: weakly held identity map, and reference fields that look their objects up rather than keep them.
   - **Not yet:** a load made inside a repeater does not belong to that repeater (section 3.2); it is independent, and released through its handle. Cascade gives no hook when a repeater is retracted, which ownership would need.
5. **Checks before writes, and volatile objects**: what Fountain needs (section 9.2). *Done*, in `src/spring.js`. How it came out:
   - `spring.checkWrites(check)` adds a check asked before every write to an object of the store, stored or volatile, with `{ object, key, value, operation }`. It runs against the state before the write and refuses by throwing, so a refused write leaves nothing to undo. For this, cascade.reactive's `meta(object).checkWrite` now also names the operation, and is asked about deletes and about every array method, also those that only remove or move elements.
   - `spring.volatile(object)` makes a local object volatile: an identity beginning with "v", synchronized, never stored. Local objects a volatile object comes to refer to become volatile too; a class can say `static volatile = true`, and its instances are then refused where they would be stored. A stored object never refers to a volatile one: such a write is refused when it is made, and a local structure that would bring one in is refused when it would be stored, and rolled back.
   - Changes to volatile objects make no Aquifer transaction. They are reported to `onCommit` listeners with `commit: null`, in `volatileChanged` and `volatileCreated`.
6. **Selectors as local rules** (section 3.7): a selector as a table of rules by class, applied in rounds, one repeater per selection and object; a read of many records in one call in Aquifer; `load`'s action running when the selection is in memory. Tested against the whole-function selector, and against a store that is made to wait. *Done*, in `src/ruleLoad.js` and `src/spring.js`. How it came out:
   - `load(start, rules, action)` takes a table of rules by class name; arrays and classless objects have the rules named `Array` and `Object`. A function is still taken as a whole selector. A rule's selection is a set whose `add` takes any number of objects, and ignores null.
   - **Rounds.** Inside a rule, a reference to an object that is not in memory reads as a stub, also when the store answers at once, so the same path runs in both cases. The engine asks for all of a round's stubs with one `db.getMany`. A tree of fifteen nodes is loaded in three reads.
   - **One repeater per selection and object.** A change runs the rule of the changed object only. The selection is then found again by following what the rules last gave from the starting object, without running any rule; a cycle that is cut off is let go. This costs in proportion to the selection for each structural change, in set operations only.
   - **A rule that reads into a stub** is stopped, and applied again when the object has arrived.
   - **An array is made with its elements**, so when an array's record arrives, its elements are asked for, in a read of their own, before it is made.
   - **`filter`**, an option, says which objects a selection may contain and pass through. It runs with the rule, and is reactive like it.
   - **A store that waits** is stood in for by `options.wait`. `handle.loaded` says whether everything the selection reaches is in memory.
   - **Not yet:** the parts of an object, its arrays and classless objects, are not selected with it by themselves (whitepaper section 3.4); a rule adds them. The other open points are in section 3.7.
7. **Migrations** (section 8). *Done*, in `src/spring.js`. How it came out:
   - A class's `static migrations` are kept with it in the registry, and checked there: functions, each named by a version older than the class's.
   - An object made from an older record is migrated before `make` returns it. The migration's changes are collected apart from those of a transaction under way, and written at once, in an Aquifer transaction of their own, reported to `onCommit` listeners with `migration: true`. The checks before writes are not asked, and a running computation does not record what the migration read.
   - An object that a migration reads is loaded, and migrated, first, in a transaction of its own.
   - `spring.completeMigrations()` and `work` complete migrations in the background, fifty records for each step. The pass lists every stored identity when it starts, which is too much for a large database; it should walk the store with a cursor.
   - **Not yet:** telling an index about objects that are not yet migrated (section 8, "Indexes"), which waits for indexes. With a store that waits, a migration can read only what is in memory.
8. **Indexes**: a B-tree of persistent objects, with key repeaters that read only their member (sections 6 and 7). Every index tested against one rebuilt from nothing.
9. **Keys that read other objects**: stored dependency records, background work, tracked staleness.

A specification with invariants is written for each step before it is begun. The data model's is [written](data-model.md).

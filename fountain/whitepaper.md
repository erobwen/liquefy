# A Reactive Distributed Object Database
## Architecture, Persistent Reachability, and Hierarchical Garbage Collection

**Status:** Architectural proposal and research draft  
**Date:** November 2026

---

# Abstract

This paper proposes a persistent, distributed JavaScript object database designed for reactive applications and collaborative editing.

The central idea is to make persistent objects behave as much as possible like ordinary JavaScript objects, while providing transparent persistence, identity, synchronization, authorization, and garbage collection.

A central server maintains the authoritative object graph. Clients subscribe to objects or reactive projections through WebSocket connections, receiving incremental updates as the underlying data changes. Object-level authorization is expressed through application-defined JavaScript methods, allowing security rules to be integrated naturally into the object model.

The architecture also supports shared, immutable snapshots for large numbers of passive consumers, reducing the computational and networking overhead of maintaining thousands of individual live subscriptions.

What a client synchronizes is defined by data selectors: functions that, starting from one object, select the set of objects that belong together, such as everything in a document. A selection is maintained reactively as the graph changes. Code loads explicitly, through subscriptions that hold a selection while they are active, and every object carries observable metadata, such as whether it is loaded and whether its changes are saved. Writes form one real-time stream to the server, in which the last write wins. Indexes are built from ordinary persistent objects and kept up to date by persistent repeaters: pure computations, such as an index key, whose dependencies are stored rather than held in memory, so that they are evaluated again when something they read changes, also after a restart. A query over such an index is live: its result is updated as objects arrive, change, and leave.

A major architectural challenge is persistent garbage collection. Unlike an ordinary in-memory garbage collector, a persistent database must identify unreachable objects without requiring periodic, expensive scans of the entire database.

The initial proposal uses a continuously maintained spanning tree of reachable objects, together with complete incoming-reference information. When references are removed, detached subtrees become unstable and are incrementally examined for alternative connections to the reachable graph. Objects that cannot reconnect are eventually reclaimed, including cyclic structures.

The longer-term proposal extends this approach using automatically discovered, recursively nested graph regions. Each region maintains precise internal reference information while summarizing references crossing its boundaries. A hierarchical collector can then restrict reachability searches to relevant regions and potentially reclaim entire unreachable regions without traversing their contents individually.

The overall goal is a database architecture in which persistence, reactive computation, synchronization, indexing, and garbage collection are incremental operations over a shared object graph.

---

# 1. Motivation and Design Goals

Modern interactive applications frequently maintain several representations of the same information:

- A persistent database representation.
- A server-side application object model.
- A client-side application state model.
- Reactive UI state.
- Synchronization and subscription metadata.
- Indexes and derived data.

Keeping these representations synchronized introduces complexity, duplicated logic, and opportunities for inconsistency.

The proposed architecture attempts to unify these layers around a persistent JavaScript object graph.

## 1.1 Primary goals

The system should provide:

1. **Natural JavaScript programming.** Persistent objects should behave similarly to ordinary JavaScript objects.

2. **Stable object identity.** Objects retain their identity across application sessions, server restarts, and network synchronization.

3. **Transparent persistence.** Changes to persistent objects are durably stored without requiring application developers to manually serialize entire object graphs.

4. **Reactive subscriptions.** Clients automatically receive changes to the data they observe.

5. **Fine-grained authorization.** Read and write permissions can be defined on individual objects.

6. **Collaborative editing.** Multiple clients can interact with the same object graph in real time.

7. **Extensible indexing.** Application-defined data structures can serve as persistent indexes.

8. **Incremental garbage collection.** Unreachable persistent objects can be reclaimed without regularly scanning the complete database.

9. **Scalable read distribution.** Large populations of read-only consumers can share immutable snapshots.

10. **A small, general-purpose core.** Specialized functionality should be implemented using ordinary objects and reusable graph operations whenever practical.

The design favors a unified programming model over the conventional separation between database records, application models, and client-side state.

## 1.2 As easy as local, with relief at the extremes

The aim is that building a distributed, real-time, multi-user application should be about as easy as building one that runs locally on one machine.

That has a cost. Reads are tracked, selections are kept per session, and derived data is maintained on every write. The architecture accepts this overhead in exchange for the simplicity of the programming model, and it knows where the overhead is:

- **Tracking reads in memory** is cheap. Cascade already does it on every client.
- **Stored dependency records** are the real cost, because they turn one write into several. They are needed only for derived values that read objects other than the one they belong to, they change only when what is read changes, and they can be made coarse (section 6.4).
- **Per-session selections** cost server memory in proportion to what each client holds (section 17.9).

For the cases where the general mechanism costs too much, there is an escape hatch with ordinary request and response semantics. A query is a named server-local object (section 6.6). What produces its result is hidden behind the name, so an expensive query can be given an optimized implementation, or one whose result is not kept up to date, without changing the clients that use it.

The default is live and simple; optimization is local and does not change the model.

---

# 2. System Architecture

## 2.1 Authoritative server and connected clients

The database is hosted by a server that owns the authoritative persistent object graph.

Clients connect through WebSockets and interact with selected parts of that graph.

Conceptually:

```text
                 Persistent Storage
                        |
                        v
               +------------------+
               | Database Server  |
               |                  |
               | Object Graph     |
               | Transactions     |
               | Authorization    |
               | Reactive Engine  |
               | Garbage Collector|
               +------------------+
                   |     |     |
                WebSocket Connections
                   |     |     |
             +-----+     |     +-----+
             |           |           |
          Client A    Client B    Client C
          Editor      Editor      Reader
```

The server is responsible for:

- Loading and storing persistent objects.
- Maintaining object identity and references.
- Validating and committing mutations.
- Enforcing authorization.
- Tracking subscriptions.
- Distributing committed changes.
- Maintaining persistent indexes.
- Performing garbage collection.

Clients maintain local representations of subscribed objects and use reactive computations to update their interfaces.

## 2.2 Persistent JavaScript objects

An application might define:

```javascript
class Document extends PersistentObject {
    title = "Untitled";
    chapters = [];

    canRead(user) {
        return this.owner === user ||
               this.isPublic;
    }

    canWrite(user) {
        return this.owner === user;
    }
}
```

Application code could then interact with the object naturally:

```javascript
document.title = "A New Title";

document.chapters.push(
    new Chapter("Introduction")
);
```

The database infrastructure detects these operations and records the corresponding persistent mutations.

Objects are assigned stable identifiers. References between persistent objects are stored as identifiers rather than requiring the entire referenced object to be embedded.

A conceptual storage representation might be:

```json
{
  "$id": "document-123",
  "$type": "Document",
  "$version": 2,
  "title": "A New Title",
  "chapters": [
    {"$ref": "chapter-456"}
  ]
}
```

Executable class definitions are not stored as database records. Instead, stored objects are associated with registered application classes when loaded.

The exact serialization format remains an implementation detail.

## 2.3 Three kinds of objects

Not every object needs to be persistent and shared.

The architecture distinguishes:

**Shared persistent objects**

The application's data. They are stored in the database, have stable identity, and are synchronized to the clients that select them.

**Server-local objects**

Selections, live queries, sessions, and snapshot builders. They exist in the server's memory only while something uses them. They are never stored and never synchronized as objects. A client talks to them through a small protocol: it subscribes, and receives results.

**Client-local objects**

User-interface state, and the client's copies of selected objects.

A fourth kind, presence objects such as other users' cursors, is shared but volatile (section 3.10).

Keeping the second kind out of the database removes a large class of problems. Nothing that observes on behalf of a connected client ever has to be serialized, and a server restart simply discards it together with the sessions it served.

## 2.4 Object metadata

A client's copy of an object is more than its fields. The client also needs to know things about it:

- Whether it has been loaded, or is only a stub: an identity and a type without content (section 3.4).
- Whether it has changes that have not been saved, or are being saved.
- The commit that last changed it.
- How many subscriptions hold it (section 3.7).
- The store it belongs to (section 3.8).

Some of this is per property rather than per object. The form field example in Cascade keeps a record per property with the saved value, a count of saves in flight, whether the property is locked by someone else, and the latest error:

https://erobwen.github.io/liquefy/cascade/form-field

The user interface reads these states: it shows a field as unsaved, saving, failed, or locked. The metadata must therefore be observable, like the object itself.

It must not be part of the object's fields. The model keeps the shape it would have without any of this, an application can name a field `meta` or `saved` without colliding with anything, and serialization never has to skip anything.

**meta() in Cascade**

Cascade has this as `meta()`, in cascade.reactive.

`meta(object)` is an observable record about the object, and `meta(object, property)` one about a single property. Each is empty until something is put in it, and made the first time it is asked for, so objects and properties that nobody asks about cost nothing. The form field example keeps its saved values, counts of saves in flight, locks and errors in the property records.

`untrackedMeta(object)` and `untrackedMeta(object, property)` are the same records as plain objects, for bookkeeping that must not be observed. Cascade's components keep their untracked fields (`this.untracked`) there.

Cascade's own bookkeeping (the object's id, its target, its handler) is kept apart, in `innerMeta(object)`, so that no name in the records is reserved. It is the one property a Cascade proxy answers itself instead of passing on to its target, under a configurable name, by default one that application data is unlikely to use (`object.cascadeMetadataObject`). `innerMeta()` is the way to reach it.

A layer that needs state of its own about an object keeps it under a name of its own in one of the records. The synchronization layer would keep one observable record per object, and the store, which nothing displays, in the plain one:

```javascript
meta(document).sync.loaded         // "unloaded" | "loading" | "loaded"
meta(document).sync.saving         // changes sent and not yet confirmed
meta(document).sync.subscriptions  // subscriptions holding it (section 3.7)
untrackedMeta(document).store          // the store it belongs to (section 3.8)
meta(document, "title").saved  // the last value the server confirmed
meta(document, "title").error
```

Cascade decides no field of the records. The synchronization layer defines `loaded`, `saving` and `saved`, and an application can add its own.

Derived states such as "unsaved" are computed from the record rather than stored: a property is unsaved while its value differs from `meta(object, property).saved`.

**Reading an unloaded object**

Reading a field of a stub is a programming error: the code is outside the boundary it subscribed to.

Cascade already has a hook for this. A world can be given an `onReadGlobal` function that is asked before every read and may refuse it, returning a configured `cannotReadPropertyValue` instead. The synchronization layer can use it to report reads of unloaded objects in development, and to return a recognizable value in production.

---

# 3. Reactive Client Synchronization

## 3.1 Cascade as the reactive foundation

The proposed frontend reactive framework is Cascade:

https://erobwen.github.io/liquefy/cascade/

Cascade provides reactive capabilities similar in principle to MobX, including automatic dependency tracking.

The intention is to use Cascade to connect synchronized database objects to user-interface computations.

When an object property changes, dependent computations are invalidated and the UI updates automatically.

A simplified example:

```javascript
const document = db.get("document-123");

repeat(() => {
    titleElement.textContent = document.title;
});
```

The computation observes the properties it reads.

When the title changes, the relevant computation executes again.

The client does not need to manually identify every UI element affected by a database mutation.

## 3.2 Reactive capabilities on the server

Some Cascade capabilities are specific to frontend rendering and animation and would be unnecessary on the backend.

However, its automatic dependency-tracking mechanisms could also be useful on the server.

For example, the server could maintain a reactive projection:

```javascript
const summary = computed(() => ({
    title: document.title,
    chapterCount: document.chapters.length
}));
```

A client subscribing to this projection would receive updates whenever its dependencies change.

This creates a natural relationship between reactive computation and network subscription.

A server-side subscription can be viewed as a computation whose output is transmitted to one or more clients.

## 3.3 Subscription granularity

The system should distinguish three kinds of relationships:

**Object references**

These determine persistent graph structure, identity, and reachability.

**Reactive dependencies**

These determine which computations need reevaluation after a mutation.

**Network subscriptions**

These determine which results or object changes must be delivered to connected clients.

These relationships overlap but should not be represented as the same thing.

For example, a million objects may reference a shared font, while only a small number of active client computations currently depend on its name.

The persistence system must understand all million references, but the reactive engine only needs to invalidate the computations that actually depend on the changed property.

## 3.4 Data selectors

Across the whole stack, code must have an object before it can operate on it.

On the server this is cheap: a reference can be followed synchronously, loading the object from storage if necessary.

On a client it is not. A reference to an object the client does not have cannot be followed without a network round trip.

Clients therefore subscribe to sets of objects in advance. The set is defined by a data selector.

A data selector is a function that takes an object and a set, and fills the set with every object that should be selected together with that object.

```javascript
function selectDocument(document, selection) {
    selection.add(document);

    for (const chapter of document.chapters) {
        selection.add(chapter);

        for (const paragraph of chapter.paragraphs) {
            selection.add(paragraph);
        }
    }

    // document.creator is not followed.
}
```

The result is a selection: a boundary around the objects to be synchronized.

The selector decides which references to follow. A document selector follows the document's structure, but does not run away across a reference that merely names the creator of an object.

A reference that leaves the selection is delivered to the client as a stub: an identity and a type, without content. The client can subscribe to another selection to obtain the object behind it.

Selectors are registered by name, as classes are. A client subscribes by naming a selector and a starting object. It never sends code to the server.

A selection is the unit of several things at once:

- **Subscription.** Changes to any object in the selection are sent to its subscribers.
- **Loading.** A client receives the whole selection before it operates on any of it, so that code within the boundary can run synchronously.
- **Holding.** The objects of a selection are held by its subscribers, and must not be collected while they are (the volatile roots of the garbage collector).
- **Sharing.** Clients that name the same selector and starting object, with equivalent access rights (section 4.3), share one selection on the server.

## 3.5 Reactive selections

A selection must follow the graph.

When a paragraph is added to a chapter, it must be added to the selection and sent to every subscriber. When it is removed, the subscribers must be told.

Running a selector is therefore a reactive computation. It records what it reads. When something it read changes, the selection is updated, the difference from the previous selection is computed, and the difference is distributed.

**Rerunning the whole selector**

The simplest implementation reruns the selector from its starting object and compares the two sets.

It is correct by construction, and its cost is proportional to the size of the selection for every structural change.

That is acceptable for small selections, and it is the reference against which any faster implementation should be tested.

**Local rules**

A selector can instead be written as a local rule: given one object, which of the objects it references are selected along with it.

```javascript
const documentSelector = {
    Document: (document, selection) => selection.add(...document.chapters),
    Chapter: (chapter, selection) => selection.add(...chapter.paragraphs)
};
```

The engine applies the rule transitively.

Each application of the rule is then a small computation of its own, depending on the fields of one object. A change to one chapter reruns the rule for that chapter only.

In the terms of section 6.3, each application is a rule repeater, one per selection and object. Its value is the set of objects it selects along with its object, and when that value changes, the selection receives the references that were added and removed. Rerunning the whole selector is the same thing with a single repeater for the whole selection. The API is the same for both, so a selector can start out whole and be made incremental later.

**Removal is a reachability problem**

Adding to a selection is easy: apply the rule to the new object and continue from there.

Removing is not. An object can be selected through several paths, and selected objects can reference each other in cycles. When one path is cut, the object leaves the selection only if no other path remains.

This is the garbage collector's problem (sections 8 and 9), over the subset of references the selector follows, starting from the selection's starting object.

It is much smaller, though. A selection has the size of a document, not of a database, and it lives in memory. Retracing one selection after a removal is affordable in a way that tracing the database is not. The spanning-tree algorithm could also be applied to a selection directly.

The two kinds of error are not equally serious. A selection that is temporarily too large sends objects that a client did not need. A selection that is too small breaks the client. Removal can therefore lag behind; addition cannot.

**Selections and regions**

The collector's regions are automatically discovered branches of the reachability spanning tree.

A selector that follows ownership will often select something close to a union of regions.

Whether regions can serve as a coarse unit of selection, loading, or distribution is an open question.

## 3.6 Observation on the server

The server needs to know when something that a selector, a query, or a persistent repeater has read is changed.

It does not need the temporal signals that Cascade uses to order a rendering pipeline. On the server, order is given by commits. Plain observation is sufficient: what was read, and whether it has since been written.

**The commit change set is the source of all triggers**

Every transaction produces a change set: the objects and fields it wrote.

Everything that reacts to data does so by matching its recorded reads against committed change sets.

**Volatile observers**

Selections, live queries, and snapshot builders are server-local objects (section 2.3).

Their recorded reads are kept in memory, in a table from object identity and field to observer, beside the object cache rather than inside the stored objects.

Nothing about them is written to the database.

After a restart they are gone, which is correct, because the sessions they served are gone too. A reconnecting client subscribes again and states the commit it last saw. The server recomputes the selection and sends what has changed since. This requires that every object records the commit that last changed it.

**Persistent observers**

A persistent repeater, such as the key of an index entry, is different. What it maintains is persistent, so it must be triggered by every relevant change, also after a restart, and also when the objects involved are not in memory.

Its dependencies cannot be references to observers in memory.

They are not stored as observers at all. Section 6.4 describes what is stored instead.

**When observers run**

A persistent repeater that maintains a transactional index runs inside the transaction that triggered it, before the commit.

Volatile observers run after the commit and see only committed state. The changes they distribute are grouped by commit, so that a client moves from one consistent state to the next.

**How much of Cascade is needed**

Cascade's plain, timeless observables record dependencies through a replaceable interface and can report every change as an event. That is the mechanism described here, and the first implementation can use it as it is.

Whether the server should eventually use a smaller tracker of its own is a question of cost, not of design. In both cases application code sees ordinary property access, and the same classes run on the server and on clients.

## 3.7 Explicit loading: subscribe

An early version of this architecture (section 18.1) loaded data implicitly. Node Fibers made it possible to suspend execution in the middle of a property getter, load the missing object, and resume, so that code never had to know what was loaded.

It was elegant, but Fibers were discontinued, and the technique could never work on a client, where loading means waiting for the network.

Loading is therefore explicit. Code states what it is about to use, by naming a starting object and a selector, and receives control once that has arrived:

```javascript
// On a client
subscribe(document, selectDocument, () => {
    // Everything selectDocument selects from document is here,
    // and stays up to date while this subscription is active.
});

// On the server
load(document, selectDocument, () => {
    // Everything selectDocument selects from document is in memory.
});
```

Inside the action, code runs synchronously and may follow any reference within the selection.

The two functions have the same shape, so code written against a selection can run on either side. They could also be one function, `subscribe`, that on the server means "held in memory".

The names were earlier `ensureSubscribed` and `ensureLoaded`. They were changed because `ensure()` already has a meaning in Cascade, where it is the preferred name for `repeat()`.

On the server, a reference outside a loaded selection could still be followed by loading on demand, since storage reads are synchronous. In development it should nevertheless be reported, as on a client, so that code that works on the server does not fail when it runs on a client.

**Subscriptions are held, and counted**

A subscription is not a one-off fetch. It holds its selection, and the selection follows the graph (section 3.5), until the subscription is released.

Every object keeps a count of the subscriptions that currently hold it, in its synchronization metadata (`meta(object).sync.subscriptions`). A subscription increments the count of each object in its selection, and of each object that later joins it. It decrements the count of objects that leave its selection, and of all of them when it is released.

When an object's count falls to zero, it can be released:

- On a client, its subscription ends and its content is dropped. It becomes a stub again, or disappears entirely if nothing references it.
- On the server, it can be evicted from the object cache, and it is no longer a volatile root of the garbage collector (section 9 and Frozen's design document, §9.4).

**When a subscription is released**

A subscription made inside a reactive computation, such as a Cascade component's `build()`, belongs to that computation. It is released when the computation is disposed, and kept when the computation reruns and makes the same subscription again. This is how Cascade already treats objects created inside a repeater, and it means that a component holds exactly the data it is showing.

A subscription made outside any reactive computation returns a handle with which it is released.

**Overlapping subscriptions**

Two subscriptions whose selections overlap share the objects in the overlap, each holding them once. On the server, subscriptions of the same selector and starting object share one selection (section 3.4), so the counts are per selection rather than per client.

## 3.8 Stores

A client may hold thousands of objects that mirror server objects. Every change to any of them, in any property, must be noticed, gathered with the other changes of the same transaction, and sent to the server as one message.

Observing each object individually would be wasteful. Instead, objects belong to a store.

A store is a server-local or client-local object (section 2.3) that receives a notification on every change to every object that belongs to it. The object's metadata names its store (`untrackedMeta(object).store`).

On a client, the store:

1. Collects the changes of the current transaction: property writes, deletions, and array splices.
2. Coalesces them: a property written several times is sent once, with its last value.
3. At the end of the transaction, sends one message to the server, including any newly created objects in full.
4. Marks the changed properties as saving in their metadata, and as saved when the server answers.
5. Applies changes that arrive from the server without sending them back.

Objects created on the client join the store of the transaction that created them, and receive their permanent identity when the server confirms them (section 3.9).

**What Cascade already provides**

Cascade emits an event for every change to an observable: `set`, `delete`, and `splice`, each carrying the object, its identity, and the old and new values. A world can be given one `onEventGlobal` function that receives all of them. A store can be built on it directly, by routing each event to `meta(event.object).store`.

A store also needs to know when a transaction has ended, so that it can send. Cascade tells it: `onTransactionEnd(listener)` calls the listener once at the end of each transaction that changed something, after the repeaters it set off have run again, so that their writes go in the same message. A write made outside any transaction is a transaction of its own.

**The same structure on the server**

On the server, the object layer over Frozen is a store as well. At the end of a transaction, its changes are written to the database as one Frozen transaction, and the resulting change set is what triggers selections, queries, and persistent repeaters (section 3.6).

A client store and the server store differ only in where they send a finished transaction.

## 3.9 Writes: a real-time stream, last write wins

**The base model**

Writes from clients form one stream to the server, served first come, first served.

When two users change the same property, the change that reaches the server last overrides the earlier one. There is no conflict detection, no merging, and no rejection of a write because someone else wrote first.

Concurrent edits are thus treated the way a shared whiteboard treats them: everyone sees everyone else's changes as they happen, and the latest one is what stands.

Locks, semaphores, reservations, and check-and-set are application concerns. They can be built from ordinary objects within this model, for example a `lockedBy` field that the application sets and respects, and shown to the user through property metadata (section 2.4).

A different route was considered, closer to form state, in which a field is edited locally and submitted, and a submission can be refused when the field has changed underneath. It suits forms and workflows with approval steps. It can be built by an application on top of the base model, but it is not the base model.

**What can still fail**

The authorization methods of section 4 are ordinary methods of the application's classes, and run the same on clients and on the server. A client therefore knows, before it writes, whether a write is allowed, and the user interface does not offer what is not.

The server still checks every write, since a client can be modified. But for an unmodified client, a refused write means one of three things:

- **A bug**, such as an authorization method that reads something outside the client's selection, and so decides differently on the client.
- **A code mismatch** between client and server (section 17.13).
- **A race**: the client decided on a state that had already changed on the server, such as a permission withdrawn a moment earlier.

None of these is a normal outcome of concurrent editing. A refusal is reported in the property's metadata (`meta(object, property).error`), and the client's value is replaced by the server's, which the refusal carries.

**Locks from authorization**

The race is also what makes a lock possible without a new primitive.

```javascript
class Paragraph extends PersistentObject {
    canWrite(user, property) {
        return !this.lockedBy || this.lockedBy === user;
    }
}
```

Taking the lock is writing `lockedBy`. Two clients that try at the same time both find it free, and both write. The server applies the first, and refuses the second, because by then the paragraph is locked by someone else. The refusal is the second client's feedback. It must therefore wait for its write of `lockedBy` to be confirmed before it starts editing.

Every client can see who holds the lock, since `lockedBy` is an ordinary field, and the user interface can show it.

Since the lock is part of the authorization, it is enforced on the server as well. A client cannot write past it, even by mistake.

This is the pattern for anything stricter than last-write-wins. The base model does not provide the feature. It provides what the feature is built from: ordinary fields, authorization that runs on both sides, and a server that applies writes in order.

**Arrays**

Last-write-wins is simple for properties. It is not as simple for arrays.

Cascade reports a change to an array as a splice: a position, a number of elements removed, and the elements inserted. If two clients splice the same array concurrently, the second splice's position may refer to an array that the first has already shifted. Applied in arrival order, it removes or inserts in the wrong place.

Replacing the whole array, the plain last-write-wins answer, would lose concurrent insertions into a chapter's list of paragraphs, which is exactly the collaborative case.

**An index is not an identity**

The underlying problem is that a position cannot be tracked across the network. Position 7 on one client is not position 7 on the server once someone else has inserted before it. An object's identity can be tracked.

Where arrays become a problem, an application can therefore use a structure built from identities instead, such as a linked list. That is the application's choice, in the spirit of the base model.

**Linked lists, written so that nobody else's fields are written**

A doubly linked list with `next` and `prev` fields does not work under last-write-wins as it is. Two users inserting after the same word both write that word's `next`. One write wins, and the other user's word is no longer reachable from the list. It is not reported, and the garbage collector will eventually reclaim it. Concurrent removal of two neighbours can similarly leave a removed node in the list.

The cause is that an insertion writes a field of an existing node, which someone else may be writing too.

A list in which an insertion only creates objects avoids that:

- A new node records the node it was inserted after (`after`), and nothing else is changed. It is never written by anyone else.
- A removal sets a `removed` flag on the node. Only the node's own fields are written, and two users removing it at the same time agree.
- The order is derived: each node follows the node it was inserted after, and nodes inserted after the same node are ordered by a rule both sides apply, such as newest first, ties broken by identity.

Concurrent insertions at the same place both survive. Concurrent removals do not interfere. Every client derives the same order from the same nodes. Nothing needs transforming or rebasing, because last-write-wins on fields that only one writer ever writes is never a conflict.

This is the structure of the sequence CRDTs (section 17.11), here built from ordinary objects within the base model, with the server's order replacing the clocks.

The derived order is a reactive computation on the client, and on the server it is a value that a persistent repeater can maintain (section 6.3), or an index.

The cost is that removed nodes stay, because later nodes may be anchored to them. They can be reclaimed once nothing is anchored to them, or a list can be compacted occasionally, by rewriting it as new nodes, as a transaction of its own.

**Arrays of objects, anchored by the store**

For arrays of objects, the store can do much the same automatically, without the application changing its data structure.

The client's store translates each splice into operations that name elements rather than positions:

- `insert(elements, after: X, before: Y)`, where X and Y were the neighbours when the client inserted.
- `remove(element)`.

The server resolves the anchors against its own array at the moment it applies the operation. If X has been removed in the meantime, it uses Y; if both are gone, the position the client gave, limited to the array's length.

Inserting an element that is already in the array moves it. A move is therefore a removal and an insertion of the same element, and two users moving overlapping ranges at the same time leave every element in one place, the place of the move that arrived last. Removing an element that is no longer there does nothing.

Two insertions after the same element both survive, in the order the server received them.

**Rebasing on the client**

The client applied its own splices at once, so when the server's operations arrive, the client's array may differ from the server's: both inserted after X, but the server put the other client's element first.

The client therefore keeps its unconfirmed operations, per array, and when operations arrive from the server, it rebases: it takes back its own unconfirmed operations, applies the server's, and applies its own again. Anchors are resolved by the same function on both sides, so after its own operations are confirmed, the client's array is the server's.

This is the general form of the rule for properties: a property's unconfirmed value, applied again after the server's older values, is the same as ignoring those values.

**Limits**

Anchoring needs elements with identity, which is the case for arrays of objects, such as a chapter's paragraphs or the entries of a list. These are the arrays that people edit together.

An array of primitive values, or one that contains the same object twice, has no identity to anchor to. For those, the fallback is to shift a splice's position past the splices the server applied in between. That is the simplest form of operational transformation (section 17.11), simple because one server decides the order. Text, a sequence of characters, is the important case of this kind.

## 3.10 Presence

Users editing the same document need to see each other: where the others' cursors are, what they have selected, which paragraph they are in. Collaborative editors show this, and users respond to it. They keep their distance, and seldom edit on top of each other.

**Presence is shared, but not persistent**

A cursor belongs to a session. It is synchronized to everyone in the document, changes many times a second, and is meaningless after the session ends.

Presence objects are therefore a kind of their own, beside the three of section 2.3: shared like persistent objects, volatile like server-local ones. They live in the server's memory, belong to a session, are selected along with the document they are in, and disappear with the session. They are never written to the database, never trigger persistent repeaters, and can be sent at a lower priority, or throttled, without harm.

**What presence makes simpler**

Since users can see each other, collisions are rare. That changes what the rare cases have to do, not whether they are handled:

- **Convergence and no silent loss are still required.** Every client must end with the server's state, and nothing a user did may disappear without a trace, however rarely it happens.
- **The result of a collision may be crude.** When two users do edit the same place at the same time, it is enough that the outcome is consistent, visible, and correctable by the users, who can see each other and talk. It need not be the best possible merge.

Presence is also a natural advisory lock. A paragraph with someone else's cursor in it can be shown as being edited, and the user interface can discourage entering it, without any lock being taken.

**What it does not make simpler**

Keeping a distance avoids overlapping edits, but not concurrent edits of the same array or string. Two users adding paragraphs at opposite ends of a chapter both splice the chapter's list of paragraphs. Two users typing at opposite ends of a paragraph both write its text.

The rule that follows: **the unit of last-write-wins must be smaller than the distance users keep.**

- Arrays of objects still need anchoring by identity (section 3.9). Distance makes the anchors almost always valid, so the fallbacks are seldom exercised.
- For text, the distance users keep is about a paragraph. A paragraph's text as one string, written last-write-wins, is acceptable if two users in the same paragraph are rare, and the user interface makes them rarer. Then it should be detected rather than silently resolved: a write that replaces a paragraph text that the writer had not yet seen can be marked in metadata and shown, so that the overwritten user knows.
- When writing inside the same paragraph must work, text needs splices (section 17.11).

**Ordering on the client**

The client applies its own writes at once, without waiting for the server.

A value that arrives from the server for a property with unconfirmed writes of the client's own must not overwrite it. If the server received another client's write first, then committed the client's own write after it, the client's value is the one that stands. Applying the older value would make it flicker back and then forward again.

The rule is therefore: while a property has writes of the client's own that the server has not yet confirmed, incoming values for it are ignored. The count of writes in flight is already in its metadata (`meta(object, property).saving`). Because one WebSocket delivers messages in order, every value the server sends after confirming the client's last write is newer, and is applied as usual.

**New objects**

An object created on a client already has a client-side identity. When it is sent to the server, it is given a temporary id, valid only within that one message, so that the other objects in the message can refer to it.

The server creates the object and answers with its permanent id. The client records the permanent id in its map from server ids to local objects, and the temporary id is forgotten.

Until the answer arrives, the object exists only on its client. Another client cannot have a reference to it, because every message that could carry one comes from the server, after the object has been created there.

---

# 4. Object-Level Security

## 4.1 Authorization through object methods

The proposed security model allows persistent objects to implement authorization methods:

```javascript
class Document extends PersistentObject {
    canRead(user) {
        return this.isPublic ||
               this.owner === user;
    }

    canWrite(user) {
        return this.owner === user;
    }
}
```

The methods are evaluated by the authoritative server.

They may also be available on clients for predictive UI behavior, such as disabling editing controls when the user is unlikely to have permission.

However, client-side evaluations are never authoritative.

## 4.2 Authorization and subscriptions

Authorization must be enforced when:

- Loading an object.
- Following references to other objects.
- Creating subscriptions.
- Delivering reactive updates.
- Applying mutations.
- Accessing indexed or derived data.

Permission to read one object does not automatically imply permission to read every object it references.

Likewise, a server-side reactive computation must not accidentally disclose properties that the subscribing user is not authorized to access.

A practical design is to evaluate subscriptions through an authorization-aware object interface.

Permission changes must also invalidate affected subscriptions. A client that loses access must stop receiving protected data, and its previously synchronized local representation may need to be revoked or cleared.

## 4.3 Shared security projections

When multiple users have equivalent access rights, they may share a reactive projection.

For example:

```text
Document
   |
   +-- Public projection ------ 10,000 readers
   |
   +-- Editor projection ------ 12 editors
   |
   +-- Owner projection ------- 1 owner
```

Sharing should occur only when the server can establish that the projection is safe for every subscriber.

---

# 5. Shared Snapshots for Large Readerships

## 5.1 Motivation

A live subscription model works naturally for interactive editors.

However, thousands of users may be reading the same information without modifying it.

Maintaining an independent reactive computation for every passive reader could waste substantial resources.

The proposed solution is to introduce explicit shared snapshots.

## 5.2 Snapshot publication

A snapshot is an immutable representation of a selected part of the database at a particular committed version.

For example:

```javascript
const catalogSnapshot = db.publish({
    source: () => catalog.products,
    minInterval: 1000
});
```

The exact API is illustrative.

The publication system observes its source dependencies.

When relevant data changes, the snapshot becomes dirty. A new version is published according to the configured update policy.

Thousands of clients can subscribe to the same published snapshot.

```text
       Live Persistent Objects
                 |
                 v
       Reactive Snapshot Builder
                 |
                 v
       Immutable Snapshot v1042
                 |
          +------+------+
          |      |      |
       Client Client  Client
         A      B       C
```

## 5.3 Versioning and structural sharing

Each snapshot should have:

- A monotonically increasing version identifier.
- A publication timestamp.
- A consistent view of committed data.
- An immutable representation.
- Optionally, a delta relative to a previous version.

Unchanged substructures may be shared between successive snapshots, reducing memory consumption and serialization work.

A client can request changes since a particular version or receive a complete replacement if the relevant history is unavailable.

## 5.4 Live and snapshot observation

The architecture supports three observation modes:

| Mode | Intended use |
|---|---|
| Live observation | Interactive and collaborative editing |
| Shared snapshots | Large populations of passive readers |
| Static snapshots | Published or archived content |

Clients may switch between these modes.

For example, a user reading a document receives shared snapshots, but switches to live observation when entering editing mode.

Snapshots should be produced from a transactionally consistent database state. Immutability after publication is not sufficient if the snapshot was constructed from partially committed mutations.

---

# 6. Persistent Indexes and Derived Structures

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

- **A member set:** the objects it covers. This is a collection, or more generally a selection (section 3.4).
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

## 6.3 Persistent repeaters

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

An instance of a persistent repeater is stored as the owner, the method names, the subject, the version of the owner's class, the last value, and the dependency records for what it read (section 6.4). The owner's class is registered by name, as all persistent classes are, so the code can be found again after a restart.

An instance is created when its subject joins the member set, and removed when its subject leaves the set or is reclaimed.

**Granularity**

There is one key repeater per index and member. A key that reads only its member needs no stored dependencies at all (section 6.4). That is the common case, and it is cheap.

A single repeater for a whole index would be the same as rebuilding it on every change. It is useful only as the test oracle.

The same structure, at the level of selections, gives rule repeaters: one per selection and object, computing which objects are selected along with it (section 3.5).

**Maintaining the tree**

The nodes of the index are not persistent repeaters.

What a node holds is not a pure function of a small set of reads. It is the result of an algorithm, such as insertion with node splits or the rotations of an AVL tree, that writes. That algorithm is the index's own ordinary code: the `insert` and `remove` methods that `keyChanged` calls, and the rebalancing they do.

It runs as part of the transaction that triggered the key repeater, or in a background step (section 6.4). Its writes to the nodes are ordinary writes, committed like any others. A query that read a node it rewrote is triggered (section 6.5); a rotation that does not change a query's result gives the query an evaluation that finds nothing to send.

The kind of tree matters more for a persistent index than for one in memory. Every node that an operation touches has to be loaded and written. A B-tree, with many keys per node, touches a few nodes per operation; a binary tree such as an AVL tree touches one per level, and rebalancing touches more. B-trees are therefore the default. Other structures can be written the same way.

**Three restrictions**

1. **A computed value is a pure function of persistent state.** It reads objects and nothing else: no clock, no session, no randomness. It is evaluated in a context where writing fails.

2. **The owner is the only writer of what it maintains.** Nothing but the index's own code modifies its nodes.

3. **What a persistent repeater maintains can be rebuilt from nothing.** This follows from the first two.

The third property carries a great deal. It is the recovery strategy if an index is damaged. It is the migration strategy when the definition of an index changes: the stored index records the version of its class, and a newer version causes a rebuild. And it is the test oracle: an incrementally maintained index can be compared with one built from scratch, under random mutation.

The same restrictions allow persistent repeaters that maintain other derived data, such as counters or denormalized fields. Persistent repeaters that write arbitrary shared objects in response to changes are deliberately not proposed. Their order, termination, and recovery are much harder to reason about.

**The name**

These were first called index demons. A demon, or a daemon, suggests an ongoing process, and nothing here runs continuously. Something is awakened when what it read changes, computes, and is still again: that is what a Cascade repeater is, with dependencies that outlive memory. "Persistent repeater" says exactly that. The two kinds are key repeaters and rule repeaters.

## 6.4 Triggering a persistent repeater without stored observers

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

The million dependency records are not inherent, however. They can be replaced by a single coarse record saying that the index as a whole depends on the rate, at the price of evaluating every key again when it changes. This is the trade-off the collector makes with its abstract incoming references (section 12.4).

**Members that are reclaimed**

An index holds its members weakly, unless the index is itself the collection that owns them.

When a member is reclaimed, its entry and its dependency records are removed.

## 6.5 Live queries

A query reads an index: a range of keys, possibly filtered and limited.

Because the nodes of the index are ordinary objects, reading a range records a dependency on the nodes that were visited. Inserting a member into that range changes one of those nodes, and the query is triggered.

Observing a range therefore requires no mechanism of its own. It follows from building indexes out of observable objects.

The result of a live query is an ordered selection. It is delivered to clients by the protocol that delivers any other selection: the objects first, then changes.

A user searching a catalog can then see the result change as new products arrive.

Whether a result should change under the user's eyes, or announce that newer results exist, is a decision for the application. The publication policies of section 5 apply to query results as well.

## 6.6 Queries as server-local objects

A query is a server-local object (section 2.3) with ordinary query and result semantics: a client names a registered query, supplies parameters, and receives a result.

What produces the result is hidden behind the name.

It can be a live index. It can also be a specialized structure, an external search engine, or a scan, and the result can be one that is not kept up to date.

Live indexes are the default, the proof of concept, and sufficient for simple applications. Where a live index costs too much, that query can be given an optimized implementation without changing the clients that use it.

## 6.7 Consistency

Required index maintenance must participate in the database's consistency model.

An index that is expected to be complete and authoritative cannot simply update whenever a background reactive scheduler happens to execute.

The architecture should distinguish:

1. Synchronously maintained transactional indexes. A key repeater that reads only its member, or a few other objects, runs inside the triggering transaction.
2. Eventually consistent derived indexes. Work caused by a widely read object is done in the background, and the index records which members are stale.
3. Lazy indexes whose coverage is explicitly tracked. An index being built, or rebuilt after its definition changed, records how much of its member set it covers.

This distinction also applies to schema migrations.

---

# 7. Lazy Object Schema Migration

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

# 8. Persistent Garbage Collection

## 8.1 The problem

Persistent objects can reference one another arbitrarily.

Consider:

```text
Root → A → B → C
           ↑   |
           +---+
```

If the reference from A to B is removed, B and C become unreachable.

However, they still reference each other.

Simple reference counting cannot reclaim them because their reference counts remain positive.

A traditional tracing garbage collector could discover the unreachable cycle by traversing all objects reachable from the database roots.

But periodically tracing an entire persistent database may be prohibitively expensive.

The goal is therefore to maintain reachability information continuously, performing small amounts of incremental work as the graph changes.

---

# 9. Basic Algorithm: A Maintained Reachability Spanning Tree

The initial algorithm assumes that complete incoming-reference information is available for every persistent object.

This is the simpler version of the proposal.

## 9.1 The maintained spanning tree

The database maintains a directed spanning tree, or a forest connected to a synthetic root, covering all objects currently known to be reachable.

Each non-root stable object has one designated parent reference that establishes its reachability.

For example:

```text
          ROOT
           |
           A
          / \
         B   C
         |   |
         D   E
```

Additional references may exist between these objects, but only selected references form the spanning tree.

The tree is a reachability certificate.

If an object has a valid chain of tree-parent references to a root, it is reachable.

The spanning tree is not the complete object graph. It is an auxiliary structure maintained alongside the graph.

## 9.2 Complete incoming-reference lists

Every object maintains a list of all objects that reference it.

For example:

```text
A → C
B → C
D → C
```

The incoming-reference list of C contains A, B, and D, including the identities of the corresponding reference edges where necessary.

This allows the collector to find alternative parents without scanning the entire database.

If C becomes detached from the spanning tree, the collector examines its incoming references to determine whether any source remains stable.

If a stable source exists, C can be reattached.

## 9.3 Stable and unstable objects

Objects are classified according to their reachability status.

**Stable objects** have an established path to a root through the spanning tree.

**Unstable objects** have lost their established path and are awaiting reconnection or reclamation.

Unstable does not necessarily mean unreachable.

An unstable object may still be reachable through a non-tree reference.

The collector must establish whether such a reference exists.

## 9.4 Removing a spanning-tree edge

Suppose the tree contains:

```text
ROOT → A → B → C
           |
           D
```

The application removes the reference A → B.

The subtree rooted at B loses its established path to the root.

B, C, and D must be marked unstable.

This operation may be performed incrementally using the maintained tree-child relationships.

The collector must not treat descendants awaiting invalidation as definitively stable merely because they have not yet been processed.

## 9.5 Reconnection

Once instability marking is complete, the collector examines the incoming references of unstable objects.

Suppose:

```text
ROOT → A → X

A -X→ B → C
      ↑
      |
      X
```

Here, the tree edge from A to B was deleted, but X still references B.

Because X is stable, B can be reattached through X.

B's descendants can then become stable again through tree expansion.

An incoming reference from another unstable object is not sufficient to prove reachability.

This prevents unreachable cycles from falsely reconnecting themselves.

## 9.6 Expansion

Expansion follows all outgoing object references from newly stable objects.

When a stable object references an unstable object, the unstable object can be attached to the spanning tree.

The collector continues until no additional reachable objects can be discovered from the pending expansion work.

Expansion has the highest priority because it can rescue objects that would otherwise remain candidates for deletion.

## 9.7 Reclamation

After all relevant instability marking, expansion, and reconnection work is complete, remaining unstable objects have no incoming reference from any stable object.

With complete incoming-reference information, this is sufficient to establish that they are unreachable, provided all roots and concurrent mutations are correctly accounted for.

The remaining unstable objects can be reclaimed, including cycles.

For example:

```text
B → C
↑   |
+---+
```

Neither B nor C can reconnect to the stable tree.

Both can be reclaimed even though they reference each other.

## 9.8 Basic collection cycle

The simplified collector repeatedly performs:

1. Expand the stable spanning tree wherever possible.
2. Complete pending instability marking.
3. Examine incoming references of unstable objects and reconnect those reachable from stable objects.
4. When no further reconnection is possible, reclaim objects proven unreachable.

Each phase can be implemented as a worklist.

The collector processes a bounded amount of work per scheduling step.

An individual operation may be constant-time, although completing an entire collection can require work proportional to the affected graph.

## 9.9 Core correctness invariants

The algorithm depends on several invariants.

**Invariant A: Stable reachability**

Every definitively stable object has a valid spanning-tree path to a database root.

**Invariant B: Complete incoming references**

Every persistent reference is represented in the incoming-reference information of its target.

**Invariant C: Complete invalidation before proof**

A detached subtree cannot be used as a source of stable reachability until its status has been correctly reestablished.

**Invariant D: Safe reconnection**

An unstable object can only become stable through a reference from a definitively stable source, or through an equivalent established root path.

**Invariant E: Safe reclamation**

No object is reclaimed while a path from a database root to that object exists.

These invariants require a precise state-transition protocol, especially when application mutations occur concurrently with collection.

---

# 10. Database Mutations Participate in Garbage Collection

A central design principle is that garbage collection is not a separate activity attempting to catch up with arbitrary application mutations.

Instead, application mutations themselves maintain the collector's invariants.

For example:

```javascript
addReference(source, target);
removeReference(source, target);
```

These operations update the object graph and its associated reachability metadata as one coordinated transaction.

Adding a reference from a stable object to an unstable object schedules or performs the appropriate expansion.

Removing a non-tree reference updates incoming-reference information.

Removing a spanning-tree reference initiates instability marking.

This allows the collector to maintain reachability incrementally as the database evolves.

A practical implementation will require transactional write barriers and a clear distinction between committed reachability facts and pending collector work.

---

# 11. The Scalability Problem of Complete Reverse References

Complete incoming-reference lists are conceptually simple, but they can become expensive.

Consider a shared resource:

```text
Document 1 ──┐
Document 2 ──┤
Document 3 ──┤
    ...      ├──→ Default Font
Document N ──┘
```

A shared font might be referenced by millions of objects.

Its incoming-reference list would contain millions of entries.

The total number of reverse-reference entries is proportional to the number of references in the database.

This may be acceptable in some systems, but it creates substantial metadata and maintenance overhead for highly shared objects.

One possible optimization is to cap the number of individually recorded incoming references.

For example, each object might retain at most eight incoming-reference entries and a flag indicating that additional references exist.

An object with incomplete incoming-reference information can no longer establish unreachability using its local metadata alone.

The original fallback idea is to scan the stable spanning tree, examining outgoing references to discover connections into unstable objects.

This preserves correctness if the scan is complete and concurrent mutations are properly accounted for.

However, it introduces a potentially expensive global operation.

It also creates a starvation risk: continuous mutations may repeatedly interrupt the collector before it completes its proof and begins reclamation.

This motivates a more scalable approach.

---

# 12. Hierarchical Regional Garbage Collection

## 12.1 Motivation

The proposed extension is to partition the persistent object graph into regions.

Within a region, incoming references can be tracked completely.

References crossing region boundaries are represented through a higher-level abstraction.

The collector can then examine selected regions rather than scanning the entire database whenever incoming-reference information is incomplete.

The regions should preferably be discovered and maintained automatically.

## 12.2 Recursive region structure

The database is partitioned into a hierarchy:

```text
Database
|
+-- Region A
|   |
|   +-- Region A1
|   +-- Region A2
|   +-- Region A3
|
+-- Region B
|   |
|   +-- Region B1
|   +-- Region B2
|
+-- Region C
```

Each object belongs to exactly one leaf region.

Each region belongs to exactly one parent region.

The region hierarchy is a tree, although the underlying object-reference graph can contain arbitrary cycles and cross-region references.

A region may contain either ordinary objects or smaller regions.

## 12.3 Complete local incoming-reference information

Within a leaf region, the database maintains complete incoming-reference information for references originating inside that same region.

For example:

```text
Region A

A1 → A2
A3 → A2
A4 → A2
```

The incoming-reference list of A2 records A1, A3, and A4.

References from outside Region A are handled through boundary metadata.

This allows ordinary local reconnection operations to remain inexpensive and precise.

## 12.4 Cross-region reference abstraction

Suppose:

```text
Region A: A4 → Region B: B7
```

The database records this cross-region relationship at the region level.

Conceptually:

```text
Region A → Region B
```

However, the abstraction should retain enough information to locate or refine the actual boundary references.

It is important to distinguish a possible reference from a proven reachable reference.

The existence of an edge from Region A to Region B does not prove that the source object in A is itself reachable.

A conservative abstraction may overestimate reachability, but it must never omit a real path that could make an object reachable.

## 12.5 Restricting incoming-reference searches

Suppose an object in Region B becomes unstable.

With incomplete global reverse-reference information, the basic algorithm might need to scan the entire stable object graph to find an incoming reference.

The regional approach instead uses the abstract graph to identify which regions might contain incoming references to B.

For example:

```text
Region A ──┐
           |
Region C ──+──→ Region B
           |
Region D ──┘
```

If the abstraction guarantees that only A, C, and D can contain external references into B, then the collector can restrict its search to those regions and B's internal graph.

It does not need to examine unrelated regions E, F, G, and so forth.

The precise search may inspect only relevant boundary sources rather than all objects within those regions, depending on the available metadata.

This is the principal expected scalability benefit.

## 12.6 Boundary objects and reachability summaries

Each region can identify boundary objects:

- **Entry objects:** Targets of incoming cross-region references.
- **Exit objects:** Sources of outgoing cross-region references.

The region may also maintain information describing which exits are reachable from which entries.

For example:

```text
Region B

Entry E1 ──→ Exit X1
         └─→ Exit X2

Entry E2 ──→ Exit X2
```

A parent region can use this summary to reason about paths through B without inspecting every object inside it.

Exact summaries can be expensive when regions have many boundary objects.

A conservative summary may therefore be preferable initially.

Such a summary can claim that a path might exist even when it does not.

That can temporarily retain unreachable objects, but it must not claim that a possible path is absent when one actually exists.

More precise summaries can be computed incrementally when needed.

---

# 13. Garbage Collection at Multiple Abstraction Levels

The proposed hierarchical collector operates recursively.

## 13.1 Abstract-level collection

At the highest level, the collector examines the graph of regions.

It determines which regions are potentially reachable from the database roots.

A region that is provably unreachable can become a candidate for whole-region reclamation.

For example:

```text
ROOT
 |
 +── Region A
       |
       +── Region B

Region C ←→ Region D
```

If Regions C and D have no path from a root, the abstract collector may identify the pair as unreachable despite their mutual references.

This requires the abstract representation to preserve all possible paths from roots through region boundaries.

## 13.2 Local collection

Regions that remain reachable at the abstract level may still contain unreachable internal objects.

The collector therefore descends into those regions and applies the ordinary spanning-tree reachability algorithm.

External incoming references are represented as possible local roots.

If the external source is known to be stable, its target can be treated as a proven local entry.

If the external source's reachability is unknown, the collector may conservatively retain the corresponding target until more information becomes available.

This distinction prevents the regional collector from incorrectly reclaiming reachable objects.

## 13.3 Whole-region reclamation

If the abstract collector proves that an entire region is unreachable, the region may be reclaimed as a unit.

This can avoid individually tracing every object inside it.

Potential benefits include:

- Reduced graph traversal.
- Fewer individual deletion operations.
- Efficient bulk removal of persistent storage.
- Simplified cleanup of large disconnected object groups.

However, logical region deletion and physical storage deletion are separate concerns.

Efficient whole-region reclamation depends on the storage layout.

A region whose objects are physically scattered may still require many storage operations, even if its unreachability is established by one abstract proof.

## 13.4 Recursive collection

The same principle can be applied repeatedly:

```text
Database-level reachability
          |
          v
Top-level region reachability
          |
          v
Subregion reachability
          |
          v
Individual object reachability
```

At each level, the collector works with a smaller graph.

When the abstraction is sufficiently precise to prove unreachability, it can reclaim an entire subtree of regions.

Otherwise, it descends to a more detailed representation.

---

# 14. Automatic Region Discovery

Requiring application developers to define regions manually would simplify implementation but weaken the general-purpose nature of the database.

The preferred design is automatic region discovery.

## 14.1 Possible heuristics

Objects may be grouped according to:

- Reference locality.
- Creation locality.
- Frequency of interaction.
- Frequency of joint loading.
- Number of internal versus external references.
- Region size.
- Runtime access patterns.

Objects created by another persistent object could initially be placed in the creator's region.

Regions can subsequently be split or merged as the graph evolves.

## 14.2 Incremental partitioning

Region management should itself be incremental.

For example:

```javascript
class RegionManager {
    targetSize = 1024;

    onObjectCreated(object, creator) {
        object.region = creator.region;
    }

    onRegionOverflow(region) {
        scheduleSplit(region);
    }

    onCrossRegionReference(source, target) {
        updateBoundaryMetadata(source, target);
    }
}
```

This is illustrative rather than a final API.

A region should have a relatively stable identity.

Constantly moving objects between regions could otherwise consume more resources than garbage collection saves.

## 14.3 Recursive balancing

As regions grow, the system may introduce subregions.

As regions shrink, it may merge them.

The hierarchy should balance:

- Local reverse-reference storage.
- Cross-region boundary metadata.
- Cost of reachability summaries.
- Search locality.
- Repartitioning overhead.
- Storage reclamation efficiency.

The optimal partitioning policy remains an open research question.

---

# 15. Incremental Scheduling and Starvation

## 15.1 The global starvation problem

The initial collector prioritizes reachability expansion and instability marking over reclamation.

This is necessary to prevent objects from being reclaimed before their reachability status is established.

However, continuous mutations could keep generating higher-priority work.

The collector might never finish its global proof of unreachability.

This is particularly problematic when incomplete reverse-reference information requires repeated scans of the stable graph.

## 15.2 Regional independence

Regional collection offers a potential solution.

A heavily modified region should not necessarily prevent a quiet region from completing garbage collection.

Each region can maintain its own:

- Expansion worklist.
- Instability worklist.
- Reconnection worklist.
- Scan progress.
- Reclamation candidates.

A scheduler distributes bounded work across regions.

The collector may finish reclaiming unreachable objects in one region while another region remains under active modification.

## 15.3 Collection epochs

Another possible technique is to associate collection work with logical epochs.

An epoch establishes a consistent reference point for reachability analysis.

Mutations occurring during collection are accounted for through write barriers, transaction ordering, or versioned state.

This may allow a collection cycle to finish without restarting whenever the live graph changes.

The exact interaction between epochs, maintained spanning trees, and hierarchical regions requires further investigation.

## 15.4 Incremental reclamation

Even after an object or region is proven unreachable, physical reclamation may take time.

The system should distinguish objects awaiting proof from objects already proven unreachable and scheduled for deletion.

A separate reclaiming state can prevent unsafe resurrection and avoid repeating reachability investigations while deleting an unreachable region.

---

# 16. Consistency and Transactional Requirements

The entire architecture depends on a coherent mutation model.

A database transaction may affect:

- Persistent object properties.
- References between objects.
- Spanning-tree parent relationships.
- Incoming-reference metadata.
- Region boundary information.
- Indexes.
- Reactive subscriptions.
- Schema versions.

These updates must be coordinated.

The system should define a point at which a committed mutation becomes visible to observers.

Required derived updates should be consistent with that commit, while optional background computations may remain eventually consistent.

The collector must never infer unreachability from metadata that is temporarily inconsistent with committed object references.

For a persistent database, GC metadata also needs a crash-recovery strategy.

Possible approaches include transactional metadata updates, write-ahead logging, or rebuilding selected auxiliary structures after recovery.

---

# 17. Research Questions

Several aspects of the architecture require further work.

## 17.1 Correctness of the basic collector

A formal state machine should define:

- Stable and unstable states.
- Pending subtree invalidation.
- Reconnection.
- Mutation barriers.
- Proven-unreachable states.
- Incremental reclamation.

The main safety property is that no reachable object can be reclaimed.

A separate liveness property should establish conditions under which unreachable objects are eventually reclaimed.

## 17.2 Regional abstraction precision

How much boundary information is necessary?

A complete entry-to-exit reachability table may become large.

A conservative approximation may be much cheaper, but retain more garbage.

The system needs a way to refine summaries when the approximation becomes insufficient.

## 17.3 Cross-region cycles

Independent regional collection may retain unreachable cycles spanning several regions.

The higher-level collector must identify such cycles or refine the abstraction until their unreachability can be established.

## 17.4 Automatic region discovery

Can an incremental heuristic produce useful partitions without expensive global graph analysis?

How should regions be split, merged, or reorganized when application access patterns change?

## 17.5 Mutation and collection concurrency

Can the collector maintain its invariants while application transactions modify the graph continuously?

What minimal write barriers and versioning mechanisms are necessary?

## 17.6 Storage architecture

Can physical storage be organized to support efficient whole-region deletion?

How should region migration interact with object identity and transaction durability?

## 17.7 Performance evaluation

The proposed collector should be evaluated against conventional tracing, reference counting with cycle collection, and established regional collectors.

Important measurements include:

- Metadata bytes per object and reference.
- Work performed per mutation.
- Collection latency.
- Total reclamation throughput.
- Peak memory consumption.
- Garbage retention.
- Behavior under high mutation rates.
- Cost of region splitting and merging.
- Frequency and scope of fallback scans.

## 17.8 Incremental selections

Can a selection be maintained with work proportional to the change, including removals through shared paths and cycles?

Is retracing one selection cheap enough in practice, or is the spanning-tree algorithm needed at this level as well?

Can the collector's regions serve as a coarse unit of selection?

## 17.9 The cost of live indexes

Everything that is observed by a volatile observer is held in the server's memory. How many simultaneous selections and live queries does that allow?

The server keeps, per session, what each client holds, so that it can compute what to send. Meteor kept the same thing (its "mergebox", section 18.2), and the memory it took per client became one of its scaling limits. Shared selections (section 3.4) and snapshots (section 5) reduce it; how far is a question for measurement.

How should dependency records be coarsened for objects that many keys read, and when?

At what size or rate of change does a live index stop being the right implementation of a query?

## 17.10 Authorization and shared selections

A shared selection must be safe for every subscriber (section 4.3).

Can authorization be evaluated as part of the selector, so that it is itself reactive and a change of permissions updates the selection like any other change?

## 17.11 Writes from clients

The base model is decided: a real-time stream in which the last write wins (section 3.9).

What remains open is what applications will want on top of it, and whether some of it should be provided. Locks can be built from authorization (section 3.9), and a library of such patterns may be worth providing. A form-state layer, in which a submission can be refused when the field has changed underneath, is another candidate. Concurrent splices of arrays are proposed to be anchored by identity and rebased on the client (section 3.9); that proposal needs a fuzz test against a model, as indexes do.

**Text**

Two users typing in the same paragraph, whose text is one string, overwrite each other under last-write-wins.

Fast synchronization helps less than one would hope. With a round trip of 100 milliseconds and someone typing ten characters a second, every keystroke overlaps the other user's. Each client keeps its own value while its writes are unconfirmed (section 3.9), and when both are confirmed, the one that arrived last replaces the whole paragraph, and the other user's characters are gone.

The options:

1. **A lock per paragraph** (section 3.9). The user who enters a paragraph first holds it, others see who is writing there, and edit other paragraphs meanwhile. Simple, built entirely from the base model, and acceptable when paragraphs are short and people mostly write in different places.
2. **Text as a sequence of splices.** The paragraph's text is changed by inserting and deleting at positions, not by replacing the string, and the server adjusts the positions of concurrent splices as it does for arrays. This is operational transformation. Google Docs works this way, on a central server that orders operations, the same arrangement as here. With one server deciding the order, it is much simpler than in the general peer-to-peer case.
3. **A CRDT for text**, such as Yjs or Automerge use. Each character has an identity of its own, so concurrent edits merge without a server. It works offline, and costs memory per character. With an authoritative server it is more than is needed.
4. **Smaller objects.** Text split into objects small enough, such as one per sentence, that collisions are rare. It reduces the problem without solving it.
5. **A list of words, built from identities** (section 3.9). Each word is an object that records the word it was inserted after; a removed word is flagged; the order is derived. Insertions at the start and the end of a paragraph, or anywhere else, never disturb each other, and only two users typing in the same word compete for its text. It needs nothing beyond the base model, and since users keep their distance (section 3.10), a word is a small enough unit.

A cursor is then just another object: a reference to a word and an offset within it. Unlike a position in a string, it stays where it was when others type elsewhere.

With presence (section 3.10), users see each other's cursors and seldom write in the same paragraph, so a paragraph as one string, last-write-wins, with an overwrite made visible rather than silent, may be enough for a first version, before even a lock.

Of the options above, the lock and the list of words are the natural start, because they need nothing new. The list of words is the one that lets people write in the same paragraph. Splices with transformed positions are needed only if text must stay one string. A CRDT is, in these terms, the list of words carried down to single characters.

## 17.12 Metadata

Which metadata fields should be standard, defined by Cascade or by the synchronization layer, and which should be left to applications?

Should property metadata be kept for every property of every object, or only for properties that someone has asked about?

## 17.13 Code versions

The architecture relies on running the same code on the server and on clients: the same classes, and the same selectors, so that a client can predict what a selection contains.

After a deploy, a client may still run the old code while the server runs the new. Its selectors may select something different from what the server sends, and its classes may not know fields that the server's objects now have.

The persisted side is handled by versions: an index records the version of its class and is rebuilt when it changes (section 6.3), and objects are migrated lazily (section 7).

For clients, the proposed answer is not to support old code for long, but to make replacing it cheap:

- A client states its code version when it connects. The server can end the subscriptions of a client whose version is too old, and tell it to reload.
- Reloading must be fast, and must recover the client's state: its subscriptions, which are named selectors and starting objects, its writes not yet confirmed, and the client-local state that the application chooses to keep, such as the current view.

How much state can be recovered across a reload, and how quickly, determines how often a deploy can be made without users noticing.

## 17.14 Scaling beyond one server

The architecture has one authoritative server. It can be scaled up, and read load can be moved to snapshots (section 5), but at some point one server is not enough.

One direction is a hierarchy of servers. Each server is authoritative for, or replicates, a part of a larger object structure held by the server above it, and clients connect to the server that holds what they work with. Objects shared across servers cost more, and changes to them take longer to reach everyone, but the system can grow by adding servers.

The collector's regions (section 12) are a natural candidate for the parts that servers take responsibility for, and a region could move between servers as the clients using it move.

This resembles server meshing in large online games, where the world is divided between servers dynamically, and objects and players are handed over at the boundaries.

It is far beyond a first version. It is noted here because it shapes earlier decisions: identity must not encode which server an object lives on, and the protocol should allow a subscription to be served by a server other than the authoritative one.

---

# 18. Related Research

## 18.1 Earlier attempts

This architecture has been attempted twice before, by the same author:

- https://github.com/erobwen/liquid
- https://github.com/erobwen/liquid-demo

Liquid synchronized an object graph between a server and its clients, with subscriptions keyed by selectors, reactive object-level security (`noAccess`, `readOnly`, `readAndWrite`), and placeholder objects standing in for objects whose data had not yet arrived. Changes made on a client were grouped into a pulse and sent to the server as a list of events.

Its earliest form relied on Node Fibers to load data in the middle of a property getter (section 3.7).

Several of the ideas in this paper come from there: selectors, stubs (liquid's placeholders), and the grouping of client changes per transaction. The repositories may contain more worth recovering.

## 18.2 Other work

Several existing approaches provide relevant foundations.

**Arborescent Garbage Collection: A Dynamic Graph Approach to Immediate Cycle Collection (2025)**

A particularly close conceptual match to the maintained spanning-tree approach. It investigates maintaining a graph-based reachability structure and repairing it after reference changes.

**Scalable Garbage Collection via Remembered Set Summarization and Refinement — Felix S. Klock II**

Relevant to regional garbage collection, summarized cross-region reference information, and the challenges of highly referenced objects.

**Cyclic Distributed Garbage Collection with Group Merger — Rodrigues and Jones (1998)**

Investigates grouping and collecting distributed cyclic structures, with relevance to dynamically formed collection regions.

**Incremental Mature Garbage Collection Using the Train Algorithm**

Relevant to incremental reclamation of cyclic garbage, region-like collection units, cross-boundary references, and collection progress.

**Distributed Garbage Collection for General Graphs — Brandt et al. (2018)**

Relevant to distributed reachability, bounded metadata, and cycle collection.

The proposed architecture should be evaluated against these algorithms before making claims of novelty or superior performance.

The synchronization and indexing parts have close relatives as well.

**Incremental view maintenance: differential dataflow, DBSP, Materialize**

A selection, an index over it, and a query over the index form a chain of derived collections, each updated from the changes of the one before. This is the subject of incremental view maintenance.

**Convex**

Queries are JavaScript functions executed by the database. Their read sets are recorded, and a query is run again and its subscribers updated when a write intersects what it read.

**ElectricSQL shapes, and similar partial replication**

A shape defines the subset of a database that is synchronized to a client. It plays the role of a data selector, over tables rather than an object graph.

**Meteor**

The closest precedent for the whole idea: the same JavaScript on server and client, publications that define what a client holds, a client-side copy of the data (Minimongo), and writes applied on the client at once.

Two of its scaling problems are worth learning from. Its first way of keeping queries live tailed the database's log and checked every write against every live query; this design instead looks up the observers of each written object (section 3.6). And it kept, per client, a copy of what that client held, the "mergebox", whose memory became a limit (section 17.9).

**RethinkDB changefeeds, Firestore listeners**

Other systems in which the result of a query is kept up to date on the client.

**Database triggers and materialized views**

The conventional counterpart of persistent repeaters. A trigger is awakened by a change, but it is imperative and does not record what it reads; a materialized view is derived, but is usually refreshed as a whole.

---

# 19. Proposed Development Roadmap

The phases are numbered as first proposed. Phases 3 to 5 were taken first, and exist as a prototype: Frozen, with its visualizer (frozen.visualizer), which shows the collector step by step.

## Throughout: a visualizer

Frozen's visualizer proved its worth while the collector was built. Fountain should have one from the start, and grow it with each step:

- Browse the database: follow references, see an object's fields, its metadata, its incoming references, and its region.
- Manipulate objects directly: edit a field, create an object, cut a reference, and watch what follows.
- See the reactive structure: which selections and queries hold an object, which persistent repeaters depend on it, and what a commit triggered.
- See the connected clients: what each one holds, and the stream of writes and changes between them and the server.

It is a debugging tool, a teaching tool, and an administration tool. Since it is itself a client, it is also the first real test of the protocol.

## Phase 1: Persistent reactive object model

Implement stable object identity, persistence, transactions, reactive proxies, and WebSocket synchronization.

Establish the basic security and subscription model.

In order:

1. In Cascade: `meta()`, `untrackedMeta()` and `innerMeta()` (section 2.4), and `onTransactionEnd` (section 3.8). Done.
2. An object layer on the store: persistent objects as proxies, one instance per identity, classes registered by name, and a server store that turns each transaction into one Frozen transaction and a change set.
3. Observation: recording what a computation reads, and matching it against commit change sets (section 3.6).
4. Selections and `load`, with subscription counts: named selectors, first by rerunning the whole selector, then incrementally, tested against the first (sections 3.4, 3.5 and 3.7).
5. The protocol and `subscribe`: subscribing to a selection, receiving it, receiving changes, reconnecting. Read-only clients first.
6. Client stores: the stream of writes from clients, last write wins, with temporary ids for new objects, authorization, and save states in metadata (sections 3.8 and 3.9).
7. Code versions: clients state their version, old clients are told to reload, and a reload recovers subscriptions and unconfirmed writes (section 17.13).

## Phase 1b: Live indexes and queries

Implement persistent repeaters, a B-tree of persistent objects maintained by its own code, and key repeaters that read only their member (sections 6.2 to 6.4).

Deliver live queries as ordered selections (section 6.5).

Then add keys that read other objects, with stored dependency records, background work, and tracked staleness.

Test every index against one rebuilt from nothing.

## Phase 2: Shared reactive snapshots

Introduce immutable, versioned projections with throttled publication and shared subscriptions.

Measure scalability under large read-only audiences.

## Phase 3: Basic incremental garbage collector

Implement the maintained spanning-tree algorithm with complete incoming-reference lists.

Focus on correctness, including cyclic garbage, mutation handling, crash recovery, and incremental scheduling.

## Phase 4: Flat regions

Partition the graph into automatically managed regions.

Maintain complete local incoming-reference information and cross-region boundary metadata.

Introduce independent local collection.

## Phase 5: Hierarchical region abstraction

Introduce recursively nested regions and conservative reachability summaries.

Allow the collector to identify and reclaim entire unreachable regions.

## Phase 6: Refinement and optimization

Investigate adaptive boundary summaries, bounded metadata, collection epochs, automatic repartitioning, and physical storage locality.

Benchmark against established garbage-collection algorithms.

---

# 20. Conclusion

The proposed system combines a persistent JavaScript object model with reactive synchronization, object-level authorization, application-defined indexes, lazy schema evolution, and incremental garbage collection.

The architectural goal is to make persistent distributed data behave naturally within a reactive JavaScript programming environment.

Synchronization is defined by data selectors, which draw the boundary of what a client holds, and indexes are kept live by persistent repeaters, pure computations that are triggered through stored keys and dependency records rather than through observers in memory. Writes are one real-time stream in which the last write wins, and anything stricter is built by applications on top of it. Selections, indexes, and queries form one chain of incrementally maintained collections.

The garbage-collection proposal begins with a relatively simple principle: maintain a spanning tree that certifies reachability, together with complete incoming-reference information that allows detached objects to reconnect without a global trace.

The principal scalability challenge is that complete reverse-reference metadata can become expensive, while incomplete metadata can require costly global searches.

The proposed hierarchical extension addresses this by automatically partitioning the object graph into recursive regions.

Within each region, incoming references can be tracked precisely. Across region boundaries, the database maintains conservative abstractions describing where references may exist and, potentially, which boundary objects can reach one another.

This allows reachability searches to be restricted to relevant parts of the database, supports independent collection of relatively quiet regions, and creates opportunities to reclaim entire unreachable regions.

The resulting architecture can be understood as a hierarchy of incremental reachability computations operating over a persistent object graph.

The most important unresolved challenge is maintaining compact, correct, incrementally updated boundary summaries under arbitrary graph mutations.

If that challenge can be addressed efficiently, hierarchical reachability may provide a common foundation not only for persistent garbage collection, but also for indexing, caching, distributed placement, and reactive data synchronization.

The proposal remains a research design rather than a proven algorithm. Its next step should be a precise state-machine specification, followed by a small implementation and adversarial tests of reachability correctness under continuous mutation.
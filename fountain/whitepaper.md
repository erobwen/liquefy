# A Reactive Distributed Object Database
## Fountain: architecture, synchronization, and security

**Status:** Architectural proposal. Decisions made so far are listed in section 1.3; what is open is in section 8. The storage and garbage-collection layer exists as a prototype, Aquifer, and is described in its own documents.  
**Date:** November 2026

---

# Abstract

This paper proposes a persistent, distributed JavaScript object database designed for reactive applications and collaborative editing.

The central idea is to make persistent objects behave as much as possible like ordinary JavaScript objects, while providing transparent persistence, identity, synchronization, authorization, and garbage collection.

A central server maintains the authoritative object graph. Clients subscribe to selections of objects through WebSocket connections, receiving incremental updates as the underlying data changes. Users are part of the database from the start. Object-level authorization is expressed through application-defined JavaScript methods that run the same on clients and on the server, and a session object, whose methods a client calls remotely, is the server's API and its security gateway.

What a client synchronizes is defined by data selectors: functions that, starting from one object, select the set of objects that belong together, such as everything in a document. A selection is maintained reactively as the graph changes. Code loads explicitly, through subscriptions that hold a selection while they are active, and every object carries observable metadata, such as whether it is loaded and whether its changes are saved. Writes form one real-time stream to the server, in which the last write wins, or, for a gated subscription, in which a write succeeds only against what its writer saw, and conflicts are marked rather than overwritten. Indexes are built from ordinary persistent objects and kept up to date by persistent repeaters: pure computations, such as an index key, whose dependencies are stored rather than held in memory, so that they are evaluated again when something they read changes, also after a restart. A query over such an index is live: its result is updated as objects arrive, change, and leave.

Objects are never deleted explicitly. Whatever cannot be reached from the database's root is garbage, and is found incrementally as references change, without scanning the database. That collector exists, in Aquifer, and is summarized in section 7.

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

5. **Fine-grained authorization.** Read and write permissions can be defined on individual objects, for users that are part of the database from the start.

6. **Collaborative editing.** Multiple clients can interact with the same object graph in real time.

7. **Extensible indexing.** Application-defined data structures can serve as persistent indexes.

8. **Incremental garbage collection.** Unreachable persistent objects can be reclaimed without regularly scanning the complete database.

9. **A base to build on, rather than a set of features.** Last-write-wins instead of conflict resolution, ordinary objects instead of built-in indexes, authorization methods instead of a permission system. Locks, text merging, and specialized queries are built by applications from these.

10. **A small, general-purpose core.** Specialized functionality should be implemented using ordinary objects and reusable graph operations whenever practical.

The design favors a unified programming model over the conventional separation between database records, application models, and client-side state.

## 1.2 As easy as local, with relief at the extremes

The aim is that building a distributed, real-time, multi-user application should be about as easy as building one that runs locally on one machine.

That has a cost. Reads are tracked, selections are kept per session, and derived data is maintained on every write. The architecture accepts this overhead in exchange for the simplicity of the programming model, and it knows where the overhead is:

- **Tracking reads in memory** is cheap. Cascade already does it on every client.
- **Stored dependency records** are the real cost, because they turn one write into several. They are needed only for derived values that read objects other than the one they belong to, they change only when what is read changes, and they can be made coarse (section 5.4).
- **Per-session selections** cost server memory in proportion to what each client holds (section 8.2).

For the cases where the general mechanism costs too much, there is an escape hatch with ordinary request and response semantics. A query is a named server-local object (section 5.6). What produces its result is hidden behind the name, so an expensive query can be given an optimized implementation, or one whose result is not kept up to date, without changing the clients that use it.

The default is live and simple; optimization is local and does not change the model.

## 1.3 Decisions so far

| Decision | Section |
|---|---|
| Three layers: Aquifer stores records and collects garbage, Wellspring makes them persistent objects with `load`, Fountain adds users and clients. Aquifer does not depend on Cascade. | 2.6 |
| References are one way, as in JavaScript. No incoming references in the model. | 2.2 |
| A synchronized object is a Cascade observable, made by extending `Synchronized` or with `synchronized()`. Plain data is a frozen value, synchronized as a whole. An unfrozen plain object in a synchronized field throws. No `#private` fields. | 2.5 |
| An object is local where it is made, and is stored and sent when an object that already is comes to refer to it. On the server, being stored always means being reachable from the root. | 2.2 |
| The layers use the same names and one Cascade world per machine: `synchronized`, and `load` beside `subscribe`. | 2.6 |
| Sessions, connections and presence objects are volatile: synchronized, never stored, without commit numbers. | 2.3 |
| A write is judged, by the gated check and by `canWrite`, against the state before it is applied. | 3.9 |
| There is one way to reconnect, which assumes the server remembers nothing of the client but its applied transactions. | 8.14 |
| Synchronized arrays are supported but expected to be small. Large collections are trees or linked structures. | 2.5 |
| Weak references follow JavaScript's `WeakRef`. Erasure is done by overwriting. | 2.5, 8.15 |
| Constructors run once, where an object is created, and never on loading. | 2.5 |
| Loading is explicit: `subscribe` on a client, `load` on the server, each with a starting object and a named selector. | 3.7 |
| The server alone decides what a selection contains. Clients do not run selectors. | 3.4 |
| Selections are per session. They are not shared between users. | 4.4 |
| Writes are one real-time stream, and the last write wins. No conflict detection or merging in the base model. | 3.9 |
| Per subscription, synchronization can be gated: a write succeeds only against the values its writer saw, and server changes to locally edited fields are marked out of sync instead of applied. Resolving is the application's procedure, built on pull and force. | 3.10 |
| Stricter rules, such as locks, are built by applications from authorization. | 3.9 |
| Users, sessions and authentication are part of Fountain from the start. | 4.1 |
| Security is activated per class, by defining `canRead` and `canWrite`, and runs the same on both sides. | 4.2 |
| A client's subscriptions form a forest whose roots the server gives. A client can subscribe from, write to, and refer to only what is in it. Arrays and classless objects come along as parts, and are written under the `canWrite` of the selection's root. Without security methods, everything reachable is freely editable. | 3.4, 4.2 |
| A client calls the server only through methods of its session. Every method of the session class is remote. | 4.5 |
| Session methods are synchronous on the server and atomic. External effects happen after the commit. | 4.5 |
| A client starts from its session, and server code from the database's root. | 4.5 |
| A stub reveals that an object exists, and its class. | 3.4 |
| Different repeaters run on clients and on the server. Repeaters on both sides that write the same data are an application bug. | 3.8 |
| What keeps derived data up to date is a persistent repeater: a pure computed value with a reaction, defined by an object and its methods. | 5.3 |
| Index trees are maintained by the index's own code, not by repeaters. B-trees are the default. | 5.3 |
| The collector is Aquifer's: a maintained spanning tree with regions and cohorts. | 7 |
| Fountain's main loop schedules background work, garbage collection included, in a configured ratio to the messages it handles, and may stall new messages when Wellspring reports pressure. | 2.6 |
| Shared publications for large readerships are left for later. | 8.13 |

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

The server is built in three layers, Aquifer, Wellspring and Fountain, described in section 2.6.

## 2.2 Persistent JavaScript objects

An application might define:

```javascript
class Document extends Synchronized {
    title = "Untitled";
    chapters = synchronized([]);

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

`Synchronized` is the base class of objects that are kept in step with others: with the user interface, with what is stored, and with copies on other machines. A plain object or an array is made the same kind of object with `synchronized()` (section 2.5).

A new object is local to where it was made. It is stored, and sent, when an object that already is comes to refer to it, as the chapter above does when it is pushed onto the document's list. Nothing is saved by calling a method.

Objects are given stable identities. A reference between objects is stored as the identity of its target, not as a copy of it:

```json
{
  "$class": "Document",
  "$version": 2,
  "title": "A New Title",
  "chapters": { "$ref": "n456" }
}
```

The class itself is not stored. A stored object names its class, and is given that class's prototype when it is loaded. The exact form of a record is specified in [the data model](../wellspring/documents/data-model.md).

**References are one way**

A reference between persistent objects is an ordinary JavaScript reference: it goes from one object to another, and the object referred to does not know about it.

Fountain does not offer references back to the objects that refer to an object as part of the model. An application that needs a child to know its parent, in a tree, stores a `parent` field explicitly, as it would in plain JavaScript.

Whatever the garbage collector keeps about incoming references internally is its own business, and not visible to applications. An earlier attempt made incoming references part of the model, since the collector of that time needed them in detail anyway (section 9.1). That reason is gone, and the model is the one JavaScript already has.

The exact serialization format remains an implementation detail.

## 2.3 Kinds of objects

Not every object needs to be persistent and shared.

The architecture distinguishes four kinds:

**Shared persistent objects**

The application's data. They are stored in the database, have stable identity, and are synchronized to the clients that select them.

**Server-local objects**

Selections and live queries. They exist in the server's memory only while something uses them. They are never stored and never synchronized as objects. A client talks to them through the protocol: it subscribes, and receives results.

**Client-local objects**

User-interface state, and the client's copies of selected objects.

**Volatile objects**

Sessions and connections (section 4.1), and presence objects such as other users' cursors (section 3.11). They are synchronized with clients, like persistent objects, but live in the server's memory only, like server-local ones. A session is delivered to its own clients; a presence object to everyone who holds what it points at. They are never stored, and a stored object never refers to one.

Keeping the second and fourth kinds out of the database removes a large class of problems. Nothing that observes on behalf of a connected client ever has to be serialized, and a server restart simply discards it together with the sessions it served.

## 2.4 Object metadata

A client's copy of an object is more than its fields. The client also needs to know things about it:

- Whether it has been loaded, or is only a stub: an identity and a type without content (section 3.4).
- Whether it has changes that have not been saved, or are being saved.
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
meta(document).sync.subscriptions  // subscriptions holding it (section 3.7)
untrackedMeta(document).store          // the store it belongs to (section 3.8)
meta(document, "title").saved     // what the server has, as far as the client knows
meta(document, "title").saving    // writes sent and not yet confirmed
meta(document, "title").error
```

Cascade decides no field of the records. The synchronization layer defines these, and an application can add its own. The complete list is in [the protocol](documents/protocol.md), section 13.

Derived states such as "unsaved" are computed from the record rather than stored: a property is unsaved while its value differs from `meta(object, property).saved`.

A stub has metadata like any other object, and its loaded state is observable there. A user interface can show a spinner where an object has not yet arrived, by reading that state rather than the object's fields.

**Reading an unloaded object**

Reading a field of a stub is a programming error: the code is outside the boundary it subscribed to.

Cascade already has a hook for this. A world can be given an `onReadGlobal` function that is asked before every read and may refuse it, returning a configured `cannotReadPropertyValue` instead. The synchronization layer can use it to report reads of unloaded objects in development, and to return a recognizable value in production.

## 2.5 What a field can hold

A synchronized object is a Cascade observable: an instance of a registered class that extends `Synchronized`, or a plain object or an array made with `synchronized()`. Its fields can hold the following. The exact rules are in [the data model](../wellspring/documents/data-model.md).

**Primitive values**

Numbers, strings, booleans, `null`. A property that is `undefined` and a property that has been deleted are the same thing to the database.

**Other synchronized objects**

A reference. The object referred to has its own identity, its own record, and its own place in selections and in security.

**Frozen values**

A plain JavaScript object or array that has been frozen, with `Object.freeze`, all the way down, is a value. It has no identity. It is stored and sent as a whole, as JSON, and it is changed only by replacing it:

```javascript
document.settings = Object.freeze({ margin: 20, columns: 2 });
```

Since nothing inside it can change, there is nothing to observe inside it and nothing to synchronize but the field that holds it, which is written last-write-wins like any other. Cascade already recognizes frozen plain data, and compares it by content.

A frozen value takes the security of the object that holds it, since it is part of that object. This settles most of the question of plain objects (section 8.8): a small plain object is a frozen value, and has no security of its own to get wrong.

A frozen value contains data only. It does not refer to synchronized objects.

**Dates, maps, and sets**

A `Date` is treated as a value, and replaced rather than changed.

A `Map` or a `Set` is supported as a value in the same way: frozen in effect, replaced as a whole. A map or set that is changed in place and synchronized entry by entry would need observable maps and sets in Cascade, which do not exist yet. Until they do, a collection that changes is an object, an array, or a structure built from objects.

**Binary data**

A `Uint8Array` is a value, for small amounts of data such as an icon. Anything larger is a blob (section 8.17).

**A plain object that is not frozen**

An ordinary, unfrozen JavaScript object assigned to a field of a synchronized object is an error, and throws when it is written.

It cannot be synchronized: it is not observable, so a change inside it would never be noticed, and the server's copy would silently drift from the client's. Making it observable behind the application's back would change its identity. The application says which it means: `synchronized({...})` for an object of its own, `Object.freeze({...})` for a value.

**Arrays**

An array made with `synchronized([])` is a synchronized object, with its own identity.

Arrays are expected to be small. An array is stored as one record, rewritten when it changes, and concurrent changes to it need anchoring and rebasing (section 3.9). A large synchronized array is an anti-pattern, and is documented as one: the server survives it, but nothing is done to make it fast. Large or heavily edited collections are trees or linked structures built from objects (sections 3.9 and 5.2).

**Weak references**

A reference is strong: it keeps what it refers to alive. A field can instead hold a weak reference, which does not.

The model is JavaScript's own `WeakRef`: `weak(object)` makes one, and `deref()` returns the object, or `undefined` if it has been reclaimed. Indexes hold their members this way (section 5.4).

A weak reference is also how deletion is verified. Code that removes a document from everything that refers to it can keep a weak reference, and see `deref()` return `undefined` once the collector has proven the document unreachable. The collector works incrementally, so this happens shortly after, not at once. An object that is unreachable but not yet reclaimed can still be reached through a weak reference and referred to strongly again, which rescues it, until the collector has decided; from then on `deref()` returns `undefined`.

**Constructors**

A constructor runs once, where an object is created. It does not run again when the object arrives at the server, when it is loaded from storage, or when it is delivered to another client. In those cases the object is made from its class's prototype and its stored fields.

Field initializers in a class body are part of the constructor, and do not run again either. A field added to a class later gets its value in existing objects through a migration (section 6), not through its initializer.

**No private fields**

A class of synchronized objects cannot use JavaScript's `#private` fields. A private field belongs to the object the constructor made, not to the observable that stands for it, so a method that reads one fails when it is called on the observable. State that must not be synchronized is kept in metadata (section 2.4).

## 2.6 Three layers

The system is three packages, each with one purpose, and each usable without the ones above it.

```text
  Fountain     users, sessions, security, selections per session,
               the protocol, the client store
     |
  Wellspring   persistent JavaScript objects on a server:
               classes, loading and unloading, migrations
     |
  Aquifer      records, references, transactions, garbage collection
```

**Aquifer** is a database of records. A record has an id and fields, and a field can hold a strong or a weak reference to another record. Aquifer runs transactions and collects what cannot be reached (section 7). It knows nothing of classes, observables, or users, and does not depend on Cascade. Its correctness is stated, and tested, in terms of records alone.

**Wellspring** turns records into objects. A Wellspring object is a Cascade observable, an instance of a registered class, whose property writes are stored without the application saying so. Wellspring keeps one instance per identity, makes objects from records and records from objects ([the data model](../wellspring/documents/data-model.md)), migrates old objects when they are loaded (section 6), and decides what is in memory.

Its central operation is `load`: code names a starting object and a selector, and receives control when everything the selector selects is in memory, and held there (section 3.7). It is to a server what `subscribe` is to a client. Because a selector follows the fields of objects, loading belongs here and not in Aquifer; and because Cascade records what a selector reads, a loaded selection follows the graph as it changes.

Wellspring needs Cascade for two things: Cascade's change events are how an ordinary property write becomes a write to the database, and its recording of reads is how a selection, or a persistent repeater (section 5.3), knows what it depends on.

Wellspring has its own [design document](../wellspring/documents/design.md), which holds what this paper used to say about loading on the server, indexes, persistent repeaters, and migration.

An application with no clients at all can be written on Wellspring alone: a server-side tool, a desktop application, a single-user editor that keeps its documents as objects.

**Fountain** is everything that involves more than one party: users and sessions, authorization, a selection per session, the protocol, and the store on each client.

**The same names at every level**

The layers are meant to read alike, so that what is learned at one level holds at the others.

- An object is made ready in one way, whether it is to be shown in a user interface, stored, or sent to other machines: with `synchronized()`, or by extending `Synchronized`. It is the operation Cascade calls `observable`, under the name that says what it is for: the object is kept in step, through repeaters, with whatever depends on it, the screen above it and the database under it alike.
- Code gets hold of a structure of objects in one way: `load` on a server, `subscribe` on a client, each with a starting object and a selector.
- Each machine has one Cascade world. An object that is stored, or sent, is the same object that a component reads. On a client, the id that Cascade gives an object when it is made is what names the object to the server until the server has given it an identity.

**What is shared with clients**

The data model itself, which is the encoding of values, the registry of classes, the check on what a field may hold, and the making of an object from a record, runs on clients as well as on the server. It depends on neither Aquifer nor a network. Whether it is a part of Wellspring that a browser can load, or a small package of its own, is decided when it is written.

**What each layer asks of the one below**

Wellspring asks of Aquifer: volatile roots, so that a loaded object is not collected while it is held; the set of changes of each transaction, with a commit number, from which everything reactive is triggered; notification of a reclaim inside the transaction that performs it, so that indexes and weak references are updated with it; and the commit that last changed each record (section 7).

**The main loop**

The server is one synchronous loop. It takes the next message from a client, handles it in a transaction, and sends what has to be sent. Between messages, it lets Wellspring do background work, including Aquifer's garbage collection, in a ratio that is a setting: one step of background work after every message, or one after every fifth. When no message is waiting, it does background work until there is none.

The collector's steps are bounded and can be interleaved with transactions in any order, so the ratio decides only how fast garbage is reclaimed, not whether the database is correct. In the rare case that Wellspring reports pressure, because the collector has fallen far behind or memory is running out, the loop may stop taking new messages until the pressure is gone (Wellspring's [design](../wellspring/documents/design.md), section 9.4).

Fountain asks of Wellspring: objects, classes and `load`; a transaction around a client's writes; the change set of each commit, in terms of objects; and a way to run a selector as a given user, passing only through what that user may read.

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
subscribe(document, selectDocument, () => {
    ensure(() => {
        titleElement.textContent = document.title;
    });
});
```

The computation observes the properties it reads.

When the title changes, the relevant computation executes again.

The client does not need to manually identify every UI element affected by a database mutation.

## 3.2 Reactive capabilities on the server

Some Cascade capabilities are specific to frontend rendering and animation and would be unnecessary on the backend.

However, its automatic dependency-tracking mechanisms could also be useful on the server.

A subscription is such a computation. The server runs a selector, which reads the objects it selects, and records what it read. When any of that changes, the selection is updated, and the difference is sent to the client (sections 3.4 and 3.5).

A server-side subscription can thus be viewed as a reactive computation whose output is transmitted to a client.

The same mechanism, with its dependencies stored rather than held in memory, keeps indexes up to date (section 5.3).

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

A stub reveals that an object exists, and its class, also when the user may not read the object. That is accepted. An application for which it is too much keeps such references in an object that the user cannot read at all.

Selectors are registered by name, as classes are. A client subscribes by naming a selector and a starting object. It never sends code to the server.

**The server decides what a selection contains**

Selectors run on the server only. The server tells a client which objects its subscription contains, and which have joined and left.

A client could run the same selector on its own copy, to predict the result, but nothing requires it to, and it would make every change of a selector a compatibility problem between client and server versions (section 8.6). The client needs to know only which subscription each object belongs to, which the server tells it.

**Parts come along**

An array, or a synchronized object without a class, has no life of its own: a chapter's list of paragraphs belongs to the chapter. When a selector selects an object, the arrays and classless objects that the object refers to are selected with it, and those that they refer to in turn. A selector therefore decides only about objects of the application's classes. It does not have to add the list in order to add the paragraphs.

**A selection has a root, and a client's subscriptions are a forest**

A selection is a shallow tree: its starting object is the root, and everything the selector selected is under it. The server does not record by which path the selector reached each member. It could not in general, since a selector is ordinary code, and the root is enough for what follows.

A client's subscriptions together form a forest. The roots of the forest are given by the server: what the session refers to, and what session methods return (section 4.5). Everything else the client has, it has because it is under one of those roots.

This forest is what a client is entitled to. It cannot subscribe from an object that is not in it, and it cannot write to one. An identity that it has made up, or seen somewhere else, gets it nothing. Section 4.2 builds the security of arrays and classless objects on this.

A selection is the unit of several things at once:

- **Subscription.** Changes to any object in the selection are sent to its subscribers.
- **Loading.** A client receives the whole selection before it operates on any of it, so that code within the boundary can run synchronously.
- **Holding.** The objects of a selection are held by its subscribers, and must not be collected while they are (the volatile roots of the garbage collector).
- **Authorization.** A selection belongs to one session, and passes only through objects that its user may read (section 4.4).

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

In the terms of section 5.3, each application is a rule repeater, one per selection and object. Its value is the set of objects it selects along with its object, and when that value changes, the selection receives the references that were added and removed. Rerunning the whole selector is the same thing with a single repeater for the whole selection. The API is the same for both, so a selector can start out whole and be made incremental later.

**Removal is a reachability problem**

Adding to a selection is easy: apply the rule to the new object and continue from there.

Removing is not. An object can be selected through several paths, and selected objects can reference each other in cycles. When one path is cut, the object leaves the selection only if no other path remains.

This is the garbage collector's problem (section 7), over the subset of references the selector follows, starting from the selection's starting object.

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

Selections and live queries are server-local objects (section 2.3).

They are Cascade repeaters, used as they are. Cascade records what they read, in memory, beside the objects rather than in their records.

Nothing about them is written to the database.

After a restart they are gone, which is correct, because the sessions they served are gone too. A reconnecting client subscribes again and states the commit it last saw and what it holds. The server computes the selection anew and sends what the client lacks, and what has changed since (section 8.14). This requires the commit that last changed each object, which Aquifer keeps.

**Persistent observers**

A persistent repeater, such as the key of an index entry, is different. What it maintains is persistent, so it must be triggered by every relevant change, also after a restart, and also when the objects involved are not in memory.

Its dependencies cannot be references to observers in memory.

They are not stored as observers at all. Section 5.4 describes what is stored instead.

**When observers run**

A persistent repeater that maintains a transactional index runs inside the transaction that triggered it, before the commit.

Volatile observers run inside the transaction too, as Cascade's repeaters do: a selection is up to date when the transaction is committed. What they found is sent after the commit, and the changes are grouped by commit, so that a client moves from one consistent state to the next. A write that is going to be refused is refused before it is applied (section 3.9), so a selection does not, in practice, see state that is then taken back.

**How much of Cascade is needed**

Cascade's plain, timeless observables record dependencies through a replaceable interface and can report every change as an event. That is the mechanism described here, and the first implementation can use it as it is.

Whether the server should eventually use a smaller tracker of its own is a question of cost, not of design. In both cases application code sees ordinary property access, and the same classes run on the server and on clients.

## 3.7 Explicit loading: subscribe

An early version of this architecture (section 9.1) loaded data implicitly. Node Fibers made it possible to suspend execution in the middle of a property getter, load the missing object, and resume, so that code never had to know what was loaded.

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

On a client, `selectDocument` is the name of a selector registered on the server, or a handle that carries the name. The client does not have the selector's code (section 3.4). A subscription can take options before the action, such as `{ gated: true }` (section 3.10).

`load` is Wellspring's (section 2.6), works without Fountain, and is described in [Wellspring's design](../wellspring/documents/design.md), section 3. The two functions have the same shape, so code written against a selection can run on either side. They are kept as two names because they are different things: a subscription involves a connection and a user, and loading does not.

The names were earlier `ensureSubscribed` and `ensureLoaded`. They were changed because `ensure()` already has a meaning in Cascade, where it is the preferred name for `repeat()`.

On the server, a reference outside a loaded selection could still be followed by loading on demand, since storage reads are synchronous. In development it should nevertheless be reported, as on a client, so that code that works on the server does not fail when it runs on a client.

**Subscriptions are held, and counted**

A subscription is not a one-off fetch. It holds its selection, and the selection follows the graph (section 3.5), until the subscription is released.

Every object keeps a count of the subscriptions that currently hold it, in its synchronization metadata (`meta(object).sync.subscriptions`). A subscription increments the count of each object in its selection, and of each object that later joins it. It decrements the count of objects that leave its selection, and of all of them when it is released.

When an object's count falls to zero, it can be released:

- On a client, its subscription ends and its content is dropped. It becomes a stub again, or disappears entirely if nothing references it.
- On the server, it can be evicted from the object cache, and it is no longer a volatile root of the garbage collector (section 7 and Aquifer's design document, §9.4).

**When a subscription is released**

A subscription made inside a reactive computation, such as a Cascade component's `build()`, belongs to that computation. It is released when the computation is disposed, and kept when the computation reruns and makes the same subscription again. This is how Cascade already treats objects created inside a repeater, and it means that a component holds exactly the data it is showing.

A subscription made outside any reactive computation returns a handle with which it is released.

**Overlapping subscriptions**

Two subscriptions whose selections overlap share the objects in the overlap, each holding them once. On a client, the server tells it which of its subscriptions an object belongs to, so the client can count without running selectors. On the server, an object is held in memory for as long as any session's selection, or any `load`, holds it.

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

On the server, Wellspring (section 2.6) is a store as well. At the end of a transaction, its changes are written to the database as one Aquifer transaction, and the resulting change set is what triggers selections, queries, and persistent repeaters (section 3.6).

A client store and the server store differ only in where they send a finished transaction.

**Repeaters on clients and on the server**

A client's transaction includes the writes of the repeaters it set off, and the server, applying it, sets off its own.

In practice the two sides run different repeaters. On a client, repeaters build views, and do not write to the model. On the server, they maintain selections and indexes, and what they change is pushed out to clients.

The assumption is therefore that repeaters on the two sides do not write the same data. If they do, and each side's writes set off the other's, that is a bug in the application, not something the protocol resolves. In development, a repeater on a client that writes to a synchronized object should be reported, since that is where such a bug starts.

An earlier attempt marked the writes of repeaters as consequences, so that the receiving side could tell them from direct writes (section 9.1). The idea is kept in reserve. Nothing so far needs it.

## 3.9 Writes: a real-time stream, last write wins by default

**The base model**

Writes from clients form one stream to the server, served first come, first served.

When two users change the same property, the change that reaches the server last overrides the earlier one. There is no conflict detection, no merging, and no rejection of a write because someone else wrote first.

Concurrent edits are thus treated the way a shared whiteboard treats them: everyone sees everyone else's changes as they happen, and the latest one is what stands.

Locks, semaphores, reservations, and check-and-set are application concerns. They can be built from ordinary objects within this model, for example a `lockedBy` field that the application sets and respects, and shown to the user through property metadata (section 2.4).

Last-write-wins is the default. Where no one's work may be lost without their knowing, a subscription can instead be gated: a write succeeds only against the values its writer saw, and changes from the server do not overwrite local work but mark it as out of sync (section 3.10).

**What can still fail**

The authorization methods of section 4.2 are ordinary methods of the application's classes, and run the same on clients and on the server. A client therefore knows, before it writes, whether a write is allowed, and the user interface does not offer what is not.

The server still checks every write, since a client can be modified. But for an unmodified client, a refused write means one of three things:

- **A bug**, such as an authorization method that reads something outside the client's selection, and so decides differently on the client.
- **A code mismatch** between client and server (section 8.6).
- **A race**: the client decided on a state that had already changed on the server, such as a permission withdrawn a moment earlier.

None of these is a normal outcome of concurrent editing. A refusal is reported in the property's metadata (`meta(object, property).error`), and the client's value is replaced by the server's, which the refusal carries.

**Locks from authorization**

The race is also what makes a lock possible without a new primitive.

```javascript
class Paragraph extends Synchronized {
    canWrite(user, property) {
        return !this.lockedBy || this.lockedBy === user;
    }
}
```

Taking the lock is writing `lockedBy`. Two clients that try at the same time both find it free, and both write. The server asks `canWrite` about each write against the state before that write. It applies the first, and refuses the second, because by then the paragraph is locked by someone else. The refusal is the second client's feedback. It must therefore wait for its write of `lockedBy` to be confirmed before it starts editing.

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

This is the structure of the sequence CRDTs (section 8.4), here built from ordinary objects within the base model, with the server's order replacing the clocks.

The derived order is a reactive computation on the client, and on the server it is a value that a persistent repeater can maintain (section 5.3), or an index.

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

An array of primitive values, or one that contains the same object twice, has no identity to anchor to. For those, the fallback is to shift a splice's position past the splices the server applied in between. That is the simplest form of operational transformation (section 8.4), simple because one server decides the order. Text, a sequence of characters, is the important case of this kind.

**Ordering on the client**

The client applies its own writes at once, without waiting for the server.

A value that arrives from the server for a property with unconfirmed writes of the client's own must not overwrite it. If the server received another client's write first, then committed the client's own write after it, the client's value is the one that stands. Applying the older value would make it flicker back and then forward again.

The rule is therefore: while a property has writes of the client's own that the server has not yet confirmed, incoming values for it are ignored. The count of writes in flight is already in its metadata (`meta(object, property).saving`). Because one WebSocket delivers messages in order, every value the server sends after confirming the client's last write is newer, and is applied as usual.

**New objects**

An object made on a client is local to it until an object the server knows comes to refer to it. It is then sent to the server, in the same transaction as the reference.

It has no identity yet. Until the server gives it one, it is named by the id that Cascade gave it when it was made, which is unique for as long as the client lives. Later transactions can refer to it by that name before the first has been confirmed.

The server stores the object and answers with its identity. The client records it, and the object is the same JavaScript object as before.

Until the answer arrives, the object exists only on its client. Another client cannot have a reference to it, because every message that could carry one comes from the server, after the object has been created there.

## 3.10 Gated synchronization

Last-write-wins suits games, whiteboards, and editors where people see each other and adjust. It does not suit an information system in which several people work on the same record, and no one's work may be lost without their knowing: a case file, a patient's chart, a contract under negotiation.

For those, a subscription can be gated.

```javascript
subscribe(caseFile, selectCaseFile, { gated: true }, () => { ... });
```

A gated subscription changes two things, one in each direction.

**Outgoing: a write succeeds only against what the writer saw**

Every write that the client sends for an object in a gated subscription carries the value it replaced, as the client had it just before the write, including the client's own earlier writes that are still on their way. The server applies the write only if the field still holds that value. If any field has changed since the client saw it, the whole transaction is refused (section 8.10), and the refusal carries the server's current values. The client's own values stay on screen, marked out of sync, until the application resolves them.

The check is per field, not per object. Two people editing different fields of the same record do not stop each other; only a write to a field that someone else has changed in the meantime is refused. And it compares values, so no version numbers need to be stored: a field that was changed and then changed back is the value the writer saw, and nothing is lost by writing over it.

For a reference, the value compared is the identity. For an array, a change is refused if anyone else has changed the array since the client saw it. That is a coarse check, simple and safe.

**Incoming: the server's changes do not overwrite local work**

In a subscription that is not gated, a change from the server is applied at once, except to a field with the client's own unconfirmed writes (section 3.9).

In a gated subscription, a change from the server to a field that the client has changed locally, and not yet had confirmed, is not applied. The client keeps its own value, and records the server's beside it, as the field's saved value. The field is out of sync.

A change from the server to a field that the client has not touched is applied as usual. Nothing is lost by it, and the document stays current wherever the user is not working.

**Out of sync is metadata**

An out-of-sync field is marked in its metadata:

```javascript
meta(caseFile, "diagnosis").outOfSync  // true
meta(caseFile, "diagnosis").saved      // what the server has now
```

The editor can show it: a field outlined, with the other value beside it, or a banner saying that a document has changed while it was being edited.

**Resolving is the application's procedure**

Fountain provides three operations, and no policy:

- **Pull** discards the local value, and takes the server's: `pull(object, property)`.
- **Force** writes the local value again, with the server's current value as the new base, so that it succeeds, knowingly overwriting: `force(object, property)`.
- **Merge** is done by the application: it computes a value from the two, writes it, and forces it.

Each can apply to one field, to one object, or to everything that is out of sync in a subscription.

What a procedure does with them is the application's: ask the user field by field, prefer the newer value for some fields and the user's for others, or show the two versions of a document side by side. Fountain does not implement version control. It provides the mechanism on which an application can build as much of it as it needs.

**Drafts**

A gated subscription can also hold the client's writes until the application sends them, rather than sending them as they are made: `{ gated: true, send: "explicit" }`. The user then edits a draft, and the draft is submitted as one transaction, checked as above. This is form state, as in the form field example (section 2.4), built on the same mechanism.

**Mixing modes**

The mode belongs to the subscription, and so to the client that made it. An object that is in both a gated and an ungated subscription of the same client is treated as gated. A gated client never overwrites a change it has not seen, and is never overwritten silently while it works. A client that is not gated, writing to the same objects, still writes last-write-wins: it can overwrite what the gated client has saved, and the gated client then sees the change arrive like any other.

When that is not enough, and every writer to some data must be checked, the class can require it: a class that declares its writes gated is written only through gated checks, by every client. **Open:** whether this is needed, and how it is declared (section 8.4).

**What it costs**

Every write in a gated subscription carries its base value, which roughly doubles its size. The server compares before applying. Nothing is stored that would not be stored anyway.

## 3.11 Presence

Users editing the same document need to see each other: where the others' cursors are, what they have selected, which paragraph they are in. Collaborative editors show this, and users respond to it. They keep their distance, and seldom edit on top of each other.

**Presence is shared, but not persistent**

A cursor belongs to a session. It is synchronized to everyone in the document, changes many times a second, and is meaningless after the session ends.

Presence objects are therefore volatile objects (section 2.3): shared like persistent objects, and in memory only, like server-local ones. They live in the server's memory, belong to a session, are selected along with the document they are in, and disappear with the session. They are never written to the database, never trigger persistent repeaters, have no commit numbers, and can be sent at a lower priority, or throttled, without harm ([protocol](documents/protocol.md), section 12).

A presence object may refer to persistent objects: a cursor refers to the paragraph it is in. A persistent object must never refer to a presence object, since the reference would dangle after the session ended. Writing such a reference is refused.

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
- When writing inside the same paragraph must work, text needs splices (section 8.4).

---

# 4. Object-Level Security

## 4.1 Users, sessions, and authentication

Every authorization decision is about a user. The user model is therefore part of Fountain from the start, not something an application adds.

**Users are persistent objects**

A user is an ordinary persistent object of a built-in class, `User`, which applications may extend with fields of their own: a name, a picture, memberships. Authorization methods receive it, and compare it with references in the data, such as `this.owner === user`.

A user's credentials are kept apart from the user, in an object that no client can read or select, so that selecting a user, to show an author's name, never comes near a password hash.

**The super user**

A new database is created with one user, the super user, who can read and write everything and can create other users. The authorization methods are not asked about the super user's operations.

The super user is the way into an empty database. It is also the visualizer's user (section 10).

**Authentication**

A connection starts with an anonymous session, whose user is none. Signing in is a call to a method of the session (section 4.5), which binds it to a user; from then on, every message on the connection acts as that user. Two ways in should be supported from the beginning:

- **Passwords.** The super user, or an application acting for it, creates a user with a password. The server stores a slow, salted hash, such as scrypt or Argon2, and never the password.
- **An external login service.** The client signs in with an identity provider, using OpenID Connect or a similar protocol, and presents the access token it receives. Fountain verifies the token's signature and issuer, and finds the user recorded for that issuer and subject, or creates one if the application allows it. Fountain does not have to implement logins, password resets, or two-factor authentication itself.

Both end in the same place: a session bound to a `User` object.

**Sessions**

Two objects are involved, as in the earlier attempts (section 9.1):

- **The session** lasts for one sign-in, across browser tabs and reconnections. It holds the user and any grants (section 4.5). Its class is the one the application extends, and it is the client's way of talking to the server and its security gateway (section 4.5).
- **The connection** lasts for one tab. It holds the subscriptions, the presence objects, the code version (section 8.6), and the order of the client's messages. It belongs to a session, and is internal to Fountain.

Both are volatile objects (section 2.3): synchronized with their own clients, and never stored. They are gone after a restart. What survives is the token a client was given when it signed in: the server stores, for each token it has issued, which user it stands for, and a client that presents one gets a session for that user, made anew.

**The client sees its own session**

The session and the connection are selected for their client like any other objects, without the server-only parts: the current user, the active subscriptions, what is being loaded. On the client they are ordinary observable state. A user interface that shows who is signed in reads `session.user`, and is updated when it changes, whatever changed it.

An earlier attempt went further, and let the client subscribe by writing: it added a subscription to a list in an object it could write, and the server responded to the change. In Fountain, subscriptions are made through `subscribe` (section 3.7), but they are visible in the same way.

Signing a user out, or disabling a user, ends their sessions. Their subscriptions end, and their clients are told to drop what they hold.

**The system**

Persistent repeaters, migrations, and the garbage collector act as no user. They are not subject to the authorization methods, and what they compute must not depend on who is asking. A key is computed once for everyone. Who may see the result is decided when it is delivered (section 4.3).

**Operations that only the server may perform**

Some operations cannot be expressed as field writes from a client, because the client must not do them itself: creating a user with a hashed password, sending an email, charging a card, or answering a question about data the user may not see.

These are methods of the session object, which a client calls remotely (section 4.5). Signing in is the first of them.

## 4.2 Authorization through object methods

The proposed security model allows persistent objects to implement authorization methods:

```javascript
class Document extends Synchronized {
    canRead(user) {
        return this.isPublic ||
               this.owner === user;
    }

    canWrite(user, property, value) {
        return this.owner === user;
    }
}
```

`canWrite` receives the property and the new value as well, so that it can allow some properties and not others, and reject values that are invalid. Validation is thus the same mechanism as authorization.

**Security is activated by the class**

An object of a class that defines `canRead` is protected for reading, and one that defines `canWrite` for writing. An object whose class defines neither is unprotected: anyone who can reach it can read and write it.

An application can start without security and add it class by class.

This is on purpose. Everything that a client can reach, and that has no security methods, can be edited freely. A prototype needs no security at all to work, and for some applications none is the right amount: a shared whiteboard on an internal network is as open as the whiteboard on the wall of the same building. Security is switched on gradually, where it is needed, without changing the rest.

**The same on both sides**

The methods are ordinary methods of the application's classes, and run the same on clients and on the server. A client knows whether a write is allowed before it makes it, and the user interface does not offer what is not.

The server's evaluation is the one that counts, since a client can be modified. For an unmodified client, a refusal means a bug, a code mismatch, or a race (section 3.9).

A client can only predict correctly if the methods read what is in its selection. A `canWrite` that reads a group's membership needs the membership selected along with the document. Development mode should report an authorization method that reads outside the client's selection, as it reports any other such read (section 2.4).

**Objects without a class, and arrays**

A small piece of plain data, such as a document's settings, `{ margin: 20, columns: 2 }`, is a frozen value (section 2.5). It is part of the object that holds it, and is read and written under that object's security.

What remains is synchronized objects that are not instances of an application class: a `synchronized({...})` without a class, and every synchronized array, such as a chapter's list of paragraphs. They have identities of their own, and no methods, and so no security methods of their own.

They are open, in the sense that nothing is declared for them. They are protected by where they are: a client can reach them only through its subscription forest (section 3.4).

- **Reading.** A client receives an object only as a member of one of its selections, and a selection passes only through objects that the user may read (section 4.3). An array that belongs to a protected document is delivered only to those who may read the document, as a part of it. There is no way to ask for the array by itself: a client can subscribe only from what its forest already contains, and the roots of the forest come from the server.
- **Writing.** A client can write only to objects it holds. For an array or a classless object, the server asks the root of the selection through which the client holds it: its `canWrite`, if it has one, with the user and no property. Someone who has subscribed to a document that they may read but not write cannot add a paragraph to a chapter's list, because the document says no.
- **Referring.** A client can write a reference only to an object in its forest, or to one it has made. Otherwise it could write a reference to an identity it had guessed into a document of its own, and receive the object as a part of that document.

If a client holds the same array through two selections, it may write it if either root allows it. An array under a root that has no `canWrite` is open to everyone who holds it.

The root decides for all the loose parts under it, whichever object they belong to. That is coarse, and deliberately so. Where it is too coarse, the answer is to give the part a class with security methods of its own, or to subscribe to it through a root that decides differently.

The aim is that arrays and classless objects remain the cheap default, and that they never become the way around a protected object.

**Creating objects**

Anyone may create objects. A new object is kept only if it is referenced from an object that its creator may write, since otherwise it is unreachable, and the garbage collector reclaims it. Creating objects therefore needs no authorization method of its own; attaching them does.

## 4.3 Authorization and subscriptions

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

**Queries and indexes**

An index is computed once, for everyone (section 4.1). The result of a query over it may contain objects that the asking user may not read, and they must be filtered out on delivery.

Filtering after a range has been read breaks limits and paging: the first twenty entries may contain five that the user may not see. Either the query reads further until it has enough, or, when most of an index is invisible to most users, there is one index per audience, such as per team. This is a design decision for each query (section 5.6).

**Granularity**

Security is per object, not per property. A property that only some readers may see, such as a salary, belongs in an object of its own with its own `canRead`.

## 4.4 Selections are per session

Every session has its own selections.

Two users who subscribe with the same selector, from the same object, may receive different sets: the selector passes only through objects that each of them may read, and `canRead` is arbitrary code that may answer differently for each user. The server cannot know that two users would receive the same selection without computing it for both.

Selections are therefore not shared between users. An earlier version of this paper proposed sharing them among users "with equivalent access rights"; that is dropped, because one user might not be allowed to see all of what another sees, and a mistake would be a leak.

The cost is memory on the server, in proportion to what each session holds (section 8.2), and it is accepted. Objects are still shared: there is one instance of each object in the server's memory, however many selections contain it. What is per session is the record of which objects it holds.

Serving a very large number of readers of the same public data is a separate problem, with a separate solution, left for later (section 8.13).

## 4.5 The session as the server's API

**Remote methods on the session**

Besides writing to the objects it has selected, a client can call methods on its session object, which lives on the server, and receive their results.

The application defines the session's class, by extending Fountain's:

```javascript
class CompanySession extends Session {
    anyOtherEmployeeWithHigherSalaryThanMe() {
        const me = this.user.employee;
        return this.company.employees.some(
            employee => employee !== me && employee.salary > me.salary
        );
    }
}
```

```javascript
// On a client
if (await session.anyOtherEmployeeWithHigherSalaryThanMe()) { ... }
```

A method of the session is what an API endpoint is in a conventional server: a named operation, with arguments, that runs on the server and returns a response. The difference is that it is written as a method, called as a method, and works on the same objects as everything else.

**Every method of the session class is remote**

The convention is that the application's session class lives in server-only code, and every method in it is a remote method. On a client, `session` is a stub with a method of the same name for each of them, which sends the call and returns a promise of the result. On the server, the same methods are ordinary methods.

Other conventions were considered:

- **An explicit call**, `object.callOnServer("methodName", ...args)`, as in the earlier attempts (section 9.1). It shows at the call site that the network is involved, but the method is named by a string, and nothing about the method itself says that it is reachable from outside.
- **A naming convention**, such as `tryLoginOnServer` beside `tryLogin`, also from the earlier attempts. It marks the definition, but a name cannot keep the code out of the client.
- **A decorator**, `@remote`, on methods of any class.

What decides the matter is that the boundary that counts is which code is sent to the client, not what a method is called. A server-only class is that boundary. At the call site, the explicitness is kept by `await`: a remote call returns a promise, and code that waits for it shows that it does.

A method that needs to do something on the client first, such as a `tryLogin` that hashes the password before calling the server, is written in an ordinary client-side function or class that calls the session.

**Only the session**

The earlier attempts allowed a remote call on any shared object, each guarded by its own `allowCallOnServer` (section 9.1). Fountain allows them only on the session.

One gateway is one place to read when auditing what a client can make the server do. An operation on a particular object takes the object as an argument, `session.publish(document)`, and the method checks what it needs to. An application that wants the call to read as a method of the object can give the object's class a client-side method that does exactly that:

```javascript
class Document extends Synchronized {
    publish() { return session.publish(this); }
}
```

It is hard to think of an application that would need more. If one does, the session can dispatch to server-side methods declared by other classes, without changing the protocol.

It is the request and response half of the model, beside the stream of writes. It is also where server queries are made, when an application wants them: a query is a session method that returns a result (section 5.6).

**The session is the security gateway**

The authorization methods of section 4.2 govern what a user can do directly: which objects a selection can deliver, and which fields a client can write.

A session method is trusted code. While it runs, it reads and writes with full access, and decides itself what crosses back to the client. On the server, a reference can always be followed, whatever is in memory (Wellspring's [design](../wellspring/documents/design.md), section 3.6), so the method does not need to load anything first. The example reads the salaries of the whole company, which the user may not read, and returns a single boolean.

A session method thus extends a user's access for the duration of one call, and only in the way the method allows. The user never gets the salary data; the user gets an answer about it.

This is the place for everything that is decided by the server rather than predicted on the client: creating users, aggregates over data the user may not see, operations with external effects, and checks that need secrets.

**Rules for session methods**

- **Server-only code.** The bodies of session methods are not sent to clients. They may contain secrets and logic that the user should not see. A client receives the names of the methods it may call, and the stub is generated from them. The bundler must be kept from including the session class in the client. This is the one deliberate exception to running the same code on both sides.
- **Arguments and results are data.** A method receives and returns values that can be serialized: numbers, strings, plain objects, and references to persistent objects. A returned reference gives the client an identity, not access. If the client subscribes to it, its `canRead` still decides.
- **Granting access for longer than a call.** A method can grant its session access to particular objects, for example the results of a search that the user may see, though `canRead` alone would not say so. The grant is held by the session, consulted by authorization along with `canRead`, and ends with the session.
- **Calls are asynchronous for the caller.** A remote call can never return synchronously. On a client it returns a promise.
- **Methods are synchronous on the server, and atomic.** A session method runs from start to end without waiting, as one transaction. What it read cannot change under it, and its writes are applied together or not at all. Its writes reach every subscriber, including the caller, through the ordinary stream.
- **External effects happen after the commit.** A method that sends an email or charges a card does not do so inside the transaction: it could not wait for the answer, and the effect must not happen if the transaction fails. It registers the effect, which is carried out after the commit. If the outcome matters, the effect's completion calls another method, in a new transaction, which records it. A method written with `async` and `await` is possible, but then each stretch between waits is a transaction of its own, the method must expect that the data has changed after each wait, and it is no longer atomic. It is the exception.
- **Rules across several objects belong here.** Last-write-wins cannot keep a rule that involves more than one write: that user names are unique, or that an account has the money before a transfer is made. A session method can, because it checks and writes in one transaction on the server. Besides secrets and external effects, this is what session methods are for.
- **Effects arrive as state.** A method's return value is for answers, such as the boolean above. Its effects are best seen as changes to selected objects. Signing in returns whether it succeeded, but the user interface follows `session.user`, which changes on every client of that session, in every tab. The earlier attempts worked only this way: their remote calls returned nothing, and the client saw their effects through synchronization.
- **Ordering.** The call travels on the same connection as the client's writes, so it sees every write that the client made before it. The server sends the changes the method made before it sends the response, so when the client's call resolves, its objects already show the method's effects.
- **Limits.** Since every call passes through the session, the session is the natural place for rate limits and quotas (section 8.12).

**The session also governs subscriptions**

The session can decide, too, which subscriptions a client may make: which selectors, from which starting objects. The default allows any selector from any object that the user may read. An application can narrow it, for example to a few named selectors from objects that the session has given the client.

This is how the roots of a client's subscription forest are given (section 3.4): the session decides which objects a client may start from, by referring to them and by returning them from its methods.

**The session is where a client starts**

Code must have an object before it can subscribe from it (section 3.4), so a client needs a first object. That is its session, which it always has.

The session's fields refer to what the user starts from: `session.user`, and whatever the application adds, such as a workspace, or the list of the user's documents. They arrive as stubs, and the client subscribes from them.

On the server, application code starts from the database's root object, to which it attaches the structures the application needs: the users, the indexes, the top of the application's own data.

**Code that no client called**

Not everything on the server happens because a client asked. A scheduled job runs at night; a payment service calls back over HTTP; another system fetches data through a conventional endpoint.

Such code is ordinary server code that works on the same objects, in transactions of its own. It runs either as the system, with full access, or as a user, by creating a session for that user and calling its methods as ordinary method calls. Tests act as users in the same way.

Fountain does not need to provide the scheduler or the HTTP server. It needs to make the database usable from them: a transaction, the root, and a session for a given user.

---

# 5. Persistent Indexes and Derived Structures

## 5.1 Indexes as ordinary objects

Indexes are not a feature of the database engine. They are ordinary persistent data structures, built from persistent objects, that an application defines.

Indexes are Wellspring's (section 2.6). What follows in sections 5.1 to 5.4 and 5.7 is a summary; the full text is in [Wellspring's design](../wellspring/documents/design.md), sections 6 and 7. Live queries, which deliver an index's contents to clients, are Fountain's, and are described here in sections 5.5 and 5.6.

## 5.2 Live indexes

An index has a member set, a key computed from each member, and an ordered structure, by default a B-tree whose nodes are persistent objects. It is live: when a member's key changes, the member moves, and when the member set changes, entries are added and removed.

Described in [Wellspring's design](../wellspring/documents/design.md), section 6.2.

## 5.3 Persistent repeaters

What keeps an index up to date is a set of persistent repeaters: one per member, each computing that member's key.

A persistent repeater is a pure computed value, with a reaction that its owner carries out when the value changes. Since a closure cannot be stored, it is defined by an object and the names of its methods. The tree of an index is not maintained by repeaters but by the index's own code, which the reaction calls. What a persistent repeater maintains can always be rebuilt from nothing, which is the recovery strategy, the migration strategy, and the test oracle.

The same structure, at the level of selections, gives rule repeaters: one per selection and object (section 3.5).

Persistent repeaters are Wellspring's, and work without clients. They are described in [Wellspring's design](../wellspring/documents/design.md), section 7.1.

## 5.4 Triggering a persistent repeater without stored observers

A persistent repeater must be triggered by changes to objects that are not in memory, and after a restart, so its dependencies cannot be observers in memory.

A key that reads only its member needs no stored dependencies: any write to the member evaluates the key again. A key that reads other objects stores a dependency record for each, and a write to such an object triggers the members that depend on it. Work caused by an object that very many keys read is done in the background, and its dependency records can be replaced by a single coarse one.

An index holds its members weakly, and its own removal code is called before a member is reclaimed.

The mechanism is described in [Wellspring's design](../wellspring/documents/design.md), section 7.2.

## 5.5 Live queries

A query reads an index: a range of keys, possibly filtered and limited.

Because the nodes of the index are ordinary objects, reading a range records a dependency on the nodes that were visited. Inserting a member into that range changes one of those nodes, and the query is triggered.

Observing a range therefore requires no mechanism of its own. It follows from building indexes out of observable objects.

The result of a live query is an ordered selection. It is delivered to clients by the protocol that delivers any other selection: the objects first, then changes.

A user searching a catalog can then see the result change as new products arrive.

Whether a result should change under the user's eyes, or announce that newer results exist, is a decision for the application.

## 5.6 Queries as server-local objects

A query is a server-local object (section 2.3) with ordinary query and result semantics: a client names a registered query, supplies parameters, and receives a result.

The natural way to name and call it is as a method of the session (section 4.5). The method runs on the server with full access, filters the result for the user, and returns either the result itself or a live result object, a server-local selection that the client then subscribes to.

What produces the result is hidden behind the name.

It can be a live index. It can also be a specialized structure, an external search engine, or a scan, and the result can be one that is not kept up to date.

Live indexes are the default, the proof of concept, and sufficient for simple applications. Where a live index costs too much, that query can be given an optimized implementation without changing the clients that use it.

## 5.7 Consistency

An index that is expected to be complete cannot be updated whenever a background scheduler happens to run. Indexes are therefore of three kinds: maintained inside the transaction that changed a key; eventually consistent, with the stale members tracked; and lazy, with their coverage tracked while they are built.

The kinds are described in [Wellspring's design](../wellspring/documents/design.md), section 7.3.

---

# 6. Lazy Object Schema Migration

Because objects are loaded individually, a class can change without the database being rewritten. A class has a version and a set of migrations, each record stores the version it was written under, and an object whose record is older than its class is migrated when it is loaded, before application code sees it.

Migration is Wellspring's, and is described in [Wellspring's design](../wellspring/documents/design.md), section 8.

What concerns Fountain is the other half: a client that runs older code than the server (section 8.6).

---

# 7. Persistent Garbage Collection

Objects are never deleted explicitly. An object lives for as long as it can be reached from the database's root through strong references, and is garbage when it cannot.

Finding garbage in a persistent database is hard for two reasons. Reference counting does not find cycles: two objects that refer to each other keep each other's counts above zero after everything else has let go of them. And tracing, which does find cycles, visits everything reachable, which for a database means reading all of it.

**Aquifer**

The collector exists as a prototype, Aquifer, and is described in its own documents:

- [The design](../aquifer/documents/persistent-garbage-collection.md)
- [The invariants](../aquifer/documents/invariants.md)
- [The original proposal](../aquifer/documents/original-proposal.md), which was the garbage-collection chapters of earlier versions of this paper

In brief:

- **A spanning tree certifies reachability.** Every reachable object has one tree parent, and a chain of tree parents to the root proves that it is reachable.
- **Mutations maintain it.** A transaction that changes references also updates the collector's metadata, in the same transaction. The collector never has to catch up with the application.
- **Cutting a tree edge makes a subtree unstable.** The objects under the cut are checked for another referrer that is still stable. Those that have one are reattached. Those that have none are reclaimed, cycles included.
- **Unstable objects are grouped into cohorts** whose fates depend on each other, and each cohort is decided on its own, so a busy part of the database cannot starve a quiet one.
- **Objects are grouped into regions**, and regions into meta-regions. They are branches of the spanning tree, kept balanced like a B-tree. A heavily shared object, such as a font that a million documents refer to, does not need a million reverse references: what refers into a region is recorded only as coarse flags. A whole region can be suspended, rescued, or reclaimed as one.
- **Work is done in bounded steps**, each one a transaction, and every invariant holds at every commit. A crash therefore needs no recovery beyond the store's own.
- **It is tested against a full trace.** A fuzzer runs random transactions and collector steps, and after each one an oracle checks every invariant against a complete trace of the database.

**What the layers above need from it**

- **Volatile roots.** An object held by a selection, by a `load`, or by a client's undo history must not be reclaimed, though nothing in the database may refer to it any longer (sections 3.7 and 8.11).
- **Weak references.** An index holds its members weakly, and its own removal code is called before a member is reclaimed (section 5.4).
- **The same write barrier for migrations.** A lazy migration changes references while an object is being loaded, and must go through the barrier like any other transaction (section 6).
- **A change set per transaction, and the commit that last changed each record.** Everything reactive is triggered from the first (section 3.6), and reconnecting clients are served from the second (section 8.14).
- **Regions, possibly, as a unit of other things**: of selection (section 3.5), and of distribution between servers (section 8.7).

---

# 8. Open Questions

What is decided is listed in section 1.3. This section holds what is open, and what is proposed but not yet settled; each heading says which.

## 8.1 Incremental selections

*Status: open.*

Can a selection be maintained with work proportional to the change, including removals through shared paths and cycles?

Is retracing one selection cheap enough in practice, or is the spanning-tree algorithm needed at this level as well?

Can the collector's regions serve as a coarse unit of selection?

## 8.2 The cost of live indexes

*Status: open, for measurement.*

Everything that is observed by a volatile observer is held in the server's memory. How many simultaneous selections and live queries does that allow?

The server keeps, per session, what each client holds, so that it can compute what to send. Meteor kept the same thing (its "mergebox", section 9.2), and the memory it took per client became one of its scaling limits. Selections are per session (section 4.4), so this cost is accepted. How many sessions one server can hold, for selections of realistic size, is a question for measurement.

How should dependency records be coarsened for objects that many keys read, and when?

At what size or rate of change does a live index stop being the right implementation of a query?

## 8.3 Reactive authorization

*Status: open.*

Can authorization be evaluated as part of running the selector, so that it is itself reactive and a change of permissions updates the selection like any other change?

It should follow from the design: `canRead` is called while the selector runs, what it reads is recorded with everything else the selector read, and a change to a group's membership then reruns the affected part of the selection. Whether it is that simple in practice is to be shown.

Could an application declare audiences, so that `canRead` answers with a role or a group rather than deciding per user? Selections for the same audience could then be shared safely, which per-user decisions do not allow (section 4.4).

## 8.4 Writes from clients

*Status: open.*

The base model is decided: a real-time stream in which the last write wins (section 3.9), and, per subscription, gated synchronization, in which a write succeeds only against what its writer saw (section 3.10).

What remains open is what applications will want on top of it, and whether some of it should be provided. Locks can be built from authorization (section 3.9), and a library of such patterns may be worth providing. Form state is covered by gated subscriptions with explicit sending (section 3.10). Whether a class should be able to require gated writes from every client, and how, is open. Concurrent splices of arrays are proposed to be anchored by identity and rebased on the client (section 3.9); that proposal needs a fuzz test against a model, as indexes do.

**Text**

Two users typing in the same paragraph, whose text is one string, overwrite each other under last-write-wins.

Fast synchronization helps less than one would hope. With a round trip of 100 milliseconds and someone typing ten characters a second, every keystroke overlaps the other user's. Each client keeps its own value while its writes are unconfirmed (section 3.9), and when both are confirmed, the one that arrived last replaces the whole paragraph, and the other user's characters are gone.

The options:

1. **A lock per paragraph** (section 3.9). The user who enters a paragraph first holds it, others see who is writing there, and edit other paragraphs meanwhile. Simple, built entirely from the base model, and acceptable when paragraphs are short and people mostly write in different places.
2. **Text as a sequence of splices.** The paragraph's text is changed by inserting and deleting at positions, not by replacing the string, and the server adjusts the positions of concurrent splices as it does for arrays. This is operational transformation. Google Docs works this way, on a central server that orders operations, the same arrangement as here. With one server deciding the order, it is much simpler than in the general peer-to-peer case.
3. **A CRDT for text**, such as Yjs or Automerge use. Each character has an identity of its own, so concurrent edits merge without a server. It works offline, and costs memory per character. With an authoritative server it is more than is needed.
4. **Smaller objects.** Text split into objects small enough, such as one per sentence, that collisions are rare. It reduces the problem without solving it.
5. **A list of words, built from identities** (section 3.9). Each word is an object that records the word it was inserted after; a removed word is flagged; the order is derived. Insertions at the start and the end of a paragraph, or anywhere else, never disturb each other, and only two users typing in the same word compete for its text. It needs nothing beyond the base model, and since users keep their distance (section 3.11), a word is a small enough unit.

A cursor is then just another object: a reference to a word and an offset within it. Unlike a position in a string, it stays where it was when others type elsewhere.

With presence (section 3.11), users see each other's cursors and seldom write in the same paragraph, so a paragraph as one string, last-write-wins, with an overwrite made visible rather than silent, may be enough for a first version, before even a lock.

Of the options above, the lock and the list of words are the natural start, because they need nothing new. The list of words is the one that lets people write in the same paragraph. Splices with transformed positions are needed only if text must stay one string. A CRDT is, in these terms, the list of words carried down to single characters.

## 8.5 Metadata

*Status: open.*

Which metadata fields should be standard, defined by Cascade or by the synchronization layer, and which should be left to applications?

Should property metadata be kept for every property of every object, or only for properties that someone has asked about?

## 8.6 Code versions

*Status: proposed.*

The architecture relies on running the same code on the server and on clients: the same classes, with the same authorization methods.

After a deploy, a client may still run the old code while the server runs the new. Its classes may not know fields that the server's objects now have, and its authorization methods may decide differently from the server's. Selectors are not a problem, since they run on the server only (section 3.4).

The persisted side is handled by versions: an index records the version of its class and is rebuilt when it changes (section 5.3), and objects are migrated lazily (section 6).

For clients, the proposed answer is not to support old code for long, but to make replacing it cheap:

- A client states its code version when it connects. The server can end the subscriptions of a client whose version is too old, and tell it to reload.
- Reloading must be fast, and must recover the client's state: its subscriptions, which are named selectors and starting objects, its writes not yet confirmed, and the client-local state that the application chooses to keep, such as the current view.

How much state can be recovered across a reload, and how quickly, determines how often a deploy can be made without users noticing.

## 8.7 Scaling beyond one server

*Status: later.*

The architecture has one authoritative server. It can be scaled up, and read load can be moved to shared publications (section 8.13), but at some point one server is not enough.

One direction is a hierarchy of servers. Each server is authoritative for, or replicates, a part of a larger object structure held by the server above it, and clients connect to the server that holds what they work with. Objects shared across servers cost more, and changes to them take longer to reach everyone, but the system can grow by adding servers.

The collector's regions (section 7) are a natural candidate for the parts that servers take responsibility for, and a region could move between servers as the clients using it move.

This resembles server meshing in large online games, where the world is divided between servers dynamically, and objects and players are handed over at the boundaries.

It is far beyond a first version. It is noted here because it shapes earlier decisions: identity must not encode which server an object lives on, and the protocol should allow a subscription to be served by a server other than the authoritative one.

## 8.8 Arrays, classless objects, and identities

*Status: decided.*

Small plain data is a frozen value, and takes the security of the object that holds it (section 2.5).

Arrays and synchronized objects without a class are protected by the client's subscription forest (sections 3.4 and 4.2): they are read only as parts of a selection, written under the `canWrite` of the selection's root, and referred to only from within the forest.

A client can name only objects in its forest. Identities are therefore ordinary ids, and need not be unguessable. An application that wants links that can be shared makes them through a session method, which returns the object and so gives the client a new root.

It costs nothing beyond what a selection already keeps: its root and its members.

What remains open is whether the root is too coarse in practice. A finer rule, in which a part is governed by the object that refers to it, is possible without tracing selectors, since the server can see which selected object holds the array. It is not needed for a first version.

## 8.9 Stale writes

*Status: proposed.*

Last-write-wins means last to arrive, not last to be made. A client that was offline for an hour, or on a slow connection, sends writes made against data that has since changed, and they override everything that happened meanwhile.

If every write carries the commit that the client had last seen, the server can tell when a write overrides a value that its writer had never seen. That is the same detection as for overwritten paragraphs (section 3.11). What to do then is policy: apply and mark it, as for text, or, for writes older than some limit, refuse them and let the client show what it had. A gated subscription (section 3.10) already refuses them, by comparing values rather than commits.

Offline work in general, with writes queued for longer than a reconnection, is not a goal of the first version. But the base commit costs little, and is worth sending from the start.

## 8.10 Atomicity of a client transaction

*Status: proposed.*

A client sends one transaction as one message (section 3.8). If one of its writes is refused, are the others applied?

Applying all or nothing is the expected meaning of a transaction, and it is what lets a client keep its invariants: a paragraph moved from one chapter to another is not left in both, or in neither. The proposal is all or nothing, with the refusal naming the write that failed.

## 8.11 Undo

*Status: open.*

Editors need undo. In a multi-user document, undo means undoing one's own changes, not the latest change, which may be someone else's.

A client can keep its own transactions, with the values they replaced, and undo by writing those values back, as a new write. Under last-write-wins that is mostly straightforward.

Two things are not. Undoing a removal brings an object back that may have been reclaimed meanwhile, unless a client's undo history keeps what it refers to alive, for example as volatile roots for as long as the session lasts. And undoing a change that someone else has changed since would override their change; the base commits of section 8.9 can detect it.

## 8.12 Limits and abuse

*Status: open.*

A client can subscribe to large selections, write at a high rate, or create many objects that are collected again. Per user limits are needed on subscription size, write rate, and the number of unconfirmed operations, and the server must be able to end a session that exceeds them.

## 8.13 Shared publications for large readerships

*Status: later.*

Selections are per session (section 4.4). That suits editors, and a moderate number of readers. It does not suit ten thousand people reading the same public page, each of whom would have a selection of their own.

An earlier version of this paper proposed shared, immutable snapshots for that case, and the idea stands, though nothing in the first versions depends on it.

It should be built from what is already here, rather than as a mechanism of its own: a publication is a selection of data that everyone may read, computed once, as the system rather than as a user, and published at a commit. Its subscribers all receive the same thing, so nothing is kept per session. A new version is published when the data has changed, no more often than a set interval, and a subscriber receives the difference from the version it has.

A reader who starts editing switches from the publication to a selection of their own.

The security condition is the one that sharing selections could not meet in general: a publication contains only objects that are readable by everyone, which is decided when it is defined, not per user.

## 8.14 Reconnecting, and applying a transaction once

*Status: decided; specified in the protocol.*

**Once only.** If a connection is lost after a client has sent a transaction and before the confirmation has arrived, the client cannot know whether the server applied it. Sending it again would apply it twice, which for an insertion into a list is a visible error. Each client transaction therefore carries an identity, and the server remembers, for a while, which it has applied, and answers a repeated one with the confirmation it gave the first time.

**What happened while the client was away.** A reconnecting client states the commit it last saw, its subscriptions, and what it holds. The server computes each selection anew and sends its complete membership, with the record of every member that the client does not hold, or that has changed since that commit. The client drops what is in no selection any longer.

There is one way to reconnect, used after a brief loss of the network and after a restart of the server alike. The server keeps nothing about a client between connections except the transactions it has applied.

Both are specified in [the protocol](documents/protocol.md), sections 10 and 11.

## 8.15 Erasing data

*Status: proposed.*

An object lives for as long as anything refers to it. A request to erase a person's data cannot be met by removing one reference, if other objects still refer to the same data.

The main method is overwriting: follow the shape of what is to be erased, with a selector, and delete every property of every object in it. The objects may live on for a while, where something still refers to them, but they are empty. A weak reference shows when they are gone (section 2.5).

Two notes on the consequences.

For the collector, emptying objects first is not cheaper than letting go of them. Each removed reference is work for the write barrier, while an intact structure that becomes unreachable can be reclaimed region by region. Erasing is done for the guarantee, not for speed, and where only the content is sensitive, the content fields can be deleted and the references left for the collector.

Overwriting erases the data from the database as applications see it. The bytes may remain in the store's file until its pages are reused, and they remain in backups. How far erasure must go is a question for the operator, and for the store.

## 8.16 Errors in application code on the server

*Status: open.*

An authorization method that throws refuses the write. That much is clear.

A key computation that throws, for one member of an index, must not stop the index, and must not leave the member filed under a key that is no longer true. The member needs somewhere to go: a list of members whose keys could not be computed, kept by the index and visible to the operator.

A session method that throws writes nothing, and its error is returned to the caller, without details that the client should not see.

## 8.17 Files and binary data

*Status: open.*

A document with images needs somewhere to keep them.

Small binary data is a value: a `Uint8Array`, or a base64 string, in a field (section 2.5). That is enough for an icon. It is wrong for megabytes: the data is in the record, in the server's memory, and in the memory of every client that holds the object, and it travels through the stream of writes.

For larger data, the proposal is a blob: an immutable persistent object whose content is not delivered with a selection. A client that holds it has its identity, its type and its size, and fetches the content when it needs it, over HTTP, authorized by its session. Uploading is the reverse. Since a blob is an object, it is referred to, selected, protected, and reclaimed like any other; since it never changes, it can be cached without limit.

Where the content is stored, in the object store or in files beside it, is an implementation matter.

## 8.18 Large selections

*Status: later.*

A client receives a whole selection before it uses any of it (section 3.4). For a document of tens of thousands of paragraphs that is slow.

The model already has the means to avoid it: a selector that selects the outline, and further selectors for the parts, subscribed to as they are shown. What is missing is support for doing it smoothly: delivering a selection in order of priority, and letting code run on the part that has arrived, with the rest shown as loading through metadata (section 2.4).

---

# 9. Related Research

## 9.1 Earlier attempts

This architecture has been attempted before, by the same author, in liquid and its demo, and in eternity, the database that followed:

- https://github.com/erobwen/liquid
- https://github.com/erobwen/liquid-demo

Liquid synchronized an object graph between a server and its clients, with subscriptions keyed by selectors, reactive object-level security (`noAccess`, `readOnly`, `readAndWrite`), and placeholder objects standing in for objects whose data had not yet arrived. Changes made on a client were grouped into a pulse and sent to the server as a list of events.

Its earliest form relied on Node Fibers to load data in the middle of a property getter (section 3.7).

Several of the ideas in this paper come from there: selectors, stubs (liquid's placeholders), and the grouping of client changes per transaction.

**Sessions and calls on the server**

Liquid had three objects per client: a session per sign-in, holding the user; a page per browser tab, holding the connection and the server's selection; and a page service per page, which was the only one the client could write. The client subscribed by adding to a list in the page service, and the page selected itself, its session, its user, and its subscriptions, so that the client held all of it as ordinary synchronized objects. Fountain keeps the split between session and connection, and the visibility (section 4.1).

Any shared object could be called on the server, with `object.callOnServer("methodName", ...args)`. Methods meant for it were named with the suffix `OnServer` by convention, and each object guarded them with `allowCallOnServer(user)`, false by default. The server ran the method with every object unlocked. In the words of the code: "Call on server grants admin rights inside the call, so it should be guarded well." That is the session gateway of section 4.5. Calls returned nothing, and their effects reached the client through synchronization. The password was kept in a separate object that no client could access.

**Other notes from the repositories**

- Liquid's to-do list proposed organizing servers in cluster trees, in which clients talk to the leaves and the tree acts as a multi-level cache (section 8.7).
- Eternity, the database that followed liquid, noted that storing observers persistently would require Causality to use methods rather than functions, the conclusion that persistent repeaters reach (section 5.3).
- Eternity made incoming references part of the model. That has been dropped (section 2.2).
- Eternity also noted that indexes cannot hold weak references, because removal requires rebalancing (section 5.4).

https://github.com/erobwen/eternity

## 9.2 Other work

The garbage collector's relatives are listed in Aquifer's documents (section 7).

The synchronization and indexing parts have close relatives.

**Incremental view maintenance: differential dataflow, DBSP, Materialize**

A selection, an index over it, and a query over the index form a chain of derived collections, each updated from the changes of the one before. This is the subject of incremental view maintenance.

**Convex**

Queries are JavaScript functions executed by the database. Their read sets are recorded, and a query is run again and its subscribers updated when a write intersects what it read.

**ElectricSQL shapes, and similar partial replication**

A shape defines the subset of a database that is synchronized to a client. It plays the role of a data selector, over tables rather than an object graph.

**Meteor**

The closest precedent for the whole idea: the same JavaScript on server and client, publications that define what a client holds, a client-side copy of the data (Minimongo), and writes applied on the client at once.

Two of its scaling problems are worth learning from. Its first way of keeping queries live tailed the database's log and checked every write against every live query; this design instead looks up the observers of each written object (section 3.6). And it kept, per client, a copy of what that client held, the "mergebox", whose memory became a limit (section 8.2).

**RethinkDB changefeeds, Firestore listeners**

Other systems in which the result of a query is kept up to date on the client.

**Database triggers and materialized views**

The conventional counterpart of persistent repeaters. A trigger is awakened by a change, but it is imperative and does not record what it reads; a materialized view is derived, but is usually refreshed as a whole.

---

# 10. Proposed Development Roadmap

## Done: storage and garbage collection

Aquifer: the object store, the spanning-tree collector with regions and cohorts, and a visualizer (aquifer.visualizer) that shows the collector step by step. It is a prototype, with its own backlog.

## Before each phase: a specification with invariants

Aquifer was built from a design document and a list of invariants, each stating who maintains it and how it is verified, with an oracle that a fuzzer runs after every step. Fountain is built the same way, one layer at a time: the specification of a layer is written just before the layer is, in enough detail to test against.

The first to be specified is the data model: exactly which values a field can hold, how each is stored and sent, how an object is made again from its stored fields, and how weak references behave (section 2.5). The protocol's messages are made of these values.

The second is the protocol between the client store and the server store: the messages, their order, and reconnection (section 8.14). Everything else depends on it, and it can be tested by a simulator with several clients and random interleaving of messages. Among its invariants:

- **Convergence.** When no messages are in flight, every client's copy of an object equals the server's.
- **Closure.** A client holds exactly the union of its selections, and every reference that leaves them is a stub.
- **Security.** A client never receives a field of an object that its user may not read.
- **Atomicity.** A client's transaction is applied completely or not at all.
- **Counts.** An object's subscription count on a client equals the number of that client's subscriptions that contain it.

Indexes, publications and distribution are not specified in detail until what they stand on exists.

## Throughout: a visualizer

Aquifer's visualizer proved its worth while the collector was built. Fountain should have one from the start, and grow it with each step:

- Browse the database: follow references, see an object's fields, its metadata, its incoming references, and its region.
- Manipulate objects directly: edit a field, create an object, cut a reference, and watch what follows.
- See the reactive structure: which selections and queries hold an object, which persistent repeaters depend on it, and what a commit triggered.
- See the connected clients: what each one holds, and the stream of writes and changes between them and the server.

It is a debugging tool, a teaching tool, and an administration tool. Since it is itself a client, it is also the first real test of the protocol.

## Phase 1: Persistent reactive object model

Implement Wellspring, on Aquifer, and then Fountain's first parts on Wellspring: stable object identity, persistence, transactions, reactive objects, and WebSocket synchronization.

Establish the user model, security, and subscriptions. Security is not added later: the user model is the base of every authorization decision, and the protocol, selections and stores are all shaped by it.

In order:

1. In Cascade: `meta()`, `untrackedMeta()` and `innerMeta()` (section 2.4), and `onTransactionEnd` (section 3.8). Done.
2. Aquifer's interface upward: volatile roots, a change set and commit number per transaction, reclaim notifications inside the transaction, and the commit that last changed each record (section 2.6).
3. Wellspring, following [its own roadmap](../wellspring/documents/design.md): persistent objects as observables, one instance per identity, classes registered by name, the data model's encoding, `load` with hold counts, unloading, and a store that turns each transaction into one Aquifer transaction. Usable and tested on its own, without clients.
4. The user model, from the start: `User`, the super user, sessions whose class the application extends, remote methods on the session (beginning with signing in and creating users), passwords, and verification of external access tokens. `canRead` and `canWrite` are evaluated from the first write, with the subscription forest protecting arrays and classless objects (sections 3.4, 4.1 and 4.2).
5. Observation: recording what a computation reads, and matching it against commit change sets (section 3.6).
6. Selections per session, with subscription counts: named selectors, first by rerunning the whole selector, then incrementally, tested against the first (sections 3.4, 3.5 and 3.7). Selections pass only through objects the user may read.
7. The protocol and `subscribe`: authenticated connections, subscribing to a selection, receiving it, receiving changes, reconnecting. Read-only clients first.
8. Client stores: the stream of writes from clients, last write wins, each carrying its base commit, all or nothing per transaction, with temporary ids for new objects and save states in metadata (sections 3.8, 3.9, 8.9 and 8.10).
9. Presence objects (section 3.11).
10. Code versions: clients state their version, old clients are told to reload, and a reload recovers subscriptions and unconfirmed writes (section 8.6).

## Phase 2: Live indexes and queries

Implement persistent repeaters, a B-tree of persistent objects maintained by its own code, and key repeaters that read only their member (sections 5.2 to 5.4).

Deliver live queries as ordered selections (section 5.5).

Then add keys that read other objects, with stored dependency records, background work, and tracked staleness.

Test every index against one rebuilt from nothing.

## Later

- Shared publications for large readerships (section 8.13).
- Scaling beyond one server (section 8.7).

---

# 11. Conclusion

The proposed system combines a persistent JavaScript object model with reactive synchronization, object-level authorization, application-defined indexes, lazy schema evolution, and incremental garbage collection.

The architectural goal is to make persistent distributed data behave naturally within a reactive JavaScript programming environment, so that a distributed, real-time, multi-user application is about as easy to build as a local one.

Synchronization is defined by data selectors, which draw the boundary of what a client holds, and indexes are kept live by persistent repeaters, pure computations that are triggered through stored keys and dependency records rather than through observers in memory. Writes are one real-time stream in which the last write wins, and anything stricter is built by applications on top of it. Selections, indexes, and queries form one chain of incrementally maintained collections.

Users and sessions are part of the system from the start. Authorization is written as methods of the application's classes and runs the same on both sides, and the session object is the one place through which a client asks the server to do something on its behalf.

Garbage collection, which was the hardest part of the original proposal, exists as a prototype. What remains is the layer above it.

The data model and the protocol are specified, with invariants that tests and a simulator can check. The next step is the smallest implementation that can be tested against them: the data model's code first, then Wellspring's objects over Aquifer's records, then the protocol with plain fields only.

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

The database should not require every index to be implemented as a special database-engine feature.

Instead, indexes can be ordinary persistent JavaScript data structures.

Examples include:

- B-trees.
- Quadtrees.
- Search trees.
- Lookup tables.
- Application-specific navigation structures.

An index can maintain references to ordinary persistent objects.

Reactive computations may help detect changes requiring index updates.

However, required index maintenance must participate in the database's consistency model.

An index that is expected to be complete and authoritative cannot simply update whenever a background reactive scheduler happens to execute.

The architecture should distinguish:

1. Synchronously maintained transactional indexes.
2. Eventually consistent derived indexes.
3. Lazy indexes whose coverage is explicitly tracked.

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

---

# 18. Related Research

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

---

# 19. Proposed Development Roadmap

## Phase 1: Persistent reactive object model

Implement stable object identity, persistence, transactions, reactive proxies, and WebSocket synchronization.

Establish the basic security and subscription model.

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

The garbage-collection proposal begins with a relatively simple principle: maintain a spanning tree that certifies reachability, together with complete incoming-reference information that allows detached objects to reconnect without a global trace.

The principal scalability challenge is that complete reverse-reference metadata can become expensive, while incomplete metadata can require costly global searches.

The proposed hierarchical extension addresses this by automatically partitioning the object graph into recursive regions.

Within each region, incoming references can be tracked precisely. Across region boundaries, the database maintains conservative abstractions describing where references may exist and, potentially, which boundary objects can reach one another.

This allows reachability searches to be restricted to relevant parts of the database, supports independent collection of relatively quiet regions, and creates opportunities to reclaim entire unreachable regions.

The resulting architecture can be understood as a hierarchy of incremental reachability computations operating over a persistent object graph.

The most important unresolved challenge is maintaining compact, correct, incrementally updated boundary summaries under arbitrary graph mutations.

If that challenge can be addressed efficiently, hierarchical reachability may provide a common foundation not only for persistent garbage collection, but also for indexing, caching, distributed placement, and reactive data synchronization.

The proposal remains a research design rather than a proven algorithm. Its next step should be a precise state-machine specification, followed by a small implementation and adversarial tests of reachability correctness under continuous mutation.
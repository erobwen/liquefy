# Persistent Garbage Collection with Regions
## A concrete design for the object store under the reactive object database

**Status:** Design proposal, intended to be prototyped  
**Date:** November 2026  
**Builds on:** `whitepaper.md`, sections 8–15. Related work is listed in §17.

---

# 1. Scope

This document covers only the storage and garbage-collection core of the database:

- How persistent JavaScript objects and the references between them are stored on top of an ordinary key/value store.
- How the spanning-tree collector from the whitepaper (§9) is extended with **regions**, so that it scales to highly shared objects and large subtrees.
- What abstract information is kept per region.
- How regions are formed.
- What the collector's main loop looks like once regions exist.

Reactivity, security, snapshots and synchronization are out of scope here. They sit on top of this layer.

---

# 2. Design goal and why it rules out tracing

## 2.1 The setting

The database may hold **huge structures on disk**. Main memory holds only a small cache of the objects currently in use. Under those conditions, a garbage collector that traverses the live data is expensive in two ways:

- It costs I/O over the whole database.
- It pushes the application's working set out of the cache.

It pays both costs on every cycle, however little has changed.

## 2.2 The goal

> **GC I/O is proportional to what changed, never to how big the database is.**

Mutations and garbage collection alike only follow the changes. A database that is not being modified costs nothing to keep collected.

The goal is *not* constant worst-case time per mutation. Sotoudeh (OOPSLA 2025) shows that every collector of this general kind has some program that forces either a long pause or an unnecessary refusal to allocate. The proof works by reducing GC to dynamic graph reachability. Adversarial workloads therefore exist for this design too. What this design aims for is:

- **bounded work per collector step**, so pauses stay short;
- **total work that tracks the size of the changes** on realistic workloads;
- **garbage that may sit around for a while** under adversarial patterns.

## 2.3 Why not the conventional alternatives

**Incremental tracing** (Dijkstra, Baker, Yuasa's snapshot-at-the-beginning) can be interleaved with the application. It needs:

- an O(1) write barrier,
- one mark or epoch value per object,
- no back-references.

But every cycle reads the entire live database. In the setting of §2.1 that is the cost we want to avoid.

**Partitioned tracing** with lists of references between partitions was the dominant design in 1990s object databases:

- Yong/Naughton/Yu 1994, Cook/Wolf/Zorn 1994, and Amsaleg/Franklin/Gruber 1995.
- Maheshwari & Liskov's Thor (SIGMOD 1997), the closest relative of the regions here.

It avoids most global work. However, garbage cycles that span partitions still require a global marking pass, which Thor piggybacks on the partition traces.

**Generational collection** relies on most objects dying young. Persistent data has already survived by definition. The one part that does transfer is the nursery idea: objects created in a transaction and never attached are never written (§9.1).

**Closest relative:** Arborescent GC (ISMM 2025) maintains a spanning forest using dynamic single-source reachability algorithms and reclaims cycles immediately. It targets an in-memory heap. This design applies the same idea to a persistent store, with regions as the unit of I/O.

## 2.4 Consequences for the design

1. **GC steps touch metadata, not objects.** Marking, checking, suspending, resuming and reclaiming read and write only the compact keys `g/`, `t/`, `T/`, `y/`, `e/`, `r/`, `c/` and `d/`. There are two exceptions:
   - *expanding* from a single rescued object reads its record (`o/`) to find its outgoing references;
   - reclamation deletes records.

   Region-level expansion and reclamation use `y/R/` ranges instead of reading records.
2. **The region is the unit of GC I/O.** Proving a huge structure dead costs roughly O(clusters along its boundary) in the region hierarchy, and deleting its storage costs O(regions). Neither is O(objects). This, more than the shared-font problem, is why regions exist.
3. **No GC state in memory that grows with the database.** Worklists, cohorts, deferred cuts and region counters live in the store. The memory cache only holds what the current step touches.
4. **Avoid needless marking of structures that are still reachable.** Cuts are deferred so that a cut followed by a relink can be cancelled (§9.3). During marking, each node first looks for a replacement parent before descending (§10.2).
5. **The back-reference index is a database feature, not only GC overhead.** A reactive, collaborative object database needs "who references this?" for several things:
   - "where used" features,
   - checking that deletes leave no dangling references,
   - invalidating permissions and subscriptions,
   - undo.

   One extra small key per edge write is cheap compared with even an occasional traversal of a database much larger than memory.
6. **No full trace in production.** A full trace from ROOT is the test oracle (§16). At most it may run as a rare, region-by-region background check that catches leaks caused by bugs.

---

# 3. The proposal in brief

1. **Storage substrate:** an *ordered*, transactional key/value store, such as LMDB (`lmdb` on npm) or SQLite. Each object is one record. Every reference edge is one key. All collector metadata is stored in the same store and updated in the same transaction as the data.

2. **Regions are branches of the spanning tree, kept balanced like a B-tree.**
   - A new object goes into its tree parent's region.
   - A region that grows past about 100 objects is split in two at its centroid, so each part is a branch of between ⅓ and ⅔ of the original.
   - Small regions merge.
   - When data is moved, the moved branch is re-homed.
   - Regions are grouped bottom-up into **meta-regions** by the same rules, recursively.

3. **Edges are keyed by source only, and the reverse direction is abstract.**
   - A region's edges, local and outgoing, are read through one function, `edgesOfRegion(R)`. It either reads the members' object records, or a range of an optional index `y/<region(a)>/<a>/<b>` (§5.5).
   - There is no per-edge reverse index, not even inside a region. Local incoming references are computed in memory from that range read.
   - The target side keeps only conservative **entry flags**: *"region or meta-region C may reference into me."* When a region has too many flags, they are coarsened to meta-region level.
   - Moving a target object never rewrites any key that points at it.

4. **The spanning tree certifies reachability; regions only make it cheaper.** There are no entry-to-exit reachability summaries (whitepaper §12.6). Region-level reasoning is used only where a whole region shares one state: an entire region becomes unstable at once (*suspension*), comes back at once (*resume*), or is deleted at once.

5. **Unstable objects are grouped into cohorts.** A cohort is the set of objects detached by one or more cuts whose fates depend on each other. Each cohort runs the original four-step ladder independently: expand, mark, reconnect, reclaim. A busy part of the database therefore cannot starve a quiet one. Deleting a cohort needs no global proof.

6. **The main loop is the same if/else ladder as before.** The work items it processes are now either objects or regions.

7. **Avoiding needless marking.** Before anything becomes unstable, a removed tree edge first tries a *quick swap* to another verified-stable referrer. If that fails, the cut is *deferred* for a while so that a relink can cancel it. During marking, each node looks for a replacement parent before descending.

---

# 4. Storage substrate

## 4.1 Requirements on the underlying store

| Requirement | Why |
|---|---|
| Ordered keys with prefix/range scans | "All edges from region A", "all members of region R" |
| Atomic multi-key transactions | The write barrier updates data and GC metadata together |
| Synchronous or cheap reads | The write barrier runs inside the commit; async round-trips per edge would hurt |
| Range delete (nice to have) | Whole-region reclamation |

**LMDB** (Node, `lmdb` package) fits well: it is ordered, transactional, and has synchronous reads and `getRange`. **SQLite** (`better-sqlite3`) is an equally good choice. The prototype should start with an in-memory sorted map behind the same interface.

## 4.2 Key layout

| Key | Value | Meaning |
|---|---|---|
| `o/<obj>` | `{type, version, fields}` | The object record: application data only |
| `g/<obj>` | `{region, treeParent, cohort, shared}` | The object's GC metadata. It is kept apart from the data so that GC steps never read object bodies (§2.4). `shared` is a sticky bit meaning "has had more than one referrer" (§9.1). |
| `r/<region>` | region record (§6.10) | Region and meta-region bookkeeping, at every level |
| `m/<region>/<member>` | — | Membership: objects in a region, or regions in a meta-region |
| `y/<srcR>/<src>/<tgt>` | count | Reference edges, keyed by source only. The count covers several fields of `src` that point at `tgt`. This is an optional index of the references in the object records (§5.5). |
| `E/<srcM>/<tgtC>` | — | Mirror of each entry flag whose source is a *meta-region*, so that splitting that meta-region can find the flags naming it (§6.6) |
| `e/<tgtC>/<srcC>` | `{refining}` | **Entry flag:** "something in srcC *may* reference into tgtC". Conservative, and kept at every level of the target (§6.6). |
| `t/<parent>/<child>` | — | Spanning-tree child edges |
| `T/<parentR>/<childR>` | count | Tree edges between regions, at every level |
| `c/<cohort>` | cohort record and worklists | Collector state |
| `d/<deadline>/<obj>` | — | Deferred cuts, ordered by deadline (§9.3) |

Useful queries are then single range scans:

- All edges whose source is in R, local and outgoing: prefix `y/R/`. One range read of a few KB gives the region's whole local graph, and its reverse view is computed in memory.
- Outgoing edges of object `a`: prefix `y/region(a)/a/`
- Which regions or meta-regions may reference into R: prefix `e/R/`
- Tree children of `p`: prefix `t/p/`

"Who references `b`?" is answered by reading `y/region(b)/` for local referrers, plus `y/` of every source named by a flag in `e/region(b)/`, and filtering for `b` (§5).

## 4.3 Reference counts per object pair

An edge key carries a count of how many fields of `src` point at `tgt`. A tree edge is a relationship between two *objects*, not a specific field. It is cut only when the count drops to zero. Re-assigning the same reference to a different field is therefore free.

## 4.4 Weak references

Not every reference should keep its target alive. Indexes, caches, "recently used" lists, activity logs and backlink tables reference objects that are owned elsewhere. If those references were strong:

- the object could never be collected until every index entry had been removed, and
- the entry flags of every indexed region would name the index. A **hub** source like a full-text index references so many regions that its flags on any target get coarsened, and a check of a dying target would then scan the whole index (§5.3).

So the object model distinguishes **weak references**. A weak reference:

- is stored in the object record like any other field, and is included in `y/` with a `weak` marker, or kept out of `y/` entirely;
- is ignored by the collector: it creates no entry flag, never rescues, never counts as a referrer in a check, and is never a tree edge;
- may dangle after its target is reclaimed. Resolving a dangling weak reference yields `null`, and the holder is expected to drop or repair the entry. Reclamation writes no tombstone; an id that does not resolve is simply gone.

Indexes maintained as ordinary persistent structures (whitepaper §6) should hold their entries weakly and tolerate dangling entries, which is how database indexes behave anyway. Whether a field is weak is declared by the application class.

---

# 5. Abstract incoming references: why the shared-font problem disappears

The whitepaper's scalability concern (§11) is a single object, the default font, with a million incoming references.

## 5.1 What is stored, and what is not

- **Edges are stored once, on the source side**, as `y/<srcRegion>/<src>/<tgt>`. A million documents referencing the font produce a million keys spread over the documents' own regions. No record grows with the font's popularity.
- **No reverse reference is stored per edge.** The font's side has only **entry flags**: `e/F/X` means "something in X may reference into region F", where X is a region or a meta-region.
- **Flags are coarsened.** When F has more than `K` flags (for example 32), flags from regions in the same meta-region are replaced by a single flag naming that meta-region (§6.6). The number of flags per region is therefore bounded, independently of popularity.

Take a font collection `fontCollection` with the children `fontA` and `fontB`, all in region F. It is referenced from 10,000 document regions. F then carries a few flags such as "meta-region M7 may reference into me". Nothing on the target side says *which* object in F is referenced, or how often.

## 5.2 What it costs

- **Adding a reference** writes one `y/` key, and makes sure a covering flag exists on the target's region at each level (§9.1). Usually it already exists, so that is a point lookup. A new flag is written only the first time some region references into F.
- **Removing a reference** deletes or decrements one `y/` key. Flags are not touched. A flag that has become stale is cleaned up the next time a check scans that source and finds nothing (§6.6).
- **Moving a target object** rewrites no edge key at all, because no key mentions the target's region. When `fontA` moves, its region's flags are copied to the region it moves into. That is conservative, and costs at most `K` per level.
- **Finding the referrers of `fontA`** requires a scan. Read `y/F/` for local referrers. For each flag, read the `y/` range of the flagged region, or of each region in a flagged meta-region, and filter for `fontA`. This only happens when `fontA` has become **unstable**, and a rescue needs only *one* stable referrer, so the scan stops early. A full scan of every flagged source happens only when proving that something is really garbage.

## 5.3 The trade-off

Compared with a complete per-edge reverse index, this design:

- **makes mutations and moves cheaper:** one key per edge, no hot counters, and no incoming keys to rewrite when objects move;
- **makes checks more expensive:** a check reads whole source ranges instead of looking up an object's referrers directly.

Mutations happen all the time. Checks only happen for objects that have actually become unstable. The design goal is that GC follows the changes (§2.2), so this is the right side to pay on.

**The hazard.** The cost of a check is the total size of the flagged sources. A source whose references fan out across the whole database, such as a full-text index, makes the flags on every target it references coarse, and a check of any such target that becomes unstable scans the whole hub. Hubs of that kind must reference their targets **weakly** (§4.4). With that rule, the sources flagged on an ordinary region are the few regions that genuinely own or link to it, and a check reads a handful of regions.

## 5.4 No local reverse index either

Inside a region, every edge is part of the same range read `y/R/`, which is a few KB. The region's local reverse references can be built in memory from that read when needed: for checks, quick swap, replacement parents and split computations. A stored local reverse index would save only a constant factor, and would cost an extra key on every edge write. So it is dropped.

There is one caveat: **an object with a huge out-degree**, such as a 10,000-element array, makes its region's edge range large no matter how few objects the region has. For that reason:

- Region size is measured in **objects plus edges** (§6.4).
- Large collections should be stored **in chunks**, as a tree of chunk objects. A database wants that anyway, for loading and for diffing.

## 5.5 `edgesOfRegion(R)`: the edge index is optional

Everything the collector needs from the edges goes through one function:

```js
edgesOfRegion(R)   // → all (src, tgt, count) with src in level-0 region R
```

It is used for checks, expansion of resumed regions, quick swap, replacement parents, split computations and coverage maintenance. There are two implementations, and the collector logic is the same for both:

| | A: edges read from the object records | B: the `y/` index |
|---|---|---|
| How R is read | read `m/R/`, then each member's `o/` record, and extract its references | one range read of `y/R/` |
| What is read | full object bodies, including text and properties; point reads | only small reference keys; one contiguous range |
| Extra writes per mutation | none | one `y/` key per changed reference |
| Rewritten when objects move between level-0 regions | nothing beyond `g/` and `m/` | the moved objects' outgoing `y/` keys |
| Rewritten by meta-level restructuring | nothing | nothing (`y/` names only level-0 regions) |

`y/` is a **secondary index of the references, clustered by region**. Whether it pays off depends on how large object records are compared with their reference lists. For text-heavy documents it very likely does, because without it checks would read all the text.

**Plan:** the prototype starts with **A**, which is the simplest and has no index to keep consistent. **B** is added as an optimization and measured against A (§16.3). In the rest of this document, "read `y/R/`" means "call `edgesOfRegion(R)`".

---

# 6. Regions

## 6.1 What a region is

A region is a storage and bookkeeping unit of objects that form one **branch** of the spanning tree. Its **weight** is its number of objects plus its number of outgoing edge keys (§5.4). The weight is kept between `CAP/4` and `CAP`; start with about 100 objects' worth. Every object belongs to exactly one region.

Objects **can move** between regions. This happens when regions split, merge or re-home. Object ids never change, because the region is stored in the object's GC metadata (`g/`), not in its id.

Regions are grouped bottom-up into **meta-regions**, recursively (§6.9). Every level uses the same rules, so this section describes level 0, where regions contain objects, and §6.9 lifts it to higher levels.

## 6.2 Anchors and parent region

An **anchor** of region R is a member whose tree parent is outside R.

`R.parentRegion` is the region that contains the anchors' tree parents. The regions and their parentRegion links form the **contracted tree**: the spanning tree with each region collapsed into a single node.

## 6.3 Placement

An object is placed when it **first gets a tree parent**, at commit, through the write barrier or through expansion. New objects that are not attached by commit time are never persisted (§9.1).

The rule is simply: **a new object goes into its tree parent's region.** Regions are allowed to overflow. A region over `CAP` gets a split scheduled.

## 6.4 Splitting: a region becomes two branches

Splitting a region at a fixed depth would separate nodes that belong together. Instead, an overflowing region is split into two parts of comparable size, each of which is a branch.

Sizes below are weights (§6.1).

```text
split(R):                                   // one collector step, its own transaction
    compute internal subtree weights in R   // one pass over m/R/, y/R/ and the t/ keys of R's members
    v = a virtual root above R's anchors
    c = v
    while some child of c has subtree size > |R|/2:
        c = that child                      // c is the centroid: every child subtree ≤ |R|/2
    if some child subtree of c has size ≥ |R|/3:
        M = that subtree
    else:
        M = child subtrees of c, added one by one until |M| ≥ |R|/3   // then |M| < 2|R|/3
    move M into a new region R′
```

The result is a guaranteed balance: both parts end up between `|R|/3` and `2|R|/3`.

- **Usual case:** the centroid c is a real member. R′ then consists of whole child subtrees of c, and its anchors all hang from c. So `R′.parentRegion = R`, and both R and R′ remain intact.
- **Centroid is the virtual root:** R had several anchors and none of them dominates, as with a long list whose items hang from an object in another region. R′ then takes a group of R's anchors, becomes a sibling of R, and `R′.parentRegion = R.parentRegion`.

**What a move rewrites.** For the moved set M:

| Keys | Why |
|---|---|
| `g/` region field and `m/` membership keys of M | Membership changed |
| `y/` keys of edges going *out of* M | Key contains the source region |
| Edges *into* M | **Nothing.** No key mentions the target's region. |
| `e/` flags on R′ | R′ copies R's flags, which is conservative (§6.6). Edges that become cross-region through the split get new flags: M → R, R → M, and M's outgoing edges, all known from the `y/R/` read. |
| `T/` counts | Tree edges between R and R′, and from both to child regions |
| `parentRegion` of child regions anchored in M | Their anchors' parents moved |

That is O(|M| + out-degree of M + flags of R). No incoming edge is ever rewritten, so a popular object costs no more to move than any other.

**Amortized cost.** After a split, both parts weigh at most `2·CAP/3`, so at least `CAP/3` more weight must be added before either one splits again. As in a B-tree, the cost per inserted object or edge is constant on average.

A single object whose own weight exceeds `CAP` cannot be split. That is the case for chunking large collections (§5.4).

## 6.5 Merging

When deletions shrink a region R below `CAP/4`, a merge is scheduled:

- If `R.parentRegion` has room (combined size ≤ `2·CAP/3`), R's members move into it.
- Otherwise, if a sibling region with the same parentRegion has room, R merges with it. Their anchors all hang from the same parent region, so the result is still intact.
- Otherwise R is left as it is.

The gap between the split threshold (`CAP`), the merge threshold (`CAP/4`) and the target size after a merge (`2·CAP/3`) keeps a region from splitting and merging back and forth.

## 6.6 Entry flags: coverage, coarsening and clean-up

Entry flags are the only incoming-reference information. They are kept at **every level of the target**: on the target's region, on its meta-region, and so on. That is what lets region checks at any level find their entry sources (§10.2).

**Coverage invariant.** Take an edge `a → b` and a level k where a's and b's level-k clusters differ; call b's cluster `B_k` and a's cluster `A_k`. Then `B_k` has a flag naming `A_k` or one of `A_k`'s containers. A flag may be stale, but a real edge is never uncovered. Safety rests entirely on this invariant (§11).

**Adding an edge** `a → b`: for each level where the clusters differ, look for a covering flag, either `e/B_k/A_k` or `e/B_k/<container of A_k>` and so on up. If there is none, write `e/B_k/A_k`. The container chain is short and mostly cached, so this is O(levels) point lookups, and usually no write.

**Removing an edge:** nothing. Flags are never removed eagerly.

**Coarsening.** When a cluster has more than `K` flags, a structure task replaces the flags whose sources share a meta-region with a single flag naming that meta-region. The number of flags per cluster therefore stays at about `K`, however popular its objects are. Coarse flags cost precision: a check has to scan the whole flagged meta-region instead of one region.

**Clean-up is lazy.** When a check scans source C completely for edges into T and finds none, it deletes `e/T/C`. A flag whose source cluster no longer exists is deleted when it is encountered. Reclaiming a region therefore leaves stale flags elsewhere, and does no target-side work.

**Refining a coarse flag.** Scanning a big meta-region C takes several collector steps. During that time, an edge could be added from an already-scanned part of C into T. The barrier would see the coarse flag, consider the edge covered, and write nothing, and then the scan would delete the coarse flag. To prevent this:

- The scan sets `refining: true` on the flag and writes fine-grained flags for the members of C where it finds edges.
- While a flag is refining, the barrier also writes the fine-grained flag for any edge it covers.
- At the end of the scan, the coarse flag is deleted.

Single-region scans run in one transaction and need no such state.

**Moves keep coverage:**

| Move | What restores coverage |
|---|---|
| Objects move from region R to R′ (split, merge, re-home) | Copy R's flags to R′. Add flags for edges that the move turned cross-region; these are known from the `y/R/` read. Re-check coverage of the moved objects' outgoing edges, which is O(out-degree × levels) lookups. |
| Meta-region M splits into M and M′ (members move from M to M′) | **Source side:** for every mirror key `E/M/T`, add the flag `e/T/M′` and the mirror `E/M′/T`. Edges from M′'s members that were covered by "M may reference T" are now covered by "M′ may reference T". **Target side:** M′ copies M's own incoming flags, about `K` of them. **Nothing below M is read.** |
| Meta-region re-home or merge | Same rule: the receiving cluster takes copies of the flags that name the cluster its members left, found through `E/`, and the union of the incoming flags. |
| Merge | Union of the flags |

At level 0 the cost is bounded by one region's edges plus about `K` flags. At level k ≥ 1, it is O(fan-out + flags naming M + K). It never depends on how much data lies inside M (§6.9).

**Why copy and not re-check.** An earlier version re-checked the coverage of every outgoing edge of every region that changed meta-region. A split at level k moves about 50 level-(k−1) clusters, which can hold a large share of the database, so that re-check would read all of their regions. This does not average out over many insertions the way it does in a B-tree. Clusters fill between a quarter and full, so a level-k split can cost up to about 4^k times more than the insertions that paid for it. Copying flags is conservative: some copies are stale, and lazy clean-up removes them. But its cost is independent of the data below.

**Mirror keys stay few.** `E/` keys exist only for flags whose source is a meta-region. Those are created only by coarsening. The flags naming a level-0 region need no mirror, because a level-0 split already reads the region's edges.

**Lazier alternative, not chosen.** Instead of copying, a flag naming M could cover "M and everything split off from M since", kept as a list on M, and checks would scan the whole family. Splits would then cost nothing for flags, but scans grow wider and the lists need their own clean-up. Copying is simpler to reason about.

**The `shared` bit.** Pinning is gone. What remains is a sticky bit in `g/` meaning "has had more than one referrer", set by the barrier (§9.1). It is the filter for the replacement-parent search (§10.2).

## 6.7 Re-homing: keeping regions branches when data moves

Quick swap, a cancelled deferral, a rescue or a replacement parent can each give an object `o` in region R a new tree parent in a region S. If S is neither R itself nor, for an anchor, `R.parentRegion`, then R is no longer one clean branch. A **re-home** step is scheduled:

- **`o` is the sole anchor of R:** R's whole content hangs below `o`. Set `R.parentRegion = S`. This is a re-link at the region level, costing O(1) plus `T/` count updates.
- **Otherwise:** move `o`'s internal subtree out of R:
  - into S, if it fits;
  - else into a new region whose sole anchor is `o` and whose parent region is S.

  This costs O(subtree + incident edges) and uses the same machinery as a split.

Until the re-home step has run, R counts as non-intact (§6.8). Re-homing is an optimization, not a correctness requirement. It can be deferred or skipped under load. But it means that, in steady state, **every region is a branch**, and the region-level shortcuts of §8 keep working as the data is rearranged.

## 6.8 Intact regions

Region R is **intact** when all three of these hold:

- Every non-anchor member of R has its tree parent inside R.
- Every anchor's tree parent is in `R.parentRegion`.
- No marking work or deferred cut is pending inside R.

In an intact region, every stable member reaches an anchor by following tree parents without leaving R. If all anchors lose their tree parents, the whole region loses its certificate at once. And if the internal tree edges are left untouched, it gets the certificate back at once when the anchors are reattached.

Intactness is maintained with counters, not by checking:

- `foreignParented`: the number of members whose tree parent violates the first two rules. These members are waiting for a re-home.
- `pendingMark`: work items in mark lists that sit in R, plus deferred cuts of members of R.
- `intact := foreignParented == 0 && pendingMark == 0`

With splitting, merging and re-homing, non-intactness is a **temporary state** that scheduled work repairs. Without them, it would accumulate as the data is rearranged.

At meta level the same counters, and `stableAnchors`, are **aggregates** over the members: a meta-region is intact only if no region inside it has pending work or a foreign parent. Every change to one of these counters is therefore propagated up the container chain, which is O(levels) writes. The same holds for `T/` counts whenever an object is re-parented. Together with the flag lookups of §6.6, these are the only O(levels) costs on the mutation path.

## 6.9 Meta-regions: the same structure, one level up

When there are more than `CAP` regions, they are grouped into **meta-regions**, using exactly the same rules one level up:

- Level 0: regions contain objects. Level k ≥ 1: meta-regions contain level k−1 regions.
- A meta-region's members form a **branch of the contracted tree** one level down. Members are connected through their parentRegion links. Each meta-region has anchor regions and a parentRegion at its own level.
- **Placement:** a new region goes into the meta-region of its parentRegion.
- **Split, merge and re-home** work as in §6.4–6.7, applied to the contracted tree, with fan-out between `CAP/4` and `CAP`.
- When the top meta-region splits, a new level is added above it, as when the root of a B-tree splits. The number of levels is about log base 50 of the number of objects, so roughly 5 levels for 10¹⁰ objects.

**Restructuring meta-regions is cheap.** No edge key, `g/` record or `t/` key mentions a meta-region. A split, merge or re-home at level k ≥ 1 changes only:

- the container fields of the moved clusters, O(fan-out);
- `T/` counts between the affected clusters, bounded by the tree edges between them, which are few because clusters are branches;
- entry flags, copied rather than recomputed (§6.6), O(flags naming the cluster + K).

None of this depends on the amount of data inside the cluster. Splits at level k are about `CAP/3` times rarer than at level k−1, so the total restructuring cost per insertion is O(1) per level, as in a B-tree.

**Per-level information.** Entry flags (§6.6) and `T/` tree-edge counts are kept at every level where the two endpoints lie in *different* clusters, up to the level where they first share one.

What the levels buy:

| Operation | Without meta-regions | With meta-regions |
|---|---|---|
| Suspending or resuming a huge branch | O(regions in it) | O(clusters along its boundary), about O(log n) for a whole branch |
| Proving a huge branch dead (§10.3) | O(regions in it) | about O(boundary) |
| Verified walk (§9.5) | O(region depth) | jumps a whole meta-region at a time, about O(log n) |
| Widely shared target, entry flags | one flag per source region, unbounded | about `K` flags, coarsened to meta-regions (§6.6) |

Deleting the storage of a dead branch still costs one range delete per region. Proving it dead does not need to touch them one by one.

## 6.10 The region record: the abstract information kept per region

The same record is used at every level:

```js
{
  id, level,               // 0 = contains objects
  container,               // meta-region one level up, or null at the top
  parentRegion,            // same level: where the anchors' tree parents are
  size,                    // members (objects or regions)
  anchors,                 // members whose tree parent is outside this region
  stableAnchors,           // anchors currently stable
  weight,                  // objects + outgoing edge keys (level 0)
  entryFlags,              // number of e/ flags on this region, triggers coarsening above K
  foreignParented,         // see 6.8; aggregated at meta level
  pendingMark,             // see 6.8; aggregated at meta level
  pendingAnchorMarks,      // anchors of this region waiting in a mark list (§8.1)
  scanning,                // in-progress scans using this cluster as a source; blocks structure tasks (§10.1)
  suspendedIn,             // cohort id or null: "all members without their own cohort are unstable in this cohort"
  explicitUnstable,        // members with their own cohort field set
}
```

The region also has these keys in the store:

- `e/R/<C>`: entry flags. **This is all the incoming-reference information there is: "region or meta-region C may reference into R."** Flags exist at each level. They are conservative and bounded to about `K` per region by coarsening (§6.6).
- `T/R/<S>`: exact counts of tree edges from R's members into region S, also at each level.

That is all. In particular, there is no table of which entries reach which exits. Reachability is always certified by the spanning tree. A region-level fact only ever says "everything here is in the same state", never "a path exists through here".

---

# 7. States

## 7.1 Object state

An object's state is derived:

```text
state(o) =
    o.cohort                           if set          // explicitly unstable
    R.suspendedIn                      for the lowest R in region(o), its container, its container's container, …
                                       that has it set                         // implicitly unstable
    STABLE                             otherwise
```

The container chain has O(levels) records. Meta-regions are few, about 1% of the regions, so the upper part of the chain can be cached in memory.

A cohort in `reclaiming` state means the object is proven dead.

- Stable objects have a tree parent, or are ROOT.
- Explicitly unstable objects have no tree parent and no tree children.
- Members of a suspended region keep their internal tree edges. That is what makes resume cheap.

## 7.2 Cohorts

A cohort is a group of unstable objects and suspended regions whose reachability is decided together.

```js
{
  id, state: 'active' | 'reclaiming',
  expand: [],   // items whose outgoing edges must be followed (newly stable)
  mark:   [],   // items whose tree children must be made unstable
  check:  [],   // items that must look for a stable referrer
  members, regions,   // counts, for scheduling and reclaim
}
```

Each item is `{kind: 'object' | 'region', id}`.

**Merging:** whenever a check finds that a member of cohort C is referenced by a member of a different active cohort C′, C and C′ are merged (union-find). The fate of the first object depends on the second, so they have to be decided together. Merging only makes cohorts larger, so earlier check results stay valid.

## 7.3 The stable flag may be stale, and that is fine

Below a cut that is still being marked, objects still look stable. If such an object rescues something in another cohort, the rescued object becomes its tree child. When marking reaches the stale object, it also takes the rescued object with it. Rescue through a stale source causes extra work, never unsafety.

**Reclamation never relies on a stable flag.** It relies only on "every referrer is a member of this cohort", and a stale-stable referrer blocks that. Within one cohort, the ladder finishes marking before any check (§10). So a cohort never rescues itself through its own not-yet-marked part, and that is what would create tree cycles.

---

# 8. Region-level operations

These are the three places where the hierarchy pays off. They work the same way **at every level**: a meta-region can be suspended, resumed or reclaimed as a unit, using the per-level `T/` counts and `e/` flags. In the text below, "region" means a region at any level, and "member" means an object or a lower-level region.

## 8.1 Suspension: marking a whole region at once

Instead of marking R's members one by one, set `R.suspendedIn = C` and push `{region R}` onto `C.mark`. Suspension is allowed when:

- R is intact, and
- R's last stable anchor is being marked, either individually or because R's parent region is being suspended.

**Regions with several anchors.** The anchors of a region S may be reached by marking at different times, possibly from different parents. If the first anchors were marked and descended into individually, S would have `pendingMark > 0` by the time its last anchor was reached, and could never be suspended. So marking an anchor is done in two stages. When `markObject(p)` reaches a child `c` that is an anchor of an intact region S, it only makes `c` explicitly unstable, decrements `S.stableAnchors`, and pushes `c` to the mark list; it does not descend. When `c` is later popped from the mark list, the collector looks at S again:

- if `S.stableAnchors == 0` and the only pending mark items in S are its own anchors (tracked by a separate `pendingAnchorMarks` counter), S is suspended as a whole, with its already-unstable anchors as explicit members. Such a region can only come back through materialization, because its anchors need individual re-parenting; that is the multi-anchor case of §8.2;
- otherwise `c` is marked normally.

With a FIFO mark list, the anchors one parent holds are pushed together and popped together, so the common case of a list whose items all hang from one object suspends in one step.

Marking a region item, `markRegion(R)`, handles the tree edges that leave R:

```text
for each S in T/R/*:
    if S is a child region of R, S is intact, and S is not suspended:
        suspend S in C; push {region S} to C.mark
    else:
        for each tree edge p → c with p in R, c in S:
            markObject(c)        // individual fallback
push {region R} to C.check
```

The cost is proportional to the number of regions and the tree edges that leave them, not to the number of objects.

At level k ≥ 1, `markRegion(M)` reads the level-k `T/M/*` counts. It only descends to level k−1 for tree exits that do not lead to an intact child meta-region. A whole branch made of complete meta-regions is suspended at the top level where it is complete. The work is therefore proportional to the boundary of the branch in the hierarchy, not to its size.

## 8.2 Resume: rescuing a whole region at once

If a suspended intact region gets back a stable parent for all its anchors, its internal tree is still valid. Two typical cases:

- the parent region resumes, or
- the region's sole anchor is rescued.

In either case, set `R.suspendedIn = null`, and push `{region R}` onto `C.expand` so that its outgoing edges are followed (§10.2).

A suspended region whose tree structure changes, or that is only partly rescued, is **materialized** instead:

- `R.suspendedIn = null`;
- R's anchors that are still unstable become explicitly unstable in C and are pushed to the mark list;
- ordinary marking then proceeds through R's internal tree one object at a time, which gives every shared member the chance to find a replacement parent (§10.2). Anchors that were already rescued keep their subtrees.

Materializing costs O(|R|), which is at most `CAP`, spread over several steps.

## 8.3 Whole-region reclamation

When cohort C is reclaimed, every region suspended in C, with no explicit members in other cohorts, is deleted as a unit:

```text
delete ranges y/R/, m/R/, e/R/, T/R/, the members' o/, g/ and t/ keys, r/R
```

No reachability work is done per object, and **nothing outside R is touched**. Flags in other regions that name R become stale, and are cleaned up lazily when they are next encountered (§6.6). The only per-member cost is deleting the records themselves.

A region suspended in C that also holds explicit members of *another* active cohort is not deleted as a unit. Its implicit members are deleted individually, and the foreign members stay where they are; their own cohort decides their fate. This is rare: if such a member were referenced from the region, its check would have merged the two cohorts.

A meta-region suspended in C is reclaimed by recursively reclaiming its member regions, plus its own `r/`, `m/`, `e/` and `T/` keys. Proving it dead took O(boundary). Deleting its storage takes one step per level-0 region.

---

# 9. The write barrier

All mutations go through a transaction. At commit, the barrier computes the **net edge diff** of the transaction and applies:

1. **added edges**,
2. then **removed edges**,
3. then placement of newly attached objects.

Processing additions first means that a *move* (remove `A → B`, add `C → B`) never detaches anything.

## 9.1 Added edge `s → t`

| state(s) | state(t) | Action |
|---|---|---|
| any | any | write `y/` key; if cross-region, make sure covering `e/` flags exist (§6.6) |
| STABLE | STABLE | — |
| STABLE | unstable in C | **rescue** t: tree parent s; push t to `C.expand`. If t's region is suspended: resume it if t is its sole anchor, otherwise materialize it first. |
| STABLE | new object | place t below s, make it stable, push to a global expand list (its own new children) |
| unstable in C | new object | t joins C as an explicit member in region(s), pushed to `C.check` |
| unstable in C | unstable in C′ ≠ C | merge C and C′ |

New objects that are not attached to anything by commit time are simply never written.

A source in a *reclaiming* cohort cannot occur, because nothing reachable references it. The barrier treats it as an error: it means the application held an object outside the root mechanisms of §9.4.

**The `shared` bit:** if `t` already had a tree parent before this edge, set `shared` in its `g/` record. The barrier reads that record anyway to learn `t`'s state. This is a conservative superset of "has more than one referrer". It is written at most once per object and never cleared.

New objects go into their tree parent's region, and a region whose weight exceeds `CAP` gets a split scheduled (§6.3).

## 9.2 Removed edge `s → t`

1. Delete or decrement the `y/` key. Flags are left alone (§6.6).
2. If the count for `s → t` is still positive, or `s` is not t's tree parent, stop. It was not a tree edge.
3. **Quick swap:** look for another referrer `s′` of `t` (local referrers first, then the parent region) that passes the verified walk of §9.5. If found, re-parent `t` under `s′` and schedule a re-home if `s′` is in another region (§6.7). Nothing becomes unstable.
4. Otherwise **defer the cut** (§9.3). No marking starts yet.

The verified walk (§9.5) is the only place where anything is *proven*, because the operations that use it skip marking. Everywhere else, stale flags are tolerated (§7.3).

If a suspended region's internal tree edge is removed, the region is materialized first. A removal that touches only non-tree edges in a suspended region just updates the index.

## 9.3 Deferred cuts

Applications often unlink a structure in one transaction and relink it in a later one: cut and paste, drag and drop, or a temporary detach during a rebuild. If the cut is processed immediately, a huge structure that is still reachable gets marked and then re-expanded. That is exactly the I/O the design is meant to avoid.

So a cut that quick swap could not resolve is first **deferred**:

1. Set `t.treeParent = null` and record the key `d/<deadline>/<t>`.
   - `t` stays stale-stable. Its subtree keeps its tree edges.
   - Walks fail at `t`, because its parent is null.
   - `region(t).pendingMark` is incremented, so the region is not intact.
2. **Cancel** if, before the deadline, an added edge `s′ → t` arrives and `s′` passes the verified walk of §9.5. Then `t` is re-parented under `s′`, and the `d/` key is removed. Nothing in the subtree was ever touched.
3. **At the deadline**, the collector retries quick swap once, because referrers may have been added in the meantime. If that fails, it starts a new cohort C:
   - If `t` is the sole stable anchor of an intact region R, suspend R in C.
   - Otherwise make `t` explicitly unstable in C and push it to `C.mark`.

Deferral is always safe. During the delay `t` behaves like any stale-stable object (§7.3): it can rescue things, and those rescued objects will be marked along with it later. Deferral never makes anything look reachable to the reclaim condition that is not. The only cost is that garbage is reclaimed later, by at most the delay.

The delay can be a fixed time, a number of transactions, or "end of the session that made the cut". This is a policy choice (§15).

## 9.4 Roots

ROOT is a stable object in the root region.

Objects that a server session or a connected client currently holds must not be collected while they are held, even if the persistent graph momentarily does not reach them, for example between the two transactions of a drag-and-drop. Two ways to express that:

- **Session root objects:** ordinary stable children of ROOT that reference everything a session holds. Simple, but every object handed to a client costs a persistent write.
- **Volatile roots:** an in-memory handle table of held object ids. The barrier and the collector treat a handle as an extra tree parent: a cut of an object in the handle table is neither deferred nor marked but *parked* until the handle is released. The table is lost in a crash, which is correct, because the sessions are gone too. This costs no writes and is the recommended choice.

Either way, the deferral delay (§9.3) also covers short gaps.

## 9.5 The verified walk

Quick swap, cancelling a deferred cut and the replacement-parent search all re-parent an object `c` under a referrer `s′` without marking anything. They may do so only if the walk below succeeds. It is the one place where reachability is *proven* rather than tracked.

**What has to be proven.** Not that `s′` reaches ROOT. Hanging `c` under an `s′` that is itself below a pending cut is harmless, because that cut's marking will reach `c` later (§7.3). What has to be excluded is a **cycle**: `s′` being a tree descendant of `c`. If `c` were re-parented under its own descendant, the detached cycle would never be marked and would leak.

**Object-level walk.** Follow tree parents from `s′`:

- **fail** if any object on the walk is `c`;
- **fail** if any object on the walk has a state other than STABLE, whether explicitly unstable or inside a suspended region. Re-parenting into a suspended region would break the suspension invariant (§8.2), and the child would dangle when that region is reclaimed;
- **fail** if the walk exceeds its step budget, or revisits an object;
- **succeed** on reaching ROOT, or on reaching a STABLE object whose tree parent is null. That is a deferred cut (§9.3): `c` then joins that cut's subtree, and is marked or cancelled together with it.

**Region jumps.** When the walk enters a level-0 region R that does not contain `c`, and R is intact (§6.8) with `stableAnchors == anchors`, the tree path from any member of R leaves R through an anchor into `R.parentRegion`. So the walk may continue at region level: R → `R.parentRegion` → … The region-level walk **succeeds** when it reaches the root region, and **fails** when it meets a region that is not intact, has an unstable anchor, is suspended, or contains `c`. At that point the entry object is unknown, so the walk cannot drop back to object level; it fails, and the caller falls back to deferral or marking. The same rule applies one level up: an intact meta-region whose anchor regions are all stable is jumped in one step, which makes the walk about O(levels) long.

This is sound because, when every region on the chain is intact, the chain *is* the tree path, and any pending cut on that path lives in a region with `pendingMark > 0`, which stops the jump. For the argument to hold at meta level, `pendingMark`, `foreignParented` and `stableAnchors` must be aggregated up the container chain (§6.8).

For `anchors` and `stableAnchors` to mean the right thing, an **anchor** is a member whose tree parent is not in R, *including a null parent*. An explicitly unstable member is therefore an anchor that is not stable.

---

# 10. The collector main loop

## 10.1 Structure

The top level is a scheduler over cohorts, plus a queue of **structure tasks**: split, merge, re-home and flag coarsening, at any level. Each cohort runs the original ladder. Every collector step is its own store transaction, so crash consistency comes from the store.

```js
function collect(budget) {
    while (budget > 0) {
        const work = scheduler.next();        // a cohort (round-robin, oldest first) or a structure task
        if (!work) return;                    // nothing unstable, nothing to restructure
        budget -= transaction(() =>
            work.isCohort ? step(work) : runStructureTask(work));
    }
}

function step(c) {
    if (c.expand.length) return expandNext(c);   // 1. expand spanning tree (rescue spreads)
    if (c.mark.length)   return markNext(c);     // 2. expand unstable area (instability spreads)
    if (c.check.length)  return checkNext(c);    // 3. try to reconnect
    return reclaim(c);                           // 4. delete: c is closed
}
```

This answers "what does the main loop look like with a hierarchy of regions". The ladder is unchanged. Three things are new:

1. **There are many ladders.** Each cohort has its own, so finishing one does not wait for the others.
2. **Items come in two sizes.** Each worklist item is either an object or a region, and region items stand in for up to `CAP` objects plus their suspended descendant regions.
3. **Cohorts merge** when their fates turn out to depend on each other.
4. **Structure tasks reshape regions between cohort steps.** A structure task does not run on regions that are suspended or have explicitly unstable members. It waits until the cohort that touches them is done. It also does not move objects into or out of a cluster that is currently a **source of an in-progress scan**, and does not split or re-home a meta-region whose coarse flag is being refined. Otherwise a split could move an edge from a not-yet-scanned region into an already-scanned one, and the check would miss a live referrer. A multi-step scan therefore records its cursor and its remaining sources in the cohort record, and holds a `scanning` count on each source cluster until it is done; structure tasks skip clusters with `scanning > 0`.

## 10.2 What each step does

| Step | Object item `o` | Region item `R` |
|---|---|---|
| **expand** | For each outgoing edge `o → u` with u unstable: rescue u (tree parent o), push u to expand. A suspended region with u as its sole anchor resumes; otherwise it is materialized. | R just resumed: resume intact child regions suspended in the same cohort. Read `y/R/`. For each edge from R, local or leaving, look up the target's state; the container chain is cached, so this is cheap. Rescue unstable targets, including explicit members of R itself. |
| **mark** | For each tree child `c` (prefix `t/o/`): clear the edge. If `c` is shared, first try to **find a replacement parent** for it (below); if one is found, re-parent `c` and do not descend. Otherwise make c unstable in this cohort and push it to mark and check. Anchors of intact child regions follow the two-stage rule of §8.1, so that a whole region can be suspended instead of descended into. | `markRegion(R)`, §8.1 |
| **check** | Checked **in a batch per region**: all of the cohort's unchecked explicit members of R at once. Read `y/R/` for local referrers. Then, for each flag `e/R/C`, read the `y/` range of C, or of each level-0 region inside C if C is a meta-region, and filter for edges into the batch. A STABLE referrer rescues its target. A referrer in another active cohort causes a merge. A target whose referrers are all in this cohort is checked. A complete scan that found no edge into R deletes the flag. | For each flag `e/R/C` at R's level: skip C wholesale if it is suspended in this cohort with no explicit outsiders. Otherwise read the `y/` ranges of C's level-0 regions and filter for edges whose target lies in R. Membership is decided from R's loaded member set, or from `g/` plus the cached container chain. Handle each edge as for an object. A rescued target resumes R (sole anchor) or materializes it. |
| **reclaim** | Delete o, its `y/` keys and its `t/` key. | §8.3 |

When a rescue makes an earlier check result outdated (another member counted on the rescued object being unstable), nothing is lost. The rescued object is now in the expand list, and its expansion will rescue those members too. This is why expansion comes first.

**Finding a replacement parent while marking.** In the basic algorithm, marking descends through the whole detached subtree before any check runs. A subtree that is still reachable through some other path is therefore marked completely, then expanded completely. A queue stored as a linked list (§12.5) shows how bad that is: every dequeue would cost the length of the queue.

So before making a tree child `c` unstable, marking looks for a referrer `s′` of `c`, other than the object being marked, that passes the verified walk (§9.5). If it finds one, it re-parents `c` under `s′` and stops descending there. This is the replacement-edge search used by dynamic-reachability trees (Even–Shiloach and its successors).

The search uses a budget, and is limited by a cheap filter:

- Only objects with the **`shared` bit** (§9.1) are searched. In tree-shaped data most objects have exactly one referrer and are skipped with no extra reads.
- Local referrers are tried first, then the parent region, up to a fixed number of candidates and walk steps.

This is safe because the walk excludes exactly the dangerous case: `s′` being a descendant of `c` (§9.5). Everything this cohort has already marked is explicitly unstable, and the walk fails on it. So the cohort can never create a cycle out of its own detached part.

Invariant C′ (marking before checking) is unchanged. Replacement parents are an early exit from marking, not a check.

## 10.3 Reclaim condition

A cohort is reclaimed when its expand, mark and check lists are all empty. At that point:

- every member has been checked, and all its referrers were members of the same cohort (after merges);
- the barrier rescues on any new reference from a stable object, so no stable referrer can have appeared since;
- every rescue produces expand work, which would make the list non-empty.

So the cohort is closed under "is referenced by", and no member is reachable. The cohort enters `reclaiming`, and deletion then proceeds incrementally. No object in a reclaiming cohort can be referenced again, because nothing reachable points to it.

---

# 11. Safety and liveness

**Invariant A′ (certificate):** every object whose state is STABLE, and that is not below a deferred cut or a cut still being marked, has a tree path to ROOT.

**Invariant A″ (proven re-parenting):** the operations that skip marking are quick swap, cancelling a deferred cut, and finding a replacement parent. Each re-parents an object `c` only under a referrer whose tree-parent chain was walked (§9.5) and shown to terminate at ROOT or at a deferred cut, through STABLE objects only, without passing `c`. This excludes tree cycles, which are the only way a detached structure could escape marking.

**Invariant B′ (complete edges, covered entries):**
- For every pair of objects (a, b), the key `y/region(a)/a/b` exists, with a count equal to the number of fields of a that reference b.
- Every cross-cluster edge is covered by an entry flag at each level where the clusters differ (§6.6). Flags may be stale; coverage must never be missing.
- Moves by split, merge and re-home restore coverage in the same transaction as the move.
- A flag is deleted only after a complete scan of its source. For coarse flags that take several steps to scan, the refining protocol of §6.6 keeps coverage intact.
- While a scan is in progress, no structure task moves an edge between its scanned and unscanned parts (§10.1).

This is what makes checks complete: every referrer of an object lies in its own region or in a flagged source, and all of those are scanned.

**Invariant C′ (marking before checking):** a cohort never checks while its own mark list is non-empty.

**Invariant D′ (rescue only from STABLE):** an unstable object only becomes stable through an edge from a STABLE object. A *stale*-stable source is allowed, because its pending marking will take the rescued object along (§7.3).

**Invariant E′ (closed reclamation):** a cohort is reclaimed only in the situation of §10.3.

**Suspension invariant:** a suspended region's members without their own cohort have the same tree edges they had when the region was suspended. Any change to those edges materializes the region first.

**Structure tasks only change membership, never the spanning tree.** Splits, merges, re-homes and flag coarsening move objects between regions or rewrite metadata, but they do not change any tree parent. So they can neither make an object look reachable nor make it look unreachable. They only change which keys the facts are stored under.

**Liveness:** a cohort that is not being mutated finishes in a number of steps bounded by its members plus the edges into it. Unrelated cohorts never block it. A cohort can be held back by mutations that keep touching its members, but that only happens to data that is actually being used.

These are claims to be tested, not proofs. The prototype should check them against an oracle (§16).

---

# 12. Worked examples

## 12.1 Moving a paragraph between chapters

The transaction removes `ch1 → para` and adds `ch2 → para`.

1. The added edge is processed first. `ch2` is stable, so it only gains a `y/` key and possibly a flag.
2. The removed edge was the tree edge. Quick swap finds `ch2`. The walk from `ch2` reaches ROOT without meeting `para`, so `para` is re-parented under `ch2`.

No cohort is created. If `ch2` is in another region, a re-home is scheduled (§6.7):

- If `para` was the sole anchor of its region, that region just gets `ch2`'s region as its new parent region.
- Otherwise `para` and its runs move into `ch2`'s region, or into a new region below it.

Either way, every region is a branch again.

## 12.2 Deleting a large document

A document has 50,000 objects in about 800 branch regions, under `Doc`. Those regions are grouped into about 12 meta-regions, and `Doc` is the sole anchor of the top one, `M0`.

1. The barrier removes `root → Doc`. Quick swap finds no other referrer, so the cut is deferred.
2. At the deadline, `M0` is suspended in a new cohort C.
3. `markRegion(M0)` reads the level-1 `T/` counts and suspends the 11 other meta-regions wholesale. That is about a dozen steps, not 800.
4. `checkRegion` at level 1: the entry sources of the 12 meta-regions are each other. The style and font regions that the document points *to* don't appear, because edges point the other way. All entry sources are suspended in C, so nothing is descended into and nothing is scanned.
5. Reclaim deletes the storage, one range delete per level-0 region.

Proving the document dead costs O(meta-regions). Deleting its storage costs O(regions). The basic algorithm would need O(objects) steps for marking alone.

If a paragraph inside the document is also referenced from a different document (a transclusion), the level-1 check of its meta-region sees an entry source that is not in C. It reads the `y/` ranges of that source's regions, filters for edges into the document's regions, and finds a stable referrer.

- The meta-region and region containing the paragraph are materialized.
- The paragraph is rescued, and expansion rescues the paragraph's subtree.
- A re-home moves the paragraph under the other document.

Everything else is still deleted in bulk.

## 12.3 A cycle across regions

`B ∈ R1` and `C ∈ R2` reference each other and nothing else does. Cutting `A → B` puts B in C₁ and, by marking, C as well, if C was B's tree child. If C had a different tree parent that was cut in another transaction, it is in C₂. Then B's check finds referrer C in C₂, and the two cohorts merge. Both are checked, all referrers are in the cohort, and the cohort is reclaimed.

## 12.4 The shared font

`fontCollection` is the anchor of region F, with `fontA` and `fontB` below it. Both fonts are referenced from documents all over the database.

- **Adding the millionth reference** to `fontA` costs one `y/` key in the document's region, plus a flag lookup that finds an existing covering flag on F. That is the same as the first reference, apart from the one-time flag write.
- **F carries about `K` flags**, most of them naming meta-regions, because coarsening has bounded them.
- **If F splits**, perhaps because `fontB` grew a large subtree of glyph objects, `fontB`'s branch moves to F′. F′ copies F's flags. Not one of the million incoming edges is touched.
- **If the tree edge `fontCollection → fontA` is cut**, quick swap reads `y/F/` and the `y/` range of the first flagged source, verifies one referrer with a walk, and stops. If quick swap fails, the cut is deferred. Later, the replacement-parent search or a check scans flagged sources until it finds one stable referrer.
- **Only if `fontA` is really garbage** does every flagged source get scanned completely. By then most document regions referencing it are gone, and their flags are cleaned up on the way.

## 12.5 A queue stored as a linked list

The queue is `root → n1 → n2 → … → nk`, and the tree follows the list. A dequeue adds `root → n2` and removes `root → n1`.

1. The added edge is processed first. `n2` is stable, so it only gets a `y/` key and the `shared` bit.
2. The removed edge cuts `n1`. Quick swap finds no other referrer, so the cut is deferred.
3. At the deadline, `n1` becomes unstable in a new cohort. Marking `n1` reaches its tree child `n2`. `n2` is shared, so it looks for a replacement parent and finds `root`. `n2` is re-parented under `root`, and marking stops.
4. The check of `n1` finds no referrers, and `n1` is reclaimed.

This is O(1) per dequeue. Without the replacement-parent search it would be O(k): the whole list would be marked and then re-expanded.

## 12.6 Relinking a huge structure in a later transaction

Transaction 1 removes `archive → collection`, which has 10 million objects in 100,000 regions. Transaction 2, a few seconds later, adds `newFolder → collection`.

1. In transaction 1, quick swap fails, so the cut is deferred. One key is written.
2. In transaction 2, the added edge's source passes the walk, so the deferred cut is cancelled.

The total GC work is a handful of key writes. No object or region inside the collection is read. The re-home that follows is a single region-level re-link of the collection's top meta-region.

Without deferral, the collection's top meta-regions would be suspended and then resumed. That costs O(boundary) rather than O(objects), but it still touches a structure that never stopped being reachable.

---

# 13. Costs

| Operation | Cost |
|---|---|
| Add a non-tree edge | 1 `y/` write. If cross-region: O(levels) flag lookups, and a flag write only when the edge is not already covered. Plus at most one `shared` bit write per object, ever. |
| Remove a non-tree edge | 1 `y/` delete or decrement |
| Add a new object | as an edge, plus the amortized split cost: O(average edges per object) |
| Split, merge or re-home a level-0 region | O(moved objects + their out-degree + about `K` flags per level). Incoming edges are never rewritten. |
| Split, merge or re-home a meta-region | O(fan-out + flags naming it + K). Nothing below it is read. No edge keys are rewritten. |
| Coarsen a region's flags | O(K) |
| Remove a tree edge, quick swap succeeds | O(referrers tried × walk budget), with walks of about O(levels) |
| Defer a cut, or cancel a deferred cut | 1 `d/` key; cancelling also costs one walk |
| Mark an explicit object | O(tree children), plus a bounded replacement-parent search for each shared child |
| Suspend or resume a region | O(1) plus O(tree exits of the region), at any level |
| Suspend a whole branch | O(clusters along its boundary in the hierarchy) |
| Check a batch of objects in one region | one `y/R/` read + one `y/` range read per flagged source region (a coarse flag counts as all regions in its meta-region). Stops early on rescue. |
| Check a region | one `y/` range read per flagged source region that is not suspended in the same cohort |
| Reclaim a region | storage range deletes only; nothing outside the region |
| Materialize a region | O(CAP) |
| Metadata per reference | 1 key |
| Metadata per object | 1 record, 1 `g/` record, 1 membership key, 1 tree key |
| Metadata per region | 1 record + about `K` flags per level + `T/` counts |

Apart from the O(levels) factor, which is logarithmic and small in practice, none of these costs depends on the total database size. Every row reads only metadata keys, except deleting a record during reclamation. That is the goal of §2.2.

The cost that remains unbounded is an adversarial one, as the impossibility result in §2.2 says there must be. It occurs when a large structure really is detached, has no replacement parent within the search budget, and is later rescued through a far-away referrer. With the hierarchy it costs roughly O(boundary of the structure), not O(objects).

A second unbounded cost is a check of a target whose flags name large coarse sources: it scans all of them. Weak references for hub sources (§4.4) confine this to the case of a genuinely popular object dying, which is rare.

---

# 14. Deliberately left out of v1, and when it would be needed

**Entry-to-exit reachability summaries (whitepaper §12.6).** Not needed: reachability through a region is never derived from a summary, only from the spanning tree.

**Region-prefixed object ids (`o/<region>/<id>`).** These would make region deletion a single range delete. But objects now move between regions, so ids would have to change. Ids stay independent, and the `m/` membership index is used instead.

**An exact per-edge reverse index.** An earlier draft of this design stored every edge as `x/<srcRegion>/<tgtRegion>/<tgt>/<src>`, with exact counts per region pair. That makes "who references `b`?" a direct lookup. But moving a popular object then rewrites all of its incoming keys, which required pinning popular objects as the tops of their own regions, and kept counters that every cross-region mutation had to update. The entry-flag design (§5, §6.6) moves that cost from mutations to checks. Revisit only if measurements show that checks dominate.

**Pinning popular objects.** Pinning is no longer needed for correctness or for the cost of moves. It might still help *check* performance: a popular object at the top of its own small region keeps the scan of its own region short. Measure before adding it.

**Meta-regions and coarsening in the first prototype.** With level-0 regions alone, deleting a structure of N objects costs O(N/CAP) collector steps, and the flags on a popular region are unbounded, one per source region. Both already meet the goal of §2.2: the work is proportional to what changed, and the flags are proportional to the references that exist. Meta-regions turn O(regions) into O(boundary), bound the flags, and shorten walks on deep structures. They are an optimization, and they bring most of the machinery: per-level flags, coarsening, the refining protocol, mirror keys, aggregated counters. The prototype should build level-0 regions first, with unbounded flags and no coarsening, measure, and add meta-regions only where the measurements call for them. The one case where level-0 regions alone may not be enough is the verified walk on very deep structures (§9.5), where region jumps alone give O(region depth).

---

# 15. Open questions

1. **Resume for multi-anchor regions.** Suspending them is handled by the two-stage rule of §8.1, but resume still materializes them. Is it worth tracking which anchors have been rescued, so that a region whose anchors all came back can resume without materializing?
2. **Split, merge and flag thresholds.** `CAP` as a weight, and how edges should count against objects in it; the merge threshold `CAP/4`; the target size `2·CAP/3`; and the flag limit `K`. Should the meta-level fan-out differ from `CAP`?
3. **Flag precision in practice.** How often do checks scan stale or coarse flags? Is lazy clean-up enough, or should a low-priority background task refine coarse flags on regions that are checked often?
4. **How eagerly to re-home.** Re-home right after every re-parent, in batches when the system is idle, or only when a region's `foreignParented` count passes a threshold? Eager re-homing keeps the shortcuts working. Lazy re-homing avoids churn when data is moved back and forth.
5. **Does splitting on the spanning tree match "what belongs together"?** The spanning tree reflects how objects were reached, which usually matches ownership. Measure how many cross-region edges real documents produce compared with a split based on the type of object or on the order objects were created in.
6. **Quick-swap budget.** How many alternative referrers and how many walk steps to try before falling back to a cohort? This is a tuning question, and correctness does not depend on it.
7. **Concurrency.** The design assumes a single writer: commits and collector steps are serialized transactions. That is natural for LMDB and SQLite. Multi-writer setups need more thought.
8. **Lazy schema migration** (whitepaper §7) changes references inside a load. It must go through the same barrier as a normal transaction.
9. **Scheduler policy.** Oldest cohort first, smallest remaining work first, or weighted by storage reclaimed?
10. **Deferral policy.** How long should a cut be deferred: a fixed time, a number of transactions, or the end of the session that made it? Longer delays save more work on relinks but keep garbage longer.
11. **Replacement-parent budget, and region-level replacement.** Is the `shared` bit a selective enough filter in practice? Should `markRegion` also look for replacement parents for the anchors of child regions before suspending them?
12. **Choosing better tree parents in the first place.** When a shared object gets a new referrer that is closer to ROOT than its current tree parent, should it re-parent eagerly? The aim would be fewer cuts at all, at the cost of extra writes.

---

# 16. Prototype plan

## 16.1 The role of a full trace

A full trace from ROOT is not part of the production collector (§2.4). It has two other jobs:

- **Test oracle.** On small graphs in the fuzzer, it is the reference answer for which objects are reachable.
- **Optional scrubber.** It can be a very rare, low-priority background check, preferably region by region, that reports or reclaims garbage leaked by bugs. It is a safety net, not a means of collection.

## 16.2 Fuzzing

Each step is tested by a **fuzzer with an oracle**. It applies random transactions. Some are generic: adding or removing edges, creating objects, moving subtrees, building cycles across regions, and creating hubs with very high fan-in. Others are **adversarial workloads** aimed at the known weak spots:

- queues stored as linked lists;
- unlinking and relinking across transactions;
- re-rooting large structures;
- rescuing a detached structure through a distant referrer;
- structure tasks interleaved with multi-step scans and refinements;
- hub sources, with both weak and strong references, and lists hanging from one object in another region (multi-anchor regions).

Between transactions it runs random amounts of collector work. It then checks:

- **Safety:** at every reclaim, a full trace from ROOT (the oracle) confirms that no reclaimed object is reachable.
- **Completeness:** once the collector is idle, the set of stored objects equals the reachable set.
- **Metadata integrity:**
  - when implementation B is used, `y/` keys match the object fields,
  - every flag whose source is a meta-region has its `E/` mirror,
  - every cross-cluster edge is covered by an entry flag at every level (stale flags are allowed),
  - `t/` keys match `treeParent`,
  - region counters match a recount, at every level,
  - suspended regions have unchanged internal trees,
  - after structure tasks have run to completion, every region is a branch of between `CAP/4` and `CAP` members, except where §6.5 left one alone.

## 16.3 Steps

1. **Store interface, object model and oracle.** An in-memory ordered KV with transactions, object records, a ROOT, and the full-trace oracle. `edgesOfRegion(R)` uses implementation A (§5.5), reading object records. No GC.
2. **Basic collector (whitepaper §9) with cohorts.** A single region, object items only. Establishes the ladder, merging and the reclaim condition.
3. **Quick swap, deferred cuts and replacement parents.** These are the mechanisms that avoid needless marking. They are tested in a single region first, so their correctness is separated from regions.
4. **Level-0 regions without suspension.**
   - placement, centroid split by weight, merge, re-homing;
   - entry flags with coverage on moves, lazy clean-up, and batched region checks;
   - still object-level marking.

   The fuzzer adds random splits and merges at arbitrary moments. They must never change which objects are reclaimed.
5. **Suspension, resume, materialize, whole-region reclaim.**
6. **Meta-regions, if the measurements from step 5 call for them (§14).** Per-level flags and `T/` counts, flag coarsening and the refining protocol, aggregated counters, suspension at higher levels, walks that jump across meta-regions.
7. **The `y/` edge index (implementation B, §5.5),** behind the same `edgesOfRegion(R)` interface. Measure it against A: bytes read per check, and writes per mutation and per move.
8. **LMDB backend and measurements.** The primary metric is **GC key reads and writes per mutation, as a function of database size**. It should stay flat as the database grows. Also measure:
   - bytes per object and per edge,
   - barrier cost,
   - steps per collected object,
   - the shared-font, large-document, queue and relink scenarios, compared with step 2's flat collector;
   - split, merge and re-home cost per mutation;
   - the fraction of cross-region edges in realistic document data.

---

# 17. Related work

- **Arborescent Garbage Collection: A Dynamic Graph Approach to Immediate Cycle Collection.** ISMM 2025, Best Paper. A maintained spanning forest with dynamic single-source reachability, for in-memory heaps. This is the closest relative of this design. <https://conf.researchr.org/details/ismm-2025/ismm-2025-papers/1/Arborescent-Garbage-Collection-A-Dynamic-Graph-Approach-to-Immediate-Cycle-Collectio>
- **M. Sotoudeh, Pathological Cases for a Class of Reachability-Based Garbage Collectors.** OOPSLA 2025. Every collector of this general kind has some workload that forces either a long pause or an unnecessary refusal to allocate. The proof works by reducing GC to dynamic reachability. <https://arxiv.org/abs/2504.11654>
- **U. Maheshwari, B. Liskov, Partitioned Garbage Collection of a Large Object Store.** SIGMOD 1997, the Thor system. Tracing one partition at a time with lists of references between partitions, plus a global marking piggybacked on the partition traces for cycles that span partitions. Maheshwari's thesis, MIT-LCS-TR-727, extends this. <https://dspace.mit.edu/handle/1721.1/149831>
- **Partitioned GC in 1990s object databases:** Yong, Naughton & Yu (1994); Cook, Wolf & Zorn (1994), on how to choose partitions, finding that partitions where pointers were recently overwritten yield the most garbage; Amsaleg, Franklin & Gruber (1995). *Cited from memory; verify details.*
- **Incremental tracing:** Dijkstra et al. (on-the-fly), Baker (incremental copying), Yuasa (snapshot-at-the-beginning). These are the standard ways to interleave tracing with the application, at the cost of reading all live data every cycle.
- **Dynamic reachability:** Even & Shiloach (1981) maintain a tree under deletions by searching for replacement edges. That is the origin of the replacement-parent search in §10.2.
- **S. Brandt et al., Distributed Garbage Collection for General Graphs.** ISMM 2018. Distributed cycle collection with bounded metadata.
- **Hierarchical tree clustering:** G. Frederickson, topology trees (1985); S. Alstrup, J. Holm, K. de Lichtenberg, M. Thorup, top trees (2005); RC-trees. These maintain a recursive clustering of a tree with bounded cluster sizes under link and cut, which is the structure behind regions and meta-regions (§6.9). *Cited from memory; verify details.*
- **M. Hirzel, A. Diwan, M. Hertz, Connectivity-Based Garbage Collection.** OOPSLA 2003. Groups heap objects into partitions by connectivity, based on the observation that connected objects tend to die together. *Cited from memory; verify details.*
- **B-trees:** split at overflow and merge at underflow, with hysteresis, for amortized constant restructuring cost. This is the model for §6.4–6.5.

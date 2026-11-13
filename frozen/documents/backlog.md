# Backlog

What is left to do on the store, the collector and the visualizer, from a review on 2026-11-12. The numbers come from one-off measurements on `MemoryStore`; the scripts were not kept, but each item says what was measured. Design section numbers refer to `persistent-garbage-collection.md`.

## Done since the review

- **Item 1, wide lists.** Worklists are keys (`w/`), and leaves are not queued for marking. The 4,000-child list: 156 steps and 1.3 seconds, from 4,097 steps and 68 seconds.
- **Item 2, step size, in part.** A step budget (`stepBudget`, invariant B1) bounds check batches, the children detached by one mark step, and the objects deleted by one reclaim step; reclaim is incremental. The largest step in the list case writes about 820 keys, from 16,130. Still unbounded: `materialize`, the expansion of a resumed cluster, and the mark and check of a suspended cluster.
- **Item 3, region weight.** Kept as a counter (invariant A3). An edit that leaves its region within bounds now costs the collector no step and no record read.
- The stale comments and the unused `markChildren`.

- **The edge index** (step 7, invariant Y1), on by default: the collector reads edge keys, never object records. `tools/edgeindex.js` measures it against reading records.
- **The LMDB backend** (step 8): `src/store/LmdbStore.js`. `tools/lmdb.js` shows the cost of a change flat from 5,000 to 80,000 objects.

- **Item 4, popular regions: pinning** (invariant P1), with a scrub of the flags left behind (G7). Flag coarsening would not have helped: it bounds the flags stored, not the regions a check reads.
- **The rest of item 2:** expanding a resumed cluster and settling a materialized one take one region a step (U6).
- **Profile of key reads** on LMDB: they follow the size of what is deleted (edge keys, membership and metadata of the dead objects, several passes); nothing stood out as waste. A transaction re-reads cluster records often (no caching within a transaction).

- **A round of small items:**
  - The store has `first(prefix)`, and the scheduler uses it instead of reading every pending task key.
  - A re-home task skipped because its cluster was busy is tried again when that ends.
  - Suspending a cluster and cutting its exits are one step, not two. A suspended cluster is always marked.
  - Tests: aborted transactions and steps (`abort.test.js`), cost bounds (`cost.test.js`), and a fuzz operation that builds subtrees, so that the fuzzer's graphs are bigger.
  - LMDB measured with durable commits (below).
  - Visualizer: click a region or meta-region to see its record; only the selected cluster's flags are drawn, and flags between meta-regions only on request; ticks for application transactions on the timeline.

## Suggested order for the rest

1. The application interface: volatile roots, chunked collections.
2. Flag coarsening, only if the number of flags stored on a pinned region becomes a problem.

## Measured problems

**1. Wide lists are quadratic.** Deleting one object with 4,000 leaf children took 68 seconds, 4,097 collector steps, and wrote 158 MB of cohort records. With 1,000 children: 5 seconds and 9 MB.
- Worklists (`expand`, `mark`, `check`) are arrays inside the cohort record, so every push rewrites the whole record. They should be keys of their own.
- An object with no tree children has nothing to mark, but `makeUnstable` queues it and it takes a step. Not queuing it should be safe: invariant M1 only asks for unmarked objects on the list, and suspension only starts from an object that has tree children (a cluster with something left to suspend has an unmarked explicit object inside it, by T4).

**2. Single steps are unbounded.** Each collector step is one store transaction.
- Reclaim deletes a whole cohort at once: 4,239 keys in one step for a 1,000-object branch, 16,130 for the list above. The design makes reclaim incremental (§10.3).
- A check step takes every pending member at once.
- `materialize`, and the expansion of a resumed cluster, read the whole cluster, which for a meta-region can be most of the database. The design has multi-step scans with a cursor (§10.1).

**3. Ordinary edits pay for a region read.** Adding one paragraph to a document caused about 5 structure tasks and 150 object-record reads by the collector. Every edge change schedules a structure task, which re-reads the whole region to recompute its weight (`regionWeight`). A weight counter in the region record would remove most of it. (The test documents were right at the region cap, so splits inflate the number.)

**4. Popular regions are expensive to check.** Checking one object in a region that many regions reference reads all of them: 20,000 records for the chunk object that shared region `r0` with the font every document references. The edge index turns those into reads of small edge keys, but there are as many. Fixed by pinning (above). What is left: the pinned object's own region still has one flag per referring region, and a check of the pinned object itself still reads them all; that happens only when the popular object is cut.

**5. Stale entry flags from splits** (partly done: copied flags are now marked, and scrubbed after a pin; after an ordinary split they are still left to the checks, since a scrub reads a region per flag and most are never checked). A split copies every flag of the old region to the new one (§6.6), true or not. In the "Meta-regions" visualizer scenario, after loading, 12 of 28 level-0 flags are stale, all of them naming the root's region. A stale flag costs one scan of its source region the first time something in the target is checked, and is then deleted. A low-priority scrub could remove them earlier (open question 3 of the design); with the `y/` edge index a split could copy only the true ones.

## Collector, smaller

- **The scheduler reads all cohort records per step** (`activeCohorts`), merged ones included, to pick one. An index of the root cohorts would avoid it; cohorts alive at once are few, so it has not mattered.
- **Deep structures.** The verified walk gives up after `walkBudget` steps (64), so a quick swap deep in a long chain fails and starts a cohort. Walk jumps across intact clusters (§9.5) are the design's answer. How often this happens has not been measured.
- **Multi-root clusters cannot resume;** they are materialized when relinked (open question 1). A split that prefers a single-root piece whenever one is above the merge threshold would give more single-root regions, at the price of balance; not tried.
- **Not built from step 6:** flag coarsening and the refining protocol, the intactness counters, walk jumps.

## Store and database

- **`MemoryStore` is slow by construction:** it clones every value on read, inserts keys into a sorted array, and a transaction's `range` rescans all of its own writes. Large loads are slow because of this; `LmdbStore` loads 80,000 objects in about 40 seconds. Use LMDB for anything big.
- **Durable commits on LMDB showed no extra cost** on the development machine: `DURABLE=1 node tools/lmdb.js 100` gave 1.6 ms per small edit and 11 ms per deleted document, the same as with `noSync`. That is surprisingly cheap for a flush per commit; whether each commit really reaches the disk there (and what it costs on other disks) has not been verified. If it turns out to cost, collector steps could share a flush, since losing the last few only repeats work.
- **Big collections.** An array of thousands of references is one record, rewritten and re-diffed on every append, and an object heavier than the region cap cannot be split ("unsplittable"). The design chunks large collections (§5.4); not built.
- **Holding objects across transactions.** Only holds exist. The volatile root table (§9.4) is not built; it belongs with the application interface.

## Testing gaps

- **Fuzz graphs are still small** next to a real database: a few hundred objects. Meta-regions are exercised through small caps, not through size.
- **No crash test on LMDB itself:** the abort test runs on the in-memory store. Killing a process in the middle of a commit would test LMDB, not this code.

## Visualizer

- **Recording blocks the page:** a long random recording is computed on the main thread before anything is shown.

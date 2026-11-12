# Backlog

What is left to do on the store, the collector and the visualizer, from a review on 2026-11-12. The numbers come from one-off measurements on `MemoryStore`; the scripts were not kept, but each item says what was measured. Design section numbers refer to `persistent-garbage-collection.md`.

## Done since the review

- **Item 1, wide lists.** Worklists are keys (`w/`), and leaves are not queued for marking. The 4,000-child list: 156 steps and 1.3 seconds, from 4,097 steps and 68 seconds.
- **Item 2, step size, in part.** A step budget (`stepBudget`, invariant B1) bounds check batches, the children detached by one mark step, and the objects deleted by one reclaim step; reclaim is incremental. The largest step in the list case writes about 820 keys, from 16,130. Still unbounded: `materialize`, the expansion of a resumed cluster, and the mark and check of a suspended cluster.
- **Item 3, region weight.** Kept as a counter (invariant A3). An edit that leaves its region within bounds now costs the collector no step and no record read.
- The stale comments and the unused `markChildren`.

## Suggested order for the rest

1. The edge index and the LMDB backend (steps 7 and 8 of the plan, §16.3), which address item 4.
2. The rest of item 2.

## Measured problems

**1. Wide lists are quadratic.** Deleting one object with 4,000 leaf children took 68 seconds, 4,097 collector steps, and wrote 158 MB of cohort records. With 1,000 children: 5 seconds and 9 MB.
- Worklists (`expand`, `mark`, `check`) are arrays inside the cohort record, so every push rewrites the whole record. They should be keys of their own.
- An object with no tree children has nothing to mark, but `makeUnstable` queues it and it takes a step. Not queuing it should be safe: invariant M1 only asks for unmarked objects on the list, and suspension only starts from an object that has tree children (a cluster with something left to suspend has an unmarked explicit object inside it, by T4).

**2. Single steps are unbounded.** Each collector step is one store transaction.
- Reclaim deletes a whole cohort at once: 4,239 keys in one step for a 1,000-object branch, 16,130 for the list above. The design makes reclaim incremental (§10.3).
- A check step takes every pending member at once.
- `materialize`, and the expansion of a resumed cluster, read the whole cluster, which for a meta-region can be most of the database. The design has multi-step scans with a cursor (§10.1).

**3. Ordinary edits pay for a region read.** Adding one paragraph to a document caused about 5 structure tasks and 150 object-record reads by the collector. Every edge change schedules a structure task, which re-reads the whole region to recompute its weight (`regionWeight`). A weight counter in the region record would remove most of it. (The test documents were right at the region cap, so splits inflate the number.)

**4. Popular regions are expensive to check.** Checking one object in a region that many regions reference reads all of them: 20,000 records for the chunk object that shared region `r0` with the font every document references. Remedies in the design, none built: the `y/` edge index (§5.5, step 7), flag coarsening (§6.6), pinning popular objects (§14).

**5. Stale entry flags from splits.** A split copies every flag of the old region to the new one (§6.6), true or not. In the "Meta-regions" visualizer scenario, after loading, 12 of 28 level-0 flags are stale, all of them naming the root's region. A stale flag costs one scan of its source region the first time something in the target is checked, and is then deleted. A low-priority scrub could remove them earlier (open question 3 of the design); with the `y/` edge index a split could copy only the true ones.

## Collector, smaller

- **The scheduler reads too much per step:** all cohort records (`activeCohorts`) and all pending `s/` and `x/` keys, to pick one. The store interface needs "first key with this prefix".
- **Dropped re-home tasks.** A re-home task that finds its cluster suspended or expanding is dropped, not retried when that ends.
- **Deep structures.** The verified walk gives up after `walkBudget` steps (64), so a quick swap deep in a long chain fails and starts a cohort. Walk jumps across intact clusters (§9.5) are the design's answer. How often this happens has not been measured.
- **Multi-root clusters cannot resume;** they are materialized when relinked (open question 1). A split that prefers a single-root piece whenever one is above the merge threshold would give more single-root regions, at the price of balance; not tried.
- **Not built from step 6:** flag coarsening and the refining protocol, the intactness counters, walk jumps.

## Store and database

- **`MemoryStore` is slow by construction:** it clones every value on read, inserts keys into a sorted array, and a transaction's `range` rescans all of its own writes. Large loads are slow because of this. It matters little once there is an LMDB backend (step 8).
- **Big collections.** An array of thousands of references is one record, rewritten and re-diffed on every append, and an object heavier than the region cap cannot be split ("unsplittable"). The design chunks large collections (§5.4); not built.
- **Holding objects across transactions.** Only holds exist. The volatile root table (§9.4) is not built; it belongs with the application interface.

## Testing gaps

- **No crash or abort test.** The transaction principle (invariants §1) is never exercised by a transaction or collector step that throws midway.
- **Fuzz graphs are small.** Meta-regions are only exercised with tiny caps.
- **Suspension costs two steps per cluster** (suspend, then mark its item). Now that leaves cost no step, a small flat region is cheaper in steps without suspension, though not in writes. The two could be one step.
- **No cost assertions.** Items 1 to 4 were invisible to the test suite; `tools/scale.js` and `tools/fragmentation.js` are run by hand.

## Visualizer

- **Clusters cannot be inspected.** Only objects are clickable. Clicking a region or meta-region should show its record: counters, tree-edge counts, flags, suspension.
- **Flags clutter the view** once there are meta-regions. Show them for the selected cluster only, or per level, and mark stale ones.
- **Timeline:** ticks for application transactions on the slider.
- **Recording blocks the page:** a long random recording is computed on the main thread before anything is shown.

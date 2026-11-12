# Invariants

This document states the invariants of the frozen object store and its garbage collector as precisely as possible. It is the reference for the code in `frozen/src`, and for the design in `persistent-garbage-collection.md` ("the design").

---

# 1. The transaction principle

> **Every operation on the database is one store transaction. Every transaction, taken as a whole, preserves every invariant in this document.**

There are exactly two kinds of operation, and both follow the principle:

| Operation | What it does in one transaction |
|---|---|
| **Application transaction** | the application's writes to object records, *plus* the write barrier, which brings all GC metadata in line with those writes |
| **Collector step** | one step of one cohort's ladder (expand, mark, check or reclaim), a due deferral, or a structure task. Its size is bounded (B1) |

Consequences:

- **Invariants hold at every commit boundary.** Inside a transaction they may be temporarily broken: the application writes records first, the barrier repairs the metadata afterwards. Nothing outside the transaction can observe the broken state, because nothing outside sees uncommitted writes.
- **Crash consistency is inherited.** The store commits a transaction atomically. A crash therefore leaves the store at the last commit boundary, where every invariant holds. No recovery procedure is needed beyond what the store does itself.
- **No GC state lives outside the store.** Worklists, cohorts and the id counter are keys. In-memory state, such as the scheduler's round-robin cursor, is only an optimization: losing it changes the order of work, never its correctness.
- **A transaction that throws writes nothing.** The barrier may refuse a transaction (for example, a strong reference to a missing object); then the application's writes are discarded too.

The store's own guarantee (`MemoryStore`, or `LmdbStore` on LMDB; both pass the same tests): a transaction's writes are applied all together or not at all; reads inside a transaction see its own writes; there is a single writer, so transactions do not interleave.

For a store that can only write *one record* atomically, the principle can still be kept with a redo log, as the earlier `eternity` prototype did: write the transaction's buffered writes as one record, apply them, then delete the record, and replay it on startup if present. Every write is a put or a delete, so replay is idempotent. (Not implemented; not needed for LMDB or SQLite.)

---

# 2. Definitions

- **Object:** an id with a record `o/<id>`. `ROOT` always exists.
- **Strong edge** `s → t`: the record of `s` contains `ref(t)` somewhere, at least once. Weak references (`weak(t)`) are not edges.
- **Reachable:** there is a path of strong edges from `ROOT`.
- **State** of an object, from its metadata `g/<id> = { treeParent, cohort, region }`:
  - **explicitly unstable in C** if `cohort` is set, where C is the surviving cohort found by following `mergedInto` links (union-find);
  - **implicitly unstable in C** if `cohort` is null and a cluster containing it (its region, or a meta-region above it) is **suspended** in C (§3.8);
  - **stable** otherwise.
- **Cluster:** a level-0 region of objects, or a meta-region (level k ≥ 1) of level k−1 clusters (§3.6). "Inside" a cluster means in it at any depth.
- **Implicit member:** an implicitly unstable object. **Anchor** of a suspended cluster: an explicitly unstable object inside it with tree children.
- **Tree edge** `p → c`: `g/c.treeParent = p`.
- **Marked:** an explicitly unstable object with no tree children. **Unmarked:** an explicitly unstable object that still has tree children. A suspended cluster whose exits have been cut counts as marked as a whole (§3.8).
- **Cohort:** a set of unstable objects that are suspected garbage and whose fate is decided together. One cut that could not be resolved on the spot starts one cohort, with the cut object as its first member. Marking adds the tree descendants of its members; a member that turns out to have a stable referrer is rescued and leaves; two cohorts merge when a member of one is referenced from a member of the other, since then neither can be judged alone. When nothing is left to expand, mark or check, no remaining member is referenced from outside the cohort (S1), and the remaining members are deleted in one step.
- **Root cohort:** a cohort record with `mergedInto = null`. Only root cohorts have worklists: the keys `w/<cohort>/<list>/<item>`, for the lists expand, mark and check.
- **Dead:** a member of a cohort in state `reclaiming`. It is proven unreachable (S1) and is deleted within a few steps (B1).
- **Checked:** an unstable object whose check ran while it was a member of its current cohort, and found every referrer to be a member of the same cohort at that moment.

---

# 3. Invariants of the current implementation

Each invariant names who maintains it and how it is verified. "Oracle" means `checkIntegrity` in `src/oracle.js`, which the fuzzer runs after every transaction and every collector step.

## 3.1 Records

**R1. Every object has metadata, and only objects do.** `o/<id>` exists if and only if `g/<id>` exists.
*Maintained by:* the barrier (new objects get both or neither), reclaim (deletes both). *Verified:* oracle.

**R2. Strong references point at existing objects.** Weak references may dangle.
*Maintained by:* `ObjectTransaction.finish` refuses a transaction that writes a strong reference to a missing object. Reclaim deletes only closed cohorts (S1): no object outside the cohort references a member, so no surviving object is left with a dangling strong reference.
*Verified:* the oracle's trace fails on a missing reachable object; the barrier's check on every write.

**R3. New objects are either placed or never written.** A new object that no placed object references at the end of its transaction is not persisted.
*Maintained by:* the barrier. *Verified:* unit tests.

## 3.2 The spanning tree

**T1. Tree keys mirror tree parents.** `t/<p>/<c>` exists if and only if `g/c.treeParent = p`.
*Maintained by:* every operation that changes a tree parent: `attachNew`, `makeUnstable`, `rescue`. *Verified:* oracle.

**T2. Tree edges are real edges.** If `g/c.treeParent = p`, then `s → c` is a strong edge for `s = p`.
*Maintained by:* the barrier cuts the tree edge in the same transaction in which the edge's count drops to zero. *Verified:* oracle.

**T3. Exactly the stable, non-deferred objects and the implicit members have tree parents.** A non-ROOT object has a tree parent if and only if it is stable and not deferred (F1), or an implicit member (U2). ROOT is stable and has no tree parent.
*Maintained by:* `makeUnstable` and `defer` clear the parent; `rescue`, `attachNew` and `reparent` set it. *Verified:* oracle.

**T4. The tree is acyclic, and every tree path ends well.** Following tree parents from any object terminates, at `ROOT`, at an **unmarked unstable** object, or at a **deferred** object.
- Ending at ROOT means the object is certified reachable.
- Ending at an unmarked unstable object `u` means the object is **stale-stable**: it is below a cut whose marking has not reached it yet. Marking `u` (M1) will reach it.
- Ending at a deferred object `d` also means stale-stable: when `d`'s deferral is resolved (F2), it is either re-parented, or made unstable and marked.

*Maintained by:* the operations that create a tree edge to an existing object are `rescue`, which requires the object to be marked (D1), so that it has no tree children and cannot be an ancestor of its new parent; and `reparent`, which requires a verified walk (W1).
*Verified:* oracle (acyclicity and termination at every commit; termination at ROOT when idle).

## 3.3 Cohorts and membership

**C1. Every unstable object belongs to exactly one root cohort, through its membership key.** `g/o.cohort = k` implies the key `C/<k>/<o>` exists and `k` names an existing cohort record. Conversely, every `C/<k>/<o>` key belongs to an object with `g/o.cohort = k`.
*Maintained by:* `makeUnstable`, `joinCohort`, `rescue`, reclaim. *Verified:* oracle.

**C2. Merges are union-find.** A merged cohort record has `mergedInto` set, no worklist keys (they move to the root, whose record counts them in `pending`), and is listed in the `absorbed` list of its root. Membership keys stay under the id the object joined with; the root's family (`[root, ...absorbed]`) covers them all.
*Maintained by:* `GcState.merge`, `push`, `take`, `unqueue`. *Verified:* oracle (membership keys resolve; worklist keys belong to root cohorts and match `pending`), reclaim (stale-key check throws).

**C3. Merging is only for active cohorts.** A cohort in state `reclaiming` is never merged, and never gains members. Its members are dead, and everything treats them as gone already: `tx.exists` says no, the barrier refuses an edge to or from one, a check ignores one as a referrer, and an expand item for one is dropped.
*Maintained by:* the barrier, `Collector.checkObjects`, `checkRegion` and `expand`. *Verified:* `merge` throws; the fuzzer reclaims with budgets of 1 and 3 objects per step, so that reclaiming cohorts live across many transactions.

## 3.4 Work obligations

These say what a cohort still owes before it may be reclaimed. They are what makes the reclaim condition (S1) sound.

**M1. Mark obligation.** Every unmarked unstable object is on its root cohort's mark list, unless it is inside a cluster suspended in that cohort: the cluster's item stands for it.
*Maintained by:* `makeUnstable` pushes the object to `mark` in the same transaction if it has tree children (one without is marked already, and never gets any: only stable objects are given tree children); a mark step that detaches only a budget of an object's children pushes it back (B1); merges move the lists; `suspend` replaces the items inside the cluster by the cluster's item; `materialize` puts them back. Nothing else gives an unstable object tree children. *Verified:* oracle.

**M2. Unmarked objects have their check pending.** Every unmarked unstable object is on its root cohort's check list, with the same exception as M1. This is what lets the barrier and expansion skip rescuing an unmarked object (D1): its check will find the referrer.
*Maintained by:* `makeUnstable` always pushes to `check`; checks run only when nothing is left to mark; `materialize`, which makes anchors unmarked again after their check may have run, queues their check again. *Verified:* oracle. (Found by the fuzzer: without the last rule, a reachable object was reclaimed.)

**M3. Stable referrers are noticed.** If a stable object `s` references an object `t` unstable in C, then `s` (or its region's item) is on an expand list, or `t` is on C's check list, or `t` is an implicit member whose suspended cluster's item is on C's mark or check list. (An expand item for any cluster containing `s` also counts.) Otherwise nothing would ever notice that `t` is referenced from outside its cohort.
*Maintained by:* a stable referrer appears when an edge is added (the barrier rescues `t` if it is marked, and otherwise `t`'s check is pending by M2), when an object is rescued (it goes on the expand list), or when an implicit member turns stale-stable at `materialize` (which queues the checks of what it references). *Verified:* oracle. (Found by the fuzzer: a materialized member that later got a replacement parent became a stable referrer that nothing had queued.)

**K1. Check obligation.** Every unstable object is either checked, or on its root cohort's check list.
*Maintained by:* `makeUnstable` and `joinCohort` push to `check`; merges concatenate lists; a check batch removes items only by checking them (or by finding them rescued or reclaimed). *Verified:* indirectly, by the safety oracle.

**E1. Expand obligation.** Let `m` be a checked member of cohort C, checked while counting `r` as a fellow member. If `r` has since been rescued, then one of these holds:
- C's expand list contains `r`, or
- `r` has been expanded while stable, which rescued `m` if `m` was marked, or left `m` to its pending check if not (D1), or
- C has been merged with the cohort `r` is now unstable in.

*Maintained by:* `rescue` pushes the rescued object to the expand list of the cohort it leaves. When an expand item finds its object unstable in another cohort, the two cohorts merge (`Collector.expand`). This last rule was found by the fuzzer; without it, an expansion can move out of C's sight and C reclaims a reachable object.
*Verified:* indirectly, by the safety oracle.

**D1. Rescue only marked objects, only from stable objects.** An unstable object becomes stable only through `rescue(o, s)`, and only if `s` is stable and `o` is marked: it has no tree children, or it is an anchor of a suspended cluster whose exits are cut (U3), so that its tree children are all implicit members and none of them is `s`. An unmarked object that gets a stable referrer is left alone: by M1 and M2 it will be checked after marking, and the check finds the same referrer. "Rescuing" an implicit member materializes its cluster instead (U4).
*Maintained by:* `canRescue` guards the barrier, expansion and checks; `rescue` throws otherwise. *Verified:* `rescue` throws; T4 in the oracle.

## 3.5 Avoiding needless marking

These come with quick swap, deferred cuts and replacement parents (design §9.2, §9.3, §9.5, §10.2).

**F1. Deferred cuts are recorded.** A non-ROOT stable object has a null tree parent if and only if it is **deferred**: its metadata has `deferred = { kind, at }`, and exactly one deadline key exists for it:
- `d/<at>/<id>` for `kind: "tx"`, a deadline on the logical clock (the number of application transactions);
- `h/<at>/<id>` for `kind: "ms"`, a deadline in wall-clock milliseconds.

A deferred object is stale-stable: it still counts as stable everywhere, but its certificate is pending.
*Maintained by:* the barrier defers a cut it cannot quick-swap; the collector resolves a due deferral by a quick swap or by starting a cohort; a later added edge may cancel it; `release` moves its deadline to now. Each of these updates the metadata and the deadline key in the same transaction. *Verified:* oracle.

**F2. Deferrals are resolved.** Every deferral is resolved by the collector once its clock reaches its deadline, unless it is cancelled first.
*Maintained by:* the scheduler runs due deferrals before every step except those of ready cohorts, which are bounded (§10.1 of the design). With `deferCuts: false` no deferral is ever created. *Verified:* the fuzzer requires no deadline keys when idle, and a quarter of its seeds run without deferral.

**H1. A hold is a deferral with a chosen lifetime.** `tx.hold(id, { transactions } | { milliseconds })` applies to the cut of `id` in the same transaction: if that cut is deferred, its deadline is the hold's instead of the default. A hold therefore ends in exactly one of the ways a deferral ends:
- **reattached:** an added edge from a verified referrer cancels it (W1), without marking anything;
- **expired:** at its deadline it is resolved like any deferral, and collected if nothing references it;
- **released:** `tx.release(id)` moves its deadline to the current transaction, so it is due at once.

A forgotten hold therefore delays collection until it expires; it never leaks. A hold has no effect when the transaction does not actually detach the object: when the object's tree edge is not cut (it is still referenced through its tree parent), or when the cut is resolved at once by a quick swap. Which reference is the tree edge is GC-internal, so the application is never asked to know it. (An earlier version refused such holds; the fuzzer showed that an application cannot avoid that error without reading GC metadata.)
*Maintained by:* `ObjectTransaction.hold` and `release`, applied by the barrier. *Verified:* unit tests, and the fuzzer's hold and release operations.

**W1. Proven re-parenting.** Quick swap, cancelling a deferral and the replacement-parent search re-parent an object `c` without marking anything. Each does so only under a referrer `s` for which the verified walk succeeds: following tree parents from `s` reaches `ROOT` or a deferred object, within a step budget, through stable objects only, without meeting `c` and without revisiting an object.
*Why this is enough:* the walk excludes `s` being a tree descendant of `c`, which is the only way re-parenting could create a cycle (T4). If the walk ends at a deferred object, `c` joins that pending cut's subtree and is resolved with it.
*Maintained by:* `GcState.verifiedWalk`, used by all three. *Verified:* T4 in the oracle.

**W2. The shared bit is a superset.** An object with more than one strong referrer has `shared` set in its metadata. The bit is sticky; it may be set on an object that has only one referrer now.
*Maintained by:* the barrier sets it whenever an edge is added to an object that already had metadata. *Verified:* oracle. It is only a filter: quick swap and the replacement-parent search skip objects without it, because such an object has no other referrer to swap to.

## 3.6 Regions and meta-regions

These come with regions (design §6 and §6.9). A **region** (level-0 cluster) groups objects; its **weight** is its number of members plus their outgoing strong edges (counted per distinct target). A **meta-region** at level k ≥ 1 groups level k−1 clusters, up to `clusterCap` of them. The record `r/<X>` of a cluster at any level has `level` and `container`.

**H1. A balanced hierarchy.** A cluster with a container is a member of it (`m/<container>/<X>`) and is one level below it. A cluster without a container is at the **top level** and has the key `R/<X>`; all top-level clusters are at the same level. So every region has a chain of containers of the same length, and two objects' chains can be compared level by level.
*Maintained by:* members only move between clusters of the same level (splits and merges inside one container, re-homes also across containers); a new level is added above all top-level clusters when there are more than `clusterCap` of them, and removed when a single top-level meta-region is left with at most `clusterCap` members (`regions.js`). *Verified:* oracle.

**G1. Membership.** Every object belongs to exactly one level-0 region: `g/<id>.region = R` if and only if the key `m/<R>/<id>` exists, and then the region record `r/<R>` exists. ROOT starts in the root region `r0`, which is never deleted (a split may move ROOT out of it).
*Maintained by:* placement in the barrier (a new object joins the region of the object that placed it), splits and merges (which move members), reclaim (which deletes membership keys). *Verified:* oracle.

**G2. Entry flag coverage, at every level.** For every strong edge `a → b` and every level k where the level-k clusters `A_k` of `a` and `B_k` of `b` differ, a flag `e/<B_k>/<X>` exists where X is `A_k` or one of its containers. A flag means "something in that source cluster *may* reference into this cluster": flags may be stale, but coverage is never missing.
*Maintained by:* the barrier covers every added edge at every level (`coverEdge`, O(levels) lookups), before it processes removals, so that quick swap can find referrers added in the same transaction. A level-0 split or merge that moves objects from region R to R′ copies R's flags to R′ (target side), and adds flags for the moved objects' outgoing edges and for edges that the move turns cross-region (source side); above level 0 nothing changes, since R and R′ share a container. A meta-region split or merge moving members from M to M′ copies M's flags to M′, adds a copy naming M′ of every flag that names M (found through the mirrors, G5), and on a split flags M and M′ on each other; nothing below M is read. A re-home (G6) may move objects or member clusters between containers; then the same copies are made at every level where the two containers' chains differ. Every such move also flags the old cluster on the new one, at each of those levels: what stays behind may reference what moved, and that edge crosses now. (Found by the fuzzer: an object re-homed to another meta-region was still referenced from a sibling region of its old one.) Flags are deleted only (a) after a complete scan of their source cluster in the same transaction found no edge into the target cluster, or (b) when their source cluster no longer exists. *Verified:* oracle.
*Why it matters:* referrer lookup for objects (checks, quick swap, replacement parents) reads only the target's own region and its flagged source regions; the check of a suspended cluster at level k reads only the sources flagged on it at level k. G2 makes both complete.

**G5. Mirrors.** A flag `e/<T>/<S>` whose source S is a meta-region has the mirror `E/<S>/<T>`, and every mirror has its flag.
*Maintained by:* `ensureFlag` and `deleteFlag`. *Verified:* oracle.
*Why it matters:* a meta-region split or merge finds the flags naming it without reading anything else.

**G6. Re-homing is scheduled.** When an object gets a tree parent in another region than its own (quick swap, a rescue, a cancelled deferral, a replacement parent), its region gets a re-home task `x/<R>`. The task finds where the cluster hangs from, by its `P/` keys: the source with the most tree edges into it is its home (the cluster holding ROOT has none). What hangs from another source moves there: at level 0 the internal subtrees of the objects whose tree parent is in that region, into it if they fit, else into a small region hanging only from it, else into a new region beside it; above level 0 the members hanging from that meta-region, with the members hanging from those. Each task then schedules the same question for its container. Re-home tasks run only when no other structure task is pending, so a move that is undone first costs nothing.
*Maintained by:* `GcState.updateMeta` schedules; `regions.js` (`runRehomeTask`) runs. *Verified:* re-homing is an optimization, so there is no oracle check that it has happened; the moves it makes are covered by the oracle's checks of H1, G1, G2, G5, A1 and A2, and the fuzzer runs a quarter of its seeds with it turned off (`rehome: false`).
*Why it matters:* a cluster can be suspended only when no tree edge enters it from outside (U2). A region hanging from two places cannot be suspended when one of them is deleted, and marking falls back to object by object (`tools/fragmentation.js` measures it).

**A1. Aggregated counters.** Every cluster's record counts the objects inside it at any depth: `objects`, `deferred`, and `explicit` (per cohort id, the explicitly unstable ones), equal to a recount.
*Maintained by:* `GcState.updateMeta`, the one place where an object's region, tree parent, cohort or deferral changes (O(levels) writes); meta-region moves transfer a member's counts, from every container it leaves to every container it joins; whole-cluster reclaim subtracts the cluster's counts from its containers at once. *Verified:* oracle.

**A3. Region weight.** A level-0 region's record has its weight: its objects plus their outgoing strong edges, equal to a recount.
*Maintained by:* the barrier (one per edge added or removed), `setRegion` (placement and moves), `deleteObject`. *Verified:* oracle.
*Why it matters:* a structure task is scheduled only when the weight says there may be something to do (G3), and it need not read the region to learn its weight.

**Y1. The edge index follows the records.** In a store with the edge index (the `edgeIndex` option, on by default; the store says so in `meta/edgeIndex`), the key `y/<region(a)>/<a>/<b>` exists with value n if and only if the record of `a` references `b` strongly n times. Weak references are not in it. A store without the index has no `y/` keys.
*Maintained by:* the barrier (`indexEdge`, for every reference count the transaction changed), `setRegion` (an object's edge keys move with it, since they are clustered by its region), `deleteObject` and `deleteClusterWhole`. *Verified:* oracle; the fuzzer runs half its seeds with the index and half without.
*Why it matters:* with the index, everything the collector needs from the edges is one range read per region (`edgesOfRegion`, `outgoing`), and it never reads an object record (design §5.5, implementation B). Without it, it reads the records of a region's members (A). The collector logic is the same for both.

**A2. Tree-edge counts.** `T/<X>/<Y>` counts the tree edges from objects inside X to objects inside Y, for every pair of different clusters at the same level that some tree edge connects (at every level up to where the two ends' chains meet), and `P/<Y>/<X>` mirrors it.
*Maintained by:* `updateMeta` (a tree parent or region change), meta-region moves (from the member's own counts one level down). *Verified:* oracle.
*Why it matters:* a cluster with no `P/` key hangs from nothing outside it, which is half of being suspendable (U2), and a suspended cluster's exits are found by descending only into members with `T/` keys leaving it (U3).

**G3. Pending structure work.** A cluster that may need restructuring has a structure task key `s/<X>`: a region whose weight (A3) is over the cap after a change, or fell below a quarter of it; a meta-region that gained or lost a member; a new cluster. In particular, an empty cluster other than `r0` has one, and is deleted when the task runs, unless it is inside a suspended or resumed-and-expanding cluster: structure tasks skip those, and ending the suspension or expansion schedules every cluster inside.
*Maintained by:* `addWeight`, `newCluster` and `detachCluster` schedule; the collector runs structure tasks, which split a region heavier than `regionCap` or a meta-region with more than `clusterCap` members, merge one lighter than a quarter of that (or a meta-region with a single member) into the cluster it hangs from in the same container, and delete an empty one. Deleting a top-level cluster schedules the remaining ones, so that a single one left is dissolved. *Verified:* oracle (empty clusters); the fuzzer requires no structure keys when idle.

**G4. Structure tasks only move membership.** Splits, merges and region deletion change `g/<id>.region`, membership keys, flags and region records, and nothing else: no tree parent, no cohort, no deferral, no record. So they cannot make anything look reachable or unreachable. They leave a cluster alone while it, or a cluster containing it, is suspended (moving a member out would make it stable, merging one in would make it unstable), never merge into one, and leave alone a resumed cluster whose expansion is pending (a member moved out would never be expanded; found by the fuzzer).
*Maintained by:* the code of `split` and `merge`, and `runStructureTask`'s guards. *Verified:* the oracle's tree and cohort checks run after every structure task.

## 3.7 Safety and completeness

**S1. Reclaim only closed cohorts.** A root cohort is reclaimed only when its expand, mark and check lists are all empty. Then:
- every member is marked (M1) and checked (K1);
- every member's referrers were fellow members when it was checked;
- every fellow member that has left since was expanded or merged in (E1);
- no stable object gained an edge to a marked member since its check, because the barrier would have rescued it (D1), and an unmarked member cannot exist (M1);
- no stable object references a member at all (M3, with every list empty);
- every suspended cluster's implicit members were checked as a unit, by its item (U3), and any change since materialized it (U4).

So **no member is referenced by any object outside the cohort**, and no member is reachable. The cohort enters the state `reclaiming` and its members are dead (C3). They are deleted a budget at a time (B1): first the clusters suspended in it, one level-0 region per piece, each deleted whole with its record, flags and counts, and its counters subtracted from its containers (design §8.3); then its explicit members outside them; then the cohort records. A small cohort goes in the step that closed it. While a suspended cluster is half deleted, the tree and the tree-edge counts inside it are not kept up; nothing reads them, and the oracle passes over dead objects.

*Maintained by:* the ladder order (`Collector.ladder`). *Verified:* the fuzzer computes reachability from ROOT at every reclaim and fails if any reclaimed object is reachable.

**B1. Bounded steps.** One collector step takes on at most `stepBudget` items: a check batch has at most that many items, a mark step detaches at most that many tree children of its object, and a reclaim step deletes about that many objects (it finishes the region it is in).
*Maintained by:* `Collector.finish`, `ladder`, `mark`, `reclaim`. *Verified:* the fuzzer varies the budget from 1 to 200.
*Not bounded yet:* materializing a cluster and expanding a resumed one read all of it; marking and checking a suspended cluster grow with its boundary; a structure task reads one region.

**S2. Completeness when idle.** When no active cohort and no deferral exists, the stored objects are exactly the reachable ones, and every object reaches ROOT through tree parents.
*Verified:* the fuzzer, at the end of every run.

**L1. Liveness.** A cohort that no transaction touches finishes in a finite number of steps: each object is marked at most once per cut, every rescue removes a member, and merges only reduce the number of cohorts. A cohort can be held back indefinitely only by transactions that keep cutting and rescuing its members.
*Verified:* the fuzzer runs the collector to idle with a step limit.

## 3.8 Suspension

These come with suspension (design §8): marking, checking, resuming and reclaiming a whole cluster at once, at any level. A suspended cluster's record says `suspended: { cohort, marked }`, and the key `S/<cohort>/<cluster>` indexes it under the cohort id it was suspended in.

**U1. Suspension is indexed.** A cluster is suspended in cohort id `k` if and only if `S/<k>/<cluster>` exists, and `k` resolves to an existing root cohort. The cluster holding ROOT is never suspended.
*Maintained by:* `suspend`, `unsuspend` (used by `resume` and `materialize`), reclaim. *Verified:* oracle.

**U2. A suspended cluster is condemned as a whole.** Every object inside a cluster suspended in C is either explicitly unstable in C, or an implicit member: not deferred, with its tree parent inside the cluster. Following tree parents from an implicit member therefore stays in the cluster and ends at an anchor in C.
*Maintained by:* `suspendable` allows a cluster only where this holds, read from its counters in O(1) (A1, A2): no `P/` key (no tree edge enters it), `deferred = 0`, every cohort in `explicit` resolves to C, and not every object is explicit already. Nor may C have materialized it before, which would otherwise suspend and materialize the same cluster forever. When marking pops an object, the highest cluster in its chain that qualifies is suspended. Afterwards nothing changes an implicit member without materializing first (U4). New objects referenced only from implicit members join C explicitly. *Verified:* oracle.

**U3. A marked suspended cluster has no tree exits.** Once its item has been marked (`marked: true`), no object inside the cluster has a tree child outside it. Marking the item cut those edges exactly as marking the objects one by one would have, with replacement parents for shared children; the edges inside the cluster stay. The exits are found by descending from the cluster only into members with `T/` keys that leave it (A2).
*Maintained by:* `Collector.markRegion`. *Verified:* oracle.

**U5. Suspensions do not nest.** No suspended cluster is inside another suspended cluster. A cluster suspended in C takes over the clusters inside it that were suspended in C: their suspensions end, their items leave C's lists, and its own item stands for them. (Inside it there can be no cluster suspended in another cohort: that cluster's anchors would be explicit in that cohort, and U2 would not allow the suspension.)
*Maintained by:* `GcState.suspend`. *Verified:* oracle.

**U4. Changes materialize.** Anything that would change an implicit member, or give the cluster a stable referrer, ends the suspension first:
- **resume:** rescuing the cluster's only anchor makes every object in it stable again with its internal tree, and queues the cluster for expansion;
- **materialize:** in every other case (an edge added from a stable object to an implicit member, a tree edge cut inside the cluster, a stable referrer found by the cluster's check, an anchor rescued while others remain), implicit members turn stale-stable, anchors go back to the mark and check lists (M1, M2), and what the members reference is queued for checking again (M3). This reads the whole cluster.

The check of a suspended cluster at level k starts from the sources flagged on it at level k (G2), and skips wholesale a source that is inside a cluster suspended in the same cohort. It does not scan a flagged meta-region whole, which can be far bigger than the cluster (the top-level cluster holding the parent of a deleted branch): it narrows each pair (target, source) one level down, to the target members' flags that name clusters inside the source, and scans level-0 source regions only. By G2, a pair with nothing below it has no edge, and its flag is deleted.

*Maintained by:* `GcState.rescue`, the barrier, `Collector.checkRegion`. *Verified:* oracle (U2 and M3 after every step); safety at every reclaim.

## 3.9 Corollaries

These follow from the invariants above. They are not checked one by one; the oracle checks what they rest on. They hold at every commit boundary.

**1. A tree path to ROOT proves reachability.** If following tree parents from an object ends at ROOT, the object is reachable.
*From:* T2 (every tree edge is a strong edge).

**2. Stable does not mean reachable.** A stable object is either on a tree path to ROOT, or **stale-stable**: its tree path ends at a deferred object or at an unstable object that is not yet marked. A stale-stable object may be reachable or not; nothing has looked yet. There can be a strong reference from ROOT to an object whose tree path does not reach ROOT: the reference is simply not the tree edge.
*From:* T3, T4.

**3. Garbage is always accounted for.** Every unreachable object is unstable, or stale-stable below a deferred object or an unmarked unstable object. So no garbage exists without pending work that will reach it: a due deferral (F2), a mark item (M1), or the cohort it is in. This includes cycles, since a cycle cannot hold itself up in the tree.
*From:* corollary 1 (an unreachable object's tree path cannot end at ROOT) and T4 (acyclic, and it must end somewhere).

**4. Unstable does not mean garbage.** A reachable object may be unstable for a while. But a cohort with a reachable member always has work pending (an expand, mark or check item), so it is not reclaimed.
*From:* S1, read backwards.

**5. A reference to a stale-stable object is never lost.** If a stable object gets a reference to a stale-stable object `t`, the barrier does nothing. When marking reaches `t`, either the replacement-parent search re-parents it under a verified referrer (W1), or `t` becomes unstable with its check pending, and the check finds the referrer.
*From:* M1, M2, K1, W2 (the new reference sets the shared bit, so the search runs).

**6. Objects created under a stale-stable object are safe.** A new object placed below a stale-stable parent is on a tree path that ends where its parent's does. If the parent turns out to be garbage, marking reaches the new object through that tree edge; if it is rescued or re-parented, the new object is certified with it.
*From:* T4, M1.

**7. A cut is cheap for the application.** A transaction that removes a tree edge writes the metadata of the cut object only, plus the counters and tree-edge counts of its clusters: O(levels), whatever the size of the subtree below. Deciding what is still reachable is left to the collector.
*From:* F1, A1, A2 (and with `deferCuts: false`, `makeUnstable`, which also touches only that object).

**8. A suspended cluster is cut off from the tree.** No tree edge enters a suspended cluster from outside, and once it is marked none leaves it. So the tree inside it can be kept or deleted as a unit without touching anything outside.
*From:* U2 (implicit members hang from inside, explicit ones have no tree parent), U3.

**9. When idle, the tree is a spanning tree.** With no active cohort and no deferral, every stored object is reachable and reaches ROOT through tree parents, and nothing unreachable is stored.
*From:* S2, with T3 and T4.

**10. The order of collector steps does not matter for correctness.** Which cohort runs next, how many steps run between transactions, and when structure and re-home tasks run change only when garbage is reclaimed and how much work it takes. Nothing reachable is ever reclaimed under any order, and reclaiming a cohort leaves no dangling strong reference.
*From:* the transaction principle (§1), S1, G4, R2.

---

# 4. Invariants of planned mechanisms

These come with later steps of the prototype plan (design §16.3). They are listed so that each new mechanism is added together with its invariant and its oracle check. None is implemented yet.

| Mechanism (design section) | Invariant |
|---|---|
| Intactness (§6.8) | **Intactness** (`foreignParented`, `pendingMark`, `stableAnchors`) equals a recount. Walks that jump across intact clusters (§9.5) need these. (Suspension uses the simpler counters of A1 and A2, and re-homing reads the `P/` keys.) |
| Flag coarsening and refining (§6.6) | **Bounded flags:** a cluster has at most about `K` flags. **Refining:** while a coarse flag is being refined by a multi-step scan, the barrier also writes the fine flag for every edge it covers. (Today flags are unbounded and every scan runs in one transaction.) |
| Multi-step scans (§10.1) | **Scan lock:** no structure task moves objects into or out of a cluster with `scanning > 0`. |

---

# 5. How to add a mechanism

1. State its invariant here, before writing the code.
2. Make every transaction that touches the mechanism's keys preserve it, in the same transaction.
3. Add a check to `checkIntegrity` where the invariant can be checked mechanically, and a fuzzer operation that exercises it.
4. Run `node tools/sweep.js 1 1000` with several `maxSteps` values.

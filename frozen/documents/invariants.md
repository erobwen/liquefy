# Invariants

This document states the invariants of the frozen object store and its garbage collector as precisely as possible. It is the reference for the code in `frozen/src`, and for the design in `persistent-garbage-collection.md` ("the design").

---

# 1. The transaction principle

> **Every operation on the database is one store transaction. Every transaction, taken as a whole, preserves every invariant in this document.**

There are exactly two kinds of operation, and both follow the principle:

| Operation | What it does in one transaction |
|---|---|
| **Application transaction** | the application's writes to object records, *plus* the write barrier, which brings all GC metadata in line with those writes |
| **Collector step** | one step of one cohort's ladder (expand, mark, check or reclaim) |

Consequences:

- **Invariants hold at every commit boundary.** Inside a transaction they may be temporarily broken: the application writes records first, the barrier repairs the metadata afterwards. Nothing outside the transaction can observe the broken state, because nothing outside sees uncommitted writes.
- **Crash consistency is inherited.** The store commits a transaction atomically. A crash therefore leaves the store at the last commit boundary, where every invariant holds. No recovery procedure is needed beyond what the store does itself.
- **No GC state lives outside the store.** Worklists, cohorts and the id counter are keys. In-memory state, such as the scheduler's round-robin cursor, is only an optimization: losing it changes the order of work, never its correctness.
- **A transaction that throws writes nothing.** The barrier may refuse a transaction (for example, a strong reference to a missing object); then the application's writes are discarded too.

The store's own guarantee (`MemoryStore`, later LMDB or SQLite): a transaction's writes are applied all together or not at all; reads inside a transaction see its own writes; there is a single writer, so transactions do not interleave.

For a store that can only write *one record* atomically, the principle can still be kept with a redo log, as the earlier `eternity` prototype did: write the transaction's buffered writes as one record, apply them, then delete the record, and replay it on startup if present. Every write is a put or a delete, so replay is idempotent. (Not implemented; not needed for LMDB or SQLite.)

---

# 2. Definitions

- **Object:** an id with a record `o/<id>`. `ROOT` always exists.
- **Strong edge** `s → t`: the record of `s` contains `ref(t)` somewhere, at least once. Weak references (`weak(t)`) are not edges.
- **Reachable:** there is a path of strong edges from `ROOT`.
- **State** of an object, from its metadata `g/<id> = { treeParent, cohort }`:
  - **stable** if `cohort` is null;
  - **unstable in C** if `cohort` is set, where C is the surviving cohort found by following `mergedInto` links (union-find).
- **Tree edge** `p → c`: `g/c.treeParent = p`.
- **Marked:** an unstable object with no tree children. **Unmarked:** an unstable object that still has tree children.
- **Root cohort:** a cohort record with `mergedInto = null`. Only root cohorts have worklists.
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

**T3. Exactly the stable, non-deferred objects have tree parents.** A non-ROOT object has a tree parent if and only if it is stable and not deferred (F1). ROOT is stable and has no tree parent.
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

**C2. Merges are union-find.** A merged cohort record has `mergedInto` set, empty worklists, and is listed in the `absorbed` list of its root. Membership keys stay under the id the object joined with; the root's family (`[root, ...absorbed]`) covers them all.
*Maintained by:* `GcState.merge`. *Verified:* oracle (membership keys resolve), reclaim (stale-key check throws).

**C3. Merging is only for active cohorts.** A cohort in state `reclaiming` is never merged, and never gains members.
*Maintained by:* the barrier refuses edges to or from objects of a reclaiming cohort; reclaim is a single step, so no other step sees the `reclaiming` state. *Verified:* `merge` throws.

## 3.4 Work obligations

These say what a cohort still owes before it may be reclaimed. They are what makes the reclaim condition (S1) sound.

**M1. Mark obligation.** Every unmarked unstable object is on its root cohort's mark list.
*Maintained by:* `makeUnstable` pushes the object to `mark` in the same transaction; merges concatenate lists; nothing else gives an unstable object tree children. *Verified:* oracle.

**K1. Check obligation.** Every unstable object is either checked, or on its root cohort's check list.
*Maintained by:* `makeUnstable` and `joinCohort` push to `check`; merges concatenate lists; a check batch removes items only by checking them (or by finding them rescued or reclaimed). *Verified:* indirectly, by the safety oracle.

**E1. Expand obligation.** Let `m` be a checked member of cohort C, checked while counting `r` as a fellow member. If `r` has since been rescued, then one of these holds:
- C's expand list contains `r`, or
- `r` has been expanded while stable, which rescued `m` if `m` was marked, or left `m` to its pending check if not (D1), or
- C has been merged with the cohort `r` is now unstable in.

*Maintained by:* `rescue` pushes the rescued object to the expand list of the cohort it leaves. When an expand item finds its object unstable in another cohort, the two cohorts merge (`Collector.expand`). This last rule was found by the fuzzer; without it, an expansion can move out of C's sight and C reclaims a reachable object.
*Verified:* indirectly, by the safety oracle.

**D1. Rescue only marked objects, only from stable objects.** An unstable object becomes stable only through `rescue(o, s)`, and only if `s` is stable and `o` has no tree children. An unmarked object that gets a stable referrer is left alone: by K1 and M1 it will be checked after marking, and the check finds the same referrer.
*Maintained by:* `canRescue` guards the barrier and expansion; `rescue` throws otherwise. *Verified:* `rescue` throws; T4 in the oracle.

## 3.5 Avoiding needless marking

These come with quick swap, deferred cuts and replacement parents (design §9.2, §9.3, §9.5, §10.2).

**F1. Deferred cuts are recorded.** A non-ROOT stable object has a null tree parent if and only if it is **deferred**: its metadata has `deferred = { kind, at }`, and exactly one deadline key exists for it:
- `d/<at>/<id>` for `kind: "tx"`, a deadline on the logical clock (the number of application transactions);
- `h/<at>/<id>` for `kind: "ms"`, a deadline in wall-clock milliseconds.

A deferred object is stale-stable: it still counts as stable everywhere, but its certificate is pending.
*Maintained by:* the barrier defers a cut it cannot quick-swap; the collector resolves a due deferral by a quick swap or by starting a cohort; a later added edge may cancel it; `release` moves its deadline to now. Each of these updates the metadata and the deadline key in the same transaction. *Verified:* oracle.

**F2. Deferrals are resolved.** Every deferral is resolved by the collector once its clock reaches its deadline, unless it is cancelled first.
*Maintained by:* the scheduler runs due deferrals before cohort steps. *Verified:* the fuzzer requires no deadline keys when idle.

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

## 3.6 Safety and completeness

**S1. Reclaim only closed cohorts.** A root cohort is reclaimed only when its expand, mark and check lists are all empty. Then:
- every member is marked (M1) and checked (K1);
- every member's referrers were fellow members when it was checked;
- every fellow member that has left since was expanded or merged in (E1);
- no stable object gained an edge to a marked member since its check, because the barrier would have rescued it (D1), and an unmarked member cannot exist (M1).

So **no member is referenced by any object outside the cohort**, and no member is reachable.

*Maintained by:* the ladder order (`Collector.ladder`). *Verified:* the fuzzer computes reachability from ROOT at every reclaim and fails if any reclaimed object is reachable.

**S2. Completeness when idle.** When no active cohort and no deferral exists, the stored objects are exactly the reachable ones, and every object reaches ROOT through tree parents.
*Verified:* the fuzzer, at the end of every run.

**L1. Liveness.** A cohort that no transaction touches finishes in a finite number of steps: each object is marked at most once per cut, every rescue removes a member, and merges only reduce the number of cohorts. A cohort can be held back indefinitely only by transactions that keep cutting and rescuing its members.
*Verified:* the fuzzer runs the collector to idle with a step limit.

---

# 4. Invariants of planned mechanisms

These come with later steps of the prototype plan (design §16.3). They are listed so that each new mechanism is added together with its invariant and its oracle check. None is implemented yet.

| Mechanism (design section) | Invariant |
|---|---|
| Regions (§6) | **Membership:** every object is in exactly one level-0 region; `g/` region field and `m/` keys agree. **Intactness counters** equal a recount. |
| Entry flags (§6.6) | **Coverage:** every strong edge between different clusters is covered by a flag at each level where the clusters differ. Flags may be stale; coverage is never missing. A flag is deleted only after a complete scan of its source. |
| Multi-step scans (§10.1) | **Scan lock:** no structure task moves objects into or out of a cluster with `scanning > 0`. |
| Suspension (§8) | **Suspension:** a suspended region's implicit members have the same tree edges as when it was suspended; any change materializes it first. |
| Structure tasks (§6.4–6.7) | **Membership only:** splits, merges, re-homes and coarsening never change a tree parent or a cohort. |
| `y/` edge index (§5.5) | **Index:** `y/<region(a)>/<a>/<b>` exists with count n if and only if `a`'s record references `b` strongly n times. |

---

# 5. How to add a mechanism

1. State its invariant here, before writing the code.
2. Make every transaction that touches the mechanism's keys preserve it, in the same transaction.
3. Add a check to `checkIntegrity` where the invariant can be checked mechanically, and a fuzzer operation that exercises it.
4. Run `node tools/sweep.js 1 1000` with several `maxSteps` values.

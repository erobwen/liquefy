# Persistent Garbage Collection, Variant B: Region Tracing
## The spanning tree at region granularity, tracing inside regions

**Status:** Design sketch for comparison with variant A  
**Date:** November 2026  
**Companion:** `persistent-garbage-collection.md` (variant A). Sections cited as "A §n" refer to it.

---

# 1. The idea

Variant A maintains a spanning tree over **objects** and repairs it edge by edge. Variant B maintains the spanning tree over **regions** only, and inside a region it does what partitioned collectors do: load the region and trace it.

The reasoning: a region is about 100 objects and a few KB of edges. Tracing it costs about the same as one check in A. If a region trace is that cheap, the object-level machinery of A exists to avoid a cost that is not worth avoiding:

| Mechanism in A | Purpose in A | In B |
|---|---|---|
| `treeParent` per object, `t/` keys | certify each object's reachability | gone; a region trace certifies its members |
| object-level marking | spread instability through a subtree | gone; a trace finds the dead set directly |
| quick swap, replacement parent, `shared` bit | avoid marking subtrees that are still reachable | gone; the trace simply reaches them |
| object-level deferred cuts | cancel a cut-then-relink | kept, but as a *deferred re-trace* of the region |
| intactness counters, materialize | keep regions usable as units | gone; a region is always consistent after its trace |
| verified walk through objects | prevent object-level tree cycles | kept at region level only |

What stays from A: the store (A §4), weak references (A §4.4), entry flags (A §6.6), the shared-font argument (A §5), cohorts and merging (A §7.2), suspension and resume (A §8), reclaim condition (A §10.3), meta-regions (A §6.9) layered over the region tree, the fuzzer and oracle (A §16).

What B gives up: O(1) handling of a cut inside a region. Every structural change inside a region costs one region trace, O(CAP). Deferral batches those, so the realistic cost is one trace per region per deferral window.

What B gains: much less maintained state. Liveness inside a region is recomputed from scratch by every trace, so object-level metadata cannot drift. Only the region tree, the anchors and the flags are maintained, and those are small and few.

---

# 2. State

## 2.1 Per object

`g/<obj>` holds `{region, cohort}`. No tree parent, no shared bit. An object is **live** when its cohort field is unset and its region is not suspended. Liveness within a region is defined by the region's last trace.

## 2.2 Per region

```js
{
  id, level, container,      // as in A §6.10
  parentRegion,              // the region whose live objects anchor this one (null for the root region)
  anchorCount,               // number of (p → a) edges with p a member of parentRegion and a a member of R
  extraSources,              // regions other than parentRegion whose live objects reference members of R
                             //   that the last trace could only reach through them (§4.3); usually empty
  weight,                    // objects + edges
  pendingTrace,              // deadline of a scheduled re-trace, or null
  suspendedIn,               // cohort id or null
  deadCount,                 // members currently in a cohort
}
```

Plus these keys:

- `a/<R>/<obj>` → count: the **anchors** of R, the members referenced from `parentRegion`, with the number of such edges. Maintained by the barrier.
- `k/<P>/<R>`: child index, the inverse of `parentRegion`.
- `e/<R>/<C>`: entry flags, exactly as in A §6.6.
- `y/<R>/<src>/<tgt>` or object records, behind `edgesOfRegion(R)` (A §5.5).

The **contracted tree** is the `parentRegion` links. It is the only spanning tree in B. The root region holds ROOT and has no parent.

## 2.3 What certifies reachability

An object `o` in region R is reachable if:

- the chain `R → R.parentRegion → … → root region` exists, each link having `anchorCount > 0` and the source region not suspended, and
- `o` is reachable *within R* from R's anchors, which is what the last trace established.

Anchors are referenced from members of `parentRegion`. Those members may themselves be dead in `parentRegion`. B handles that the way A handles stale-stable objects: a region whose parent has a pending trace is **stale-live**, which is safe, because the parent's trace will propagate down (§4.2).

---

# 3. The region trace

```text
trace(R):                               // one collector step, one transaction
    edges  = edgesOfRegion(R)           // a few KB
    roots  = anchors of R (a/R/*) ∪ members referenced from a live object of an extraSource region
    live   = reachable from roots along edges whose target is in R
    dead   = members(R) − live

    for each d in dead that is not yet in a cohort:
        put d in cohort C (new, or R's current one); push d to C.check
    for each l in live that is in a cohort:                      // rescued by a new edge, see §5.1
        remove l from its cohort; push l to C.expand (§6)

    // propagate to child regions
    for each child S of R (k/R/*):
        for each edge (d → s) with d in dead, s in S:            // these are in `edges`
            decrement a/S/s; if it reaches 0, S.anchorCount--
        if S.anchorCount == 0: suspend-or-replace(S)             // §4.3
        else if any anchor of S was removed: schedule trace(S)   // deferred, §5.3
```

Cost: one read of R's edges plus O(|R|) in memory, plus one write per object whose liveness changed and one write per anchor count that changed. A trace that changes nothing writes nothing.

The trace also yields a BFS tree from the anchors. Splits use it as the tree to find a centroid in (§7), so no persistent tree is needed for that either.

---

# 4. Region-level operations

## 4.1 Suspension

When `S.anchorCount` drops to 0 and §4.3 finds no replacement, S is **suspended** in cohort C: `S.suspendedIn = C`, and S's whole live set is unstable at once. Its child regions are then suspended recursively, through `k/S/*`, without reading any objects. This is A §8.1 without the intactness condition, because in B every region is a branch of the contracted tree by construction.

A suspended region is pushed to `C.check`.

## 4.2 Resume

When a suspended region S gets back an anchor from a live object in a region that is not in the cohort, S is resumed: `suspendedIn = null`, `parentRegion` set to the new source if it differs (after the walk of §4.4), and `trace(S)` is scheduled. The trace establishes the live set from the new anchors; members it does not reach go to the cohort. Child regions resume through the anchor propagation in the trace. A multi-anchor region that gets only some anchors back needs no special case: the trace from the surviving anchors is the answer.

## 4.3 Replacement parent, at region level

Before suspending S, look at `e/S/*`. For each flagged source Q that is not in the cohort and not suspended:

- read `edgesOfRegion(Q)`, filter for edges into S from live objects of Q;
- if any exist and Q passes the walk (§4.4), re-parent S under Q: `parentRegion = Q`, rebuild `a/S/*` from those edges, schedule `trace(S)`.

If no flagged source qualifies, suspend. This is the only "search" in B. It reads a few regions.

## 4.4 The region walk

Re-parenting S under Q must not create a cycle in the contracted tree. Walk `Q → Q.parentRegion → …`:

- fail if the walk reaches S;
- fail if it reaches a region that is suspended, or in any cohort;
- succeed at the root region, or at a region whose trace is pending (a deferred cut; S then joins that region's fate, as in A §9.5).

The walk is O(region depth), or O(levels) with meta-regions, which may jump over an intact meta-region exactly as in A §9.5. There is no object-level walk anywhere in B.

## 4.5 Reclamation

As in A §8.3: a suspended region is deleted by range; explicit dead objects of a live region are deleted individually. Nothing outside the region is touched, and flags naming it go stale and are cleaned up lazily.

---

# 5. The write barrier

Much lighter than A's. At commit, for the net edge diff:

## 5.1 Added edge `s → t`

| Where | Action |
|---|---|
| same region | nothing, unless `t` is dead (in a cohort): then push `t` to the cohort's expand list (§6). |
| `region(s) = parentRegion(region(t))` | increment `a/region(t)/t`; if it was 0, `anchorCount++`. If `t` is dead, push to expand. If `region(t)` is suspended, resume it (§4.2). |
| other cross-region | ensure flags cover it (A §6.6). If `t` is dead and `s` is live: push `t` to expand after re-parenting `region(t)` under `region(s)` if `region(t)` is suspended, or adding `region(s)` to `extraSources` if it is not. If `s` is dead in another cohort: merge cohorts. |

No tree maintenance, no walk, no shared bit. The flag lookup is the only cross-region cost.

## 5.2 Removed edge `s → t`

| Where | Action |
|---|---|
| same region | schedule a deferred trace of `region(t)` (§5.3). |
| `region(s) = parentRegion(region(t))` | decrement `a/region(t)/t`; if it reaches 0, `anchorCount--`. If `anchorCount` is now 0, schedule a deferred trace of `region(t)` whose outcome will be §4.3. Otherwise schedule a deferred trace. |
| other cross-region | if `region(s)` is in `extraSources` of `region(t)`: schedule a deferred trace. Otherwise nothing. |

## 5.3 Deferred traces

A scheduled trace is recorded under `d/<deadline>/<region>` and in `pendingTrace`. Several removals in the same region within the window cost one trace. An added edge does not cancel the trace, because the trace is what proves the region consistent again; but it makes the trace cheap, since it finds nothing dead.

During the window the region is **stale-live**: its members still count as live, including for rescuing objects elsewhere. That is safe for the same reason as in A §7.3: the pending trace will take any wrongly rescued object down with it, through the anchor propagation of §3.

---

# 6. The collector loop

The same scheduler and ladder as A §10.1, with the items being regions and dead objects:

```js
function step(c) {
    if (c.expand.length) return expandNext(c);   // a rescued object or resumed region: trace from it
    if (c.trace.length)  return traceNext(c);    // regions whose trace is due (replaces "mark")
    if (c.check.length)  return checkNext(c);    // dead objects / suspended regions: look for stable referrers
    return reclaim(c);
}
```

| Step | What it does |
|---|---|
| **expand** on object `o` | trace within `region(o)` from `o` alone: dead members it reaches become live and are removed from the cohort; edges it finds into child regions re-add anchors there, which may resume them. |
| **expand** on region R | R just resumed: `trace(R)`. |
| **trace** on region R | `trace(R)` (§3). Replaces marking: the dead set is computed, not propagated edge by edge. |
| **check** on R's dead batch | as A §10.2: read `edgesOfRegion(C)` for each flag `e/R/C` whose source is not in the cohort; a live referrer rescues its target (push to expand); a referrer in another active cohort merges. A complete scan that found nothing deletes the flag. |
| **check** on suspended R | §4.3 again with the full flag list, then skip sources suspended in the same cohort. |
| **reclaim** | §4.5. |

The reclaim condition is A §10.3 unchanged: all lists empty means every dead object's referrers were found to be in the cohort, local ones by the trace, external ones by the flag scans.

Structure tasks (split, merge, coarsen) obey the same locking as A §10.1: not on suspended regions, not on regions with dead members, not on sources of an in-progress scan.

---

# 7. Regions: placement, split, merge

- **Placement:** a new object goes into the region of the object that references it, as in A §6.3. If that region is full it still goes there; a split is scheduled.
- **Split:** `trace(R)` yields a BFS tree from the anchors. Find the centroid in that tree and move a subtree, exactly as A §6.4. The moved subtree's anchors are the edges from the centroid into it, so `R′.parentRegion = R` and `a/R′/*` is known from the trace. Edges into the moved set from elsewhere in R become... nothing special: R is R′'s parent, so those are anchor edges too. Flags are copied as in A §6.6.
- **Merge:** as A §6.5; anchors of the absorbed region become local edges.
- **Re-home:** not needed. There is no object-level tree to keep regions aligned with. A region whose members are referenced from several regions simply has `extraSources`; a split may later separate them.

Weight, `CAP`, chunking of large collections and the `y/` index are as in A §5.4–5.5.

---

# 8. Meta-regions

Layered over the contracted tree exactly as A §6.9, with the same per-level flags and the same copying rules on splits. The meta level is unchanged by the choice of B, because A's meta level never looked at objects either. The region walk (§4.4) jumps intact meta-regions. The one thing that simplifies: the aggregated intactness counters of A §6.8 reduce to "no member has `pendingTrace` set and none is suspended".

---

# 9. Worked examples

**Queue as a linked list.** `root → n1 → n2 → …`, with `n1..n100` in region R. Dequeue adds `root → n2` and removes `root → n1`. Barrier: `a/R/n2` becomes 1, `a/R/n1` becomes 0, `anchorCount` stays positive, a trace of R is deferred. At the deadline, one trace reads R's edges, finds `n1` dead, pushes it to check; the check finds no flags, `n1` is reclaimed. Cost per dequeue: one region trace, amortized over all dequeues in the window. A did this in O(1) with the replacement-parent search; B does it in O(CAP) with no search.

**Moving a paragraph between chapters.** Add `ch2 → para`, remove `ch1 → para`. If `ch1` and `ch2` are in the same region as `para`: one deferred trace that finds nothing dead. If `ch2` is in another region: a flag, and the trace finds `para` unreachable from R's anchors; its check finds `ch2` live, `para` is rescued and `region(ch2)` is added to `extraSources` of R. No re-home exists in B; a later split may put `para` in its own region under `region(ch2)`.

**Deleting a large document.** `root → Doc` removed; `Doc` was the only anchor of R0. `anchorCount` hits 0; deferred; at the deadline §4.3 finds no replacement, R0 is suspended, and suspension cascades through `k/` over the document's regions, O(regions) without reading objects. Checks on each suspended region read the flagged sources that are not in the cohort, typically the parent region only. Reclaim deletes by range. Identical to A.

**Relinking a huge structure later.** Removal: `anchorCount` of the top region hits 0, trace deferred. Addition from `newFolder`: the top region is re-parented under `region(newFolder)` after a region walk, anchors rebuilt from that one edge, trace scheduled. The trace of the top region finds everything live and changes no child anchors, so nothing propagates. A handful of key writes plus one region trace.

**The shared font.** As A §12.4: flags on F, no incoming keys anywhere, a split of F copies flags. If `fontCollection → fontA` is removed: a deferred trace of F finds `fontA` dead, its check scans the first flagged source, finds a live referrer, rescues it, and `extraSources` of F gains that region.

---

# 10. A versus B

| | A: object spanning tree | B: region tracing |
|---|---|---|
| Certificate of reachability | tree parent per object | contracted tree over regions + last trace per region |
| Metadata per object | `g/` with region, treeParent, cohort, shared; `t/` key | `g/` with region, cohort |
| Metadata per region | record + flags + `T/` counts + intactness counters | record + flags + anchors `a/` + child index `k/` |
| Cost of a cut inside a region | O(tree children), plus bounded searches | one region trace, O(CAP), batched by deferral |
| Cost of a big deletion | O(regions), O(boundary) with meta | same |
| Barrier | tree maintenance, walks, counters, flags | anchor counts, flags, scheduling |
| Searches that need a budget | quick swap, replacement parent, object walk | none at object level; region walk only |
| Self-correction | none; metadata drift is permanent | liveness inside a region is recomputed by every trace |
| Worst case | re-marking a subtree repeatedly | re-tracing a region repeatedly, bounded by CAP each |
| Mechanisms to get right | about twelve | about six |
| Where A is better | hot small structures inside one region that change constantly: A pays per edge, B pays a trace per window | — |
| Where B is better | everything else, by simplicity | — |

The honest summary: B keeps every part of A that operates on regions, which is where the scalability comes from, and deletes every part that operates on objects, which is where the complexity and the drift risk were. The price is O(CAP) instead of O(1) for structural changes within a region, paid once per region per deferral window. For a region of 100 objects and a few KB of edges that is about the cost of a single check in A.

---

# 11. Open questions specific to B

1. **Deferral window versus trace frequency.** A region under continuous edit is traced once per window. Is a window of seconds enough to keep the trace cost negligible for editing workloads? Measure traces per mutation.
2. **`extraSources` growth.** A region referenced from many other regions, for objects its own anchors do not reach, accumulates extra sources. Each trace reads them. A split that moves such objects under their real referrer keeps the list short; is that enough, or does B need a lightweight re-home after all?
3. **Trace in the barrier or in the collector?** All traces are deferred here. A synchronous trace on a cut would give A-like promptness for small regions at the cost of a region read inside the commit.
4. **Should the trace persist its BFS tree?** It would turn B back into A incrementally. Keep it transient unless splits turn out to need it often.

---

# 12. Prototype plan delta

Steps 1–2 of A §16.3 are shared. Then:

3. Regions with anchors and deferred traces, no flags: cuts, rescues and cohorts within and between regions with a parent-only reference pattern.
4. Flags, external checks, region-level replacement parent and the region walk.
5. Suspension cascade, resume, whole-region reclaim.
6. Split by trace-tree centroid, merge.
7. Meta-regions, if needed, as in A.
8. `y/` index and measurements, as in A, plus: traces per mutation, bytes per trace, and the A-versus-B comparison on the queue, paragraph-move, document-delete and font scenarios.

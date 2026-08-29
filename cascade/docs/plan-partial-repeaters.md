# Plan: partial-repeaters, child repeaters, and renderOnto

Status: **step 1 done** (every repeater always has a single default
partial - see "Implementation progress" below). Everything past that
(real child creation, `linkRepeater`, tree-based time, per-partial
reconciliation on rerun) is designed but not yet built.

Reference test: `src/test/renderOnto.js` - a draft, deliberately not
runnable yet (`linkRepeater` doesn't exist). It's the concrete scenario
this whole design is checked against.

## Why: renderOnto

The motivating use case isn't a UI framework specifically - `cascade` needs
to support things like a word processor, where a component renders itself
by mutating a shared "paper sequence" object (current last page, available
space on it) as if it owns its own slot in time. A `renderOnto` component
performs an *ordered sequence of mutations* onto a live target, where a
later step can read what an earlier step committed (a toolbar renders and
claims height, the parent measures what's left, the next component is
fitted to that). Getting "only invalidate from the point that actually
changed onward" right isn't an optimization here - redoing an entire long
document's layout because one measurement changed would be a real
usability problem, not just wasted CPU.

## Partial-repeaters: sub-time-slots within a repeater's own time

A "partial" is a sub-position within its owning repeater's declared time -
the same relationship stage1/stage2/stage3/stage4 have to each other via
flat declared `{time: N}` numbers, except partials are automatic and
positional: created implicitly whenever a repeater's code reaches a child
attachment point (creating a new child via `repeat`, or reattaching an
existing one via `linkRepeater`), never declared by the app.

Concretely, a repeater whose code does `P1; child(); P2; child(); P3`
produces the sequence `[partial1, child1, partial2, child2, partial3]`.
`partial2`'s writes are only visible to code positioned after it in the
sequence (child2, partial3) - exactly mirroring how a later `time` level
sees an earlier one's writings but not the other way around.

Why this has to exist, not just be an optimization: without distinct
sub-positions, *all* of a parent's own writes to the same property
(interleaved between children) collapse onto one slot, since today "time"
is only the flat number declared once per repeater. A child created between
two of the parent's writes has no way to see "value as of right before me"
vs. "right after me" - that's a data-correctness gap, confirmed by tracing
the renderOnto padding example (see that test file's comments for the
concrete before/after numbers).

A partial can never run independently - the owning repeater's code has to
execute in one go, so **invalidating a partial delegates straight to
invalidating its repeater** (`partial.invalidateAction()` calls
`repeater.invalidateAction()`).

## `linkRepeater`: pure reattachment, never a trigger

`linkRepeater(oldRepeater)` puts a previously-created repeater back into its
parent's child list at the current position. It never itself forces
execution:
- If the repeater is already invalid (something it reads changed), cascade's
  normal dirty-queue machinery refreshes it on its own schedule, independent
  of when `linkRepeater` happens to be called.
- If it's clean, linking is a no-op - no rerun, no state loss.

Component/child identity (which old repeater corresponds to which new
render call - i.e. React-style keys) is entirely the caller's
responsibility, not cascade's. This is a deliberate simplification over
`flow.core`'s old approach, which baked key/shape-matching logic
(`buildId`, `rebuildShapeAnalysis`) directly into the reactive engine
itself. Cascade only exposes the dumb primitive; a future component model
does the matching.

## Retracted vs. disposed

Two distinct, non-overlapping states for a repeater (or partial) that a
parent's rerun doesn't reference again:

- **Retracted**: all current effects/writings are retracted (same
  retract -> pending -> reconcile -> finalize shape already built for
  property writings), but it's *not* gone - re-linkable if a later rebuild
  renders it again.
- **Disposed**: permanently gone, will never run again. Matches the
  existing meaning of "disposed" already used in `flow.core` for components
  that will never be used again - deliberately not reusing that word for
  the temporary case.

Retracting a child ripples exactly like retracting any repeater's writings
does today: whatever the child wrote gets retracted, and anything observing
that data - even something entirely outside the parent/child tree - gets
correctly notified. See `renderOnto.js`'s case 3 (`external.marker`, read by
a third, unrelated repeater) for the concrete assertion.

## Rerun: partials get reused in place, not thrown away

Naive approach (rejected): eagerly retract-and-dispose the whole
partial/child sequence at invalidation time, the way `disposeChildren()`
does today. That would cause exactly the unnecessary invalidation avalanche
this whole feature exists to prevent.

Actual approach: process the previous run's sequence lazily, in step with
the parent's fresh re-execution. Right before re-running the code for slot
N, retract slot N's old partial into "pending" (same mechanism a property
writing already uses); the reads/writes that slice performs get reconciled
against it exactly the way a property write already reconciles against a
pending writing (same value -> quiet, relink, no invalidation; different ->
real replacement, invalidate). Extra old slots beyond what this run
produces get finalized (genuinely retracted) at the end - same as today's
end-of-run finalization for abandoned property writings.

## Time as tree position, not a flat number

Repeaters form a forest: independent top-level repeaters each still have a
flat declared `time` (as already built - stage1/stage2/etc.), but a
repeater created *as a child* has its declared `{time: N}` (if any)
superseded entirely by its position in the tree. Comparing two writings:
if they come from different root trees, compare root `time` numbers as
today; if they share a root, walk down to find where the trees diverge and
compare position there.

For now: "a really stupid solution" for time comparison - tree traversal,
no optimization. A `writing.time` plain number is no longer sufficient;
writings need to reference the repeater/partial that actually wrote them
(`writing.writer` or similar), with comparison done via that reference
rather than numeric `<=`. Not implemented yet - step 1 only introduced
partials that inherit their repeater's own flat time unchanged.

Future optimization (explicitly deferred): a chain across all leaves with
assigned comparison values for fast order-maintenance-style comparison,
once tree traversal actually becomes a bottleneck.

## Open question carried over: same-time writers

Two different repeaters at the same declared time, both touching the same
property - likely reframed rather than solved head-on once time is tree
position (see `docs/plan-time-aware-timelines.md`'s "Same-time writers"
section for the original discussion). Not revisited in detail yet.

## Implementation progress

**Step 1 (done): every repeater always has a single default partial.**
`createPartial(repeater)` in `cascade.js` - reads/writes always register on
`repeater.currentPartial`, never the repeater directly. With only one
partial ever existing, this is a pure shape change: 42/42 existing tests
still pass unchanged. Concretely:

- `repeater.currentPartial` replaces `repeater.sources`/`writings`/
  `pendingWritings` (those now live on the partial).
- `enterContext(partial)` instead of `enterContext(repeater)` in `refresh()`.
- A partial's `time()`/`isRecording` delegate to its repeater (`isRecording`
  via a getter, so the two never drift out of sync).
- `partial.invalidateAction()` delegates to `repeater.invalidateAction()`.
- `state.inRepeater` is now derived from `state.context.type === "partial"`
  (was `"repeater"`) - anything reading `state.context` and expecting it to
  *be* the repeater directly needs to go through `state.inRepeater` or
  `state.context.repeater` instead. Found and fixed one real case:
  `finalize()`'s `rebuildShapeAnalysis` lookup was reading `state.context`
  directly, which crashed once `state.context` became a partial.

**Real bug found and fixed while doing this**: `repeater.dispose()` moves
a repeater's writings into `pendingWritings` on the *outgoing* partial, but
`refresh()` was creating a brand new partial with empty `pendingWritings`,
losing that hand-off entirely - every write during a rerun took the
"create a brand new writing" path instead of reconciling, which broke the
pipeline test's cyclic-invalidation case (stage3 started spuriously
rerunning on an unrelated change). Fixed by having `refresh()` carry the
previous partial's `pendingWritings` into the new one. Worth remembering:
once a repeater can have *several* partials, this hand-off can no longer be
"the one previous partial" - it needs to match up by position (or child
identity) between the old sequence and the new one, which is exactly the
"process each partial at a time on rerun" mechanism described above, not
yet built.

**Step 2 (done): real child-repeater creation, `linkRepeater`, partial
splitting, and the lazy child-level reconciliation, all together** - these
turned out not to be separable the way the original list below assumed
(see "why linkRepeater needed reconciliation now, not later" below). 42/42
existing tests still pass; `renderOnto.js` no longer crashes but still
correctly fails on 4 wrong-value assertions, expected until tree-based time
lands (see that section above - Panel/Leaf never declare `{time: N}`, so
parent and child currently collide on the same flat time-0 slot).

Concretely, in `cascade.js`:

- `children`/`pendingChildren`: one linked list per repeater (`first`/
  `last`, nodes have `nextSibling`/`previousSibling`), holding both real
  child repeaters and partials, superseding the old array-based
  `children`/`addChild()`/`disposeChildren()` (removed - nothing exercised
  them once `meta_repeaters.js` was gone).
- `attachToCurrentParent(child)`: shared by `repeat()` (a brand new
  repeater) and `linkRepeater()` (an existing one, exported on `world`).
  Reclaims the child from `pendingChildren` if it's found there (no
  disposal, no notification - the child's own state was never touched),
  appends it to `children`, then closes the current partial and opens a
  fresh one for whatever parent code comes next.
- `dispose()` moves `children` to `pendingChildren` for a fresh run -
  O(direct children) to flag each moved node `listMembership = "pending"`
  (not free, but far cheaper than actually retracting/disposing any of
  them - see the bug below for why the flag has to be set eagerly here).
- `finalizeChildren(repeater)` (called at the end of `refresh()`, paired
  with `finalizeWritings`): anything still in `pendingChildren` - never
  reclaimed this run - is genuinely retracted (a partial just gets
  `finalizeWritings`; a real child repeater gets `dispose()` +
  `finalizeWritings` on its own current partial + recursively finalizing
  its own pending children + `retracted = true`).
- `refresh()` fix: it used to capture `activeContext`/`partial` in local
  variables and use them at the end (`finalizeWritings`, `leaveContext`).
  Once the repeater's own action can create children mid-execution
  (closing/reopening partials via `attachToCurrentParent`),
  `repeater.currentPartial` may have moved on to a *later* partial by the
  time the action returns - using the stale local variable threw "Context
  mismatch" from `leaveContext` the first time any repeater created a
  child. Fixed by reading `repeater.currentPartial` fresh after the action
  runs, not the originally-entered partial.
- `seekWriting` made self-healing: if every writing on a timeline has been
  retracted (`currentWriting === null`), it now reinstates a fresh time-0
  anchor itself rather than crashing - previously only `getOrCreateTimeline`
  did this, but `hasTimelineValue`/`readTimelineValue` look a timeline up
  directly without going through it first. Independent robustness fix,
  found via a real crash, not specific to child-repeaters.

**Real bug found and fixed while doing this** (via a standalone smoke
test, not caught by `renderOnto.js` since that was already failing on
tree-time grounds): `dispose()` originally moved `children` to
`pendingChildren` by just swapping the list container
(`this.pendingChildren = this.children`) without updating each node's
`listMembership`. `attachToCurrentParent`'s reclaim check
(`listMembership === "pending"`) then never fired, so a relinked child
never got unlinked from `pendingChildren` - it ended up structurally
present in both lists (its sibling pointers overwritten by the fresh
`appendToChildList`, while the old list's other pointers still expected it
there), and `finalizeChildren` found it still sitting in `pendingChildren`
and wrongly retracted it even though it had just been relinked. Fixed by
walking the list in `dispose()` and flagging each node `"pending"`
explicitly - cheap (O(direct children), no disposal), but not literally
free as first assumed.

Why "step 1: splitting + linkRepeater" and "step 2: per-partial
reconciliation" from the original list turned out to be the same step:
`linkRepeater` is meaningless without *some* form of "don't disturb a
child whose own inputs haven't changed," and the lazy pending/reclaim
mechanism above *is* that reconciliation - just at the child-attachment
granularity, not yet at the finer "compare a partial's individual writes"
granularity the "Rerun: partials get reused in place" section above
describes. That finer form (comparing a *specific* property write inside
partial N against partial N's own previous run) already happens "for
free" for a repeater's *first* partial (via the `pendingWritings` hand-off
from step 1) but not yet for a repeater's second, third, etc. partial -
each new partial past the first currently starts with empty
`pendingWritings`, so a repeater's own writes made *after* creating a
child don't yet get the same-value dedup across reruns. Worth confirming
whether real workloads hit this before building it out.

## Suggested next steps

1. Tree-based time comparison (`writing.writer` instead of a plain
   number) - needed before `renderOnto.js` can actually pass, since
   Panel/Leaf never declare `{time: N}` and currently collide on flat
   time 0.
2. Per-partial `pendingWritings` hand-off for a repeater's second and
   later partials (not just its first) - only if a real case needs it.
3. Get `renderOnto.js` actually passing, fixing up any wrong assumptions
   it turns out to have along the way.

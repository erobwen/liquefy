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

**Not yet done**: `disposeChildren()`/`addChild()`/`children` are
deliberately left untouched (still array-based, still only for real child
repeaters) rather than merged into one linked list with partials right now.
Nothing currently exercises them (the only test that did,
`meta_repeaters.js`, was removed), so there was no forcing function to get
the merge right yet. Merging them properly needs the actual child-creation
path and `linkRepeater` built first, since `disposeChildren()` needs to be
able to tell "permanently torn down" (a real child that's actually gone)
apart from "retract and maybe reconcile" (a partial, or a child that might
get relinked) - not decidable with no real children in the picture.

## Suggested next steps

1. Real child-repeater creation from inside a partial (splitting: reaching
   a child attachment point closes the current partial and opens a new
   one), plus `linkRepeater` itself.
2. Merge partials and real children into one linked list per repeater
   (superseding the array-based `children`/`addChild`).
3. Per-partial reconciliation on rerun (the lazy retract-and-compare
   mechanism described above) - this is what makes `renderOnto.js`'s case 2
   and case 3 meaningful.
4. Tree-based time comparison (`writing.writer` instead of a plain number).
5. Get `renderOnto.js` actually passing, fixing up any wrong assumptions it
   turns out to have along the way.

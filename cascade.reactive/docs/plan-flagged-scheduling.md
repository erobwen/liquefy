# Plan: flagged repeaters and the pipeline scheduler

Status: **implemented.** `src/test/flagged-repeaters.js`,
`writing-reuse-guard.js`, `writing-reuse-optimization.js`,
`migrate-overtaken-observers.js`, `multi-pipeline-isolation.js`,
`flush.js`, `access-initial-values.js`, and `enumeration-timeline.js` cover
the mechanisms below; the full suite (73 tests in cascade.reactive, plus
5 in cascade.component and 18 in cascade.DOM) passes, and the demo app's
own real-browser behavior was re-verified against this design (see
"Status" at the end).

This now covers three layers, built in this order: the pipeline scheduler
itself (migration, flagging, `workStatus`, pipelines/wavefronts/parking);
`flush()`, letting the application deliberately retreat a wave instead of
parking; and `accessInitialValues()` plus a fix to enumeration's own
dependency tracking, both about *reaching backward through position*
rather than through scheduling.

This doc picks up where `docs/plan-partial-repeaters.md` leaves off. That
doc's own "Open question carried over: same-time writers" section is
**resolved here** - not by solving same-time writers head-on, but by
building the machinery that makes a farther, "overtaken" dependency
correct in general, which is the same underlying problem. Its `linkRepeater`
description ("pure reattachment, never a trigger") is also **out of
date** as of this doc - see "linkRepeater's opportunistic check" below.

## Motivating problem: invalidation traveling faster than the computation front

Everything here traces back to one naive assumption that turned out to be
wrong: that "don't invalidate on same-value writes" - already built,
already correct - would be enough to keep reruns bounded once a
repeater's positional reconciliation breaks (see `docs/plan-partial-repeaters.md`'s
"Rerun: partials get reused in place"). It isn't, for two separate
reasons, each closed by a separate mechanism below:

1. **A reader can be watching the wrong (farther) writing.** Once a
   closer writing is inserted between an existing writing and a reader
   that resolved to it, ordinary writing-scoped invalidation
   (`invalidateWritingObservers`) never touches the farther writing -
   only the one actually being written. The reader's dependency, unless
   something goes and finds it, stays pinned there forever. See
   "Migration: catching up a farther dependency" below.

2. **Reusing a repeater's own prior writing (instead of always creating a
   fresh one) needs to decide, eagerly and unconditionally, whether to
   notify - and that's the wrong call for a tree-ordered reader if
   something later in the same wave might still undo the change.** A
   direct dependent of a reused writing has the exact same problem a
   migrated one does; reuse just makes it easy to miss, because nothing
   about it looks like "overtaking" on its face. See "Flagged: deferred
   invalidation" and "The writing-reuse guard" below.

The concrete shape behind both: repeaters A, B, C, structurally ordered
(B and C both created after A, in that order, inside a shared parent). A
changes something. B - which runs right after A, before C is ever
reached - reverts it in the very same wave. If C's dependency is resolved
eagerly, the moment A's change is discovered, C reruns for a change that
never actually stuck. The system has to be able to tell "changed, for
real, as far as anyone downstream can tell" apart from "changed for a
moment, mid-wave" - and the only way to tell them apart is to not decide
until the wavefront has actually, provably passed the point where a
revert could still happen.

## Migration: catching up a farther dependency

`migrateOvertakenObserversFor(writing)` (cascade.js), called whenever a
writing is freshly spliced into a timeline - a brand-new writing, or a
stale one reused at a new position: only the writing's immediate
predecessor's observers can possibly be affected (a reader further back
must have its own read position before the predecessor's, or it would
have resolved there instead - see the function's own comment for the
full argument). For each such observer:

- Same effective value either way -> repoint silently, no matter what
  kind of reader it is. Nothing observable changes.
- Different value, but the reader isn't part of the same wavefront-
  ordered tree (an invalidator - `time === Infinity`, always wants
  "whatever's latest right now" - or a partial from an unrelated chain,
  no tree-position relationship to defer relative to) -> repoint and
  invalidate immediately, same as this always worked.
- Different value, same-chain tree-ordered reader -> **flag it instead**
  (see next section) - don't repoint or invalidate yet.

`settleOvertakenObservers(oldWriting, newWriting, entries)` holds this
per-entry decision; `retireWritingOnto` (see "The writing-reuse guard"
below) reuses it for a structurally different but logically identical
situation - a stale writing being fully retired rather than overtaken
from some positions on.

`entryNeedsDeferredTreatment(entry, referenceWriter)` is the "same tree"
check: `entry.observer.type === "partial"` and
`entry.observer.repeater.chainHead === referenceWriter.repeater.chainHead`.
Two unrelated repeater trees have no execution sequence connecting them -
nothing about "wait, something in between might undo this" applies, since
there is no "in between" for unrelated trees. Found via a real regression
(`renderOnto.js`'s own retraction test) after an earlier, too-broad
version deferred *any* tree-ordered reader regardless of chain.

**A real bug found here**: `seekWriting(timeline, entry.time, entry.writer)`,
used when re-resolving a flagged entry, can resolve straight to
`entry.writer`'s *own* subsequent write to the same property - a read
and a later write from within the same partial share the identical
`(time, writer)` position (the ordinary read-then-write shape every leaf
in `renderOnto.js` uses). That write didn't exist yet at read time. Fixed
by falling back to `.previous` whenever the seek lands on a self-authored
writing.

## Flagged: deferred invalidation

"Flagged" sits between clean and invalid: known to *maybe* need
reevaluation, not promoted to a guaranteed rerun until actually
re-examined and found to matter. `flagRepeaterEntry(repeater, entry,
previousWriting)` records `{entry, previousWriting}` on
`repeater.flagRecords` and marks `repeater.workStatus = 'flagged'` if
nothing stronger is already pending. Deliberately left parked exactly
where it was (`previousWriting.observers`, untouched) rather than moved:
this is what keeps it automatically covered by `previousWriting`'s own
*ordinary* invalidation in the meantime - if `previousWriting` genuinely
changes for real before the flag is ever resolved, that fires directly,
bypassing the flag entirely, which is exactly correct (see
`resolveFlaggedRepeater`'s own comment for the fuller argument on why no
snapshot of history is ever needed here - two live reads, taken at
resolution time, are sufficient).

`resolveFlaggedRepeater(repeater)` does the actual settling, once
reached: for each record, re-seek fresh against whatever's linked *now*,
compare against `previousWriting`'s still-accurate value, repoint, and -
only if genuinely different - call `invalidateRepeater(repeater)`
directly (not `invalidateObserver`; by this point we're already holding
the repeater, not a reading).

## `workStatus`: invalid vs. flagged, and why only repeaters carry it

A repeater carries `workStatus` (`null | 'invalid' | 'flagged'`).
`'invalid'` always wins and is never downgraded back to `'flagged'` -
`flagRepeaterEntry` only sets `'flagged'` when `workStatus` is currently
`null`. Only *repeaters* ever get scheduled this way - a partial can
never usefully run on its own (see `docs/plan-partial-repeaters.md`), so
a flagged *reading* always resolves to "does the whole owning repeater
need to rerun", never to running a partial in isolation. A repeater is
flagged if one or more of its own partials had a flagged reading;
resolving it means walking those specific flag records to find out.

## The writing-reuse guard

Reusing a repeater's own prior writing (`repeater.staleWritings`, see
`docs/plan-time-aware-timelines.md`'s retraction/recovery mechanism, now
carried in `cascade.js` under this name) means mutating that same object
in place - and `finalizeTouchedStaleWritings`'s own before/after
comparison notifies *unconditionally* if the value differs. That's
correct for an eager-eligible observer, wrong for a same-chain
tree-ordered one - it needs the deferred treatment above, and mutating
the writing in place doesn't leave room to defer anything.

`staleWritingNeedsRetirement(candidate, writer)` decides, at claim time
(in `setHandlerObject`'s staleQueue branch): does `candidate` currently
have *any* observer that `entryNeedsDeferredTreatment` would defer? If
not - no observers at all, or only eager-eligible ones - reuse in place
exactly as before; `finalizeTouchedStaleWritings`'s own eager
notify-if-different is the right treatment for all of them anyway, so
there's no reason to pay for a fresh object. If so, the candidate is
**retired**, not reused: abandoned outright (its own `.value` stays
frozen, a safe reference for whatever must defer its own comparison), and
an ordinary fresh insertion takes its place - `retireWritingOnto`
(reusing `settleOvertakenObservers`) settles its former observers exactly
like any other overtaken dependency's.

**A real ordering bug found here**: for the *reuse* path specifically,
`migrateOvertakenObserversFor` used to run immediately, at write time -
before `finalizeTouchedStaleWritings`'s own before/after check for that
same writing. A reader freshly migrated in (correctly judged "no real
change" from *its own* perspective, against whatever the writing's
predecessor held) would then get swept up anyway by the writing's *own*,
unrelated old-vs-new comparison, the moment it landed in `.observers`.
Fixed by moving the migration call to run *after* that per-writing
settle, inside `finalizeTouchedStaleWritings` itself, mirroring the same
ordering principle `setHandlerObject`'s own `justInserted` case already
used for a brand-new (non-reused) writing.

## `linkRepeater`'s opportunistic check

`docs/plan-partial-repeaters.md` describes `linkRepeater` as "pure
reattachment, never a trigger." That's still true for a genuinely
*invalid* `oldRepeater` - cascade's own scheduler (see "The pipeline
scheduler" below) refreshes it on its own schedule, independent of when
`linkRepeater` is called. It is **not** true for a merely *flagged* one.

The reason: a root repeater's own refresh can span multiple positions
internally (its own "before" write, a child, a "between" write, another
child, an "after" write - the padding pattern from
`docs/plan-partial-repeaters.md`), and something flagged partway through
- by the "between" write, say - may need resolving *before* the root's
own later code (the "after" write) continues, not merely "sometime
later, once the whole root refresh returns". Deferring that resolution to
the heap (see below) is too late - the heap only drains after the
*whole* root's `refresh()` call returns. `linkRepeater` being called,
exactly when the parent's own execution arrives at that child's
position, is itself the wavefront arriving there - and it may be the
*only* place that arrival is ever observable for that specific position.

So: `linkRepeater(oldRepeater)`, if `oldRepeater.workStatus === 'flagged'`,
calls `processRepeater(oldRepeater)` inline before reattaching. If that
finds a genuine change, `invalidateRepeater` runs `dispose()` immediately
(which is the part the parent's own later code actually needs to see -
e.g. a sibling's writing correctly unlinked) - but the repeater's actual
*refresh* is still left for the heap to pick up in its own turn, exactly
as ever (`scheduleWork`'s own `inHeap` dedup guard means this never
double-schedules).

Confirmed necessary, not just plausible, by tracing `renderOnto.js`'s own
case 1 through by hand and then with real instrumentation: without this,
panel's own "after" write read a sibling's writing that should already
have been retracted, and the observed rebuild count came out wrong.

## The pipeline scheduler: pipelines, wavefronts, parking

Everything above needs somewhere to actually get carried out - not
"immediately, whenever discovered" (that's exactly the eager behavior
being avoided), and not "in some list, in whatever order things happened
to be invalidated" either, since a flagged reading specifically needs to
wait until *the wavefront has actually passed its position*, not until
some arbitrary later moment.

### Pipelines

A "pipeline" is one root repeater's whole tree - every repeater sharing
its `chainHead`. Every repeater in one pipeline executes at **exactly
one** time level, always - nothing forces (or is expected to want) a
nested repeater to declare a different one than its root's. If something
inside a pipeline legitimately needs to trigger work at an earlier or
later time level (e.g. a selection widget writing back to the model at
model-time), that's a *different* pipeline, owned by whatever component
requested it - never a child of the one that triggered it. This is what
lets `chainHead.time` be set once, at creation, from the root's own
declared time (or 0), and never touched again -
`repeater.time()` just delegates to `this.chainHead.time`.

This also means "a pipeline is really just an invalidated repeater from
the outside" (its root) - so the top-level scheduler never needs to track
individual repeaters at all, only pipelines (chainHeads).

### The two-level structure

`state.workQueue[level]` holds two FIFOs, not one: `active` (pipelines
with actionable work right now) and `parked` (pipelines whose own work
emptied this wave, but not all of it settled - see "Parking" below).
Each `chainHead` carries its *own* pipeline-scoped work:

- `heap`: repeaters needing attention, this pipeline, this wave -
  position-ordered by each repeater's `firstPartial` (set fresh every
  `refresh()` - the *first* partial specifically, not `rightmostPartial`,
  because a child's first partial is always created strictly after its
  parent's own first partial begins, which is what guarantees a parent's
  heap entry always sorts before any of its descendants'). Compared live
  via `compareWriterOrder`, never a cached order number - `orderNumber`
  can be renumbered by `releaseChainPressure` (see
  `docs/plan-partial-repeaters.md`'s "Step 6") while something sits in
  this heap, so nothing may ever store one directly; every reference here
  is to the partial itself.
- `parkedPartials`: repeaters that arrived behind this pipeline's own
  wavefront this wave (see below), waiting for the next one.
- `wavefront`: the `firstPartial` of the last-processed repeater this
  active session - meaningful only while this chainHead is
  `state.activePipeline`.

The pipeline's own **root repeater never occupies a heap slot**. Nothing
can have an earlier position than the thing that created everything else
in its own tree, so `drainActivePipeline` checks it directly,
unconditionally, before ever touching the heap - as a `while` loop, not a
single check, since resolving a flagged root can itself turn up a genuine
change (via `invalidateRepeater`, called from inside
`resolveFlaggedRepeater`) that still has to actually run this same
session, not get left set and parked for yet another wave.

Two separate dedup flags reflect the two different places a repeater can
be waiting: `inATimeBucket` for a root repeater (whose *pipeline* sits in
an outer bucket), `inHeap` for a nested one (which sits in its own
chainHead's heap). A root's `inHeap` stays `false` forever - it never
enters a heap.

### Draining

`refreshAllDirtyRepeaters()` repeatedly asks `findNextPipeline()` for the
earliest still-unlocked level with anything in its `active` FIFO
(locking levels as it passes them, same shape the old flat
`firstDirtyRepeater()` used), extracts that pipeline as
`state.activePipeline`, and calls `drainActivePipeline()`: the root
first (in the loop above), then the heap, strictly in position order,
advancing `chainHead.wavefront` as it goes.

### Parking, at two levels

New work discovered *within* the pipeline currently being drained routes
through `scheduleWork(repeater)`: strictly after `chainHead.wavefront`
(`compareWriterOrder(repeater.firstPartial, chainHead.wavefront) > 0`) ->
the heap, ordinary case. At or before it -> `chainHead.parkedPartials`,
not the heap. This is the back-reference case: something later just
wrote to something earlier, and the wave must not backtrack to pick it
up this pass.

If `drainActivePipeline` finishes its session with `parkedPartials`
non-empty (or the root itself ended up re-pending, mid-session, via the
same back-reference path applied to the root - see above), the whole
*pipeline* gets parked too: moved into its level's `parked` FIFO, not
`active`. This is the second level of parking - not individual readings
this time, but an entire pipeline that isn't done for this wave. New
work arriving for an already-parked pipeline - even something entirely
unrelated to why it was parked - also goes to `parkedPartials`, not back
into `active`: once parked, a pipeline waits for the wave boundary no
matter what, with no early reactivation.

### The wave boundary

Waves move in one direction only, through the whole level range, before
ever looping back - matching the priority-level sweep behavior the
`revalidationTimeLock` mechanism already had for the coarser, pre-pipeline
scheduler (see `enterTimeLevel`/`exitTimeLevel`, left untouched and
serving only their own, older, general context-tracking purpose now -
this scheduler keeps a fully separate `state.workQueueTimeLock`, so it
can never be perturbed by that unrelated bookkeeping; see "A bug found
along the way" below for why that separation matters).

`findNextPipeline()`, once every level's `active` FIFO comes up empty,
doesn't necessarily conclude the system is idle: any level's `parked`
FIFO may still hold pipelines waiting on real, if held-back, work. If so,
every one of them gets folded back into action - `parkedPartials` moved
into `heap`, moved from `parked` into `active` - and the lock resets to
`-1`: a new wave begins. Only once that produces nothing either is the
system genuinely idle.

## A bug found along the way (kept as a caution, not just a note)

An earlier version of this scheduler hooked the flag-resolution sweep
directly into `exitTimeLevel`, gated on its own `workOnTimeLevel[level]`
counter reaching zero. That counter is shared with ordinary call-stack
tracking - `enterContext`/`leaveContext` bump it for *every* partial
boundary, not only top-level refreshes - so it can transiently touch
zero for a single instant between a `leaveContext` and the very next
`enterContext`, mid-refresh, nowhere near an actual settle point. The
sweep fired there, resolving flags before the wavefront had genuinely
finished moving. Fixed by moving the sweep entirely out of
`exitTimeLevel` and into the scheduler's own two-phase drain loop instead
- and by keeping `state.workQueueTimeLock` as a dedicated field, never
shared with the older, general-purpose `state.revalidationTimeLock`, for
exactly this reason.

## `flush()`: giving the application control over wave direction

Everything above assumes waves move strictly forward - "nothing is
allowed to make one backtrack" (see "Parking, at two levels"). Two
concrete cases need exactly that, deliberately: a modal dialog whose
frame already finished rendering this wave, where a later component opens
a portal and needs to add content back into it without waiting a frame
for it to appear; and a selector that discovers the model handed it an
invalid value and needs to correct the model and have everything forward
of it re-derive, in the same frame, rather than flash the invalid state
first. `flush(callback)` is the escape hatch: a recursion-safe counter
(`state.flushing`, same style as `recordingPaused`/`blockInvalidation`)
that, while `> 0`, turns "would park until the next wave" into "retreat
the wave and pick it up within this one instead."

A single global `state.waveRetreated` flag records that a retreat
happened, set by either of two distinct places:

- **`ensurePipelineActiveOrParked`**, for a chainHead *other* than the one
  currently being drained: instead of parking it (its own level already
  passed), `state.workQueueTimeLock` retreats to `chainHead.time - 1` and
  the chainHead is placed into `active` as usual.
- **`scheduleWork`**, for a back-reference *within* the pipeline
  currently being drained: instead of `chainHead.parkedPartials`, the
  repeater goes straight into `chainHead.heap`. Nothing needs to move
  `chainHead.wavefront` back explicitly for this - `heapInsert` already
  places the repeater at its correct position, so the ongoing heap-loop's
  next pop naturally reaches it in order, and popping it is what updates
  `wavefront` to reflect the new, retreated position anyway.

`checkWaveRetreat(chainHead)`, called once right after *every*
`processRepeater()` call in both of `drainActivePipeline`'s loops (never
mid-refresh - a repeater's own refresh, even one that recursively
revalidates whole subtrees of its own children, is never interrupted),
is where the flag actually gets acted on. While draining a pipeline at
time `L`, `state.workQueueTimeLock` sits at `L - 1` as a matter of
routine (see "Draining" above - `findNextPipeline` never locks the level
it hands back) - so the real question isn't "is the lock currently behind
this pipeline" (always true, harmlessly), it's whether the lock fell
*further* back than that: `workQueueTimeLock < chainHead.time - 1`.

- If not - the retreat stayed within, or exactly at, this pipeline's own
  level - nothing more to do; the heap-insertion above already handles it
  correctly on its own.
- If so, the wave moved to before this whole pipeline's level. This
  session is abandoned: `parkedPartials` folds into `heap` (ready for next
  time, wavefront concept reset), and the whole chainHead is requeued at
  the *front* of its own level's `active` bucket (`prependToLevelList`,
  new alongside `appendToLevelList`) - so it resumes ahead of anything
  else waiting there, rather than going to the back of the line.

**A correction found in review, worth keeping explicit**: the abandon
branch does *not* dispose or reinvalidate anything. An earlier version
called `invalidateRepeater(root)` here, on the reasoning that the whole
pipeline's last run was now "stale" - but retreating past a pipeline only
means some earlier-level work needs to run first, not that anything in
this pipeline was actually wrong. Whatever the earlier-level rerun
produces will mark exactly what needs attention through the ordinary
invalidation/migration/flagging path, same as always; forcing a redo
pre-empts that and throws away correct work, exactly the kind of needless
recompute this whole design otherwise exists to avoid.

`flush()` only changes *when* a resulting invalidation is processed
relative to the current wave - it does not change *where* a write lands.
See `accessInitialValues()` below for that other half.

**Infinite oscillation** is an accepted, unguarded risk, same as an
ordinary `while` loop in application code: nothing stops a developer from
writing a `flush()` that keeps correcting in both directions forever.
Staying converging is the caller's responsibility.

## A second bug found along the way: the lock never resetting on idle

Tracing through when a retreat is genuine (as opposed to just the
ordinary `L - 1` resting position above) surfaced a separate,
pre-existing bug, unrelated to `flush()` itself: `findNextPipeline`'s
forward walk locks every level it passes without finding anything, but
nothing ever reset `state.workQueueTimeLock` back to `-1` once the system
genuinely went idle (its own fold-in branch only resets it when something
was actually parked to fold). So a wave that settled without ever parking
anything left the lock stuck at whatever level it last advanced to - and
a later, completely unrelated invalidation at an earlier level would then
be wrongly treated as `wantParked`, since nothing had told the lock the
old wave was over. Fixed by having `refreshAllDirtyRepeaters` reset the
lock to `-1` right before it reports idle.

## `accessInitialValues()`: reaching backward through position

`flush()` controls *when* something is processed; it deliberately leaves
*where a write lands* untouched, because "time as tree position" is
fundamental, not a scheduling detail - `migrateOvertakenObserversFor`
only ever migrates an observer positioned *after* a new writing, never
one positioned before it, so a later-positioned (or later-time-level)
write to a plain property can never, by construction, reach an earlier
reader. Yet the motivating portal/selector cases genuinely need exactly
that. The resolution turns out to already exist, half-built:
`docs/plan-time-aware-timelines.md`'s "External reads and writes are
asymmetric" section - external (outside any repeater) writes already land
at the time-0 baseline, external reads already see the pipeline's latest
output. `accessInitialValues(callback)` just makes that behavior
reachable *from inside* a repeater: it nulls `state.context` for the
callback's duration, so `currentTime()`/`currentReadTime()`/`currentWriter()`
- which derive purely from `state.context` - all fall through to their own
"outside any repeater" branches, regardless of what's actually executing.

No new invalidation path is needed as a result. A write inside the
callback to a property that already has a baseline writing (every
observable's construction writes one via `moveTargetDataIntoTimelines`)
*reuses* that exact writing rather than splicing a new one - so it goes
through the same unconditional, already-eager `invalidateWritingObservers`
every ordinary rewrite-in-place already gets, not
`migrateOvertakenObserversFor`, and so isn't subject to
`entryNeedsDeferredTreatment`'s same-chain deferral either: this isn't
overtaking a reader positioned after it, it's rewriting the exact slot
that reader already depends on.

`accessInitialValues()` and `flush()` are deliberately independent,
composable primitives - `accessInitialValues(() => flush(() => ...))` or
the reverse order, whichever reads better at the call site - rather than
one trying to do both jobs, matching the existing
`postponeInvalidations`/`doWhileInvalidationsPostponed` pattern of
separate, stackable modifiers.

**Open, not yet resolved**: this is on solid ground for genuinely global
objects and for correcting a pipeline-local object's own baseline slot
from elsewhere - but *ownership* of that slot, for an object *created*
inside a pipeline, isn't reasoned through yet. It happens to work today
because a component's constructor never touches these values in the
first place (an interesting parallel to the rebuild framework's own
`onEstablish` lifecycle hook, which exists for exactly the same reason -
state set in a constructor would be overwritten the moment a freshly
constructed object gets merged into an already-established one), but what
happens to a baseline writing "owned" by a repeater that vanishes on its
own next rerun is an open question. A competing alternative - never write
backward at all, and instead let a component spawn additional,
forward-positioned repeaters on demand (dynamic child creation, not time
travel) whenever it needs to react to something like a portal request -
is also on the table. Both possibilities are being left open pending an
actual attempt at building the modal/portal case that motivated this.

## Enumeration: the same forward-only rule, for key composition

`recordDependencyOnEnumeration` never recorded a reader's own
`(time, writer)`, and `getOrCreateEnumerationTimelineWriting` always
sought the fixed `(0, null)` position regardless of who was asking - so
every reader, at every position, shared one single writing, and
`invalidateEnumerateObservers` simply fired all of them, unconditionally,
on any key add/remove. A key added by a *later* repeater could reach a
reader positioned *before* it - the same backward-reach bug class this
whole design otherwise prevents for plain properties, just via a
different (unconditional) dependency.

**First attempt, reverted**: mirror the property-timeline treatment
exactly - splice a fresh writing at the write's own position, migrate
whichever of the predecessor's observers are overtaken
(`migrateOvertakenObserversFor`, already fully generic despite living
under a property-sounding name - reused as-is). This broke the dev-time
structural order verifier (`structural-order-verifier.js`): a repeater's
own writing on this reserved timeline never goes through the
`dispose()`/`staleWritings` cleanup its *property* writings get across
reruns, so writings from old reruns just accumulated, pointing at
partials no longer in the live order-number chain - comparing a live
writer against one of those produced disagreeing orderNumber-vs-structural
results. Giving enumeration real multi-version history needs the same
reconciliation-across-reruns machinery properties get; that's a bigger,
separate undertaking, explicitly not pursued here (see the note added to
`docs/plan-array-timelines.md`, which has the identical gap for arrays).

**What shipped instead**: keep the single, permanently-reused writing per
handler (no storage change at all), but make invalidation *selective*
about which of its own observers actually fire -
`invalidateDownstreamEnumerationObservers` (cascade.js) only invalidates
entries positioned strictly after the change (`comparePositions(...) > 0`,
via the already-generic `collectOvertakenPropertyObservers`), leaving
upstream readers registered, untouched. Always eager, never flagged:
flagging only pays off when there's a genuinely fresher writing to defer
resolution against later (`resolveFlaggedRepeater`'s own live re-seek) -
with a single writing that's never replaced, that resolution would always
trivially resolve back to itself and never detect a real change.

Arrays (`invalidateArrayObservers`) still have no position gate of any
kind today - left explicitly open, same reasoning, tracked in
`docs/plan-array-timelines.md`.

## `reactiveBuildEquivalent()`: a nested buildRepeater whose own caller
## needs its result synchronously

Found building `cascade.application/demo`'s `ApplicationMenuFrame` -
a component whose `render()` is overridden directly (real
`getBoundingClientRect()` measurement, ordering-sensitive) rather than
using the default build()-then-renderOnto() flow, but which still needs
`build()`'s own key-based reconciliation for the declarative tree it
composes underneath. `linkRepeater(u.buildRepeater)` only guarantees a
*flagged* buildRepeater's disposal happens inline, right there - a
genuine rerun it finds has that rerun deliberately left for the heap to
pick up later (see `linkRepeater`'s own comment, above). Fine for a
caller that only needs the disposal to have happened before its own next
write (`renderOnto.js`'s original motivating case) - wrong for
`reactiveBuildEquivalent()`'s own very next line, which hands
`this.newBuild` straight to its caller, used immediately.

**First attempt**: skip the separate buildRepeater entirely - call
`build()` directly, inline, reconciling naturally against the *caller's
own* repeater/partial instead (a `buildOnce()` method, briefly added to
`Component.js`). This does dodge the deferred-refresh problem (no
separate repeater to ever fall out of order with the scheduler's own
walk) - but breaks something subtler: reconciling a keyed child sets the
*established* object's own `forwardTo` to point at the freshly
constructed, about-to-be-discarded twin (see `observable()`'s own build-
identity branch); every read of anything but that object's own
causality/timelines meta is transparently redirected through `forwardTo`
until `finishRebuilding()` clears it - which only happens once whichever
repeater did the constructing finishes its own `refresh()`. Building
without any repeater at all means that never happens until the *caller's
own* enclosing render-repeater finishes - too late if `build()`'s result
gets `renderOnto()`'d before then, in the same call: reading
`.unobservable` on a component still mid-`forwardTo` hits its temporary
twin's own, empty `unobservable` bag instead of the established one's, so
`renderOnto()` finds no repeater there and silently creates a redundant
new one instead of relinking the real one - orphaning that component's
whole previously-established subtree, with no exception anywhere.
Reverted; `buildOnce()` no longer exists.

**What shipped instead**: keep the separate buildRepeater (so
`finishRebuilding()` still runs promptly, before this method's own caller
ever sees the result) but force its refresh to complete synchronously
when `linkRepeater()` leaves it merely disposed-and-scheduled rather than
actually rerun (`if (workStatus === 'invalid') { workStatus = null;
refresh(); }`, mirroring `processRepeater()`'s own 'invalid' branch
exactly). `drainActivePipeline()`'s own heap loop already discards a
repeater it later pops whose `workStatus` has gone back to `null` in the
meantime, so this can never cause buildRepeater to run twice. See
`cascade.component/src/Component.js`'s own `reactiveBuildEquivalent()`.

## Retraction losing a race against a stale, already-queued rerun

A second, related but distinct bug, found the same way (real browser
verification of `ApplicationMenuFrame`, this time crossing the modal/
docked breakpoint under resize): a component's own property, written
once at construction time and never touched again, read back as
`undefined` on a rerun - not because anything wrote a new, wrong value,
but because nothing did.

The shape: a child component is constructed inside an ancestor's own
`build()` (so the write to the child's property - e.g.
`MenuList.setProperties()`'s plain `this.frame = frame`, or
`DOMElementNode.setProperties()`'s `this.attributes = ...` - lands
positioned within *that ancestor's own buildRepeater's partial*, not the
child's), and the child is also conditionally dropped from the tree
entirely on some later rerun (a docked drawer that stops being built at
all once a responsive breakpoint flips to modal, say). When the ancestor
disposes for that rerun, `dispose()` unlinks *all* of its own prior run's
writings - the child's property write included, since it was positioned
there regardless of which object it was actually setting a property on.
That unlinking is itself a genuine invalidation of whatever depended on
the writing - here, the dropped child's own (still fully live, not yet
retracted) buildRepeater or render-repeater, which read that property
last time. It gets scheduled, same as any other invalidation.

Real retraction - which would stop that scheduled rerun from ever
mattering - only happens once whatever renders the child's siblings next
(a `DOMElementNode`'s own `children` loop, say) actually reruns and
notices the child wasn't relinked this time. But that rerun is a
*separate*, independent piece of scheduled work from the child's own
stale invalidation above - nothing orders one before the other beyond
where each happens to land in tree position, and the child's own
inherited invalidation, having been scheduled first (as a direct
consequence of the ancestor's own dispose(), which runs before the
ancestor's build() even starts producing the new tree the retraction
would come from), routinely reaches the heap - and gets processed - well
before the retraction that should have preempted it. The child's stale
buildRepeater or render-repeater refreshes anyway, reading back
`undefined` for whatever property depended on the now-unlinked writing,
with no exception at the write site to explain it - reproduced in
isolation (no real DOM at all) in under 10 lines, confirmed independent
of the `reactiveBuildEquivalent()` fix above (reproduces identically with
or without it).

**First fix (since replaced)**: write the affected property via
`accessInitialValues()` so it lands at the baseline and the constructing
repeater's `dispose()` can't unlink it. It worked, at three sites
(`MenuList.frame`, `DOMElementNode`'s `tagName`/`children`/`attributes`,
`DOMTextNode.text`) - but for the wrong reason: those are all
*properties*, meant to change on every rebuild, and repositioning them
only made the stale rerun harmless, it didn't stop it. The actual defect
is the race itself.

**What shipped instead**: `retractRepeater()` (cascade.js), the body
`finalizeChildren()` always used for a child it no longer relinks, now
callable on its own and idempotent - and `finishRebuilding()`'s existing
dispose-event branch (a buildId absent from the new run's map) is where
it gets called, via `Component.onDispose()`: the moment a keyed
component's build identity is known to have vanished, its render-repeater
is retracted (cascading to its buildRepeater and everything rendered
underneath), *before* the heap ever gets to any stale rerun of it. With
`reactiveBuildEquivalent()`'s synchronous refresh above, that
`finishRebuilding()` runs inside the parent's own `render()`, ahead of
the heap loop - so the scheduler's own `if (repeater.retracted) continue`
check finally sees the flag in time. All three `accessInitialValues()`
workarounds reverted to plain property writes. Still open: an *unkeyed*
child (no buildId, so no dispose event) dropped the same way has no such
hook and keeps the original race - see "Explicitly deferred".

## State properties: `declareState()`

The other half of the same investigation, and the actual invariant it
was groping for (see `cascade.component/README.md`, "Component state and
properties"): some of a component's properties aren't properties at all.
A *property* comes from the constructing context on every rebuild, like a
function argument. *State* is established once and thereafter changes
only through the user (an event handler) or an event that causes - and a
rebuild must never reset it. `OverlayFrame.assignedOverlayContent` was
already being hand-positioned at the baseline via `accessInitialValues()`
for exactly this reason, without a name for it.

`declareState(object, {name: default, ...})` marks the names as state on
the object's meta (`stateProperties`) and writes the defaults at the
baseline (time 0, writer null), like construction data. Two enforced
consequences:

- `setHandlerObject()` throws on a state write while `state.inRepeater`
  is set. A write inside `accessInitialValues()` passes - `state.context`
  is null there - which makes it the sanctioned way to write state from
  inside a pipeline (`Component.setState(values)` wraps it, and rejects
  undeclared names). An event handler, outside any repeater, just
  assigns.
- `mergeInto()` (lib/utility.js) skips state when a rebuild copies a
  reconciled twin's properties onto the established object. This is the
  *only* gate: during a rebuild the constructed object is a throwaway
  whose writes already go to the twin (setHandlerObject's `forwardTo`
  redirect), so a constructor writes its defaults unconditionally, with
  no need to detect a rebuild - deliberately, since rebuild-ness isn't
  reliably knowable at construction time once pattern matching is
  involved. `declareState()` registers the names on the twin's meta too,
  so the write guard reads the same on both sides.

`Component.initializeState()` returns the defaults; the constructor calls
`declareState(me, me.initializeState())` right after `setProperties()`,
so a default may derive from a property.

## Status

## Status

Done: migration (a farther dependency correctly catches up to a closer
writing), flagging (deferred, not eager, invalidation for tree-ordered
readers), the writing-reuse guard (reuse only when nothing needs
deferred treatment), `linkRepeater`'s opportunistic inline resolution,
the full pipeline/heap/wavefront/parking scheduler replacing the old
flat dirty/flagged lists, `flush()` (deliberate wave retreat, with
`checkWaveRetreat`'s still-inside-vs-before-this-pipeline split and the
lock-reset-on-idle fix that came with it), `accessInitialValues()`
(reaching backward through position rather than scheduling, reusing the
existing external-write baseline), enumeration's own dependency tracking
made position-aware (downstream-only invalidation on key add/remove),
`reactiveBuildEquivalent()`'s own deferred-refresh fix (force a flagged-
then-genuinely-invalid buildRepeater's refresh to complete synchronously
rather than leaving it for the heap), the retraction-vs-stale-queued-
rerun race (a dropped child's own inherited invalidation reaching the
heap before the retraction that should have preempted it - fixed by
`retractRepeater()` on dispose, via `Component.onDispose()`), and state
properties (`declareState()`: a write guard in `setHandlerObject()` and a
`mergeInto()` exemption, surfaced as `Component.initializeState()`/
`setState()`). Verified against the real demo app
(`cascade.application/demo`) in an actual browser, including the
original reconciliation-breaking scenario (menu/hamburger breakpoint
under resize) that motivated this whole line of work.

Explicitly deferred, not needed by any concrete case yet:
- **Retraction-on-dispose for *unkeyed* children.** `retractRepeater()`
  reaches a dropped child through `finishRebuilding()`'s dispose event,
  which only fires for a buildId that vanished from the map - an unkeyed
  component (e.g. an `h1(...)` without a key inside some `build()`) is
  never in that map, so if its constructing repeater disposes and drops
  it in the same rerun, the original race (a stale, already-queued rerun
  of it processed before whoever rendered it reruns and retracts it) is
  still possible. Not seen in practice yet: an unkeyed child is
  reconstructed fresh on every rebuild anyway, and the shape only bites
  when the *same* rerun both invalidates the old one and stops rendering
  it. The shape-analysis (`rebuildShapeAnalysis`) branch of
  `finishRebuilding()` has its own dispose loop over unkeyed objects that
  could carry the same hook, if that ever becomes the mechanism
  components use.
- **Inter-wave event yielding.** Waves currently run fully synchronously,
  looping immediately from one to the next within the same call stack if
  parked work remains. A genuinely deep cascade could block the thread
  through several waves - discussed and deliberately deferred as a
  separate, later, opt-in layer (a `setTimeout`/microtask yield point
  between waves), since so much of what's built assumes synchronous
  settling (a write returning only once everything has fully resolved).
- **A real heap for `chainHead.heap`.** Currently a plain array kept
  sorted by linear insertion (`heapInsert`/`heapPopMin`) - fine while a
  pipeline's own pending work is small, worth revisiting if that ever
  isn't true.
- **Generalizing `timeLevels` beyond a small, fixed-size array.** Raised
  as a live question (a map of active levels instead of a preallocated
  array, to allow sparse/large level numbers) but not pursued without a
  concrete need driving it.
- Same-time writers from *different, unrelated* root trees (different
  chainHeads) - still the stable chain-id fallback from
  `docs/plan-partial-repeaters.md`; deliberately excluded from the
  deferred/flagged treatment (`entryNeedsDeferredTreatment`'s own
  same-chain check), since there is no wavefront connecting unrelated
  trees for deferral to mean anything.
- **Ownership of a backward-written baseline slot for an object created
  *inside* a pipeline** (see `accessInitialValues()` above) - works today
  for global objects and for correcting an existing pipeline-local
  object's own slot, but what happens to that slot across the owning
  repeater's own future reruns isn't resolved. Left open alongside its own
  competing alternative (dynamic, forward-positioned child repeaters
  instead of writing backward at all), pending an actual attempt at the
  modal/portal case that motivated both.
- **Real multi-version history for the enumeration timeline** (and the
  identical gap for arrays - see `docs/plan-array-timelines.md`). What
  shipped is downstream-only *invalidation*, not a real per-position
  reconstruction of "what the key set looked like as of here" - giving
  either one genuine multi-writing history needs the same
  reconciliation-across-reruns machinery properties get via
  `dispose()`/`staleWritings`, not yet built for either.

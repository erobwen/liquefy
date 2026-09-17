# Plan: flagged repeaters and the pipeline scheduler

Status: **implemented.** `src/test/flagged-repeaters.js`,
`writing-reuse-guard.js`, `writing-reuse-optimization.js`,
`migrate-overtaken-observers.js`, and `multi-pipeline-isolation.js` cover
the mechanisms below; the full suite (68 tests in cascade.reactive, plus
5 in cascade.component and 18 in cascade.DOM) passes, and the demo app's
own real-browser behavior was re-verified against this design (see
"Status" at the end).

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

## Status

Done: migration (a farther dependency correctly catches up to a closer
writing), flagging (deferred, not eager, invalidation for tree-ordered
readers), the writing-reuse guard (reuse only when nothing needs
deferred treatment), `linkRepeater`'s opportunistic inline resolution,
and the full pipeline/heap/wavefront/parking scheduler replacing the old
flat dirty/flagged lists. Verified against the real demo app
(`cascade.application/demo`) in an actual browser, including the
original reconciliation-breaking scenario (menu/hamburger breakpoint
under resize) that motivated this whole line of work.

Explicitly deferred, not needed by any concrete case yet:
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

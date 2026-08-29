# Plan: repeaters reading/writing timelines at their own time

Status: **implemented.** `src/test/pipeline-observeable.js`'s "Main
principle" test passes, including the cyclic-invalidation case below. This
doc is now a record of the design (and the two real bugs it exposed) rather
than a proposal.

## Motivating example

`src/test/pipeline-observeable.js`'s "Main principle" test - a staged
pipeline of repeaters at increasing `time` levels, each transforming a
shared model. Initially traced through by hand assuming today's
single-value-per-property engine would already satisfy it, given the
existing time-level-ordered dirty-repeater scheduling - that assessment
turned out to be wrong once the full trace was redone carefully: stage1 and
stage2 both read *and write* the same property (`a`). With one flat
observer set per property (no notion of time), stage2's write invalidates
stage1 right back, whose write invalidates stage2 again, climbing `a` by 10
then 20 forever - a genuine non-terminating cycle, not just a missed
optimization. Per-time observer sets are what breaks it: stage1 only
depends on the observer set of whatever writing it actually resolved to
(nearest `time <= 1`), which structurally can never be stage2's time-2
writing. This is the concrete justification for the whole feature, not
just a "nicer semantics" argument - implemented and verified to terminate
correctly.

Two real bugs in the original draft test, found and fixed along the way:
- `model.c += model.a + model.b` needed to be `model.c = model.a + model.b`
  (a repeater recomputes its output from current inputs each run;
  accumulating onto its own previous output makes it non-idempotent, and
  produces the wrong numbers on the second run).
- `timeLevels` defaults to 4 (valid indices 0-3), but the test declares
  repeaters at times 1-4 - time 4 is out of bounds. Fixed by giving the test
  its own world (`getWorld({ name: "pipeline-observeable", timeLevels: 5 })`),
  which also isolates it from the shared default-config world other test
  files use (worlds are cached/shared by config signature).

## Read/write rule

Reading property P inside a context (repeater/invalidator) with time T
resolves to the writing with the **largest `time <= T`** in P's timeline,
walking from the cached `currentWriting` via `next`/`previous` (this is
exactly the `seekWriting` seam already built for objects - just needs real
logic instead of always returning the single writing).

This rule needs no special-casing for "first read vs. later reads within the
same execution": a second read in the same repeater execution naturally
finds the writing the first write just created, because the rule is
re-evaluated fresh each time, not memoized per-execution.

### External reads and writes are asymmetric

Found while making the test's own assertions pass (they read `model.a`
etc. from outside any repeater, same as any external code would):
external writes and external reads need *different* times, not both time 0.

- External **writes** (`model.a = 0`, outside any repeater) land at time 0 -
  the baseline, feeding the pipeline as fresh input for every time>0
  repeater to pick up. This was already the existing behavior.
- External **reads** need to see the *latest* writing - the pipeline's
  fully-settled output - not the time-0 baseline. Reading `model.a` at time
  0 would otherwise return the raw, untransformed input (42) instead of the
  result of the whole pipeline (72), which is not what any external
  consumer of the model wants.

Implemented as two time functions instead of one: `currentTime()` (used for
writes and for the delete path) returns 0 for external code, while
`currentReadTime()` (used for every read) returns `Infinity` for external
code - `seekWriting` already walks to `last` for an unbounded time with no
extra logic needed. The two only ever differ when `state.context` is null
(no active repeater/invalidator), which is also exactly when dependency
recording is skipped (`state.inActiveRecording` is false), so this doesn't
change what a repeater's own reads resolve to - only bare, non-reactive
reads/writes from outside any repeater are affected.

## Reruns must fully retract, not merely unset

The hard part: a repeater's *previous* run's writings must not be visible to
its *next* run, or a fresh read at the top of a rerun will find its own
stale prior output instead of falling through to whatever's now current
below it.

Important distinction (this took a couple of iterations to land on): retract
is not the same operation as delete/unset. Delete (`set: false`, as already
built for object properties) is itself a claim - "this property has no
value as of this time" - which is real, notification-worthy information.
Retraction should carry no claim at all: "this specific writer has nothing
to say here." A repeater's branches can genuinely stop touching a property
(or object) entirely between reruns, so leaving any placeholder behind - even
an "unset" one - is wrong. The writing has to actually be removed.

Design, as implemented (`repeater.writings`/`repeater.pendingWritings`,
`retractWritingsIntoPending`/`finalizeWritings` in cascade.js):

- Each repeater tracks `repeater.writings` - a Map from timeline to writing,
  the writings it currently has live - symmetric to the existing
  `repeater.sources` (which tracks what it currently *reads*, cleaned up via
  `removeAllSources`).
- On invalidation (in `dispose()`, alongside the existing `removeAllSources`
  call - covers both "about to rerun" and permanent teardown): unlink every
  writing in `repeater.writings` from its timeline (fixing up
  `previous`/`next`, and `first`/`last`/`currentWriting` if affected) and
  move it into `repeater.pendingWritings`, keyed by timeline - notification
  is deferred, see "Recovering the same-value optimization" below.
- On re-execution, a write checks `pendingWritings` for its timeline first
  (see below) before creating a brand new writing; either way the writing
  ends up back in `repeater.writings`.
- At the end of `refresh()` (and right after disposing each child in
  `disposeChildren()`, since a permanently-torn-down child gets no further
  refresh to do this itself), `finalizeWritings` notifies and discards
  anything still left in `pendingWritings` - never reconciled this run.

## Recovering the same-value optimization

**Implemented together with retraction above, not as a later pass** - once
traced through carefully (see the pipeline test's cyclic-invalidation case
in "Motivating example"), notifying immediately on retraction doesn't just
lose the dedup, it breaks cascade ordering outright: a chain of nested
`dispose()` calls (retraction notifying a dependent, whose own retraction
notifies *its* dependent, ...) could start running a downstream repeater
before an upstream one has even been marked dirty, let alone finished
recomputing. Deferring notification until the real new value is known fixes
both problems at once, for the same reason: notification can now only ever
fire from inside a repeater's own write statement, which only runs after
that repeater has already claimed the outer refresh loop - so a nested
`repeaterDirty()` call is correctly caught by the existing reentrancy guard
instead of racing to start its own loop.

Mechanism:

1. At start of rerun (`dispose()` → `retractWritingsIntoPending`), detach the
   repeater's old writings as before, but instead of notifying immediately,
   stash each one in `pendingWritings`, keyed by timeline.
2. When the repeater writes that property again during this rerun
   (`setHandlerObject`), check `pendingWritings` first:
   - New value equals the pending (old) value → relink it quietly, no
     notification, move it back to `writings`.
   - Differs → update the same writing, relink it, notify, move it to
     `writings`.
3. At the end of the rerun (`finalizeWritings`), anything still in
   `pendingWritings` (branch not taken this time) is genuinely gone -
   notify and discard.

This keeps the correctness property (nothing stale is visible mid-rerun,
since detached entries are structurally gone from the timeline immediately)
while recovering the dedup exactly where it matters, and keeping cascades
correctly ordered. Cost is a small transient side-table scoped to one
repeater's one rerun, not a persistent structure.

This removed the need for the dual-API idea below - not pursuing that.

## Same-time writers (multiple repeaters, same declared time, same property)

Open question raised while designing the above: two different repeaters
both declared at the same `time` level, both touching the same property.
"Nearest writing at `time <= T`" can't disambiguate between them without
knowing not just *which level* but *where within that level's execution*
each one sits.

Proposed simplification (avoids needing a real execution-order clock):
writings that land on the same nominal time for the same property pile
onto a `nextWritingInSameTime` chain, in the order they're actually written
(append-on-write, so the chain is already execution-ordered). Coupling
rule: if any writing in the chain is invalidated/retracted, the whole chain
is - forcing every repeater with a writing in that chain to rerun together,
not just the one whose own read-dependency changed.

Still open: what does a reader *above* that time level actually resolve to
when it lands on a multi-writer slot? Leaning towards "the tail of the
chain" (the most recently written entry), with the "invalidate the whole
chain together" rule being what keeps that meaningful - if an earlier
member changes, the tail's context has shifted and the group needs to
re-settle before the tail can be trusted again.

Not sure this is actually exercised by the real consuming app yet. Treating
as an explicitly-acknowledged limitation until there's a concrete failing
case to design against, per the "ship the simple model first" call made
earlier in this thread.

**Superseded by "repeater trees for time" below** - see that section for the
direction this is actually heading, and for why `meta_repeaters.js` was
removed rather than fixed.

## Repeater trees for time (supersedes ad hoc property-based memoization)

While implementing retraction, `meta_repeaters.js` broke and was removed
rather than fixed. It used a plain property as a memo to avoid recreating a
child repeater on every parent rerun:

```js
array.forEach(function(node) {
  if (node.repeater) return;
  node.repeater = repeat(() => node.emitHelloEvent(...), {dependentOnParent: true});
});
```

This conflicts with retraction at a structural level, not a bug-fixable one:
a repeater reading a property it also writes, at its own time, is exactly
the same shape whether the intent is "pick up fresh external data" (the
pipeline test) or "leave my own prior output alone unless I explicitly
change it" (this pattern) - the engine can't tell those apart from the fact
that a property wasn't touched this run. Patching around it (e.g. letting a
read fall back to a repeater's own retracted writing when nothing fresher
exists below it) fixed the immediate symptom but not the deeper issue: child
repeaters are already disposed unconditionally by `disposeChildren()` on
every parent rerun, regardless of what any property says, so a property-based
memo can end up pointing at an already-dead repeater.

Going forward, parent/child repeater relationships (already tracked
structurally via `addChild`/`children`/`disposeChildren`) become the actual
mechanism for this, instead of a property serving double duty as both
observable data and repeater-identity bookkeeping. Repeaters that create
other repeaters form a real tree, and **each repeater's time is derived from
its place in that tree**, rather than being only a flat number. This means
"time" stops being just an integer level and becomes something closer to a
tree-comparable position - two repeaters' relative time is determined by
comparing where they sit in the tree, not by comparing two plain numbers.

This likely reframes the "same-time writers" problem above rather than
requiring it to be solved head-on: if time is tree position, two repeaters
that would otherwise collide on a flat number may simply occupy different,
comparable positions in the tree instead of the same slot.

Not designed in detail yet - new test cases will be built specifically
against this once the shape of it is worked out.

## Not pursued: supporting old-style mutable observables alongside timelines

Was raised as a hedge in case the reconciliation approach above didn't fully
recover the old engine's optimization characteristics in practice - it did
(see above), so this wasn't needed. Leaving this note in case a real
workload later surfaces a case the reconciliation approach doesn't cover:
the idea was two flavors - `observable()` keeping something like the old
simple single-current-value behavior, and a new `observableOverTime()` (or
similar name) for the full timeline-versioned model built here.

## Status of the suggested order of work

1. Multi-writing timelines: real `next`/`previous` linked list per property,
   real `seekWriting(timeline, time)`. **Done.**
2. Repeater-owned writings (`repeater.writings`) + retraction wired into
   `dispose()`. **Done.**
3. The detach-then-reconcile mechanism for recovering same-value dedup.
   **Done - built in from the start (see above), not as a later pass.**
4. Same-time chains - only once there's a concrete case that needs it.
   **Still not needed; likely superseded by repeater-trees-for-time instead
   of being solved directly (see above).**

All 42 tests in the suite pass, including the full pipeline test
(`meta_repeaters.js` was removed - see "Repeater trees for time" above).

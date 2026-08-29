# Plan: virtualizing arrays into timelines

Status: **planning only, nothing here is implemented yet.** This is a design
discussion to align on before touching `cascade.js`.

## Why

Object properties already went through this move: instead of living directly
on `target`, each property's value now lives in a "writing" on a per-property
timeline (`handler.timelines`), which is what lets `proxy.timelines.a.first`
exist and gives us a seam (`currentWriting`, `seekWriting`) for real
versioning later. Arrays still store their elements the old way, directly on
a real JS array (`target`). This plan is about closing that gap.

## Where arrays differ from objects

- **Objects** have a small, fixed set of named slots. Each slot's whole
  history is "did we overwrite this value" - trivial to represent as one
  writing per key.
- **Arrays** are ordered, bulk data. A single "set index 3" isn't the only
  kind of change - `push`/`pop`/`shift`/`unshift`/`splice`/`sort`/`reverse`/
  `fill`/`copyWithin` all reshape many indices at once. Any per-element write
  model has to be able to represent all of those, which is why a **splice**
  (`index`, `removed`, `added`) is the natural unit of change here, not a
  per-index value the way `set` is for objects. `mergeInto`'s
  `differentialSplices` helper already turns "old array vs new array" into a
  splice sequence for exactly this reason.
- Arrays can *also* carry ordinary named properties (`arr.flag = true`), and
  those behave exactly like object properties. That part should just reuse
  `handler.timelines` as-is - no new design needed there.

## Proposed shape

Each array handler gets **two** kinds of storage, not one:

1. `handler.timelines` - unchanged, reused verbatim from the object work, for
   any non-index string key (`arr.someFlag = ...`, or any string property
   that isn't `length`/a numeric index). All the existing helpers
   (`getOrCreateTimelineWriting`, `hasTimelineValue`, `readTimelineValue`,
   `timelineDataKeys`, ...) already do the right thing here.

2. A new, single **elements timeline** per array handler - e.g.
   `handler.elementsTimeline` - holding the history of structural changes to
   the numeric contents. This is *not* nested inside `handler.timelines`,
   because its writings have a different shape than a property writing (see
   below); it's a parallel, special-purpose timeline, similar in spirit to
   the reserved enumeration timeline but for a different reason.

### The elements timeline's writing

```js
writing = {
  time: 0,
  index: <number>,
  removed: [...],
  added: [...],
  observers: null,   // who depends on the array's structure changing
  next: null,
  previous: null,
}
```

Every mutating array operation - `push`, `pop`, `shift`, `unshift`, `splice`,
`copyWithin`, `reverse`, `sort`, `fill`, and a direct index assignment
(`arr[i] = x`, itself just a 1-for-1 splice at `i`) - normalizes to one of
these. This is barely new work: the existing static overrides in
`createStaticArrayOverrides` already compute `index`/`removed`/`added` for
every one of these operations today (that's exactly what `emitSpliceEvent`
already consumes) - we'd just be capturing that same computation into a
timeline writing instead of only an outgoing event.

**Open question:** with "only one writing per timeline for now" (mirroring
the object rule), what does that one writing actually hold once several
splices have happened? Two options:
- (a) the writing always holds the *latest* splice only (`index`/`removed`/
  `added` describe just the most recent operation), and "the current array"
  lives elsewhere (see `currentShape` below) - splices become purely
  transient/event-shaped until real multi-version history exists.
- (b) collapse the writing into a full-snapshot shape (`index: 0, removed:
  [], added: [...currentShape]`) after every mutation, so it's always
  self-contained.
(a) is cheaper and matches "the writing is really just a log entry", but
means the single writing alone can't reconstruct the array - you need
`currentShape` too. (b) makes the writing self-sufficient but is wasteful
work on every mutation for something we throw away immediately (there's only
one writing, so we recompute the snapshot on every single op). Leaning
towards (a), but this is worth deciding before writing code.

### `currentShape`: the materialized cache

Unlike objects (where we fully emptied `target` into timelines), the plan
is to **keep a real, live JS array as a cache** - `currentShape` - that
always reflects "the array as of `currentWriting`". Every mutating
operation applies itself to `currentShape` exactly like it applies to
`target` today (in fact, `currentShape` most likely *is* `target`, just
given a name that matches the new mental model), in addition to recording
the splice on the elements timeline.

This is a deliberate asymmetry from the object design, and worth calling
out plainly: for objects, the timeline *is* the storage. For arrays, the
timeline is a log layered *beside* a materialized cache, because:

- Native array behavior (`.length`, iteration, spread, `.map`/`.filter`/
  `.includes`/etc., anything ecosystem code does with a "real array") needs
  something that behaves like a real array at all times, cheaply.
- Reconstructing "the current array" by replaying a splice log on every
  read would be a real performance cliff arrays don't need to pay just to
  get versioning.

`currentShape` would live on the elements timeline (`handler.elementsTimeline
.currentShape`), the same way `currentWriting` does - both are "the cache
for right now", just for different questions ("what's the last writing" vs.
"what does the array look like").

### `currentWriting`, reused as-is

Same role as for objects: `handler.elementsTimeline.currentWriting` is the
writing valid "now". For now it's just the (only) writing, exactly like
object timelines. This is what would let two operations at the same logical
time skip straight to the relevant writing instead of walking from `first`,
once there's real history to walk.

### `.length`

`length` is fully derived - reading it is just `currentShape.length`, and
writing it (`arr.length = N`) is really a truncating/extending splice, so it
should route through the same splice path as everything else rather than
being its own timeline entry. Small side benefit: today, `arr.length = N`
only emits a generic `set` event (via `setHandlerArray`'s non-numeric-key
branch), not a proper splice describing what was removed - going through the
canonical splice path would fix that for free.

### Dependency granularity - open question, likely deferred

Today, *any* array read (`getHandlerArray`) records one coarse dependency on
the whole array (`recordDependencyOnArray` / `handler._arrayObservers`),
regardless of which index was read. The elements timeline's writing having
an `observers` field invites the question of whether we go per-index (like
objects) or per-region now. I don't think we should chase that yet:
indices shift under splice operations (insert/remove change what "index 3"
means over time), so "does this write affect what I read" isn't a simple
identity check the way it is for a stable property key - it needs the
region math done properly, which is a bigger undertaking on its own.
Proposal: keep it coarse for this pass (one `observers` set on the elements
timeline's current writing, replacing `_arrayObservers` 1:1), and revisit
per-region granularity once real multi-version history exists and "does
this splice's range overlap the read range" actually needs answering.

## Suggested phased approach (mirrors how the object work went)

1. Add `handler.elementsTimeline` (`first`/`last`/`currentWriting`/
   `currentShape`) at array-observable creation time, with `currentShape`
   initialized to (or aliased as) `target`.
2. Rewrite `createStaticArrayOverrides` methods to also update the elements
   timeline's writing when they run, using the same `index`/`removed`/
   `added` they already compute - no behavior change yet, just also
   recording it.
3. Swap `handler._arrayObservers` for `handler.elementsTimeline
   .currentWriting.observers` in `recordDependencyOnArray`/
   `invalidateArrayObservers`, mirroring exactly what we did for
   `_enumerateObservers` → the enumeration timeline.
4. Route non-index string keys on arrays through `handler.timelines`
   (reuse, no new code) - this is the "properties exist on arrays too" part.
5. Route `.length` writes through the splice path.

Each step should be independently testable against the existing array test
suite (`array.js`, `array-splices.js`) before moving to the next, same as
the object migration was done test-suite-green the whole way through.

## Explicitly out of scope for this plan

- Per-index/per-region dependency granularity (see above).
- Real multi-version history for either objects or arrays (still "one
  writing, time 0" everywhere).
- Anything about `rebuildShapeAnalysis`'s raw-target usage for arrays -
  unrelated pre-existing rough edge, already flagged in `cascade.js`.

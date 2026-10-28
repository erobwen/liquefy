# 8. Reactivity in depth

cascade.reactive is a signal library with one twist: **temporal signals**.
Readers and writers of the same object are ordered in time, so one object can
be read and written along a pipeline - a renderer writing "the next line goes
here", the next renderer reading it - and a change reruns only the readers
after it. This chapter covers the whole public API of cascade.reactive and how
cascade.component uses it.

## 8.1 Worlds

cascade.reactive's API comes from a *world*:

```js
import getWorld from "@liquefy/cascade.reactive"; // also a named export
const world = getWorld({ name: "myApp", timeLevels: 4 });
const { observable, repeat } = world;
```

Calling `getWorld()` again with the same `name` returns the same world; the
options are only read the first time. cascade.component creates the world
named `"cascade.component"` and re-exports its functions. **In a Cascade app,
import `observable`, `repeat` etc. from `@liquefy/cascade.component`**, so your
models and your components share one world. `isObservable()` only recognizes
the world's own observables, and a repeater doesn't follow an observable from
another world: changing it doesn't rerun the repeater. Keep everything a
component reads in one world.

What `@liquefy/cascade.component` re-exports from its world: `observable`,
`deeplyObservable`, `isObservable`, `repeat`, `linkRepeater`, `refreshIfNeeded`,
`retractRepeater`, `withoutRecording`, `invalidateOnChange`,
`postponeInvalidations`, `continueInvalidations`, `flush`,
`accessInitialValues`, `declareState`, `finalize`, `sameAsPreviousDeep`,
`state` - and the world itself as `world`. Everything else is reached through
it: `world.transaction`, `world.withoutReactions`, `world.establish`,
`world.dispose`, `world.caching`, `world.log`.

Options of `getWorld()` (defaults in brackets):

- `name` - the world's identity. Without one, worlds are told apart by their
  whole configuration.
- `timeLevels` [4] - how many time levels repeaters can be put in (8.4).
- `sendEventsToObjects` [true] - call `onChange(event)` on an observable that
  has such a method (8.15). `onEventGlobal` [null] - a function called with
  every event. `emitReBuildEvents` [false] - also emit events for rebuild
  twins.
- `useNonObservablesAsValues` [false], `valueComparisonDepthLimit` [5] -
  compare non-observable values deeply when deciding whether a write changed
  anything.
- `requireRepeaterName`, `requireInvalidatorName` [false] - make the
  description argument mandatory.
- `onWriteGlobal`, `onReadGlobal`, `cannotReadPropertyValue`,
  `customObjectlog`, `customDependencyInterfaceCreator`,
  `customCreateRepeater`, `customCreateInvalidator`, `objectMetaProperty`
  ["causality"] - hooks for extensions; leave them alone in an application.

## 8.2 Observables

```js
const store = observable({ items: [], filter: "" });
observable([1, 2, 3]);
observable(new MyClass());     // or `return observable(this)` from a constructor
deeplyObservable(plainTree);   // every nested object and array, in place (or a copy: deeplyObservable(tree, true))
```

An observable is a proxy that behaves like the plain object: property reads
are tracked, writes notify. Getters and setters on the class are honored (a
getter's reads are tracked like any other). Enumeration (`Object.keys`,
`for ... in`) is tracked too: adding or deleting a property reruns whoever
enumerated.

- Only the object itself is observed. `observable({ list: [] })` makes the
  outer object observable, not the array in it - make the array observable
  too, or use `deeplyObservable()`.
- `observable(x)` on something already observable **throws**. A non-object
  is returned as it is. `deeplyObservable()` leaves already observable
  objects as they are.
- Each observable has a meta object on `.causality` (`obj.causality.id` is a
  unique id).
- **Arrays are temporal too**: each reader sees the array as the writers
  before it left it, and is rerun only when what *it* read changed - its
  length, an index, the whole contents, or an element counted from the end
  (`pop()`, `at(-1)`).
- Writing the same value is not a change: nothing reruns. `NaN` equals
  `NaN`, and two *frozen* plain objects or arrays are compared by content
  (see [5.3](05-callbacks-and-frozen.md#53-frozen)); everything else by
  identity.

## 8.3 Reads and writes in time

Every write is a *writing* at a position; every read finds the writing that
applies at its own position.

- **Inside a repeater**, a read resolves to the writing with the largest
  position at or before the reader; a write is a writing at the repeater's
  position. Positions are compared by `time` level first, then by tree
  position (8.4).
- **Outside any repeater** (event handlers, timers, top-level code), a write
  lands at the **baseline** - time 0, writer `null` - feeding the pipeline as
  input; a read sees the **latest** writing - the pipeline's settled output.
- Every observable's initial contents are baseline writings.
- A repeater's writings belong to it. When it reruns, its previous writings
  are withdrawn at once (readers after it fall through to what is below) and
  reclaimed where the rerun writes the same property again; an unchanged
  value settles quietly. When it is retracted, its writings are undone.
- Independent repeaters (8.4) are parallel pipelines: each reads the other's
  latest writings.

```js
const doc = observable({ line: 0 });
repeat(() => {
  doc.line = 1;
  repeat(() => console.log("A sees", doc.line)); // A sees 1
  doc.line = 2;
  repeat(() => console.log("B sees", doc.line)); // B sees 2
});
doc.line; // 2 - outside, the latest
```

**The significance of the baseline.** A write from an event handler is
*input*: it lands *before* every repeater. So if a repeater also writes that
property, the repeater's writing still wins for everyone after it - including
an outside read:

```js
const m = observable({ v: "base" });
repeat(() => { m.v = "fromRepeater"; });
m.v = "click";   // lands at the baseline, under the repeater's writing
m.v;             // "fromRepeater"
```

So never let a repeater and an event handler both write the same property.
And code that may run *inside* a repeater (a `build()`, an `onDispose()` run
by a rebuild) but means to write input must write at the baseline
explicitly, with `accessInitialValues()` (8.8, and
[10.1](10-pitfalls-and-rules.md#101-write-shared-state-at-the-baseline-when-a-repeater-might-be-running)).

**When work runs.** Everything is synchronous. A write outside any repeater
runs every affected repeater - in pipeline order, lower time levels first -
before the assignment returns. A write inside a running pipeline schedules
its readers, which run when the scheduler reaches their position. To make
several writes and react once, batch them (8.6).

## 8.4 repeat()

```js
const repeater = repeat([description], action, [nonRecordedAction], [options]);
```

- `action(repeater)` is run at once, and again whenever something it read
  changes. `repeat()` returns the repeater object.
- `description` - a string, for debugging.
- With `nonRecordedAction`, the return value of `action` is passed to it,
  unrecorded (MobX `reaction`): reads in `action` are the cause, the
  non-recorded part the effect.
- Created inside another repeater's run, a repeater becomes its **child**:
  part of the parent's pipeline, rerun in place, and retracted when the
  parent's rerun doesn't create it again. Its `time` option is then ignored.
- A repeater created outside any repeater is the **root** of a pipeline of
  its own.

Options:

- `time`: a time level from 0 to `timeLevels - 1` (4 levels by default) for a
  root repeater; anything else throws. Lower levels settle first, and a
  reader at a lower level never sees a writing from a higher one: a level-0
  repeater reading what a level-1 repeater writes sees the baseline. Use it
  to stage a pipeline: model, then view model, then view.
- `independent: true`: a new pipeline of its own even when created inside
  another repeater - never its child, never retracted with it. It runs at its
  creator's time level unless `time` says otherwise. Its first run is
  synchronous; later it reruns on its own when what it read changes, and its
  creator can pull it with `refreshIfNeeded()`. **Its lifecycle is the
  creator's responsibility**: it keeps running after its creator is gone
  until someone calls `retractRepeater()` on it; `repeater.restart()` resumes
  it. (A component's build repeater and `inherit()`'s cached lookups are
  independent repeaters.)
- `onRetract(repeater)`: called once per genuine retraction (not on reruns).
  For side effects the reactive system doesn't know about - a DOM node, a
  subscription.
- `onRefresh(repeater)`: called at the start of every run.
- Used by cascade.component, rarely by applications: `pulledBy` (a repeater,
  or a function returning one, that is invalidated in this repeater's place -
  so this one only runs when pulled), `rebuildShapeAnalysis` (pattern
  matching of what a run constructs), `onStartBuildUpdate`/`onEndBuildUpdate`.

The repeater object: `restart()` (invalidate and run again; brings back a
retracted independent repeater), `retracted`, `disposed`, `description`,
`returnValue` (what the last run of `action` returned), and for debugging
`causalityString()` (what invalidated it) and `sourcesString()` (what it
read).

**Partials.** A repeater is a *tree position*: its run is split into
**partials** at each child it creates or relinks. Writes made between child
*k* and child *k+1* are seen by child *k+1* and after, not by child *k* (the
`doc.line` example in 8.3). This is how a parent can write "before",
"between" and "after" its children - how a component's `render()` places its
own node, then its children, each seeing where the previous one left off.

## 8.5 linkRepeater() and refreshIfNeeded()

- `linkRepeater(repeater)` reattaches an existing repeater as a child at the
  current position (what `renderOnto()` does for an already rendered
  component). It doesn't rerun a clean repeater; an invalid one is rerun by
  the scheduler in its turn, and one merely *flagged* (something it read may
  have changed) is checked on the spot. Returns the repeater.
- `refreshIfNeeded(repeater)` runs a pending repeater right now, at the
  current position, instead of whenever the scheduler reaches it (a pull).
  No-op for an up-to-date or retracted repeater. Whatever the running code
  wrote so far is settled first, so the pulled repeater sees it.

## 8.6 Batching: postponeInvalidations / continueInvalidations

Without a batch, each write outside a repeater runs its readers before it
returns (8.3) - two writes, two runs, and the first run sees a half-made
change. A batch collects the invalidations and runs them once at the end:

```js
postponeInvalidations();
try {
  store.a = 1;
  store.b = 2;
} finally {
  continueInvalidations(); // readers of both run once
}
```

The world's `transaction(fn)` does the same around a callback and returns
its result (`world.transaction`, not re-exported by name). Batches nest:
every `postponeInvalidations()` needs its `continueInvalidations()`, also
when the code in between throws. Don't *read* inside a batch expecting
derived values to be up to date - nothing has rerun yet.

## 8.7 flush()

Work is processed in *waves* that move forward through each pipeline, lower
time levels first. A change discovered *behind* the current wave (a later
repeater wrote to something an earlier one already read) is parked: the rest
of the wave runs first, and the earlier reader catches up in a following
wave - after things that come later in the pipeline, and whatever depends on
its result runs again. Everything still finishes before the outermost write
returns.

`flush(fn)` makes invalidations caused inside `fn` retreat the wave instead:
they are processed in order within this one. This is how a portal or overlay
frame that already rendered fills in during the same pass - the source,
rendered later, assigns the portal's contents:

```js
show(contents) {
  flush(() => this.setState({ contents })); // setState: at the baseline; flush: in this wave
}
```

`flush()` changes *when* work is processed, not *where* a write lands
(that is `accessInitialValues()`). It only matters for writes made while a
pipeline runs. An oscillating correction (A writes back to B, which changes
A again) is your responsibility, like any loop. Returns `fn`'s result.

## 8.8 accessInitialValues()

`accessInitialValues(fn)` runs `fn` as if outside any repeater: writes land
at the baseline, reads see the latest. It changes *where* a write lands.
Returns `fn`'s result.

Use it for:

- writing *input* from code that might run inside a repeater - shared state
  touched from a `build()`, `render()`, `onDispose()` (see
  [10.1](10-pitfalls-and-rules.md#101-write-shared-state-at-the-baseline-when-a-repeater-might-be-running));
- writing component state from inside a pipeline - `Component.setState()` is
  `accessInitialValues()` around the writes;
- writing anything a render context holds ([6.1](06-context.md#61-provide-and-inherit)).

Compare first, so an unchanged value writes nothing:

```js
if (withoutRecording(() => focus.owner) !== owner) {
  accessInitialValues(() => { focus.owner = owner; });
}
```

Compose with `flush()` when the effect must also settle in the same wave:
`accessInitialValues(() => flush(() => ...))` (either order).

## 8.9 withoutRecording()

`withoutRecording(fn)` reads without creating dependencies and returns `fn`'s
result: debug output, comparing before writing, reads in `onShow()`, reading
something you must not rerun on. Writes inside it are ordinary writes.

`world.withoutReactions(fn)` (not re-exported by cascade.component) writes
without notifying anyone. Readers keep stale values until they rerun for
some other reason - rarely what you want.

## 8.10 Retraction: retractRepeater() and restart()

`retractRepeater(repeater)` takes a repeater and its whole subtree down.

- *Retracted* is not *disposed*: a retracted repeater is intact and
  re-linkable (`linkRepeater()`, or `restart()` for an independent one); a
  disposed one is gone. A child that its parent's rerun doesn't create again
  is retracted the same way.
- It happens in two phases: first every repeater in the tree is disposed,
  unsubscribed and marked retracted; then their writings are undone and
  their `onRetract()` callbacks fire. So nothing inside the tree reruns
  against half-undone writings.
- Undoing writings notifies the readers **outside** the retracted tree, which
  rerun. Inside a running pipeline those notifications are queued; from
  outside any pipeline (an event handler, a `setTimeout`) they run
  immediately.
- Idempotent.
- `repeater.restart()` invalidates a repeater so it runs again; for a
  retracted independent (root) repeater, it is what brings it back.

```js
const writer = repeat(() => { r.y = "written"; });
retractRepeater(writer); // r.y is "base" again; its readers rerun
writer.restart();        // r.y is "written" again
```

`Component.onDispose()` retracts a dropped component's repeaters this way,
immediately, so no stale, already-queued rerun of it can run first. A
component that is merely not shown for a while keeps its build repeater (it
is left invalid and revalidated when shown again), so keyed children keep
their identity and state.

## 8.11 invalidateOnChange()

```js
invalidateOnChange(() => { cache = compute(); }, () => { cache = null; });
invalidateOnChange("description", doFirst, doAfterChange);
```

Runs `doFirst` recording its reads; on the **first** change of any of them,
calls `doAfterChange` once, and that's it - one shot. `doAfterChange` should
not modify observables (use a repeater for that). Returns the invalidator
(`returnValue` holds what `doFirst` returned). For lazily filled caches and
integrating other systems.

`world.caching(fn)` is a ready-made cache on top of it: `fn` with its results
cached per argument list (observables by identity, numbers and strings by
value) until something they were computed from changes. An entry costs
nothing once cleared, but clearing it invalidates every reader even if the
recomputed value turns out the same - use it for many values read now and
then. For values read all the time, whose inputs change without changing
them, a repeater that keeps the value up to date is better (that is how
`inherit()` caches).

## 8.12 Rebuilding data structures with build ids

Outside components, `observable(object, buildId)` inside a repeater gives a
created object a build identity: on the next run, constructing the same
build id returns the established object, with its properties merged in.

```js
repeat(() => {
  for (const input of inputs) {
    index.add(observable({ value: input.value }, "entry" + input.id));
  }
});
```

- A build id must be unique within one run of the repeater (a duplicate
  throws), not just among siblings.
- The same build id with an object of a different class is a replacement:
  the new object is created fresh and the established one disposed.
- An object whose build id is not constructed again is disposed.
- Objects with `onEstablish()`/`onDispose()` are told when they are first
  created and when a run no longer creates them. `world.establish(object)`
  and `world.dispose(object)` do the same by hand, for an object you own;
  `finalize(object)` finishes one constructed in a run (internal to
  rebuilding).

Components use exactly this mechanism (a component's key is its build id;
without one, `rebuildShapeAnalysis` matches by class and place - see
[4](04-identity.md)).

## 8.13 State: declareState()

`declareState(object, defaults)` declares some properties of an observable
as *state* and writes their defaults at the baseline. Two rules are then
enforced:

1. Writing a state property from inside a repeater **throws** - state is
   written from outside any repeater (an event handler) or deliberately at
   the baseline, with `accessInitialValues()`.
2. A rebuild never copies a state property from the throwaway twin onto the
   established object, so a rebuild never resets state.

`Component`'s constructor calls it with what `initialState()` returns, and
`setState()` is the sanctioned way to write state from inside a pipeline (see
[3.3](03-components.md#33-state)).

Its counterpart for properties is `declareGiven(object, keys, onWrite)`:
properties are changed only by a rebuild copying new values over, inside a
repeater, so a write to one from *outside* any repeater calls `onWrite(key)`.
`Component`'s constructor declares whatever `setProperties()` wrote, and
warns (see [3.2](03-components.md#32-properties)).

## 8.14 Errors

- An error thrown in a repeater's first run comes out of `repeat()`.
- An error thrown in a rerun comes out of whatever triggered it - usually the
  **write** in your event handler (`store.x = 1` throws), or
  `continueInvalidations()`. The scheduler keeps working; the repeater that
  threw is left alone until something invalidates it again.
- The world's global state (the running repeater, recording, batching) is
  always restored, even when a callback throws.

## 8.15 Events and debugging

- With `sendEventsToObjects` on (the default), an observable whose class has
  an `onChange(event)` method - or which was created with an `onChange`
  function property - gets called with every event of that object: `create`,
  `set` (`property`, `newValue`, `oldValue`), `delete`, `splice`, `reCreate`,
  `dispose`. Don't name a method `onChange` on a model class by accident.
- `world.log(entity)`, `logGroup`, `logUngroup`, `logToString`, `loge`,
  `logs`, `logss` - debug output that never records dependencies.
- Give repeaters a description (`repeat("cart total", () => ...)`) and use
  `repeater.causalityString()` to see what invalidated one.
- `world.state` (re-exported as `state`), `enterContext`, `leaveContext`,
  `invalidateObserver` and the timeline functions are for extensions.

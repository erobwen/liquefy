# Plan: temporal arrays

Status: **implemented.** `src/test/temporal-arrays.js` covers the reader
kinds and the write semantics below, `src/test/temporal-arrays-fuzz.js`
checks random trees pushing onto one array against a from-scratch walk.
The full suite passes (cascade.reactive, and cascade.component/DOM/ui/
ui.material unchanged). The design lives in cascade.js's own "Temporal
arrays" section; this doc is the record of how it came to look like it
does, and where it departs from the plan it replaced.

## The idea

An array's elements are positioned in time like a property's value: a
reader sees what was written *before* it - by tree position, by time level
- never what's written after it. And a reader reruns only when what *it*
read changed. There are four kinds of reader:

- **whole** - iteration, `Object.keys`, and the reading methods (`map`,
  `slice`, `indexOf`, `join`, ...): any change to the elements.
- **length** - `arr.length`.
- **index i** - `arr[i]`, `at(i)`, and `shift()` (index 0, the first):
  that element, and whether it's there.
- **from the end** - `pop()` (the last), `at(-k)`: the k:th element counted
  from the end.

A change flags every reader positioned after it. A flagged reader, once the
wavefront reaches it, checks whether its own read really changed: a popper
only cares whether the last element is still the same, a reader of `arr[2]`
only whether `arr[2]` is. Other (non-index) properties of an array are
ordinary properties.

## Storage: an elements timeline of operations

`handler.elements` is a timeline like a property's - same `(time, writer)`
positions, same `seekWriting`, splicing, parallel-pipeline ownership,
`dispose()`/`staleWritings` retraction and reuse across reruns. What a
writing holds differs:

- The **baseline** (time 0, writer null) holds the content outright
  (`ops === null`) - construction, and every write from outside any
  repeater (or inside `accessInitialValues()`).
- A **repeater's writing** holds the *operations* its partial performed
  (`ops`: push, pop, splice, set, delete, length, sort, ..., and `assign`
  for a wholesale replacement). Its content is its predecessor's, with
  the operations replayed.

So writes are relative: a push says "one more, after whatever's before
me". When something before it changes, the push is replayed on that,
without its writer running again (`temporal-arrays.js`: "pushers don't
depend on each other", "a sort is replayed...").

**The cursor.** Contents aren't kept per writing. The timeline holds one
current content (`cursorContent`) - the elements as of one writing
(`cursorWriting`) - and `moveArrayCursor()` moves it to wherever a read
or write needs it: forward by replaying the operations in between, else by
rebuilding from the baseline. Forward is the common case - repeaters run
one after another in position order, and so does the wavefront checking
flagged readers - so a pusher costs one push, and a whole wave one rebuild
at its start. A change at or before the cursor drops it (it rebuilds when
next needed); a change after it - looked for a few writings ahead, see
`arrayWritingIsAfterCursor()` - leaves it be. A writing relinked right
back after the same predecessor (`retouchSubtreeWritings()` relinks every
writing of a child the first time it's attached) keeps it too: without
that, every pusher of a first render rebuilt from the baseline.

**Departure from the plan.** The plan proposed one coarse observer set and
a single "latest splice" writing, with the target array as the one
materialized content. Neither survives contact with position: a reader at
position P needs *the content as of P*, and a writer's operations have to
be replayable for its content to follow a changing predecessor. Hence
per-writing operations, and a cursor to materialize them where needed.

(A first version cached a full content per writing instead, as immutable
snapshots. Simple, but n pushers onto one array held O(n²) elements, and a
change near the start of a long one was quadratic - 1.5 s for 3000 pushers
against 0.12 s with the cursor. See `src/experiments/temporal-array-pushers.js`.)

**The target** is now only a mirror of the latest content - kept for
debuggers and Node's `util.inspect`, which look at a proxy's target
directly, bypassing traps. It's kept in step cheaply when an operation
lands on the last writing, and otherwise copied over at rest
(`flushArrayMirrors()`, at the end of a scheduler drain, a top-level
`repeat()`, or an external write).

## Readers keep what they found

The cursor moves on, so a reader can't keep a reference to what it saw -
it keeps the values themselves, on its dependency entry
(`entry.arrayRead`): a copy of the elements for a whole read (which costs
as much as copying them anyway), the length, or one slot - whether there's
an element there, and which - per index or from-the-end read. Checking a
read is moving the cursor to the reader's position and comparing -
`arrayReadChanged()`, with `sameAsPrevious()` per element, so frozen
plain data compares by value (that's what makes the Paper demo's words,
each pushing a frozen `{ text, line, column }`, stop the cascade as soon
as a word lands where it did before). A whole read hands out a copy too -
it may be iterated, or passed to callbacks, while the cursor moves.

This is what makes everything else simple. Properties need writing-level
bookkeeping to decide when to notify - `nextValue` buffering,
`staleWritingNeedsRetirement`, freezing a retired writing's value as a
comparison reference - because their flagged readers compare *writings*.
Array readers compare *what they saw*, so nothing has to be kept stable on
their behalf: a reused writing is simply mutated, and readers decide.

## Settling: flag everything after a change

`settleArrayChange(writing)` - for a write, an insertion, a reclaimed or
retouched writing - settles every reader positioned after it: those of the
writing before it that are overtaken, and every reader of it and of every
writing after it, since all their contents replay through it. Same-pipeline
readers are flagged (`flagRepeaterEntry`), and checked when the wavefront
reaches them (`recheckArrayEntry()`, from `resolveFlaggedRepeater`).
Readers with no wavefront between them and the change - invalidators,
other pipelines' readers, and anyone at all for an external write - are
checked right away. A partial's own writes settle once, when it closes
(`settleTouchedArrayWritings()`, from `finalizeTouchedStaleWritings()`),
not once per push. An abandoned writing (`abandonStaleArrayWriting()`)
settles its own readers and everything after where it was.

Readers after the wavefront stay flagged until it reaches them, so a wave
of writers rerunning one after another would visit the same flagged
readers again at every one of them - quadratic. A writing whose readers
are all flagged already is marked (`observersAllFlagged`) and passed by,
until a read is recorded on it, an entry is moved onto it, or one of its
entries is resolved.

**Writes that read.** `pop()`/`shift()` read what they remove (from the
end / index 0). `splice()` reads the elements it removes, and the length
wherever its range is relative to it. `push()`/`unshift()` return the new
length but *don't* record reading it - a pusher shouldn't rerun because
something before it pushed too. A partial reading its *own* writing (after
its own push, say) is recorded as a whole read of the writing before its
own: that's what its operations replay on, and its own later operations
mustn't make it rerun for what it did itself.

**Rebuilds.** `mergeInto()` writes a rebuilt array's elements into the
established one with one absolute `assign` (`world.assignArray`), read
through the twin's proxy without recording - not differential splices
computed from raw targets, which would be relative to whatever the
established array happened to hold at the merge's position.

## Two engine fixes the fuzz forced

Both are general, not array-specific - arrays just reach them far more
often, because a change flags everything downstream rather than only the
readers of one writing.

1. **A flag that resolves to a real change runs in the same wave.** A
   flagged repeater resolved at the wavefront and found changed was
   invalidated and - being *at* the wavefront - parked by `scheduleWork()`
   for the next wave. By then the readers after it had already been
   checked against the transient state it was about to correct: in
   `temporal-arrays.js`'s "a change undone before the wavefront reaches a
   reader", A changes, B (which reads A's last element) restores it, and
   C reran anyway. `drainActivePipeline()` now processes it again right
   there, as its root loop already did for the root.

2. **Moving an invalidated child retouches its children's writings
   too.** `retouchSubtreeWritings()` walked a moved child's `.children` -
   empty if the child had already been disposed (here, by `linkRepeater()`
   resolving its flags just before reattaching it), leaving the
   grandchildren's writings where the old order put them. It now includes
   `pendingChildren`. That needed `structuralCompareSiblings()` to order
   two siblings both still pending in the same list - by their previous
   run's position numbers, which are exactly where their writings still
   are - instead of giving up and falling back to possibly stale order
   numbers.

## Behavior that changed

- An array write from a later position no longer reaches an earlier
  reader. `test/flush.js` used to rely on exactly that ("arrays still have
  no position gate", its own note said); its corrections now go through
  `accessInitialValues()`, the sanctioned way to write backward, the same
  as for properties.
- Two parallel pipelines (different chainHeads) can no longer both write
  one array at the same time level - the property rule, now for elements
  too.
- A rebuild's merge into an established array emits one `splice` event
  (index 0, everything removed, everything added) instead of a series of
  differential ones.

## Open

- **Moving the cursor backward rebuilds from the baseline** - O(the
  operations before the position). Once per wave in the common case; if
  readers ever jump back and forth a lot, undo information recorded while
  moving forward, or a few checkpoints, would make it cheaper.
- **`sort()`'s comparator is replayed** whenever its predecessor changes,
  without recording - a comparator that reads observables sees whatever
  they hold at replay time.
- **Property reordering.** Running `reorder-fuzz.js` (properties, not
  arrays) with more seeds and steps than it ships with still finds
  failures - seeds 159 and 245 at 25 steps. Fewer than before the two fixes
  above (at HEAD it failed from seed 47), but there's a remaining
  moved-subtree case for property timelines. Not array-specific; not
  chased here.

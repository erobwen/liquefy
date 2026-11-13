# 1. Concepts

Cascade is a reactive front-end framework. You write components as classes
with a `build()` method, as in React, and state is observed automatically, as
in MobX: whatever a `build()` reads is tracked, and the build runs again when
any of it changes. Only what actually changed in the result is touched in the
page.

Two things are different from what you may be used to.

**Components render directly onto their target, in one pass, in tree
order.** There is no virtual DOM built first and reconciled later. A
component renders, then its children render after it, each placing its
element after the element placed before it. A parent can render, measure
the room it has, and hand that to its children in the same pass. The target
is usually the real DOM (cascade.dom), but cascade.component knows nothing
about the DOM: a render target can be anything - a paper that words lay
themselves out on, say (see [3.6](03-components.md#36-rendertarget-context)).

**Temporal signals.** In most signal libraries an observable property has one
value. Cascade has those too - `observable()` - and they are what your
models, your components and their contexts are. But it also has *temporal*
objects - `temporal()` - whose readers and writers are ordered by their
position in the tree (in time, as the render pass proceeds). A reader sees
the value as written by the last writer *before* it. A write is seen by the
readers after it in tree order, not by those before it. When a write
changes, only the readers after it are invalidated. Render targets are
temporal: that is how each component finds where the one before it left
off.

```js
import getWorld from "@liquefy/cascade.reactive";
const { temporal, repeat } = getWorld({ name: "example" });

const layout = temporal({ width: 1000 });

repeat(() => {
  repeat(() => console.log("Header sees width", layout.width));  // before the write
  repeat(() => { layout.width = layout.width - 200; });          // the sidebar takes 200
  repeat(() => console.log("Content sees width", layout.width)); // after it
});
// Header sees width 1000
// Content sees width 800

layout.width = 1200;
// Header sees width 1200
// Content sees width 1000

console.log(layout.width); // 1000 - read from outside: after the whole pipeline
```

(This example makes a world of its own, to show cascade.reactive alone. In an
app, import `observable`, `temporal` and the rest from `@liquefy/cascade.component`, so
your models live in the same world as your components - see
[9.1](09-reactivity.md#91-worlds).)

This is what lets a sequence of steps transform the *same* objects - a word
processor laying paragraphs onto pages, a toolbar claiming height before the
content measures what is left - and still be updated incrementally: change
one paragraph, and only it and what comes after it run again.

## The mental model

- A **component** has *properties* (given by whoever builds it, again on every
  rebuild), *state* (set once, then changed by the user) and *unobservables*
  (plain, non-reactive bookkeeping).
- `build()` returns child components. It is a reactive function: it reruns
  when anything it read changes. What it returns is matched to what it
  returned last time, so that the same component stays the same component -
  its state and its DOM elements kept. Matching is by class and place
  (pattern matching), or by key for what can move, appear or disappear.
- A component's properties are compared with their previous values when its
  creator rebuilds it. Only a *changed* property reruns what read it. A new
  closure or a new object literal is a change every time, so stable
  callbacks (`callback()`) and value-compared data (`frozen()`) are what keep
  a rebuild from rippling down the whole tree (see
  [6](06-callbacks-and-frozen.md#6-callbacks-view-and-frozen)).
- Rendering is a tree of reactive **repeaters** (a repeater is MobX's
  `autorun`). Each component's render is one repeater, a child of its parent's.
  The whole tree is one **pipeline**; position in the tree is time.
- A component's `build()` runs in a repeater of its own, an *independent*
  pipeline, parallel to rendering. Builds read the *latest* value of what
  they read; renders read the value as of their place in the tree. So a
  build may read the render context (which holds only values that don't
  change during a pass), but never the render target (which does).
- A component constructed in a `build()` belongs to that build: it is
  established when first built and disposed when a rebuild no longer
  constructs it. Anything created any other way is owned by whoever created
  it, who must `establish()` and `dispose()` it (see
  [3.8](03-components.md#38-components-you-own-created-outside-build)).
- Almost everything is **timeless** (`observable()`): models, components,
  render contexts. A property has one value; whoever writes it, from
  wherever, every reader of it sees the write. Only render targets - and
  whatever else a render pass threads its state through, like the pages a
  document is laid out on - are **temporal** (`temporal()`).
- On a temporal object, a write made *outside* any repeater (an event
  handler, a `setTimeout`) lands at the **baseline** (time 0, before
  everything), and a read from outside sees the latest value, after the
  whole pipeline.

Keep the last two points in mind: they are the source of the most important
rule in this manual - models are `observable()`, not `temporal()` (see
[11.1](11-pitfalls-and-rules.md#111-models-are-observable-only-what-a-pass-threads-through-is-temporal)).

## What to read first

Before building anything, read [2](02-project-setup.md) to
[6](06-callbacks-and-frozen.md) - components, identity, callbacks and
`frozen()` - and [11](11-pitfalls-and-rules.md). Most surprises in Cascade
come from identity (which component a rebuild keeps) and from properties
that change when they shouldn't; those chapters are about exactly that.

# 6. Callbacks, view() and frozen()

When a creator rebuilds, each child it constructs again is compared, property
by property, with what it was given last time (see
[5.3](05-identity.md#53-what-happens-to-a-matched-component)). Only a changed
property reruns what read it. Two kinds of value are new every build without
meaning anything new: closures and object literals. `callback()` and
`frozen()` are how you tell Cascade they are the same as before, so that a
rebuild stops at the children that really changed instead of rippling down
through every one of them.

## 6.1 callback(key, fn)

A plain closure is a new function every build, so passed as a property it
counts as a change every time, and the child re-renders (or rebuilds, if its
build reads the property). In a list, every row does, on every build of the
list. `callback(key, fn)` returns one stable function for as long as the
building component lives, always calling the closure from the latest build -
so nothing it captures is ever stale:

```js
button({ onClick: callback("clear", () => { this.chosen = []; }) })
this.items.map((item) => tile({ key: item.id, onclick: callback(item.id + "Toggle", () => this.toggle(item.id)) }))
```

- The key names the callback, the way a key names a component. Callback
  keys are separate from component keys, and scoped to the component whose
  `build()` is running (helpers called from that build share them).
- Keys are unique among the callbacks of one build: a duplicate warns, and
  the second takes over the first, both getting the same function.
- A callback a build no longer makes is dropped when that build is done; made
  again later, it is a new function.
- Called outside any build - from `render()` or an event handler, say -
  `callback()` returns `fn` itself. Make callbacks in `build()`.

When to use which: a plain closure is fine for a quick
prototype - it costs a re-render, nothing breaks. Name callbacks in code
that is meant to last. And a plain closure is *right* for a function a child
calls while it builds - a frame that measures the room it has and then calls
a passed-in function to build its content into it. There a new function
really is new, and must count as a change. That is why Cascade doesn't make
function properties stable by itself.

## 6.2 view(name, build, methods)

For the many small components that only build:

```js
const provenanceRow = view("ProvenanceRow", ({ line }) =>
  tr(td(text(line.status)), td(text(line.key + " = " + line.value))));

tbody(lines.map((line) => provenanceRow({ key: line.key, line })));
```

- `build` is called with the component itself (destructure its properties,
  read its state, call `inherit()`). Reads are tracked, as in any
  `build()`.
- `name` is the class name used in errors, component paths and debug ids.
- The returned function takes the same argument list a constructor does
  (key, properties, children - see [4](04-creator-functions.md#4-creator-functions-and-argument-lists)).
- `methods` go onto the class as they are - written as methods, not arrow
  functions, so `this` is the component - e.g. `setProperties()` to
  `frozen()` plain-data properties, or `initialState()`. `build` may not be
  among them.
- A view has its own key namespace, so a keyed helper made a view can be used
  any number of times in one build.
- The returned function has `.componentClass` for `instanceof`.

Without a `setProperties()`, every property is compared by identity: a view
given a fresh object literal on every build rebuilds every time.

```js
const card = view("Card", ({ style, children }) => div({ style }, children), {
  setProperties({ style, children }) {
    this.style = frozen(style);
    this.children = frozen(children);
  },
  initialState() {
    return { open: false };
  },
});
```

Anything more than this is clearer as a class.

## 6.3 frozen()

`frozen(value)` deep-freezes the plain data in `value` (plain objects and
arrays) in place and returns it. Two frozen values are compared **by
content**; unfrozen values by identity.

```js
setProperties({ style, children, model }) {
  this.style = frozen(style);       // a value: an equal style in a new object is no change
  this.children = frozen(children); // the array a value; the components in it stay references
  this.model = model;               // a reference: compared by identity
}
```

Why it matters: without it, `card({ style: { padding: "8px" } }, ...)` gives
the card a new style object on every build of its creator. The card counts
as changed, reruns, and constructs its own children again with *their*
fresh literals, and so on down. With `style` and `children` frozen, an equal
style is no change, and so is a children array holding the same components:
the matched children are the established ones, so the array is equal. The
creator's rebuild stops at the card; a child whose own properties changed
reruns by itself.

- The comparison applies wherever an observable property is written, not
  only when a rebuild copies properties: writing an equal frozen value to
  any observable invalidates nothing.
- Freezing stops at observables (components included), class instances,
  functions and DOM nodes. Inside a frozen value, those are compared by
  identity.
- In place: data that also lives elsewhere (a server answer in your store) is
  frozen there too, and mutating it later throws. Hand over a copy, or
  replace data in the store instead of mutating it.
- Don't freeze large structures or models: compared by identity, their
  identity stands for the whole, which is cheaper than comparing them node
  by node. Pass observables (models) as they are.
- `null` and `undefined` pass through; `frozen(style || null)` is the common
  form.
- `isPlainData(value)` tells whether `frozen()` would freeze a value.

cascade.dom's elements and cascade.ui's widgets already freeze their own
`style`, `children` and attributes. You need `frozen()` in the
`setProperties()` of your own components (and views) that take such
properties.

# Cascade: User Guide and Reference Manual

This manual is for developers who know JavaScript and a reactive UI framework
(React, MobX, signals) and want to build applications with Cascade. It covers
the four core packages:

| Package | What it is |
|---|---|
| `@liquefy/cascade.reactive` | Temporal signals: observables, repeaters, pipelines, retraction |
| `@liquefy/cascade.component` | Components: build(), state, properties, keys, context, services |
| `@liquefy/cascade.dom` | Rendering onto the real DOM, HTML tag functions, measurement, animation, portals, routing |
| `@liquefy/cascade.ui` | Themed widgets, layout, overlays, modals, drawers, popovers, color schemes |

```console
npm install @liquefy/cascade.ui @liquefy/cascade.dom @liquefy/cascade.component @liquefy/cascade.reactive
```

Contents:

1. [Introduction](#1-introduction)
2. [Getting started](#2-getting-started)
3. [Components](#3-components)
4. [Identity: keys and pattern matching](#4-identity-keys-and-pattern-matching)
5. [Callbacks, view() and frozen()](#5-callbacks-view-and-frozen)
6. [Context: provide(), inherit(), render target and render context](#6-context-provide-inherit-render-target-and-render-context)
7. [Services and hydration](#7-services-and-hydration)
8. [Reactivity in depth](#8-reactivity-in-depth)
9. [DOM specifics and UI widgets](#9-dom-specifics-and-ui-widgets)
10. [Pitfalls and rules](#10-pitfalls-and-rules)
11. [API reference](#11-api-reference)

---

## 1. Introduction

Cascade is a reactive front-end framework. You write components as classes
with a `build()` method, as in React, and state is observed automatically, as
in MobX: whatever a `build()` reads is tracked, and the build runs again when
any of it changes. Only what actually changed in the result is touched in the
page.

Two things are different from what you may be used to.

**Components render directly onto the real DOM, in one pass, in tree order.**
There is no virtual DOM built first and reconciled later. A component renders,
then its children render after it, each placing its element after the
element placed before it. A parent can render, measure the room it has, and
hand that to its children in the same pass.

**Temporal signals.** In most signal libraries an observable property has one
value. In Cascade, the readers and writers of the same property are ordered
by their position in the tree (in time, as the render pass proceeds). A
reader sees the value as written by the last writer *before* it. A write is
seen by the readers after it in tree order, not by those before it. When a
write changes, only the readers after it are invalidated.

```js
import getWorld from "@liquefy/cascade.reactive";
const { observable, repeat } = getWorld({ name: "example" });

const layout = observable({ width: 1000 });

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
```

This is what lets a sequence of steps transform the *same* objects - a word
processor laying paragraphs onto pages, a toolbar claiming height before the
content measures what is left - and still be updated incrementally: change
one paragraph, and only it and what comes after it run again.

### The mental model

- A **component** has *properties* (given by whoever builds it, again on every
  rebuild), *state* (set once, then changed by the user) and *unobservables*
  (plain, non-reactive bookkeeping).
- `build()` returns child components. It is a reactive function: it reruns
  when anything it read changes. What it returns is matched to what it
  returned last time, so that the same component stays the same component -
  its state and its DOM elements kept.
- Rendering is a tree of reactive **repeaters** (a repeater is MobX's
  `autorun`). Each component's render is one repeater, a child of its parent's.
  The whole tree is one **pipeline**; position in the tree is time.
- A component's `build()` runs in a repeater of its own, an *independent*
  pipeline, parallel to rendering. Builds read the *latest* value of what
  they read; renders read the value as of their place in the tree.
- Writes made *outside* any repeater (an event handler, a `setTimeout`) land
  at the **baseline** (time 0, before everything). Reads from outside any
  repeater see the latest value, after the whole pipeline.

Keep the last point in mind: it is the source of the most important rule in
this manual (see [10.1](#101-write-shared-state-at-the-baseline-when-a-repeater-might-be-running)).

---

## 2. Getting started

A Cascade app needs three things: a **render target** (where it goes), a
**render context** carrying a **service locator** (where components get their
elements and widgets from), and a root component that is **established** and
then **rendered onto** the target.

```html
<!-- index.html -->
<div id="app"></div>
<script type="module" src="/src/main.js"></script>
```

```js
// src/main.js
import { Component, RenderContext, CompoundServiceLocator, callback } from "@liquefy/cascade.component";
import { DOMElementTarget, DOMServiceLocator, DOMDebugServiceLocator, h1, p, text } from "@liquefy/cascade.dom";
import { basicTheme, button, column } from "@liquefy/cascade.ui";

class Counter extends Component {
  // Properties: given by whoever builds it - again on every rebuild.
  setProperties({ label }) {
    this.label = label;
  }

  // State: established once, then changed only by the user.
  initialState() {
    return { count: 0 };
  }

  // Reactive: runs again when this.label or this.count changes.
  build() {
    return column(
      { style: { gap: "8px", padding: "20px" } },
      h1(text(this.label)),
      p(text("Clicked " + this.count + " times")),
      button(text("Click me"), callback("click", () => { this.count++; })),
    );
  }
}

// Where it all goes.
const target = DOMElementTarget.forElement(document.getElementById("app"));

// Asked in order: real DOM elements, then the theme's widgets, then a debug
// locator that renders a visible placeholder for anything nobody provides.
const services = new CompoundServiceLocator(
  new DOMServiceLocator(),
  basicTheme,
  new DOMDebugServiceLocator(),
);

// The root component is created here, not by anyone's build(), so it is
// established here. It lives as long as the app: nothing to dispose.
new Counter({ label: "Hello Cascade" })
  .establish()
  .renderOnto(target, new RenderContext({ serviceLocator: services }));
```

Notes:

- `new RenderContext(provided, parent)` - the root context provides
  `serviceLocator`. Everything below finds it.
- The shortest form, used by the package READMEs, passes just the theme:
  `new RenderContext({ serviceLocator: basicTheme })`. HTML tag functions fall
  back to `defaultDOMServiceLocator` (a `DOMServiceLocator` followed by a
  `DOMDebugServiceLocator`) when no locator in the context provides an
  element, so this works too.
- To switch themes while the app runs, use an `ObservableCompoundServiceLocator`
  and replace a locator in it (see [7](#7-services-and-hydration)).
- The themes draw icons with Google's icon fonts; link them in your page if
  you use `icon()` or `iconButton()`:
  ```html
  <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined" rel="stylesheet">
  <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
  ```

> **Text is `text()`.** A leading lowercase string (or a number) given to an
> element or widget function is its *key*, not its text: `div("header", ...)`
> is a div keyed `"header"`. Wrap text in `text("...")`. See
> [10.6](#106-a-leading-lowercase-string-is-a-key-not-text).

---

## 3. Components

A component is a class extending `Component`. Most implement only
`build()`; some also `setProperties()`, `initialState()`, `provide()` or
lifecycle hooks.

### 3.1 Constructing a component

The constructor accepts a flexible argument list (inherited from Flow):

```js
new Card({ key: "summary", title: "Summary" })   // one properties object
div({ style: { padding: "8px" } }, childA, childB) // properties, then loose children
div("toolbar", buttonA, buttonB)                  // leading lowercase string: the key
```

- A trailing or leading plain object is the properties bag (only one allowed).
- Loose components, strings and numbers become `children`; nested arrays are
  flattened; `null`, `undefined` and `false` hold a place but render nothing.
- The first loose argument, if it is a number or a string starting with a
  lowercase letter, becomes the implicit `key`.

Inside a `build()`, constructing a component is how you create a child: the
component whose `build()` is running becomes its **creator**.

### 3.2 Properties

Properties are like a function's arguments: set by the creator on every
build. Override `setProperties(properties)` to interpret them; the default
copies every property onto the component (`Object.assign(this, properties)`).

```js
class Badge extends Component {
  setProperties({ label, style, children }) {
    this.label = label;
    this.style = frozen(style);       // plain data: compared by content
    this.children = frozen(children); // the array is a value, the components in it references
  }
}
```

On a rebuild, a new instance is constructed and its properties are copied onto
the established instance. A property that did not change does not invalidate
anything. "Did not change" means *identical* - unless both values are
`frozen()` plain data, which is compared by content (see
[5.3](#53-frozen)).

### 3.3 State

State is declared by `initialState()`, which returns the state properties and
their defaults. It runs in the constructor right after `setProperties()`, so a
default may derive from a property:

```js
initialState() {
  return { chosen: this.pages[0].key, open: false };
}
```

Rules:

- State is **never reset by a rebuild**. The throwaway instance constructed
  during a rebuild gets its own defaults, but they are not copied back.
- State may be written **from an event handler** (outside any repeater) by
  plain assignment: `this.open = true`.
- Writing state **from inside a repeater** (a build, a render, anything that
  runs reactively) **throws**. Where you must write state from such code, use
  `this.setState({ name: value })`, which writes at the baseline
  (`accessInitialValues()`) and rejects undeclared names.

### 3.4 Unobservables

`this.unobservable` is a plain object for non-reactive bookkeeping: render
counters, cached measurements, references to components you own. Seed it
with `initialUnobservables()`:

```js
initialUnobservables() {
  return { lastScrollTop: 0 };
}
```

`initialUnobservables()` runs lazily, the first time `this.unobservable` is
read, inside `accessInitialValues()`. Some names are reserved by `Component`
itself (`repeater`, `buildRepeater`, `renderTarget`, `renderContext`,
`renderParent`, `ownContext`, `childContext`, `callbacks`, ... - using one
throws).

### 3.5 build()

`build()` returns a component, an array of components, or `null`. It runs in
its own repeater:

- It reruns only when something it read changes - not when the parent reruns.
- One build repeater per component for its whole life. While the component is
  not rendered (a hidden page), its build is simply left invalid and is run
  again when the component is rendered again - its keyed children intact.
- The result is matched against the previous result (see
  [4](#4-identity-keys-and-pattern-matching)).
- A build may read the render context (`this.inherit()`,
  `this.renderContext`) and timeless target values (`this.fromTarget()`), but
  never the render target itself.

`Component.showIf(condition)` returns the component, or `null`:
`new Panel({ key: "details" }).showIf(this.expanded)`.

### 3.6 render(target, context)

Override `render()` for a component that does real work at render time -
measuring, placing things itself, interleaving children with its own
writes. The default `render()` builds one step (`buildOneStep()`) and calls
`child.renderOnto(target, context)` for each child in order. A component
overrides `build()` **or** `render()`, not both.

```js
// A render target of your own - no DOM at all (from the demo's Paper example).
class Word extends Component {
  setProperties({ text }) { this.text = text; }

  render(paper) {
    const previous = paper.words.at(-1);          // what the word before me left
    let line = previous ? previous.line : 1;
    let column = previous ? previous.column + previous.text.length + 1 : 0;
    if (column > 0 && column + this.text.length > paper.width) { line++; column = 0; }
    paper.words.push(frozen({ text: this.text, line, column }));
  }
}
```

Change the third word, and only it and the words after it lay out again; a
word that lands where it was stops the ripple.

`context` in `render(target, context)` is what the children are to be
rendered with - pass it on. What the component itself inherits is read with
`this.inherit()`.

### 3.7 Lifecycle

| Hook | When | Notes |
|---|---|---|
| `constructor` → `setProperties()` → `initialState()` | Every construction, including the throwaway twin of a rebuild | Do not acquire resources here. |
| `initialUnobservables()` | First access to `this.unobservable` | Runs at the baseline. Create owned components here. |
| `onEstablish()` | First built by its creator's build, or `establish()` called by its owner | Acquire external resources. Call `super.onEstablish()`. |
| `provide()` | Once, when it first enters the tree | Returns what it provides, or `null`. |
| `build()` | Reactively | |
| `render(target, context)` | Reactively | |
| `onShow()` / `onHide()` | Shown (first render, rendered again, or placed by a container) / no longer shown | Notifications only. Reads here are recorded against whoever is rendering - wrap them in `withoutRecording()`. |
| `onRetract()` | Its render repeater is retracted (not rendered this pass) | Undo side effects the reactive system can't see. Default calls `onHide()`; call `super.onRetract()`. |
| `onReattach(target)` | Rendered again after being retracted | Redo what `onRetract()` undid. Default calls `onShow()`. |
| `onDispose()` | Dropped by its creator's build, or `dispose()` called by its owner | Release resources. **Must call `super.onDispose()`**. |

Retracted is temporary - the component can come back with its state. Disposed
is for good: `Component.onDispose()` retracts the render repeater, stops the
build repeater, disposes of the component's own context and of everything its
build constructed.

### 3.8 Components you own (created outside build())

A component constructed in a `build()` is established and disposed for you by
that build. A component created any other way - kept in an unobservable,
say, so it survives being absent from a build - has nobody to do that, so its
owner must:

```js
export class Owned extends Component {
  initialUnobservables() {
    return {
      first: new Tally({ label: "First" }).establish(),
      second: new Tally({ label: "Second" }).establish(),
    };
  }

  onDispose() {
    this.unobservable.first.dispose();
    this.unobservable.second.dispose();
    super.onDispose();
  }

  build() {
    return this.tab === "first" ? this.unobservable.first : this.unobservable.second;
  }
}
```

- Create them in `initialUnobservables()`, **not** in `initialState()`:
  `initialState()` also runs for the throwaway instance of every rebuild, so a
  component established there would be thrown away without being disposed.
- `establish()` is a no-op on an already established component and returns
  the component, so it can be chained on the constructor.
- `dispose()` is not optional: a component reading data that never changes
  again is never invalidated, so without `dispose()` its repeaters stay
  subscribed, holding everything they built.
- Never do both: a component constructed in a build *and* kept by reference
  is the build's, and a rebuild that doesn't construct it disposes it.

---

## 4. Identity: keys and pattern matching

When a build runs again, what it constructs is matched to what it constructed
the previous time, so that the same component stays the same component -
state, DOM elements and all. Two mechanisms:

**Pattern matching** (no key): a component constructed in the same place as
before - the same property of the same parent, the same position among its
siblings - and of the same class (for a DOM element, the same tag) is the
one from before. Static structure needs no keys.

**Keys**: for what can **move, appear or disappear** among its siblings - the
items of a list. Among an array's children, unkeyed ones are paired in order,
skipping the keyed ones; an item inserted at the front would otherwise be
matched to what used to be first.

```js
build() {
  return ul(this.items.map((item) => li({ key: item.id }, text(item.name))));
}
```

Also key:

- a component built but not shown (`.showIf(false)` leaves nothing in the
  result to match against);
- two components of the same class taking turns in the same place (without
  keys, the second carries on as the first, with the first's state);
- a component referred to from outside the build result (a closure, an
  unobservable) - after a pattern match those references point to the
  discarded twin; a key makes the constructor return the established instance
  itself.

A child left out - `cond ? child : null`, or `.showIf(false)` - still holds
its place: the unkeyed siblings after it are matched as if it were there. So
the siblings of a conditional child need no keys.

### 4.1 Keys are unique across a whole build

Keys are unique across *everything one `build()` constructs*, not just among
siblings. That is what lets a keyed component move to another parent within
the build and stay the same component. A duplicate throws an error naming
both components. Consequence: a helper that builds keyed structure can't be
used twice in one build. See [10.7](#107-keys-are-unique-across-everything-one-build-constructs).

### 4.2 A dropped keyed child is gone for good

If a build does not construct a given key on some run, that key's component
is disposed - permanently. Constructed again later, it is a brand-new
instance with fresh `initialState()` defaults. Guarding construction with an
`if` is choosing to let identity and state lapse.

To keep a child alive across such a toggle:

1. **Construct it every run, and hide it with `.showIf()`**:
   ```js
   new Tally({ key: "first", label: "First" }).showIf(this.tab === "first"),
   new Tally({ key: "second", label: "Second" }).showIf(this.tab === "second"),
   ```
2. **Own it** (see [3.8](#38-components-you-own-created-outside-build)).

### 4.3 What happens to a matched component

A matched component (by key or by pattern) is merged into the established
one: its properties copied over, its state never. The matching reads the new
build without recording dependencies and compares it with a plain-data
snapshot of the previous build.

---

## 5. Callbacks, view() and frozen()

### 5.1 callback(key, fn)

A plain closure is a new function every build, so passed as a property it
counts as a change every time, and the child rebuilds. `callback(key, fn)`
returns one stable function for as long as the building component lives,
always calling the closure from the latest build:

```js
button({ onClick: callback("clear", () => { this.chosen = []; }) })
this.items.map((item) => tile({ key: item.id, onclick: callback(item.id + "Toggle", () => this.toggle(item.id)) }))
```

- Keys are unique among the callbacks of one build (a duplicate warns, and
  the second silently takes over the first).
- A callback a build no longer makes is dropped when that build is done.
- Called outside any build, `callback()` returns `fn` itself.
- A plain closure is fine for a quick prototype, and right for a function a
  child *calls while it builds*, where a new function really is new.

### 5.2 view(name, build, methods)

For the many small components that only build:

```js
const provenanceRow = view("ProvenanceRow", ({ line }) =>
  tr(td(text(line.status)), td(text(line.key + " = " + line.value))));

tbody(lines.map((line) => provenanceRow({ key: line.key, line })));
```

- `build` is called with the component itself (destructure its properties,
  read its state, call `inherit()`).
- `name` is the class name used in errors and debug ids.
- `methods` go onto the class as they are - written as methods, not arrow
  functions - e.g. `setProperties()` to `frozen()` plain-data properties, or
  `initialState()`. `build` may not be among them.
- A view has its own key namespace, so a keyed helper made a view can be used
  any number of times in one build.
- The returned function has `.componentClass` for `instanceof`.

### 5.3 frozen()

`frozen(value)` deep-freezes the plain data in `value` (plain objects and
arrays) in place and returns it. Two frozen values are compared **by
content** when a rebuild copies properties; unfrozen values by identity.

```js
setProperties({ style, children, model }) {
  this.style = frozen(style);       // a value: an equal style in a new object is no change
  this.children = frozen(children); // the array a value; the components in it stay references
  this.model = model;               // a reference: compared by identity
}
```

- Freezing stops at observables (components included), class instances,
  functions and DOM nodes.
- In place: data that also lives elsewhere (a server answer in your store) is
  frozen there too, and mutating it later throws. Hand over a copy, or
  replace data in the store instead of mutating it.
- `isPlainData(value)` tells whether `frozen()` would freeze a value.

---

## 6. Context: provide(), inherit(), render target and render context

### 6.1 provide() and inherit()

A component provides values to its subtree by returning an object from
`provide()` (default `null`: provides nothing). Anything below finds a field
by name with `this.inherit(name)` - the nearest provider above where it is
placed:

```js
class NoticeBoard extends Component {
  initialUnobservables() {
    return { board: portal({ style: { minHeight: "150px" } }).establish() };
  }
  onDispose() {
    this.unobservable.board.dispose();
    super.onDispose();
  }
  provide() {
    return { noticeBoard: this.unobservable.board };
  }
  build() { /* ... */ }
}

// Anywhere below:
const board = this.inherit("noticeBoard");
```

- `provide()` is called once, when the component first enters the tree. The
  object it returns is kept for the component's life. Its fields may be plain
  values, getters (read afresh at each lookup, so a getter over the
  component's own properties follows them), or an observable object's fields.
- `provide()` never returns the component itself - a component and its
  context are kept apart, so nothing it merely has is inherited by accident.
- A component never inherits what it provides itself: a frame inside a frame
  finds the outer one.
- `inherit()` is a tracked read; it throws if the component has not entered
  the tree yet (don't call it from the constructor or `initialState()`).
- Lookups are cached per context and only a *different* result invalidates
  readers.
- `undefined` means nothing provides it. To *block* a value for a subtree,
  provide it as `null`.

### 6.2 Render target vs render context

A component is rendered onto a *target* with a *context* -
`renderOnto(target, context)` - and the two are kept strictly apart:

- **The target holds everything temporal**: where things go and what has
  been placed so far this pass (a `DOMElementTarget`'s `lastChild`, space
  left after the siblings before). Only render repeaters read and write it,
  in pipeline order. A build never sees it - except values that are timeless,
  kept on `target.timeless`, which a build reads with `this.fromTarget(name)`.
  cascade.dom's measured elements keep their layout size there.
- **The context holds only non-temporal information**: services, a location,
  an overlay frame, portals - values with one value per render pass.

Why: a build repeater is a pipeline of its own, unrelated in time to
rendering, and reads the latest writing of whatever it reads. For a value
with one value per pass, the latest writing is the right one. For a temporal
value (a size measured part-way through the pass, a position), it is not - read
deep down, it would mean nothing there.

Invariants (from cascade.component's design notes):

1. A context is created once by its component when it first enters the tree,
   and kept; it is disposed with the component.
2. Its parent link can change (a provider removed or inserted upstream);
   only lookups that went through it follow.
3. Everything written to a context is written at the baseline
   (`accessInitialValues()`), and only when it changes.
4. A component's own lookups see only the context it was given.
5. `inherit()` is cached per context.
6. Every shown component has one current target and context, set by the same
   step (`enterTree()`) whether it is rendered or expanded by a container.
7. What is shown elsewhere than where it comes from (portal contents, an
   overlay's dialog) enters with the context of where it came from
   (`enteredContext()`, `ContextScope`).

**Rule:** never put a temporal value - a measured size, a position - in the
context. Read timeless target values with `this.fromTarget()`, or hand a
measurement to a direct child as a property. See [10.13](#1013-never-put-a-temporal-value-in-the-render-context).

```js
class Profile extends Component {
  build() {
    const width = this.fromTarget("width") || 0; // the element it's placed in, measured
    return div({ style: { display: "flex", flexDirection: width >= 420 ? "row" : "column" } }, /* ... */);
  }
}

elementBoundsProvider({ style: { width: "100%", contain: "inline-size layout" }, child: new Profile() })
```

### 6.3 ContextScope

`contextScope({ context, children })` renders its children with the given
context instead of the one where it stands. It is how portals and overlays
show content with the context of its origin. Override
`enteredContext(given)` on a component for the same effect.

---

## 7. Services and hydration

Every element and widget is asked for through the **service locators** in
the render context, so themes can replace whole components, and any part of
an app can have services of its own.

### 7.1 Locators and queries

A locator is any object with `locate(query)`, returning what it provides, or
`undefined`. A query is always an object, so different domains never collide
on a name:

```js
{ type: "htmlElement", name: "button", properties }  // an HTML <button> (DOMServiceLocator)
{ type: "widget", name: "button", properties }       // a themed button (basicTheme, materialTheme)
{ type: "textNode", properties }                      // a Text node (DOMServiceLocator)
{ type: "domComponent", name, properties }            // cascade.dom's own components
{ type: "colorScheme" }                               // a theme's color scheme
```

`div()`, `button()` and friends call `locateService(query, fallbackLocator)`,
which asks each locator provided as `serviceLocator` on the way up from the
building component's context, nearest first, then the fallback. Unlike other
inherited values, locators compose: one that doesn't provide something falls
through to the next.

A custom locator:

```js
class MyWidgets {
  locate(query) {
    if (query.type === "widget" && query.name === "card") return new FancyCard(query.properties);
    return undefined;
  }
}
const services = new CompoundServiceLocator(new DOMServiceLocator(), new MyWidgets(), basicTheme);
```

- `CompoundServiceLocator(...locators)` - asks each in order. Plain: no
  dependency recorded. Use it when the set never changes.
- `ObservableCompoundServiceLocator(...locators)` - observable: replace
  `compound.locators[i]` (or the whole `locators` array) and exactly the
  builds that looked something up through it rebuild - a runtime theme switch.
- `serviceProvider({ serviceLocator, child })` - renders `child` with
  `serviceLocator` in front of the surrounding ones: a part of the app with a
  theme of its own.

### 7.2 Hydration

A document is plain data: a tree of queries whose `properties.children`
hold further queries, strings and already-built components. Hydrating hands
each query to a service locator, children first, and returns ordinary
components:

```js
import { hydrate } from "@liquefy/cascade.dom";

build() {
  return hydrate({
    type: "htmlElement", name: "div",
    properties: { children: [
      { type: "htmlElement", name: "h1", properties: { children: ["Hydration"] } },
      { type: "widget", name: "button", properties: { onClick: this.save, children: ["Save"] } },
    ] },
  });
}
```

- `hydrateQuery(query, locator, positionalKey = "h")` - hydrate through a
  given locator.
- `hydrateService(query, fallbackLocator)` - hydrate through the locators of
  the component whose build is running.
- cascade.dom's `hydrate(tree)` is `hydrateService(tree, defaultDOMServiceLocator)`.
- A node without a key gets a positional key (`h`, `h.0`, `h.0.2`, ...), so a
  rebuild matches the new tree to the old node for node. Several documents
  in one build are numbered `h`, `h1`, `h2`, ...
- `isServiceQuery(value)` - a plain object with a string `type`.
- JSX compiles to these same queries (see [9.6](#96-jsx)).

---

## 8. Reactivity in depth

### 8.1 Worlds

cascade.reactive's API comes from a *world*: `getWorld({ name, ...options })`.
Calling it again with the same name returns the same world. cascade.component
creates the world named `"cascade.component"` and re-exports its functions.
**In a Cascade app, import `observable`, `repeat` etc. from
`@liquefy/cascade.component`**, so your models and your components share one
world. `isObservable()` only recognizes the world's own observables, and a
repeater doesn't follow an observable from another world: changing it
doesn't rerun the repeater. Keep everything a component reads in one world.

### 8.2 Observables

```js
const store = observable({ items: [], filter: "" });
observable([1, 2, 3]);
observable(new MyClass());     // or `return observable(this)` from a constructor
deeplyObservable(plainTree);   // every nested object and array, in place (or a copy: deeplyObservable(tree, true))
```

An observable behaves like the plain object: property reads are tracked,
writes notify. Arrays are temporal too: each reader sees the array as the
writers before it left it. Getters and setters on the class are honored.

### 8.3 Reads and writes in time

- **Inside a repeater**, a read resolves to the writing with the largest
  position at or before the reader; a write is a writing at the repeater's
  position. Positions are compared by `time` level first, then by tree
  position.
- **Outside any repeater** (event handlers, timers, top-level code), a write
  lands at the **baseline** - time 0, writer `null` - feeding the pipeline as
  input; a read sees the **latest** writing - the pipeline's settled output.
- A repeater's writings belong to it. When it reruns, its previous writings
  are withdrawn at once (readers after it fall through to what is below) and
  reclaimed where the rerun writes the same property again; an unchanged
  value settles quietly. When it is retracted, its writings are undone.
- Independent repeaters (below) are parallel pipelines: each reads the
  other's latest writings.

### 8.4 repeat()

```js
const repeater = repeat([description], action, [nonRecordedAction], [options]);
```

- `action(repeater)` is run at once, and again whenever something it read
  changes. With `nonRecordedAction`, the return value of `action` is passed
  to it, unrecorded (MobX `reaction`).
- Created inside another repeater's run, a repeater becomes its **child**:
  part of the parent's pipeline, retracted when the parent's rerun doesn't
  create it again. Its `time` option is then ignored.
- `options.time`: a time level from 0 to `timeLevels - 1` (4 levels by
  default) for a root repeater - lower levels settle first.
- `options.independent: true`: a new pipeline of its own even when created
  inside another repeater - never its child, never retracted with it. It runs
  at its creator's time level unless `time` says otherwise. Its first run is
  synchronous; later, its creator can pull it with `refreshIfNeeded()`. **Its
  lifecycle is the creator's responsibility**: `retractRepeater()` stops it,
  `repeater.restart()` resumes it. (A component's build repeater and
  `inherit()`'s cached lookups are independent repeaters.)
- `options.onRetract(repeater)`: called once per genuine retraction.

A repeater is a *tree position*: its run is split into **partials** at each
child it creates or relinks. Writes made between child *k* and child *k+1*
are seen by child *k+1* and after, not by child *k*. This is how a parent
can write "before", "between" and "after" its children.

### 8.5 linkRepeater() and refreshIfNeeded()

- `linkRepeater(repeater)` reattaches an existing repeater as a child at the
  current position (what `renderOnto()` does for an already rendered
  component). It does not by itself rerun the repeater.
- `refreshIfNeeded(repeater)` runs a pending repeater right now, at the
  current position, instead of whenever the scheduler reaches it (a pull).
  No-op for an up-to-date or retracted repeater.

### 8.6 Batching: postponeInvalidations / continueInvalidations

```js
postponeInvalidations();
try {
  store.a = 1;
  store.b = 2;
} finally {
  continueInvalidations(); // readers of both run once
}
```

The world also has `transaction(fn)` doing the same around a callback (not
re-exported by cascade.component). Don't *read* inside a batch expecting
derived values to be up to date.

### 8.7 flush()

Waves of work move forward: a change discovered *behind* the current wave
(something later wrote to something earlier) normally waits for the next
wave. `flush(fn)` makes invalidations caused inside `fn` retreat the wave
and get processed within this one - so a portal or overlay frame that
already rendered fills in the same frame. It changes *when* work is
processed, not *where* a write lands. An oscillating correction is your
responsibility, like any loop.

### 8.8 accessInitialValues()

`accessInitialValues(fn)` runs `fn` as if outside any repeater: writes land
at the baseline, reads see the latest. It changes *where* a write lands.
This is what `setState()` uses, what contexts are written with, and what
you need for shared state written from code that might run inside a
repeater (see [10.1](#101-write-shared-state-at-the-baseline-when-a-repeater-might-be-running)).
Compose with `flush()` when the effect must also settle in the same wave:
`accessInitialValues(() => flush(() => ...))`.

### 8.9 withoutRecording()

`withoutRecording(fn)` reads without creating dependencies: debug output,
comparing before writing, reads in `onShow()`. `withoutReactions(fn)` (on the
world, not re-exported by cascade.component) writes without notifying
anyone.

### 8.10 Retraction: retractRepeater() and restart()

`retractRepeater(repeater)` takes a repeater and its whole subtree down. A
retracted repeater is intact and re-linkable; a disposed one is gone.

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

`Component.onDispose()` retracts a dropped component's repeaters this way,
immediately, so no stale, already-queued rerun of it can run first.

### 8.11 invalidateOnChange()

```js
invalidateOnChange(() => { cache = compute(); }, () => { cache = null; });
```

Runs the first function recording its reads; on the first change, calls the
second (which should not modify observables). For lazily filled caches and
integrating other systems.

### 8.12 Rebuilding data structures with build ids

Outside components, `observable(object, buildId)` inside a repeater gives a
created object a build identity: on the next run, constructing the same
build id returns the established object, with its properties merged in.
Objects with `onEstablish()`/`onDispose()` are told when they are first
created and when a run no longer creates them. Components use exactly this
mechanism (a component's key is its build id).

---

## 9. DOM specifics and UI widgets

Each package README has more detail: `cascade.DOM/README.md`,
`cascade.ui/README.md`.

### 9.1 HTML tag functions

Every HTML element has a function - `div()`, `span()`, `input()`, `table()`,
... - plus `element(tagName, ...)` for any other tag, custom elements
included (`element("mdui-button", {...}, text("Save"))`). Two tags are
renamed to avoid clashing with JavaScript or cascade names: `htmlVar`
(`<var>`) and `htmlPortal` (`<portal>`). Each asks the context's service
locator for `{ type: "htmlElement", name, properties }`.

- `style` is a plain object, diffed against what was applied last time
  (removed keys are cleared). Bare numbers are pixels, except unitless
  properties (`opacity`, `zIndex`, `flexGrow`, `fontWeight`, `lineHeight`,
  ...) and custom properties (`--name`, set with `setProperty()`).
- `className` and `htmlFor` become `class` and `for`; every other property
  name is lowercased.
- A property reaches the element **as an element property** where the
  element has a writable property by that name (`value`, `checked`,
  `disabled`, `title`, `onclick`, ...) - live state, not just the initial
  attribute - and **as an attribute** otherwise (`class`, `for`, `aria-*`,
  `data-*`, `tabindex`, `readonly`, `colspan`, ...). An attribute given
  `false`/`null`/`undefined` is absent, `true` present and empty. Custom
  elements (a dash in the tag) always get properties.
- Event handlers are element properties: `onclick`, `oninput`, `onkeydown`,
  `onfocus`, ... (`onClick` works too, being lowercased). An `on...` name the
  element has no property for is set as an attribute string - see
  [10.5](#105-event-handlers-must-be-element-properties).
- Loose string and number children become text nodes;
  `text("...")` makes one explicitly, `text("value", { key })` a keyed one.

### 9.2 DOMElementTarget

`DOMElementTarget.forElement(element)` wraps an element that components
render into. Its `lastChild` is an observable read and written in tree order:
each component inserts its node after what the component before it placed.
`observeBounds()` and `observeVisibility()` opt in to keeping the element's
size or visibility on `target.timeless` (used by the providers below).

### 9.3 Measurement and layout

- `elementBoundsProvider({ child, style })` - measures its element (size
  contained by default, `contain: size layout`); the child reads
  `this.fromTarget("width")`/`("height")`. Give it `contain: "inline-size
  layout"` for one whose height follows its content.
- `elementVisibilityProvider({ child, style, amount, margin })` - the child
  reads `this.fromTarget("inView")` and `("seen")`.
- `overflowContainer({ children, ellipsis, overflowSlot, onOverflow })` with
  `elementSlot()` - places children while they fit, the rest in the slot.
- `textWidth()`, `fitTextWithinWidth()` - text measured on a canvas.

### 9.4 FlipAnimationContainer

`flipAnimationContainer({ enabled, speed, confine, zoomAlong, isUnit, style }, ...children)`
places its whole subtree itself and animates every change in it: moves
(within a parent or to another), resizes, appearing and leaving. The
components inside know nothing about animation; moving items need keys so
they stay the same items. `isUnit(component)` marks components to place as
one piece (an "island").

### 9.5 Portals, providing elements, routing, head

- `portal({ style }, ...defaultChildren)` and `portalSource({ portal, inheritFrom, children })`
  - content shown somewhere else (a page's buttons in the app's top bar).
  `portal` may be a Portal or a name to `inherit()`. Contents inherit from
  where they came from (`inheritFrom: "source"`, default) or from where they
  end up (`"portal"`). The last source shown wins. Own the portal (create it
  in `initialUnobservables()`, establish and dispose it) and provide it.
- `providingElement({ child, context, style })` - a styleable div that
  provides the fields of `context` to its child's subtree.
- `browserLocation({ base })` - the URL as observable state: `path`
  (segments), `navigate(path, { replace })`, `href(path)`, `back(fallback)`.
  Call `navigate()` from event handlers.
- `documentHead(() => ({ title, description, canonical, image, type, meta, structuredData }))`
  - the document head built reactively from your data; returns a handle with
  `dispose()`.

### 9.6 JSX

With Vite (esbuild): `esbuild: { jsx: "automatic", jsxImportSource: "@liquefy/cascade.dom" }`.
JSX tags compile to service queries, not components; pass them to
`hydrate()`. Lowercase tags are HTML elements; `<widget.button>` with
`const widget = serviceQueries("widget")` asks for a themed widget; a
Component class tag constructs that class.

```jsx
build() {
  return hydrate(
    <div>
      <h1>Count is {this.count}</h1>
      <widget.button onClick={callback("count", () => { this.count++; })}>More</widget.button>
    </div>
  );
}
```

### 9.7 cascade.ui widgets

Themed widgets ask for `{ type: "widget", name }`; every theme implements the
same property contract (see `cascade.ui/src/widgets.js`):

| Widget | Main properties |
|---|---|
| `button` | `onClick` (or a loose function), `disabled`, `variant` (`"filled"`), `style`, children. Given no children, shows its key as a label (`"openDialog"` → "Open dialog"). |
| `icon` | `name` (Material icon name), `style` |
| `iconButton` | `icon`, `onClick`, `title`, `disabled`, `style` |
| `card` | `variant` (`"elevated"`, `"filled"`, `"outlined"`), `style`, children |
| `controlPanel` | `style`, children |
| `alert` | `severity` (`"info"`, `"success"`, `"warning"`, `"error"`), `style`, children |
| `listItem` | `active`, `onClick`, `style`, children |
| `dialog` | `title`, `close`, `fullScreen`, `style`, children |
| `textField` | `label`, `placeholder`, `value`, `onInput(text)`, `type`, `unit`, `error`, `style` |
| `checkbox` | `label`, `checked`, `onChange(checked)`, `style` |
| `colorField` | `label`, `value` (hex), `onInput(hex)`, `style` |
| `tabBar` | `tabs` (`[{ key, title }]`), `selected`, `onSelect(key)`, `style` |

Themes: `basicTheme` (this package) and `materialTheme`
(`@liquefy/cascade.ui.material`).

Layout: `row`, `column`, `center`, `middle`, `centerMiddle`, `wrapper`,
`filler`, `zStack` - each a div with a default style merged under yours -
and the style constants (`fillerStyle`, `fitContainerStyle`, ...).

### 9.8 Overlays, modals, drawers, popovers

- `overlayFrame({ style }, ...children)` - place one at the app's root.
  Every frame provides itself as `overlayFrame`.
- `overlay({ showing }, content)` - shows its single child on the nearest
  frame while `showing`, built right where it stands. One overlay per frame:
  a newer one evicts the older. Overlays stack across frames (one opened from
  inside another's content).
- `modalAssembly({ close, width, height, fullScreenBelow, backdrop }, content)` -
  backdrop plus centered window, full screen below a width. Parts:
  `modalBackdrop({ close })`, `modal({ fullScreen, width, height }, content)`
  (provides `modalPresentation`).

  ```js
  overlay({ showing: this.asking },
    modalAssembly({ close, width: 340, fullScreenBelow: 480 },
      dialog({ title: "Are you sure?", close }, /* ... */)))
  ```
- `drawer({ open, close, onOpen, side, size, modal, header, title, collapsed, bar, animate, speed }, ...content)`,
  or `drawers({ modal, animate, speed }, drawerPanel({...}), ...)` for one per edge.
- `popover({ anchor, showing, close, style }, ...content)` - beside an element
  (`event.currentTarget`) or a viewport rectangle.
- `dropdown({ options, value, onSelect, disabled, title, placeholder, style })`.

### 9.9 Color schemes

A theme's colors derive from a base and an accent, as CSS variables
(`themeColor.page` is `var(--cascade-page, ...)`). Put `colorSchemeScope()`
around your app (or around a `serviceProvider()` subtree) to set them; in a
build, `currentColorScheme()` returns the context theme's `ColorScheme`,
whose `base`/`accent` you can change from an event handler.

---

## 10. Pitfalls and rules

Each rule: what to do, why, and a short example. The first five come from
real debugging sessions and are the ones most likely to bite.

### 10.1 Write shared state at the baseline when a repeater might be running

**Rule.** Shared observable state (an app-level model, a "who has the focus"
object) that may be written from code a rebuild can call - a `build()`, a
`render()`, an `onDispose()` or `onEstablish()` run by a rebuild - must be
written with `accessInitialValues(() => ...)`. Compare first with
`withoutRecording()` so an unchanged value writes nothing.

**Why.** A write made from inside a repeater is *that repeater's writing, at
its position in the tree*. Readers after that position keep seeing it. A
later write from an event handler lands at the baseline, which is *before*
that position - so for those readers it does not override the repeater's
writing. Their value is stuck until the repeater reruns or is retracted.
An `onDispose()` called because a rebuild dropped a component runs inside
the rebuilding build repeater, so it counts.

**Real case.** In Tabula, a `contextMenus` object held the current focus
`owner`. When the mode switched, the old editor's `onDispose()` released the
focus (`owner = null`) - inside the rebuild. A click in the new editor then
set `owner` from an event handler, at the baseline - and the layout, reading
after the rebuild's position, went on seeing `null`: no menus.

```js
// Wrong: from onDispose() during a rebuild, this is the rebuild's writing.
release(owner) {
  if (this.owner === owner) this.owner = null;
}

// Right: always at the baseline, and only when it changes.
focus(owner) {
  if (withoutRecording(() => this.owner) !== owner) accessInitialValues(() => { this.owner = owner; });
}
release(owner) {
  if (withoutRecording(() => this.owner) === owner) accessInitialValues(() => { this.owner = null; });
}
```

`Component.setState()` does exactly this for declared state. Plain writes
from event handlers already land at the baseline; the rule is about code
that *might* run inside a pipeline. If the change must also be processed in
the same wave (something earlier in the tree has already rendered), wrap it
in `flush()` as well.

### 10.2 State is written by the user, or with setState()

**Rule.** Write state properties only from event handlers, or with
`this.setState({ ... })`.

**Why.** A plain write to a state property from inside any repeater throws
("Cannot write state property ... from inside a repeater"). State is
established once and changed by the user; a pipeline writing it would be a
side effect of recomputation.

```js
render(target, context) {
  // this.selected = fallback;            // throws
  this.setState({ selected: fallback });  // lands at the baseline
}
```

### 10.3 Components created in a build are the build's

**Rule.** A component constructed in a `build()` is established and disposed
by that build: when a rebuild doesn't construct it again, it is disposed.
Anything a component owns outside its build - created in
`initialUnobservables()` - must be established and disposed by the component
itself. Never both build a component and keep it by reference.

**Why.** The rebuild only knows what it constructed. Something it didn't
construct is never established or disposed by it; something it did construct
is disposed when it stops constructing it, references or not. A component
that's never disposed keeps its repeaters subscribed and everything they
built alive.

```js
initialUnobservables() {
  return { board: portal({ key: "board" }).establish() };
}
onDispose() {
  this.unobservable.board.dispose();
  super.onDispose();
}
```

### 10.4 Content components passed as properties: fine, but state belongs to the component

**Rule.** A parent may keep components (in unobservables, owned as in 10.3)
and pass them as properties - "content" components handed to layout
components - and the layout places them. The content component's state
lives in the content component, not in the layout. A component of a
*different class* in the same place is a *new* component.

**Why.** Identity is by key, or by class and place. Swap a `PlainTextEditor`
for a `SpreadsheetEditor` in the same slot and the first is dropped (and
disposed, if it was built there); nothing carries over. If state must
survive a swap, keep it in the owner or a model the components read.

```js
// The owner keeps both editors (owned as in 10.3), and hands one to the
// layout - `layout` here stands for a layout component of your own:
build() {
  return layout({ content: this.mode === "text" ? this.unobservable.textEditor : this.unobservable.sheetEditor });
}
```

### 10.5 Event handlers must be element properties

**Rule.** Use event handler names that exist as element properties: `onclick`,
`oninput`, `onchange`, `onkeydown`, `onmousedown`, `onfocus`, `onblur`, ...
Put `onfocus` on the focusable element itself rather than reaching for an
event without a handler property, such as `onfocusin`.

**Why.** cascade.dom assigns a property as an element property only if the
element has a writable property by that name (`element.onclick = fn`).
Otherwise it sets an attribute, with `String(value)`. For `onfocusin` that
is the function's source text as an inline handler, which the browser tries
to compile - "Function statements require a function name" or a similar
syntax error - and the handler never runs.

```js
input({ onfocus: callback("focus", () => this.takeFocus()) })   // works
div({ onfocusin: () => this.takeFocus() })                      // attribute string: broken
```

(For events that only exist as `addEventListener` events, add the listener
yourself from a component that owns the element - to verify whether
cascade.dom offers a helper for this; none was found in its exports.)

### 10.6 A leading lowercase string is a key, not text

**Rule.** Wrap text in `text("...")`. Give keys explicitly when in doubt.

**Why.** The first loose argument, if it is a number or a string starting
with a lowercase letter, is the implicit key. `li("first")` is an empty `li`
keyed `"first"`; `button("save", onClick)` is a button keyed `"save"` (shown
with the label "Save" by the themes). Text that comes from data can turn
into a key depending on its first letter. A key containing whitespace
triggers a warning.

```js
p(this.message)              // "hello there" becomes a key (with a warning)
p(text(this.message))        // text
```

### 10.7 Keys are unique across everything one build() constructs

**Rule.** Don't key static structure inside a helper that may be called more
than once per build. Drop the inner keys (static structure is matched by
pattern), or make the helper a component (`view()`), whose build has keys of
its own.

**Why.** Keys are unique across the whole build, so that a keyed component
can move to another parent and stay itself. Calling a keyed helper twice -
or keying static list buttons by name when other keys in the build have the
same names - is a duplicate key error.

```js
const field = (key, labelText, control) => div({ key }, div({ key: "label" }, text(labelText)), control);
// Two fields in one build: "label" twice - duplicate key error.

const field = view("Field", ({ labelText, control }) => div(div({ key: "label" }, text(labelText)), control));
// Each Field has its own key namespace.
```

### 10.8 Key only what can move, appear or disappear

**Rule.** Static structure needs no keys. Key list items, things shown
conditionally whose state matters, and things that take turns. Key a
dependent piece by what it belongs to, so it comes and goes with it - e.g. a
separator that belongs to the list item before it is keyed by that item.

**Why.** Unkeyed children are paired in order, skipping keyed ones, and
`null` holds a place. A keyed item with an unkeyed separator after it would
leave the separator matched by position - to a different item's separator -
when items are inserted or removed.

```js
this.items.flatMap((item, index) => [
  index > 0 ? hr({ key: "separator-" + item.id }) : null,
  row({ key: item.id }, text(item.title)),
]);
```

### 10.9 A dropped keyed child is gone for good

**Rule.** Use `.showIf(condition)` (constructed every run) or ownership to
keep a child's state across a toggle; an `if` around its construction forgets
it.

**Why.** A key not constructed on one run is disposed. Built again, it is new,
with fresh defaults.

```js
// Forgets:   this.tab === "first" ? new Tally({ key: "first" }) : new Tally({ key: "second" })
// Remembers:
new Tally({ key: "first" }).showIf(this.tab === "first"),
new Tally({ key: "second" }).showIf(this.tab === "second"),
```

### 10.10 Create owned components in initialUnobservables(), not initialState()

**Why.** `initialState()` runs for the throwaway instance of every rebuild
too; a component created and established there is thrown away without being
disposed. `initialUnobservables()` runs lazily, on the established object.

### 10.11 Override hooks call super

**Rule.** An override of `onDispose()` must call `super.onDispose()`;
`onEstablish()` calls `super.onEstablish()`; `onRetract()`/`onReattach()`
call super to keep `onHide()`/`onShow()`.

**Why.** `Component.onDispose()` retracts the component's repeaters, disposes
its context and disposes everything its build constructed. Without it,
everything below stays subscribed.

### 10.12 Stable properties: callback() and frozen()

**Rule.** Pass `callback(key, fn)` rather than a fresh closure, and
`frozen()` plain-data properties in `setProperties()`.

**Why.** A fresh closure or a fresh object literal is a different value every
build, so the child sees a changed property and rebuilds every time its
creator does.

### 10.13 Never put a temporal value in the render context

**Rule.** The context holds values with one value per render pass (services,
location, frames, portals). A measured size, a position, the space left -
read them with `this.fromTarget()`, or pass them to a direct child as a
property.

**Why.** Builds read the latest writing of the context. For a value that
changes part-way through a pass, the latest writing is the wrong one for
almost every reader.

### 10.14 References outside the build result want a key

**Rule.** If you keep a reference to a component you construct in a build (in
a closure or an unobservable), key it.

**Why.** On a pattern match, only references in what the build returned are
redirected to the established component. Others still point to the
discarded twin.

### 10.15 Retraction notifies readers outside the retracted tree

**Rule.** Expect readers outside a retracted subtree to rerun when it is
retracted - immediately, if you retract from outside any pipeline (an event
handler, a timer); queued, if inside a running pipeline.

**Why.** Retraction undoes the subtree's writings; readers of them must see
what is underneath. Inside the subtree nothing reruns (see 10.16 (d)).

### 10.16 Behaviour guarantees (fixed framework bugs)

These used to be bugs and are now fixed in cascade.component's `renderOnto()`
and cascade.reactive's `refresh()`, `dispose()` and `retractRepeater()`.
You can rely on them:

- **(a) Pending relinked children render in tree order.** A child that is
  relinked (rendered again in its place) with work pending is rendered on
  the spot, so the siblings after it are placed after it, not where it used to
  be. (Previously: a keyed child inserted before a sibling whose own build
  changed in the same pass left unkeyed siblings out of DOM order.)
- **(b) A component dropped by its creator's catch-up build stops
  rendering.** A component's render first brings its creator's build up to
  date (`refreshCreatorBuild()`); if that build no longer constructs it, the
  component is retracted and does not render. (Previously it rendered with
  retracted - undefined - properties.)
- **(c) Retracted during its own run stays retracted.** A repeater retracted
  while it runs finishes as retracted; anything it created after the
  retraction is retracted too.
- **(d) retractRepeater() is two-phase.** The whole tree is disposed and
  marked retracted first; then writings are undone and `onRetract()` fires.
  Nothing inside the tree reruns against undone writings. (Previously:
  retracting a paper layout from outside a pipeline re-ran paragraphs that
  read where the previous section had left off - from null.) Readers outside
  the tree are still notified.

### 10.17 What initialUnobservables() returns is copied

`this.unobservable` is a copy of the object `initialUnobservables()` returns
(`Object.assign({ repeater: null }, own)`), not that object. A closure made
in `initialUnobservables()` that captures the returned object never sees
what's written to `this.unobservable` later - by `build()`, say. Read
through `this.unobservable` in such closures.

```js
initialUnobservables() {
  const u = { settings: null };
  // Wrong: reads the original object - build()'s write never reaches it.
  // u.isWide = () => u.settings.wide;
  u.isWide = () => this.unobservable.settings.wide;
  return u;
}

build() {
  this.unobservable.settings = settingsFor("editor", { wide: false });
  ...
}
```

Found in Tabula: an editor's editing functions, made in
`initialUnobservables()`, read settings the build put on `this.unobservable`
- and found `null`, throwing on the first Enter.

### 10.18 Smaller rules

- `inherit()` only works once the component has entered the tree - not in a
  constructor, `setProperties()` or `initialState()`.
- In `onShow()`/`onHide()`, wrap reads in `withoutRecording()`: they run
  inside whoever is rendering, and would become that render's dependencies.
- Use `observable` from `@liquefy/cascade.component` for app models, so they
  live in the components' world (see 8.1).
- `frozen()` freezes in place: mutating frozen data later throws.
- `flush()` can oscillate; make sure corrections converge.
- An error thrown from `build()` or `render()` is annotated with the
  component path (`"in Editor.build() (App › Workspace › Editor)"`); DOM
  elements carry a debug `id` naming the components that produced them.

---

## 11. API reference

Signatures use `[optional]` for optional arguments. "Shorthand" means a
function `name(...parameters)` that constructs the class with the flexible
argument list of [3.1](#31-constructing-a-component).

### 11.1 @liquefy/cascade.reactive

Exports: `getWorld(configuration)` (also the default export). Everything else
is a member of the world it returns.

| Member | Signature | Description |
|---|---|---|
| `getWorld` | `getWorld({ name, ...options })` | Returns the world with that name, creating it with the options the first time. |
| `observable` | `observable([target], [buildId])` | Wraps an object or array in a tracked proxy; `buildId` gives it a rebuild identity inside a repeater. |
| `deeplyObservable` | `deeplyObservable(object, [copy])` | Makes a tree of plain objects and arrays observable, in place or as a copy. |
| `isObservable` | `isObservable(value)` | Whether `value` is an observable of this world. |
| `repeat` | `repeat([description], action, [nonRecordedAction], [options]) → repeater` | Runs `action` now and whenever what it read changes. Options: `time`, `independent`, `onRetract`, `onRefresh`, `pulledBy`, `rebuildShapeAnalysis`. |
| `invalidateOnChange` | `invalidateOnChange([description], doFirst, doAfterChange) → invalidator` | Runs `doFirst` recording reads; calls `doAfterChange` on the first change. |
| `linkRepeater` | `linkRepeater(repeater)` | Reattaches an existing repeater as a child at the current position. |
| `refreshIfNeeded` | `refreshIfNeeded(repeater)` | Runs a pending repeater now (a pull). |
| `retractRepeater` | `retractRepeater(repeater)` | Retracts a repeater and its subtree, two-phase; idempotent. |
| `establish` | `establish(object) → object` | Marks a rebuildable object established and calls its `onEstablish()`. |
| `dispose` | `dispose(object)` | Emits the dispose event and calls its `onDispose()`. |
| `finalize` | `finalize(object) → object` | Finishes a rebuilt object (merge its twin back) or establishes a new one. Internal to rebuilding. |
| `declareState` | `declareState(object, defaults) → object` | Declares state properties with baseline defaults. |
| `withoutRecording` | `withoutRecording(fn)` | Runs `fn` without recording dependencies; returns its result. |
| `withoutReactions` | `withoutReactions(fn)` | Runs `fn` without notifying anyone. |
| `accessInitialValues` | `accessInitialValues(fn)` | Runs `fn` as if outside any repeater: writes at the baseline, reads latest. |
| `flush` | `flush(fn)` | Lets invalidations caused in `fn` be processed in the current wave. |
| `postponeInvalidations` | `postponeInvalidations()` | Starts batching invalidations. |
| `continueInvalidations` | `continueInvalidations()` | Ends a batch and processes it. |
| `transaction` | `transaction(fn)` | Batches invalidations around `fn`. |
| `sameAsPreviousDeep` | `sameAsPreviousDeep(a, b, [depthLimit])` | Deep comparison of plain (non-observable) values. |
| `caching` | - | Cache helper built on `invalidateOnChange` (to verify: usage not documented here). |
| `log`, `loge`, `logs`, `logss`, `logGroup`, `logUngroup`, `logToString` | - | Debug logging without recording. |
| `state` | - | The world's internal state object (advanced). |
| `enterContext`, `leaveContext`, `invalidateObserver`, ... | - | Advanced hooks for extensions. |

Repeater object: `restart()` (invalidate and run again; brings back a
retracted root repeater), `retracted` (boolean), `disposed` (boolean).

Configuration options of `getWorld()` include `name`, `timeLevels` (4),
`requireRepeaterName`, `useNonObservablesAsValues`, `valueComparisonDepthLimit`,
`sendEventsToObjects` (true: calls `onChange`/`onEstablish`/`onDispose` on
objects), `onEventGlobal`, `onWriteGlobal`, `onReadGlobal`,
`customCreateRepeater`, `customCreateInvalidator`.

### 11.2 @liquefy/cascade.component

Reactive functions (re-exported from the `"cascade.component"` world):

| Export | Description |
|---|---|
| `world` | The world itself. |
| `observable`, `deeplyObservable`, `isObservable`, `repeat`, `linkRepeater`, `finalize`, `withoutRecording`, `sameAsPreviousDeep`, `invalidateOnChange`, `postponeInvalidations`, `continueInvalidations`, `flush`, `accessInitialValues`, `declareState`, `retractRepeater`, `refreshIfNeeded`, `state` | As in 11.1. (`establish`/`dispose` are used through `Component.establish()`/`dispose()`.) |

Components:

| Export | Signature | Description |
|---|---|---|
| `Component` | `new Component(...parameters)` | Base class. See below. |
| `ContextScope` / `contextScope` | `contextScope({ context, children })` | Renders children with `context` instead of the one where it stands. |
| `componentPath` | `componentPath(component) → string` | `"App › Page › Card(key)"`, following creators. |
| `getCreator` | `getCreator() → Component \| null` | The component whose build is running. |
| `aggregateToString` | `aggregateToString(component) → string` | Debug id of every component an element stands in for. |
| `view` | `view(name, build, [methods]) → (...parameters) => Component` | A component class from a build function. |
| `callback` | `callback(key, fn) → function` | A stable named callback for the running build. |
| `frozen` | `frozen(value) → value` | Deep-freezes plain data in place: compared by content. |
| `isPlainData` | `isPlainData(value) → boolean` | Plain object or array, not observable. |
| `RenderContext` | `new RenderContext([provided], [parent])` | A context link; `inherit(name)`, `serviceLocators()`. `RenderContext.empty` provides nothing. |
| `toProperties` | `toProperties(arglist) → properties` | Parses a flexible argument list (no children extraction). |
| `toPropertiesWithChildren` | `toPropertiesWithChildren(arglist) → properties` | Parses it, with loose arguments as `children`. |
| `extractProperty` | `extractProperty(object, name)` | Removes and returns a property. |
| `findImplicitChildren` | `findImplicitChildren(properties)` | Moves loose content into `children`. |
| `CompoundServiceLocator` | `new CompoundServiceLocator(...locators)` | Asks each locator in order; `hydrate(query)`. |
| `ObservableCompoundServiceLocator` | `new ObservableCompoundServiceLocator(...locators)` | Same, with observable `locators`. |
| `locateService` | `locateService(query, [fallbackLocator])` | Looks up a query through the running build's context; throws if nothing provides it. |
| `ServiceProvider` / `serviceProvider` | `serviceProvider({ serviceLocator, child })` | Renders `child` with an extra locator in front. |
| `isServiceQuery` | `isServiceQuery(value) → boolean` | A plain object with a string `type`. |
| `hydrateQuery` | `hydrateQuery(query, locator, [positionalKey])` | Hydrates a query tree through `locator`. |
| `hydrateService` | `hydrateService(query, [fallbackLocator])` | Hydrates through the running build's locators. |

`Component` methods - override:

| Method | Description |
|---|---|
| `setProperties(properties)` | Interpret properties (default: assign all). |
| `initialState() → object` | Declare state and defaults. |
| `initialUnobservables() → object` | Seed `this.unobservable`. |
| `provide() → object \| null` | What the subtree inherits. |
| `build() → Component \| Component[] \| null` | What this component is made of. |
| `render(target, context)` | Real-time work on the target (default: build and render children). |
| `enteredContext(given) → context` | Enter the tree with another context. |
| `onEstablish()`, `onDispose()` | Established / dropped for good (call super). |
| `onShow()`, `onHide()` | Shown / no longer shown. |
| `onRetract()`, `onReattach(target)` | Render retracted / relinked after retraction (call super). |

`Component` methods - call:

| Method | Description |
|---|---|
| `establish() → this` | Establish a component you own. |
| `dispose()` | Dispose of a component you own. |
| `renderOnto(target, [context])` | Render (or relink) onto a target. |
| `setState(values)` | Write declared state at the baseline. |
| `inherit(name)` | Nearest provided value above. |
| `fromTarget(name)` | A timeless value of the target it's placed on. |
| `showIf(condition) → this \| null` | Conditional inclusion in a build result. |
| `expand(target, context, renderParent, [isLeaf], [visited])` | Build as far down as `isLeaf` says (for placing containers). |
| `isExpandable()` | Whether it's composed purely by `build()`. |
| `buildOneStep()` | Build one step, pulling a pending build. |
| `refreshCreatorBuild()` | Bring the creator's build up to date. |
| `getComponentTypeName()`, `toString()` | Debug names. |

Fields: `key`, `creator`, `renderContext` (observable), `unobservable`,
`currentBuild`, `componentTypeName` (optional override for the debug name).

### 11.3 @liquefy/cascade.dom

| Export | Signature | Description |
|---|---|---|
| `DOMElementTarget` | `DOMElementTarget.forElement(element)` | A render target for an element. Methods: `appendElement(tag)`, `reattachElement(element)`, `observeBounds()`, `stopObservingBounds()`, `observeVisibility({ amount, margin })`, `resetVisibility()`, `stopObservingVisibility()`. |
| `BrowserLocation` / `browserLocation` | `browserLocation({ base, window })` | URL as observable `path`; `navigate(path, { replace })`, `href(path)`, `back(fallback)`, `dispose()`. |
| `DocumentHead` / `documentHead` | `documentHead(describe, { document })` | Reactive document head; `dispose()`. |
| `DOMServiceLocator` | `new DOMServiceLocator()` | Provides `htmlElement`, `textNode` and `domComponent` queries. |
| `DOMDebugServiceLocator` | `new DOMDebugServiceLocator()` | Provides a visible placeholder for any query, warning once per name. |
| `defaultDOMServiceLocator` | - | `CompoundServiceLocator(DOMServiceLocator, DOMDebugServiceLocator)`: the fallback of tag functions. |
| `hydrate` | `hydrate(tree)` | Hydrates a document through the running build's locators, DOM default behind. |
| `locateDOMComponent` | `locateDOMComponent(name, parameters)` | Asks for one of cascade.dom's components (for their factory functions). |
| `serviceQueries` | `serviceQueries(type)` | A namespace of query functions, for JSX (`<widget.button>`). |
| `SingleNodeComponent` | class | A build()-composed component guaranteed to build exactly one DOM node component. |
| `DOMNodeComponent` | class | A component owning one real node: implement `ensureNode()` or `renderNode(target, existingElement)`. |
| `DOMProvidingElement` / `providingElement` | `providingElement({ child, context, style })` | A div that provides `context`'s fields to its child. |
| `DOMElementBoundsProvider` / `elementBoundsProvider` | `elementBoundsProvider({ child, style, className })` | Measured element: child reads `fromTarget("width"/"height")`. |
| `DOMElementVisibilityProvider` / `elementVisibilityProvider` | `elementVisibilityProvider({ child, style, className, amount, margin })` | Watched element: child reads `fromTarget("inView"/"seen")`. |
| `FlipAnimationContainer` / `flipAnimationContainer` | `flipAnimationContainer({ enabled, speed, confine, zoomAlong, isUnit, style }, ...children)` | Places and animates its subtree. |
| `DOMPlacingContainer` | class | Base of containers that place their subtree themselves. |
| `OverflowContainer` / `overflowContainer` | `overflowContainer({ children, style, isUnit, ellipsis, overflowSlot, onOverflow })` | A row that moves what doesn't fit into a slot. |
| `DOMElementSlot` / `elementSlot` | `elementSlot({ style })` | An element for an overflow container to fill. |
| `DOMElementComponent` / `taggedElement` | `taggedElement(tagName, properties)` | A real element with attributes, style and children (constructed directly, bypassing locators). |
| `DOMTextComponent` / `text` | `text(value, [properties])`, `text({ key, text })` | A Text node. |
| `applyStyle` | `applyStyle(element, newStyle, previouslySetStyle) → nextPreviouslySet` | Diffs a style object onto an element. |
| `defaultToPx` | `defaultToPx(value, [property])` | A style value as CSS: bare numbers in px unless unitless. |
| `textWidth` | `textWidth(text, { fontSize, fontWeight, fontFamily })` | Text width in px, measured on a canvas. |
| `fitTextWithinWidth` | `fitTextWithinWidth(text, targetWidth, { fontWeight, fontFamily })` | Font size at which one line is `targetWidth` wide. |
| `element` | `element(tagName, ...parameters)` | Any element by tag name. |
| tag functions | `div(...parameters)` etc. | `address article aside footer header h1-h6 group main nav section search blockquote dd div dl dt figcaption figure hr li menu ol p pre ul a abbr b bdi bdo br cite code data dfn em i kbd mark q rp rt ruby s samp small span strong sub sup time u htmlVar wbr area audio img map track video embed iframe object picture htmlPortal source svg math canvas noscript script del ins caption col colgroup table tbody td tfoot th thead tr button datalist fieldset form input label legend meter optgroup option output progress select textarea details dialog summary slot template` |
| `Portal` / `portal` | `portal({ style }, ...defaultChildren)` | A place whose content comes from elsewhere. |
| `PortalSource` / `portalSource` | `portalSource({ portal, inheritFrom }, ...children)` | Shows its children in `portal` while shown. |

JSX runtime (import source `@liquefy/cascade.dom`): `jsx`, `jsxs`, `jsxDEV`,
`Fragment`.

### 11.4 @liquefy/cascade.ui

| Export | Signature | Description |
|---|---|---|
| `OverlayFrame` / `overlayFrame` | `overlayFrame({ style, overlayContent }, ...children)` | Where overlays are shown; provides `overlayFrame`. Methods `showOverlay()`, `hideOverlay()`. |
| `Overlay` / `overlay` | `overlay({ showing }, content)` | Shows one child on the nearest frame while `showing`. |
| `ModalBackdrop` / `modalBackdrop` | `modalBackdrop({ close, style })` | Dimmed layer; click calls `close`. |
| `Modal` / `modal` | `modal({ fullScreen, width, height, style }, content)` | Centered window or full screen; provides `modalPresentation`. |
| `ModalAssembly` / `modalAssembly` | `modalAssembly({ close, fullScreen, fullScreenBelow, width, height, backdrop, style }, content)` | Backdrop plus modal, full screen below a width. |
| `modalBackdropColor` | constant | `"rgba(0, 0, 0, 0.4)"`. |
| `Drawer` / `drawer` | `drawer({ modal, animate, speed, ...panel }, ...content)` | One sliding panel. |
| `Drawers` / `drawers` | `drawers({ modal, animate, speed }, ...panels)` | Several panels, one per edge. |
| `DrawerPanel` / `drawerPanel` | `drawerPanel({ open, close, onOpen, side, size, header, title, collapsed, bar, style }, ...content)` | One panel of `drawers()`. |
| `drawerBarSize` | constant | `48` - the room a collapsed bar takes. |
| `flexContainerStyle`, `rowStyle`, `columnStyle`, `centerStyle`, `middleStyle`, `centerMiddleStyle`, `naturalSizeStyle`, `fitContainerStyle`, `fillerStyle`, `autoFillerStyle`, `layoutBorderStyle`, `overflowVisibleStyle`, `zStackElementStyle` | style objects | Layout styles. |
| `wrapper`, `row`, `column`, `center`, `middle`, `centerMiddle`, `filler` | `row(...parameters)` | Divs with a default style under yours. |
| `zStack` | `zStack(...parameters)` | Children stacked edge to edge. |
| `widget` | `widget(name, properties)` | Asks the locators for `{ type: "widget", name }`. |
| `button`, `icon`, `iconButton`, `card`, `controlPanel`, `alert`, `listItem`, `dialog`, `textField`, `checkbox`, `colorField`, `tabBar` | `button(...parameters)` | Themed widgets (see 9.7). |
| `alertSeverities` | object | Icon and colors per severity. |
| `toButtonProperties` | `toButtonProperties(parameters)` | Parses arguments; a loose function becomes `onClick`. |
| `keyAsLabel` | `keyAsLabel(key)` | `"openDialog"` → `"Open dialog"`. |
| `popover` | `popover({ anchor, showing, close, style }, ...content)` | Content beside an element. |
| `Dropdown` / `dropdown` | `dropdown({ options, value, onSelect, disabled, title, placeholder, style })` | One choice out of several. |
| `BasicThemeServiceLocator` / `basicTheme` | locator | The basic theme. |
| `basicShadow` | constant | The basic theme's shadow. |
| `ColorScheme` | `new ColorScheme({ base, accent, extraVariables })` | Observable `base`/`accent`; `reset()`, `isChanged()`, `variables()`. |
| `ColorSchemeScope` / `colorSchemeScope` | `colorSchemeScope({ style }, ...children)` | A div setting the context theme's color variables. |
| `currentColorScheme` | `currentColorScheme() → ColorScheme \| null` | The scheme of the theme in the running build's context. |
| `themeColor` | object | Each color as `var(--cascade-..., fallback)`. |
| `deriveColors` | `deriveColors(base, accent)` | Every color from a base and an accent. |
| `colorVariables` | `colorVariables(colors)` | Colors as CSS variables. |
| `defaultColors` | constant | `{ base: "#34495e", accent: "#2e86c1" }`. |
| `hexToRgb`, `rgbToHex`, `rgbToHsb`, `hsbToRgb` | color conversions | |

---

### Points marked "to verify"

- 10.5: whether cascade.dom has a helper for `addEventListener`-only events.
- 11.1: the usage of the world's `caching` helper.

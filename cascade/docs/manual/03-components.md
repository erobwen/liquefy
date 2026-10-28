# 3. Components

A component is a class extending `Component`. Most implement only
`build()`; some also `setProperties()`, `initialState()`, `provide()` or
lifecycle hooks.

```js
import { Component } from "@liquefy/cascade.component";

class Card extends Component {
  setProperties({ title, children }) { ... }   // what it's given
  initialState() { return { open: false }; }   // what it keeps
  build() { return div(...); }                 // what it's made of
}

// A factory function, the convention throughout Cascade: card(...) rather than new Card(...).
export const card = (...parameters) => new Card(...parameters);
```

## 3.1 Constructing a component

The constructor accepts a flexible argument list (inherited from Flow):

```js
new Card({ key: "summary", title: "Summary" })   // one properties object
div({ style: { padding: "8px" } }, childA, childB) // properties, then loose children
div("toolbar", buttonA, buttonB)                  // leading lowercase string: the key
```

- One plain object anywhere in the list is the properties bag (two throw).
  It is copied, never used as is, so you may reuse or freeze the object you
  pass.
- Loose components, strings and numbers become `children`. Arrays are
  flattened into them, however deeply nested, so `ul(header, items.map(...))`
  is one flat list.
- `null`, `undefined` and `false` hold a place among the children but render
  nothing (trailing ones are dropped). Holding a place matters for matching
  (see [4](04-identity.md#4-identity-keys-and-pattern-matching)). A loose
  `true` or a function throws, with a message naming the build it happened
  in. (Factories may take a loose function out first: cascade.ui's
  `button(text("Go"), onClick)`.)
- The first loose argument, if it is a number or a string starting with a
  lowercase letter, becomes the implicit `key` - not a child. A key with
  whitespace in it warns, since it was probably meant as text.
- `key` may also be given in the properties. Use strings: a falsy explicit
  key (`key: 0`, `key: ""`) counts as no key at all.
- `children` given both loosely and in the properties throws.

Watch out for values that look like booleans but aren't: `count && badge()`
with `count === 0` passes the number `0`, which becomes a key (or a child
`"0"`). Write `count > 0 ? badge() : null`.

Inside a `build()`, constructing a component is how you create a child: the
component whose `build()` is running becomes its **creator**
(`this.creator`). Constructed outside any build (at the top level, in an
event handler), a component has no creator and nothing to be matched
against: the key is just a label.

To write a factory that takes the same argument list, call the constructor
with it (`(...parameters) => new Card(...parameters)`), or use
`toPropertiesWithChildren(parameters)` to get the properties object yourself
(see [11.2](11-api-reference.md#112-liquefycascadecomponent)).

## 3.2 Properties

Properties are like a function's arguments: set by the creator on every
build. Override `setProperties(properties)` to interpret them; the default
copies every property onto the component (`Object.assign(this, properties)`).
Each property becomes an observable field: reading `this.title` in `build()`
or `render()` is tracked.

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
[5.3](05-callbacks-and-frozen.md#53-frozen)).

This is why the shape of `setProperties()` matters. With the default, every
property is compared by identity, and a creator that writes
`badge({ style: { color: "red" } })` hands over a new object every time it
builds: the badge counts as changed, and whatever read `style` runs again -
its build, and from there everything it builds with fresh literals of its
own. Nothing is wrong on screen, but every rebuild ripples down. Freeze
plain-data properties (styles, option lists, `children`) and pass
`callback()`s rather than fresh closures, and a rebuild stops where nothing
changed.

Properties are the creator's to write. Assigning one from an event handler
doesn't even take effect: the write lands at the baseline, *before* the
creator's build wrote it, and readers go on seeing the creator's value. A
value the component changes itself is state.

## 3.3 State

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
  during a rebuild gets its own defaults, but they are not copied back. A
  default derived from a property is taken once: if the property changes
  later, the state keeps its value.
- State lives as long as the component. A component that is dropped and
  constructed again is a new one, with fresh defaults (see
  [4.2](04-identity.md#42-a-dropped-keyed-child-is-gone-for-good)).
- State may be written **from an event handler** (outside any repeater) by
  plain assignment: `this.open = true`.
- Writing state **from inside a repeater** (a build, a render, `onEstablish()`,
  anything that runs reactively) **throws** ("Cannot write state property
  ... from inside a repeater"). Where you must write state from such code,
  use `this.setState({ name: value })`, which writes at the baseline
  (`accessInitialValues()`) and rejects undeclared names. Readers that
  already ran will run again; that is fine, as long as the corrections
  settle rather than ping-pong.
- State is reactive like a property: reading `this.open` in `build()` makes
  the build rerun when it changes.

Declare everything the component changes itself in `initialState()`. An
undeclared field written from a handler is just an observable field: if the
creator also passes a property of that name, the creator's value wins (see
[3.2](#32-properties)), and a write to it from a repeater isn't caught.

## 3.4 Unobservables

`this.unobservable` is a plain object for non-reactive bookkeeping: render
counters, cached measurements, references to components you own. Seed it
with `initialUnobservables()`:

```js
initialUnobservables() {
  return { lastScrollTop: 0 };
}
```

`initialUnobservables()` runs lazily, the first time `this.unobservable` is
read, inside `accessInitialValues()` - normally on the established object, so
it runs once per component, not once per rebuild. What it returns is copied
(see [10.17](10-pitfalls-and-rules.md#1017-what-initialunobservables-returns-is-copied)).
Some names are reserved by `Component` itself (`repeater`, `buildRepeater`,
`pullingComponent`, `renderTarget`, `renderContext`, `renderParent`,
`ownContext`, `childContext`, `renderTimeless`, `callbacks`, `callbackBuild`,
`hydratedInBuild`, `hydrated` - using one throws).

Reading an unobservable records nothing, and writing one invalidates
nothing. Never keep something there that a build or render should follow.

## 3.5 build()

`build()` returns a component, a flat array of components, or `null`
(`null`, `undefined` and `false` in the array are skipped). The default
`render()` doesn't flatten nested arrays: spread them, or wrap them in an
element. It runs in its own repeater:

- It reruns only when something it read changes - not when the parent reruns.
- It runs only when the component is rendered (or expanded by a container,
  see [3.6](#36-rendertarget-context)): it is pulled by the render, not
  run on its own. A component that is never rendered never builds.
- One build repeater per component for its whole life. While the component is
  not rendered (a hidden page), its build is simply left invalid and is run
  again when the component is rendered again - its keyed children intact.
- The result is matched against the previous result (see
  [4](04-identity.md#4-identity-keys-and-pattern-matching)), and kept on
  `this.currentBuild`.
- A build may read the render context (`this.inherit()`,
  `this.renderContext`) and timeless target values (`this.fromTarget()`), but
  never the render target itself.
- A build constructs and returns. It can't write state (that throws), and
  shouldn't write shared models either: its job is to describe what the
  component is made of, and it may run any number of times.

`.showIf(condition)` returns the component, or `null`:
`new Panel({ key: "details" }).showIf(this.expanded)`. A child left out this
way is still constructed, so with a key it stays alive while hidden (see
[4.2](04-identity.md#42-a-dropped-keyed-child-is-gone-for-good)).

An error thrown from `build()` (or `render()`) has the component's path added
to its message: `in Editor.build() (App › Workspace › Editor)`.

## 3.6 render(target, context)

Override `render()` for a component that does real work at render time -
measuring, placing things itself, interleaving children with its own
writes. The default `render()` builds one step (`this.buildOneStep()`) and
calls `child.renderOnto(target, context)` for each child in order.

Three ways to write a component, then:

- `build()` only - most components. The default `render()` renders what it
  built.
- `render()` only - a component that places something itself (cascade.dom's
  elements, the `Word` below).
- `render()` that calls `this.buildOneStep()` itself, to get what `build()`
  returned and render it between writes of its own. A section of paper does
  this: it starts a page on the target, then renders the paragraphs it
  built.

```js
import { Component, observable, frozen } from "@liquefy/cascade.component";

// A render target of your own - no DOM at all (from the demo's Paper example):
// a paper holding the words placed on it, in order.
class Paper {
  constructor(width) {
    this.width = width;
    this.words = observable([]);
    return observable(this);
  }
}

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

class Sentence extends Component {
  setProperties({ words }) { this.words = words; }
  build() { return this.words.words.map((text) => new Word({ text })); }
}

const words = observable({ words: ["Temporal", "signals", "lay", "out", "words", "on", "paper"] });
new Sentence({ words }).renderOnto(new Paper(20));
```

Change the third word, and only it and the words after it lay out again; a
word that lands where it was stops the ripple (its entry is `frozen()`, so an
equal one is no change).

`context` in `render(target, context)` is what the children are to be
rendered with - pass it on. What the component itself inherits is read with
`this.inherit()`. A component rendered with no context at all (the `Paper`
above) gets `RenderContext.empty`.

Containers that place a whole subtree themselves (cascade.dom's
`FlipAnimationContainer`) don't render it: they call `expand()`, which
builds down through every component that only builds (`isExpandable()`:
it doesn't override `render()`). Such components get the same context and
lifecycle either way, which is one more reason to prefer `build()` when you
don't need `render()`.

## 3.7 Lifecycle

| Hook | When | Notes |
|---|---|---|
| `constructor` → `setProperties()` → `initialState()` | Every construction, including the throwaway twin of a rebuild | Do not acquire resources here, or create components you mean to keep. |
| `initialUnobservables()` | First access to `this.unobservable` | Runs at the baseline. Create owned components here. |
| `onEstablish()` | Built for the first time - when its creator's build finishes, before it is rendered - or `establish()` called by its owner | Acquire external resources (subscriptions, timers). Call `super.onEstablish()`. Runs inside the creator's build: write state with `setState()`. |
| `provide()` | Once, when it first enters the tree | Returns what it provides, or `null`. |
| `build()` | Reactively, when rendered | |
| `render(target, context)` | Reactively | |
| `onShow()` / `onHide()` | Shown (first render, rendered again, or placed by a container) / no longer shown | Notifications only. Reads here are recorded against whoever is rendering - wrap them in `withoutRecording()`. |
| `onRetract()` | Its render repeater is retracted (not rendered this pass) | Undo side effects the reactive system can't see. Default calls `onHide()`; call `super.onRetract()`. |
| `onReattach(target)` | Rendered again after being retracted | Redo what `onRetract()` undid. Default calls `onShow()`. |
| `onDispose()` | Dropped by its creator's build, its creator disposed, or `dispose()` called by its owner | Release resources. **Must call `super.onDispose()`**. |

Retracted is temporary - the component can come back with its state. Disposed
is for good: `Component.onDispose()` retracts the render repeater, stops the
build repeater, disposes of the component's own context and of everything its
build constructed (shown or not). So disposing a component disposes its
whole built subtree.

A component rendered at the root without `establish()` still renders, but its
`onEstablish()` never runs. Establish what you create.

## 3.8 Components you own (created outside build())

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
- An owned component's properties are set once, where it's created. If they
  must follow something, make them observables it reads, or build it
  instead.

## 3.9 Who owns a component

Three relations, easily confused:

- **Creator** (`this.creator`): the component whose `build()` constructed
  it. The creator's build *owns* it - establishes it, writes its properties,
  matches it on rebuilds, disposes it. Keys are scoped to the creator's
  build.
- **Owner**: for a component created outside any build, whoever created it
  and calls `establish()`/`dispose()` (3.8). A root component is owned by
  the code that rendered it.
- **Render parent**: the component that rendered it. Often the creator, but
  not necessarily: a `card` that renders `this.children` renders components
  its *own* creator constructed, and a portal renders content constructed
  far away. Rendering a component doesn't make it yours - it won't be
  disposed with you, and its identity is decided by the build that
  constructed it.

So a layout component taking `children` doesn't need keys for them, can't
dispose them, and should `frozen()` the array so that its creator's rebuild,
handing over the same (matched) children again, isn't a change.

`componentPath(component)` gives the creator chain as a string
(`"App › Settings › PresetBar(presets)"`), and `getCreator()` the component
whose build is running right now. `toString()` gives `"ClassName:id(key)"`;
set `componentTypeName` to name a component something other than its class
in these.

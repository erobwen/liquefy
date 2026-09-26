# Flow - Reactive DOM Rendering and State Management

![Flow Logotype](../flow.application/demo/public/flow.svg "Flow Logotype")

Flow is what you get if you take all the capabilities of MobX + React and
integrate them into one unit: components that build reactively, a UI that
follows your data with minimal DOM updates, and no stores, reducers or
notifications to wire up. It is the generation before
[Cascade](../README.md#cascade) - without Cascade's temporal signals, and
without their overhead: for context free UIs, built context free.

To install it and get started, see [@liquefy/flow.core](../flow.core#readme).
[Try the demo](https://erobwen.github.io/liquefy/flow/) - every page has a
button showing its own code - or run it locally, from the repository root:

```console
npm install
npm run flow:demo
```

## Features

* **Composite component model.**
  * A user interface is a composite of components. Each component builds
    reactively into other components - and, eventually, into primitive
    components that render onto the DOM.

* **Minimal updates.**
  * Only changes are rendered to the DOM (as React does).
  * Minimal updates of the component tree too: no need to tell pure
    components from impure ones - a component only rebuilds when something
    it actually read has changed.
  * Assigning a property the value it already has changes nothing - for
    models, view models and components alike.

* **Integrated, automatic state handling.**
  * `model({ ...yourData })` makes any data observable - ES6 proxies track
    every change and every dependency (as MobX does).
  * Change your data directly, from anywhere, at any time: the UI follows.
    No need to notify Flow of changes, and no observers, reducers or global
    stores to set up.
  * A model can belong to a store, which is told whenever objects in it
    change - `model(yourData, store)`.
  * Derived data that updates itself: `this.ensure(() => { ... })`.
  * Transactions: changes made in `transaction(() => { ... })` reach the DOM
    in one single animation frame.

* **Transition animations.**
  * Components that appear, leave or move across the UI animate (the FLIP
    technique) - containers of them animating their size along.
  * Easy to use: the property `animate` on a component. Fully configurable.

* **JavaScript first.**
  * JavaScript instead of configuration, templates, JSX or CSS files:
    styling and responsiveness are plain JavaScript too - and reactive, like
    everything else.

* **Render targets - render to any medium.**
  * Components render into primitives made available by the render target,
    without depending on any specific ones: the render target works as a
    service locator between your components and the primitives that do the
    rendering. Build a render target of your own, and your components
    render onto whatever it renders onto.
  * Render targets can be nested: inside a component, a new render target
    that another component renders onto.
  * Extend or override `DOMRenderTarget` and its primitives to change how
    anything is rendered.

* **Web components.** Flow can use and build web components: inside a web
  component, a render target connected to it that a Flow component renders
  onto. The page around it then has to render and hand it new arguments
  before anything inside can change, which can affect how animations are
  synchronized across the page - and component contexts don't reach inside
  it. Use web components to comply with browser standards or integrate with
  other projects, or bare Flow components for better communication between
  them.

* **Component lifecycle control.**
  * Off-screen components: a component can live with its state, and its DOM
    nodes ready, while disconnected from the document - for instant tab
    switching, say.
  * A component can move from one place in the DOM to another, keeping its
    state.
  * Three ways to keep a child's identity and state:
    * implicitly, by pattern matching of the build structure;
    * with keys, identifying a child across rebuilds;
    * by creating it yourself - in `initialize()`, say - and handling its
      lifecycle (`onEstablish()`, `onDispose()`).

* **Bottom-up rendering.** A child can be finalized, and laid out, before its
  parent renders - so the parent can measure it and lay out accordingly: for
  advanced, programmatic responsive layout.

* **More:**
  * Property inheritance down the component hierarchy (`this.inherit()`,
    playing the role of React's contexts).
  * Key paths (`getChild()`, `findKey()`), for programmatic access to
    components, UI test automation and debugging.
  * Portals, populated as components build - their content in place before
    the portal has even mounted, rather than in a second rendering pass.

## How it works

### Components

Components are JavaScript objects extending `Component`. They build into
other components, that eventually build into primitive components, rendered
by the DOM render target. An application typically defines its own set of
components - buttons and widgets in its own style and behavior - so instead
of CSS classes, you build components. Modularize further with plain
JavaScript modules as style components: everything is reactive, even the
styles.

### State

`model(object)` makes any JavaScript object observable - arrays included.
Make your model objects observable, and the user interface responds to
changes in them. Components are observable in the same way: change their
state at any time, and the user interface follows.

### Build and identity

When a component builds, it creates its children anew - but a child created
with the same key as one from its previous build takes over that child's
identity. However many times a component builds, its children keep their
established identities, and their state.

### Generality of flow.core

flow.core together with flow.dom is reactive DOM rendering. But flow.core on
its own is a general engine for **reactive recursive object composition**:
a reactive, generative process where, on each level, a build function builds
the children of a component, depending on state. It can build a
word-processor document, a spreadsheet, or a native mobile UI. Since it is a
reactive process, changes are minimal - and through keys and pattern
matching, children keep their identity and state, although the build
function apparently rebuilds them on every change.

### Programmatic reactive layout

The theory and philosophy behind Flow - in particular programmatic reactive
layout, and the "no CSS" principle - in
[these slides](https://docs.google.com/presentation/d/13E7E8TzRBoGBJ5BhVV78-s73AnYHnI4MrQ233xihZdY/edit?usp=sharing).

### Argument lists

The arguments to a component function follow a standard pattern:

```
myComponent([key], [Component | model | string | number]*, [properties])
```

* At most one plain object: the properties - whatever the component needs.
* At most one plain array: the children (`properties.children`).
* At most one function: an implicit `onClick` for components that have one.
  A function and `properties.onClick` both given is an error.
* Components, strings and numbers, in any order: the children. If the first
  is a string starting with a lowercase letter, or a number, it's taken for
  the component's key.

## More

[An introduction to Flow](https://www.youtube.com/watch?v=eNdQrf7WLWU), on
video.

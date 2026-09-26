# Flow

![Flow Logotype](https://raw.githubusercontent.com/erobwen/liquefy/main/flow.application/demo/public/flow.svg "Flow Logotype")

A generative, JavaScript-first front end framework with integrated,
auto-observing state management. Flow is what you get if you take all the
capabilities of MobX + React and integrate them into one unit: components
that build reactively, a UI that follows your data with minimal DOM updates,
and no stores, reducers or notifications to wire up.

Flow is the generation before [Cascade](https://github.com/erobwen/liquefy#readme),
which adds temporal signals to render in real time - a parent measuring, and
its children laying out within what it measured, in the same pass. If you
don't need that, Flow is a simpler machine: context free UIs, built context
free, without the overhead of temporal signals.

```console
npm install @liquefy/flow.core @liquefy/flow.dom @liquefy/causality
```

## Hello World

```js
import { Component } from "@liquefy/flow.core";
import { DOMRenderTarget, div, h1, b } from "@liquefy/flow.dom";
import { button } from "@liquefy/ui-material";

class Hello extends Component {
  // Properties - `to` here - are merged into the component by Flow itself.
  initialize() {
    this.count = 0;
  }

  build() {
    return div(
      h1(`Hello ${this.to}`),
      b("Clicked " + this.count + " times"),
      button("Click me!", () => this.count++),
    );
  }
}

new DOMRenderTarget(document.getElementById("app")).setContent(new Hello({ to: "World" }));
```

## What's in it

- **Composite component model.** A UI is a composite of components, each
  building reactively into other components. Keys (and pattern matching of
  the build structure) keep a child's identity - and state - across
  rebuilds.
- **Minimal updates,** to the DOM and to the component tree alike: no need to
  tell pure components from impure ones, and assigning a value a property
  already has changes nothing.
- **Integrated state handling.** `model({ ...yourData })` makes any data
  observable (ES6 proxies, like MobX), components are observable too - change
  anything, from anywhere, and the UI follows. Transactions, derived data
  (`this.ensure()`), and stores notified of changes.
- **Transition animations** - components appearing, leaving and moving across
  the UI animate (FLIP), with one property: `animate`.
- **JavaScript first** - no templates, JSX or CSS: styling and responsiveness
  are plain JavaScript, and reactive like everything else.
- **Render targets** - components don't depend on the DOM: a render target
  provides the primitives they render into, so they could render onto
  anything.
- **Portals, property inheritance, off-screen components** that keep their
  state and elements, and bottom-up rendering for layout that measures.

`flow.core` alone - without the DOM - is a general engine for reactive
recursive object composition: a document, a spreadsheet, a native UI.

Packages: [@liquefy/flow.dom](https://github.com/erobwen/liquefy/tree/main/flow.DOM#readme),
[@liquefy/basic-ui](https://github.com/erobwen/liquefy/tree/main/flow.ui/basic#readme),
[@liquefy/themed-ui](https://github.com/erobwen/liquefy/tree/main/flow.ui/themed#readme),
[@liquefy/ui-material](https://github.com/erobwen/liquefy/tree/main/flow.ui/material#readme),
on [@liquefy/causality](https://github.com/erobwen/liquefy/tree/main/causality#readme).
More in [Flow's documentation](https://github.com/erobwen/liquefy/tree/main/flow#readme),
and an [introduction video](https://www.youtube.com/watch?v=eNdQrf7WLWU).

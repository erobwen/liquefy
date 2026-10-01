# cascade.dom

[Cascade](https://github.com/erobwen/liquefy#readme) for the browser. Components
are rendered straight onto the real DOM in one pass, in tree order - reading
and writing it as they go - instead of building an abstract tree first and
reconciling it separately. A rebuild still touches only the nodes that
actually changed.

```console
npm install @liquefy/cascade.ui @liquefy/cascade.dom @liquefy/cascade.component @liquefy/cascade.reactive
```

## Hello World

```js
import { Component, RenderContext } from "@liquefy/cascade.component";
import { DOMElementTarget, div, h1, p, text } from "@liquefy/cascade.dom";
import { button, basicTheme } from "@liquefy/cascade.ui";

class Hello extends Component {
  setProperties({ to }) {
    this.to = to;
  }

  initialState() {
    return { count: 0 };
  }

  build() {
    return div(
      { style: { padding: "20px" } },
      h1(text("Hello " + this.to)),
      p(text("Clicked " + this.count + " times")),
      button(text("Click me!"), () => { this.count++; }),
    );
  }
}

// The render target: where it all goes. The service locator - the basic
// theme - provides the themed widgets (button(), ...); HTML elements are
// real DOM elements unless a locator says otherwise.
const target = DOMElementTarget.forElement(document.getElementById("app"));
new Hello({ to: "World" }).establish().renderOnto(target, new RenderContext({ serviceLocator: basicTheme }));
```

`text("...")` is always text. An element factory, though, takes a lone string
argument that starts with a lowercase letter for a key - so wrap text in
`text()`.

## What's in it

- **Every HTML element** as a function - `div()`, `span()`, `input()`, ... -
  keyed, styled with plain objects (`style: { padding: "20px" }`), and asked
  for through the render context's service locator.
- **`elementBoundsProvider()`** - measures its own element; what's placed on
  it reads the size with `this.fromTarget("width")`/`("height")`, following
  every change of its size: programmatic, reactive layout without CSS media
  queries.
- **`flipAnimationContainer()`** - animates every change in the subtree inside
  it: elements moving (within a parent, or to another one), resizing,
  appearing and leaving. Nothing inside it knows about animation.
- **`overflowContainer()`** - places its children one by one, measuring each
  where it really is, and moves what doesn't fit into an overflow slot (an
  ellipsis toolbar, say) - an `elementSlot()`, an element for it to fill,
  shown wherever the overflow belongs (a popover).
- **`portal()`** and **`portalSource()`** - content placed somewhere else in
  the tree: a page's buttons in the app's top bar, say. The contents inherit
  from where they came from (the source) by default, or from where they end up
  with `portalSource({ inheritFrom: "portal" })`.
- **`providingElement({ child, context, style })`** - an element of its own
  (a styleable div) that renders `child` into it, and provides the fields of
  `context` to everything below it.
- **`browserLocation()`** - routing: the URL as observable state.
- **`hydrate()`** - a UI written as a document: plain data, a tree of service
  queries, turned into components.
- **JSX** - tags compile to those same service queries, for `hydrate()`. With
  Vite (esbuild): `esbuild: { jsx: "automatic", jsxImportSource: "@liquefy/cascade.dom" }`
  in `vite.config.js`, and `serviceQueries("widget")` for themed widgets
  (`<widget.button>`).
- **`fitTextWithinWidth()`**, `textWidth()` - text measured on a canvas.

See the [demo](https://erobwen.github.io/liquefy/cascade/) - every page has a button
showing its own code.

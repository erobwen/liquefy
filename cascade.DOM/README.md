# cascade.dom

[Cascade](https://github.com/erobwen/liquefy#readme) for the browser. Components
are rendered straight onto the real DOM in one pass, in tree order - reading
and writing it as they go - instead of building an abstract tree first and
reconciling it separately. A rebuild still touches only the nodes that
actually changed.

```console
npm install @liquefy/cascade.dom @liquefy/cascade.component @liquefy/cascade.reactive
```

## Hello World

```js
import { Component, RenderContext, CompoundServiceLocator } from "@liquefy/cascade.component";
import { DOMElementTarget, DOMServiceLocator, div, h1, p, text } from "@liquefy/cascade.dom";
import { button, basicTheme } from "@liquefy/cascade.ui";

class Hello extends Component {
  setProperties({ to }) {
    this.to = to;
  }

  initializeState() {
    return { count: 0 };
  }

  build() {
    return div(
      { key: "hello", style: { padding: "20px" } },
      h1({ key: "title" }, text({ key: "titleText", text: "Hello " + this.to })),
      p({ key: "count" }, text({ key: "countText", text: "Clicked " + this.count + " times" })),
      button({ key: "click" }, text({ key: "clickText", text: "Click me!" }), () => { this.count++; }),
    );
  }
}

// What the app's components get when they ask for an HTML element, or a
// themed widget: real DOM elements, then the basic theme's widgets.
const services = new CompoundServiceLocator(new DOMServiceLocator(), basicTheme);

new Hello({ to: "World" }).renderOnto(
  new RenderContext(DOMElementTarget.forElement(document.getElementById("app")), { serviceLocator: services }),
);
```

Use `text({ key, text })` for text: a lone string argument that starts with a
lowercase letter is taken for a key.

## What's in it

- **Every HTML element** as a function - `div()`, `span()`, `input()`, ... -
  keyed, styled with plain objects (`style: { padding: "20px" }`), and asked
  for through the render context's service locator.
- **`elementBoundsProvider()`** - measures its own element and hands the
  result to its child as `this.renderContext.width`/`height`, following
  every change of its size: programmatic, reactive layout without CSS media
  queries.
- **`flipAnimationContainer()`** - animates every change in the subtree inside
  it: elements moving (within a parent, or to another one), resizing,
  appearing and leaving. Nothing inside it knows about animation.
- **`overflowContainer()`** - places its children one by one, measuring each
  where it really is, and moves what doesn't fit into an overflow slot (an
  ellipsis toolbar, say).
- **`contextContainer()`** - keeps a component, its state and its elements,
  wherever it's shown next.
- **`browserLocation()`** - routing: the URL as observable state.
- **`hydrate()`** - a UI written as a document: plain data, a tree of service
  queries, turned into components.
- **`fitTextWithinWidth()`**, `textWidth()` - text measured on a canvas.

See the [demo](https://erobwen.github.io/liquefy/cascade/) - every page has a button
showing its own code.

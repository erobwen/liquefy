# 2. Setting up a project

A Cascade app needs three things: a **render target** (where it goes), a
**render context** carrying a **service locator** (where components get their
elements and widgets from), and a root component that is **established** and
then **rendered onto** the target.

```console
npm install @liquefy/cascade.ui @liquefy/cascade.dom @liquefy/cascade.component @liquefy/cascade.reactive
```

The packages are plain ES modules, published as source: no compile step is
needed, but bare imports (`"@liquefy/cascade.dom"`) need something to resolve
them - a bundler such as Vite, or an import map. The demo uses Vite.

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

What happens:

- `renderOnto()` renders `Counter`: its `build()` runs (in a repeater of its
  own), and the `column` it returns is rendered onto the target - a real
  `div`, with its children rendered into it, in order.
- The click handler runs outside any repeater, so it may assign state
  directly: `this.count++`. That invalidates the build (it read
  `this.count`), which runs again. Its result is matched to the previous
  one by class and place - the same `column`, `h1`, `p` and `button` as
  before - so only the text of the `p` changes in the page.
- `callback("click", ...)` gives the button the same function on every
  build, so the button itself doesn't count as changed (see
  [6.1](06-callbacks-and-frozen.md#61-callbackkey-fn)). A plain arrow
  function works too; it just makes the button re-render each time.
- `button` is a themed widget from cascade.ui: a loose function given to it
  is its `onClick`, anything else loose is its content.

Notes:

- `new RenderContext(provided, parent)` - the root context provides
  `serviceLocator`. Everything below finds it.
- The shortest form, used by the package READMEs, passes just the theme:
  `new RenderContext({ serviceLocator: basicTheme })`. HTML tag functions fall
  back to `defaultDOMServiceLocator` (a `DOMServiceLocator` followed by a
  `DOMDebugServiceLocator`) when no locator in the context provides an
  element, so this works too.
- `establish()` calls the component's `onEstablish()` (and marks it
  established); a component built inside some `build()` gets that from its
  creator's build. A root that doesn't live as long as the page - a widget
  mounted into a page you don't own, a test - is taken down with
  `dispose()`, which stops its repeaters and removes what it rendered.
- To switch themes while the app runs, use an `ObservableCompoundServiceLocator`
  and replace a locator in it (see [8](08-services-and-hydration.md#8-services-and-hydration)).
- The themes draw icons with Google's icon fonts; link them in your page if
  you use `icon()` or `iconButton()` (Material Symbols for the basic theme,
  Material Icons for the Material theme):
  ```html
  <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined" rel="stylesheet">
  <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
  ```
- If you prefer JSX, see [10.6](10-dom-and-ui.md#106-jsx). This manual uses
  the function calls.

> **Text is `text()`.** A leading lowercase string (or a number) given to an
> element or widget function is its *key*, not its text: `div("header", ...)`
> is a div keyed `"header"`, and `td(42)` an empty cell keyed `"42"`. Wrap
> text in `text("...")`. See
> [11.6](11-pitfalls-and-rules.md#116-a-leading-lowercase-string-is-a-key-not-text).

## A project's shape

A typical app is a root component (an app frame: menu, top bar, a page area)
and one component per page, each building its widgets. Keep models -
the data your app is about - in observables of their own
(`observable({...})` from `@liquefy/cascade.component`), outside the
components, and let builds read them: a change anywhere reruns exactly the
builds that read it. Keep in component state only what belongs to that
component's own display (an open panel, a selected tab), and remember that
state lives as long as the component does (see
[5.2](05-identity.md#52-a-dropped-keyed-child-is-gone-for-good)).

# 8. Services and hydration

Every element and widget is asked for through the **service locators** in
the render context, so themes can replace whole components, and any part of
an app can have services of its own.

**The boundary rule.** Application code - your components, pages, demos,
anything that builds a UI - gets platform components only through the
factory functions that go through the locators: `div()`, `text()`,
`button()`, `elementBoundsProvider()`, `flipAnimationContainer()`,
`providingElement()`, `hydrate()` and the like. Never `new
DOMElementComponent(...)` or `new BasicButton(...)`: a component built that
way ignores the theme and every `serviceProvider()` around it. Inside
cascade.dom (and inside a theme's own widgets) components may construct each
other directly - whoever wants a different implementation replaces the whole
component through a locator, not its insides. Your *own* component classes
you construct with `new` as usual.

## 8.1 Locators and queries

A locator is any object with `locate(query)`, returning what it provides, or
`undefined`. A query is always an object, so different domains never collide
on a name:

```js
{ type: "htmlElement", name: "button", properties }  // an HTML <button> (DOMServiceLocator)
{ type: "widget", name: "button", properties }       // a themed button (basicTheme, materialTheme)
{ type: "textNode", properties }                      // a Text node (DOMServiceLocator)
{ type: "domComponent", name, properties }            // cascade.dom's own components (providingElement, ...)
{ type: "colorScheme" }                               // a theme's color scheme
```

`div()`, `button()` and friends call `locateService(query, fallbackLocator)`.
It asks each locator provided as `serviceLocator` on the way up from the
**building component's** context, nearest first, then the fallback; it throws
if none of them provides anything. Unlike other inherited values, locators
compose: one that doesn't provide something falls through to the next. The
reads are tracked, so a build depends on which locators its context holds.

**Where the lookup happens.** A lookup runs when the component is
*constructed*, in the context of the component whose `build()` is running
(the creator) - not where the result will be placed. Two consequences:

- A factory call outside any build (top-level code, an event handler)
  finds no context: only the fallback answers. cascade.dom's fallback (`defaultDOMServiceLocator`)
  provides HTML elements and placeholders, but no theme. Build UI in
  `build()`.
- `serviceProvider()` changes the services for builds *inside* it. Components
  constructed in the same build that creates the provider were already looked
  up in the outer context:

  ```js
  build() {
    return row(
      serviceProvider({ serviceLocator: inSwedish, child: button(text("Save")) }),  // NOT Swedish: built here
      serviceProvider({ serviceLocator: inSwedish, child: new SaveChanges() }), // Swedish: SaveChanges builds inside
    );
  }
  ```

### The root and fallback locators

The application puts its root locator in the root context
([7.1](07-context.md#71-provide-and-inherit)). A typical one:

```js
import { CompoundServiceLocator } from "@liquefy/cascade.component";
import { DOMServiceLocator, DOMDebugServiceLocator } from "@liquefy/cascade.dom";
import { basicTheme } from "@liquefy/cascade.ui";

const services = new CompoundServiceLocator(new DOMServiceLocator(), basicTheme, new DOMDebugServiceLocator());
new App().establish().renderOnto(target, new RenderContext({ serviceLocator: services }));
```

Asked in order: real DOM elements, then the theme's widgets, then
`DOMDebugServiceLocator`, which answers *every* query with a visibly marked
placeholder (and warns once per missing name) instead of failing. cascade.dom's
own fallback, `defaultDOMServiceLocator`, is `DOMServiceLocator` followed by
`DOMDebugServiceLocator` - so a missing widget renders a red dashed
`[widget name]` box rather than throwing.

### Custom locators

```js
class MyWidgets {
  locate(query) {
    if (query.type === "widget" && query.name === "card") return new FancyCard(query.properties);
    return undefined;
  }
}
const services = new CompoundServiceLocator(new DOMServiceLocator(), new MyWidgets(), basicTheme);
```

A locator can also wrap another one - here every text the app asks for is
translated, and everything else passes through:

```js
const dom = new DOMServiceLocator();
const inSwedish = {
  locate(query) {
    if (query.type !== "textNode") return undefined;
    const { text: original, ...rest } = query.properties;
    return dom.locate({ ...query, properties: { ...rest, text: swedish[original] ?? original } });
  },
};
```

- `CompoundServiceLocator(...locators)` - asks each in order; the first
  answer wins. Plain: no dependency recorded. Use it when the set never
  changes. Its `hydrate(query)` hydrates a document through it.
- `ObservableCompoundServiceLocator(...locators)` - observable: replace
  `compound.locators[i]` (or the whole `locators` array) and exactly the
  builds that looked something up through it rebuild - a runtime theme switch.
- `serviceProvider({ serviceLocator, child })` - renders `child` on the same
  target with `serviceLocator` in front of the surrounding ones: a part of
  the app with a theme (or translation) of its own. `serviceLocator` is
  provided through a getter, so a rebuild that swaps it is followed.
- `locateService(query, [fallbackLocator])` - look a query up yourself, the
  way a factory function does. A theme-dependent value that is not a
  component (`{ type: "colorScheme" }`) is looked up the same way.

### Switching locators at runtime

When a build reruns because its locator changed, each lookup may return a
component of a different class under the same key. A key that now belongs to
a different class is a *replacement*, not a rebuild: the new component is
established, the old one disposed - with its state. So a theme
switch keeps your own components and their state, but the themed widgets
themselves start fresh. Keep state that must survive a theme switch in your
components or models, not inside widgets.

Who may switch: the demo uses the render context for *using* services and
inheritance for *changing* them - the root component provides the switchable
locator as `rootServiceLocator`, a theme menu does
`this.inherit("rootServiceLocator")` to change it, and a subtree that should
not be able to provides `rootServiceLocator: null`.

## 8.2 Hydration

A document is plain data: a tree of queries whose `properties.children`
(an array, or a single one) hold further queries, strings and already-built
components. Hydrating hands each query to a service locator, children first,
and returns ordinary components - exactly as if `build()` had called `div()`,
`button()` and so on itself:

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

Nothing reactive happens in hydration: it is one more way to construct
components, so call it from `build()`, where what it constructs is that
build's to reconcile and the locators are those of the building component.

- `hydrate(tree)` (cascade.dom) is `hydrateService(tree, defaultDOMServiceLocator)`.
- `hydrateService(query, fallbackLocator)` - hydrate through the locators of
  the component whose build is running (the same lookup as `locateService()`).
- `hydrateQuery(query, locator, positionalKey = "h")` - hydrate through a
  given locator.
- A node without a key gets a positional key (`h`, `h.0`, `h.0.2`, ...): a
  node's own `key` wins, and its descendants' positional keys extend it. A
  rebuild then matches the new tree to the old one node for node. Several
  documents in one build are numbered `h`, `h1`, `h2`, ... (counted per run
  of the build, in order), and an array at the root is a fragment, its nodes
  side by side (`h.0`, `h.1`).
- A non-query value (a string, an already-built component) is kept as it is.
- `{ type: "component", componentClass, properties }` constructs
  `componentClass` directly, with its children hydrated - no locator is
  asked. JSX produces this for a Component class tag.
- A query no locator provides throws.
- `isServiceQuery(value)` - a plain object (not an array, not an observable)
  with a string `type`.
- JSX compiles to these same queries (see [10.6](10-dom-and-ui.md#106-jsx)).

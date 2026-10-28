# 9. DOM specifics and UI widgets

This chapter covers `@liquefy/cascade.dom` (rendering onto the real DOM) and
`@liquefy/cascade.ui` (themed widgets, layout, overlays) with the Material
theme. Each package README has more: `cascade.DOM/README.md`,
`cascade.ui/README.md`, `cascade.ui.material/README.md`.

One rule runs through all of it: **application code gets platform components
through the service locator** - `div()`, `text()`, `flipAnimationContainer()`,
`elementBoundsProvider()`, `button()` - never `new DOMSomething(...)`. Only
cascade.DOM's own components construct each other directly (a
`DOMElementComponent` its text children, say): whoever wants another
implementation replaces the whole component through a locator, so its
insides need not go through one. See
[7](07-services-and-hydration.md#7-services-and-hydration).

## 9.1 HTML tag functions

Every HTML element has a function - `div()`, `span()`, `input()`, `table()`,
... - plus `element(tagName, ...)` for any other tag, custom elements
included (`element("mdui-button", {...}, text("Save"))`). Two tags are
renamed to avoid clashing with JavaScript or cascade names: `htmlVar`
(`<var>`) and `htmlPortal` (`<portal>`). Each asks the service locators in
the building component's render context for
`{ type: "htmlElement", name, properties }`, falling back to
`defaultDOMServiceLocator` when none answers (so a theme or another platform
can decide what a `div` is). Arguments follow the flexible convention of
[3.1](03-components.md#31-constructing-a-component): a leading lowercase
string or number is the **key**, not text
([10.6](10-pitfalls-and-rules.md#106-a-leading-lowercase-string-is-a-key-not-text)).
`br()` takes no children.

- `style` is a plain object, diffed against what was applied last time
  (removed keys are cleared, unchanged ones not touched). Bare numbers are
  pixels, except unitless properties (`opacity`, `zIndex`, `flexGrow`,
  `fontWeight`, `lineHeight`, ... - React's list) and custom properties
  (`--name`, set with `setProperty()`).
- `className` and `htmlFor` become `class` and `for`; every other property
  name is lowercased (`onClick` becomes `onclick`, `tabIndex` `tabindex`).
- A property reaches the element **as an element property** where the
  element has a writable property by that name (`value`, `checked`,
  `disabled`, `title`, `inert`, `onclick`, ...) - live state, not just the
  initial attribute, so `value` set on every rebuild controls the input -
  and **as an attribute** otherwise (`class`, `for`, `aria-*`, `data-*`,
  `role`, `tabindex`, `readonly`, `colspan`, and properties with only a
  getter, like input's `list`). An attribute given `false`/`null`/`undefined`
  is absent, `true` present and empty. A property given `null` is cleared.
  Custom elements (a dash in the tag) always get properties, even before
  their definition loads.
- Event handlers are element properties: `onclick`, `oninput`, `onkeydown`,
  `onfocus`, ... An `on...` name the element has no property for is set as
  an attribute string - see
  [10.5](10-pitfalls-and-rules.md#105-event-handlers-must-be-element-properties).
- Properties no longer given are cleared: removed attribute, property reset
  to `false`, `null` or `""`. Anything set on the element from outside in
  between (an animation's inline transform) is left alone - only what changed
  in the properties is written.
- Loose string and number children become text nodes;
  `text("...")` makes one explicitly, `text("value", { key })` (or
  `text({ key, text })`) a keyed one. A loose string is a fresh, unkeyed text
  node on every rebuild; key one whose text changes often, so the same node
  is patched.
- `children` and every property are passed through `frozen()`: a rebuild
  with an equal style object or children array is not a change
  ([5.3](05-callbacks-and-frozen.md#53-frozen)).
- A component reconciled under the same key with a different tag (a theme
  swap turning `button` into `mdui-button`) gets a new element in the old
  one's place, its child nodes moved over.
- Every element the platform creates gets a debug `id`:
  `aggregateToString()` of its component - `"App:12 | Page:40(home) | ..."`.
  Click it in DevTools to see which component (and which builders) made it.
  An `id` you give as a property replaces it.

## 9.2 Render targets, the root, and DOM components

`DOMElementTarget.forElement(element)` wraps an element that components
render into - the app's root (see [2](02-getting-started.md#2-getting-started))
and every element's own children. Its `lastChild` is an observable read and
written in tree order: each component inserts its node after what the
component before it placed, and re-confirms its position on every render
(without touching the DOM when nothing moved). A target holds what is
temporal - what has been placed so far, its measured size - never services
or provided values: those travel in the render context
([6.2](06-context.md#62-render-target-vs-render-context)).

`observeBounds()` and `observeVisibility({ amount, margin })` opt a target
in to keeping its element's size or visibility on `target.timeless`, read
from `build()` with `this.fromTarget(name)`. Use the providers below rather
than calling them yourself.

A prerendered app (`@liquefy/cascade.prerender`) starts on
`PrerenderedElementTarget.forElement(root)` from
`@liquefy/cascade.prerender/client` instead - a `DOMElementTarget` that
replaces the prerendered snapshot with the live app in one frame. That is the
only prerender-specific code in an app; cascade.dom itself knows nothing of
prerendering. Snapshots are taken at one viewport width, so what must be
right on a phone at first paint should be done with CSS (media queries), not
with measured layout ([9.3](#93-measurement-and-layout)).

Writing a DOM component of your own (rare - a canvas, a third-party widget):

- Extend `DOMNodeComponent` and implement **`ensureNode()`** - create the
  node if there is none (`this.unobservable.node`), bring it up to date,
  return it, without placing it. Such a component can also be placed by a
  placing container ([9.4](#94-placing-containers-and-flipanimationcontainer)).
  Or implement **`renderNode(target, existingElement)`** to create, update
  and place it yourself (measuring, owning a target for children): such a
  component can only be rendered, and is an island inside a placing
  container.
- The base removes the node on retraction and puts it back on reattach.
- Extend `SingleNodeComponent` instead for a `build()`-composed component
  that must build exactly one DOM node component (it throws otherwise).
- `applyStyle(element, style, previous)` gives you the same style diffing
  as elements; keep its return value in `unobservable`.

## 9.3 Measurement and layout

Cascade lays out from real measurements when you ask it to: a component
reads the size of the element it is placed in, and builds for that size.
Measurement is an advanced feature with rules:

- `elementBoundsProvider({ child, style, className })` - a div whose layout
  size (content box, as laid out - transforms don't change it) its `child`
  reads from build() or render(): `this.fromTarget("width")`,
  `this.fromTarget("height")`.
  - **Size-contained by default** (`contain: size layout`): its size comes
    from its parent and siblings, never from its content, so what is built
    from the size can't change the size. It must therefore get its size from
    outside - fill its parent, a flex share, a grid cell. For one whose height
    follows its content, give `contain: "inline-size layout"` in `style`.
  - **Measured synchronously when first rendered**, so the child's first
    build already has the real size; a ResizeObserver follows every later
    change (window resize, siblings arriving in a flex row), reporting after
    layout and before paint, so nothing is drawn at the old size.
  - If the size changes within the frame it was first measured in (a sibling
    added after it, a height following content), the new size is taken and
    the readers rebuild - graceful degradation, and the browser may log
    "ResizeObserver loop completed with undelivered notifications". That
    means the DOM is set up wrong, not that Cascade is.
  - `width`/`height` are `undefined` while the element isn't in the page.
  - The size means something only to the child placed on that element:
    what the child renders into an element of its own has another target.
    **Never put a measured size in the render context**; hand it to a child
    as a property ([10.13](10-pitfalls-and-rules.md#1013-never-put-a-temporal-value-in-the-render-context)).
- `elementVisibilityProvider({ child, style, className, amount, margin })` -
  a div (not size-contained) whose child reads `this.fromTarget("inView")`
  (in view now) and `this.fromTarget("seen")` (has been since last shown;
  stays true). `amount`: fraction of its height that must be visible
  (default `0.25`; for an element taller than the viewport, a fraction of
  the viewport; `0` = any part). `margin`: IntersectionObserver `rootMargin`
  (default `"0px"`). Clipping by scroll panels counts. Both are false until
  the observer first reports (between frames), so content built from them is
  first drawn "not seen". Hidden and shown again (page switched), `seen`
  resets - reveal-on-scroll pages reveal anew. Without IntersectionObserver
  it counts as seen at once.
- `overflowContainer({ children, ellipsis, overflowSlot, onOverflow, isUnit, style })`
  with `elementSlot({ style })` - an ellipsis toolbar. Places its children's
  nodes in its row one at a time, measuring each where it lands; at the first
  that overflows, that one and the rest go into `overflowSlot` (an
  `elementSlot()` you show elsewhere, typically in a popover), and `ellipsis`
  (a component) is placed last in the row. All within one render, before
  paint. `onOverflow(count)` is called when the number overflowed changes
  (it typically does a `setState()` upward - a backward write, which is
  fine). Lays out again when rebuilt, when the `width` of the target it's
  placed on changes (put it on an `elementBoundsProvider`), and when a
  child's node resizes by itself.
- `textWidth(text, { fontSize = 13, fontWeight = 400, fontFamily })` and
  `fitTextWithinWidth(text, targetWidth, { fontWeight, fontFamily })` -
  text measured on a canvas (cached; nothing laid out). `fontFamily`
  defaults to the body's.

## 9.4 Placing containers and FlipAnimationContainer

`FlipAnimationContainer` and `OverflowContainer` are **placing containers**
(`DOMPlacingContainer`): instead of letting each component in their subtree
render itself, they expand the whole subtree (`Component.expand()`, every
component given its render context, so services are found as usual) down to
DOM nodes and place every element's child nodes themselves, in one pass. At
rest the DOM is exactly what normal rendering would give. What this means for
you:

- **Islands.** A component that can only be rendered (its own `render()`,
  like a bounds provider) - and any component your `isUnit(component)`
  answers true for - is rendered normally into a plain block `div` the
  container adds (`data-flip-island` / `data-island`) and placed as one
  piece. That wrapper div is in the layout: style for it (a flex item, say)
  goes on what's around it or inside it accordingly.
- Edits inside an island are the island's own business. **Any structural
  change elsewhere in the subtree reruns the whole container** (it reads the
  entire expanded tree), so mark large, independently changing parts as
  units.
- `isUnit` should be one stable function (a module-level constant, or a
  `callback()`): a new function every build counts as a changed property.
- Components it places get `onShow()`/`onHide()` as rendering would give
  them; while the container is hidden, their builds don't run.

`flipAnimationContainer({ enabled, speed, confine, zoomAlong, keepCorners, isUnit, style }, ...children)`
places its subtree and **animates every change in it**: moves within a parent
or to another, resizes, appearing and leaving. The components inside know
nothing about animation. Items must keep their identity to animate as moves:
give keys to what can move, appear or disappear
([4](04-identity.md#4-identity-keys-and-pattern-matching)).

| Option | Default | Meaning |
|---|---|---|
| `enabled` | `true` | Animate at all. Off, it only places, and whatever is on its way is where it belongs at once. |
| `speed` | `FlipAnimationContainer.speed` (1) | Pace factor: 1 is the springs' natural pace, 0.5 half. Read as frames are drawn: changing it never places anything again. |
| `confine` | `false` | What appears stays within the elements around it as they are drawn on their way - clipped where they clip, not lifted above its surroundings. Off: it fades in whole, lifted over the edge of a container still growing to make room. |
| `zoomAlong` | `false` | What fades in or out inside something growing or shrinking zooms with it (uniformly, by the geometric mean of the carrier's scales). Off: it keeps its own size and only follows its carrier's position. |
| `keepCorners` | `true` | Rounded corners keep their roundness while what they're on is scaled, going gradually from how round they were drawn to how round they are at rest (percent radii are left alone). Costs a repaint of scaled elements every frame; off, only `transform` and `opacity` change while things move. |
| `isUnit` | none | `(component) => boolean`: components to place, and animate, as one piece. |
| `style` | none | The container's own div. |

How it animates (FLIP with springs):

- On every render it records where and how large each tracked element is
  drawn right now (mid-animation included), places, reads the new layout,
  and draws each element at the difference with a `translate()`/`scale()`
  that a per-element spring brings to zero. A spring keeps its velocity, so
  an element redirected mid-flight curves smoothly to its new place. Nested
  elements are drawn relative to their nearest tracked ancestor, so movement
  never adds up twice.
- An element with text of its own is never squashed: it is scaled only by
  the change of its font size, and its box takes its new size at once.
- **Appearing**: the outermost new element fades in where it lies (not on
  the container's first render). New elements inside something on its way
  come along with it.
- **Leaving**: a removed element is put back as a **ghost** where it was
  among its siblings, positioned exactly as drawn, keeping its font and
  color, fading out. A bare box (nothing to see of its own) fades out as its
  parts instead. An element that comes back while fading is restored and
  moves on from there.
- **Travelling** (moving to another parent): raised into a layer of the
  container's own above everything else in it - above an overlay with its own
  z-index too - with an invisible placeholder holding its spot, and lowered
  back when it arrives. On the way it gradually takes on the looks of where
  it lands (color, background, shadow, font weight). One with text and a
  visible box of its own is **sized**, not scaled, from its old size to its
  new, its text laid out anew; in a flex or grid box its **texts glide** to
  their new places, and a text that now says something else **cross-fades**
  (the old text leaves as a ghost, the new fades in).
- **The container's own box** grows or shrinks to its new size with a spring
  of its own (its inline `width`/`height` set while it does), so what is
  around the container makes room gradually instead of snapping when the
  first item arrives or the last leaves.
- Stacking: at rest, the app's DOM order and z-indexes alone decide what is
  above what. Only while something animates does the container lift or
  raise it.
- Nothing animates while the container isn't in the page. Islands animate as
  one element.
- `FlipAnimationContainer.speed` is the global default pace;
  `FlipAnimationContainer.clock` (`now`, `requestFrame`) can be replaced -
  tests drive frames by hand.

## 9.5 Portals, providing elements, routing, head

### Portals

`portal({ style }, ...defaultChildren)` is a place (a div) whose content
comes from elsewhere; `portalSource({ portal, inheritFrom }, ...children)`
builds nothing where it stands and, while it is shown, shows its children in
`portal` - a page's buttons in the app's top bar, say. Both live in
cascade.dom (no theme needed) and are constructed directly, not through a
locator.

- `portal` is a Portal or the name of one to `inherit()`; a name nothing
  provides warns once.
- The portal shows its default children when nothing is assigned, or only an
  empty list.
- The last source shown wins; a source hidden (its page switched away)
  takes its content back - but only if it is still the one shown.
- Contents inherit from where they came from (`inheritFrom: "source"`,
  default) or, with `inheritFrom: "portal"`, from where they end up.
- The portal is usually rendered before its source (the top bar before the
  work area), so assigning is a backward write: done with `setState()` and
  `flush()`, so the portal fills in within the same wave, in order. This
  is intended (see [10.21](10-pitfalls-and-rules.md#1021-writing-back-to-something-already-rendered-setstate-and-flush-and-make-it-converge)).
- **Own the portal**: create it in `initialUnobservables()`,
  `.establish()` it there, `dispose()` it in `onDispose()`, and provide it
  ([3.8](03-components.md#38-components-you-own-created-outside-build)):

  ```js
  initialUnobservables() {
    return { topBarPortal: portal({ key: "topBarPortal", style: { display: "flex" } }).establish() };
  }
  provide() { return { topBarPortal: this.unobservable.topBarPortal }; }
  onDispose() { this.unobservable.topBarPortal.dispose(); super.onDispose(); }
  // in build(): render this.unobservable.topBarPortal in the bar;
  // anywhere below: portalSource({ portal: "topBarPortal" }, button("save", save))
  ```

### providingElement

`providingElement({ child, context, style })` - a styleable div that provides
the fields of `context` to its child's subtree, rewritten at the baseline as
they change, dropped fields no longer provided. Only timeless values: never a
measured size.

### Routing

`browserLocation({ base, window })` - the URL as observable state. `base` is
where the app is served (`"/"`, or Vite's `import.meta.env.BASE_URL`).

- `path` - segments below the base (`/app/shop/42` under `/app/` is
  `["shop", "42"]`; the base itself is `[]`). Read it in a build and the
  build follows the URL. Back/forward (popstate) update it; the same path
  again changes nothing.
- `navigate(path, { replace })` - segments or a string; pushes (or replaces)
  a history entry. Call it from event handlers, like any user change.
- `href(path)` - the URL for a link's `href`.
- `back(fallback)` - `history.back()` if the user came from within the app,
  else `navigate(fallback, { replace: true })` (for closing something with
  its own URL, opened directly).
- `dispose()` - stops listening.

There is no router component: create one `browserLocation()` at startup,
hand it to the root component (or provide it), and choose pages from `path`
in `build()`. Links are `a({ href: location.href(p), onclick })` where the
handler calls `event.preventDefault()` and `navigate(p)`.

### Document head

`documentHead(describe, { document })` - the head built reactively from your
data. `describe()` runs as an independent repeater and returns
`{ title, description, canonical, image, type, meta, structuredData }`:

- `title` - `document.title` and `og:title`; `description` - meta
  description and `og:description`; `canonical` - `<link rel="canonical">`
  and `og:url`; `image` - `og:image` and a large `twitter:card` (URLs made
  absolute against the document); `type` - `og:type` (default
  `"website"`); `meta` - `{ name: content }` (`og:`, `article:`, `product:`
  ... as `<meta property>`, others as `<meta name>`); `structuredData` - an
  object or array, as `application/ld+json`.
- Its tags are marked `data-cascade-head`; they replace those of the
  previous description and any a prerendered page came with. Nothing else
  in the head is touched.
- Returns a handle; `dispose()` stops it and removes its tags. Call it once
  at startup, outside any build.

## 9.6 JSX

With Vite (esbuild): `esbuild: { jsx: "automatic", jsxImportSource: "@liquefy/cascade.dom" }`.
JSX tags compile to **service queries** (plain data), not components; pass
them to `hydrate()` inside a build
([7.2](07-services-and-hydration.md#72-hydration)). Lowercase tags are HTML
element queries; `<widget.button>` with `const widget = serviceQueries("widget")`
asks for a themed widget; a Component class tag constructs that class once
its children are hydrated; any other function tag is called with the
properties. Properties pass through untouched (callbacks included);
children are flattened, adjacent strings joined, and `null`, `undefined`
and booleans dropped (`{open && <p/>}`). Unkeyed nodes get positional keys,
so a rebuild matches node for node; text in JSX is never taken for a key.

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

## 9.7 cascade.ui widgets

Themed widgets ask the locators for `{ type: "widget", name, properties }`;
which theme answers is decided by whoever set up the render context (the root,
or a `serviceProvider()` subtree), never by the component using the widget.
Every theme implements the same property contract (`cascade.ui/src/widgets.js`),
so switching themes changes looks, not meaning. Every widget takes `key` and
`style`. With no theme in the context, a widget falls back to the DOM
default and renders as a dashed, warning placeholder.

| Widget | Main properties |
|---|---|
| `button` | `onClick` (or one loose function), `disabled`, `variant` (`"filled"` for the main action), children; other properties (`title`, ...) pass to the element. Given no children, shows its key as a label (`button("openDialog", fn)` reads "Open dialog"). |
| `icon` | `name` (Material icon name: `"info"`, `"close"`, ...); `style.fontSize` sets its size |
| `iconButton` | `icon`, `onClick` (or a loose function), `title`, `disabled` |
| `card` | `variant` (`"elevated"` default, `"filled"`, `"outlined"`), children |
| `controlPanel` | children - controls in a wrapping row on a surface |
| `alert` | `severity` (`"info"` default, `"success"`, `"warning"`, `"error"`), children |
| `listItem` | `active`, `onClick` (or a loose function), children |
| `dialog` | `title`, `close`, `fullScreen`, children. Title bar with close button; full screen it fills its place with a back arrow instead. Unset `fullScreen` follows the `modalPresentation` a `modal()` provides. |
| `textField` | `label`, `placeholder`, `value`, `onInput(text)`, `type` (`"text"`/`"number"`), `unit`, `error` (message; marks it invalid) |
| `checkbox` | `label`, `checked`, `onChange(checked)` |
| `colorField` | `label`, `value` (hex), `onInput(hex)` while picking |
| `tabBar` | `tabs` (`[{ key, title }]`), `selected` (a key), `onSelect(key)` |

Notes:

- Inputs are controlled by you: `value`/`checked` are written to the element
  on every build, and `onInput`/`onChange` tell you what the user did. Keep
  the value in state and write it from the handler.
- Widgets made of several elements (alert, dialog, text field) are
  components of their own, so their inner keys never collide with yours.
- Both themes draw icons from Google's icon fonts: the basic theme uses
  Material Symbols Outlined, the Material theme `mdui-icon` (Material
  Icons). Link the fonts ([2](02-getting-started.md#2-getting-started)).
- The basic theme adds a small stylesheet (`data-cascade-theme="basic"`) on
  first use for hover/focus states; inline style is left for yours.

Layout: `row`, `column`, `center`, `middle`, `centerMiddle`, `wrapper`,
`filler`, `zStack` - each a div with a default style merged **under** yours
(your values win) - and the style constants they use (`rowStyle`,
`fillerStyle`, `fitContainerStyle`, ...). Layout containers set
`minWidth/minHeight: 0` (they can shrink in a flex parent) and do not clip;
add `overflow: "hidden"` where you want clipping. `fitContainerStyle` is
100% of the parent's box; `fillerStyle` an equal flex share (`flex: 1 1 0`);
`autoFillerStyle` grows from its content size. `zStack` stacks its children
edge to edge (absolutely, via a class rule) - a child's own style can still
deviate.

## 9.8 Overlays, modals, drawers, popovers

Overlays are how anything appears above the page: modals, popovers, the
dropdown's list. The design: the overlay is **built where it belongs** (next
to the button that opens it, keeping that place's context and state) and
**shown on a frame** at the top of the tree.

- `overlayFrame({ style, overlayContent }, ...children)` - place one at the
  app's root, around everything, sized to the viewport (its div is
  `position: relative`, and what it shows covers it). Every frame provides
  itself as `overlayFrame`. `overlayContent` is an alternative to
  `overlay()`: content handed to the frame directly by whoever owns it.
- `overlay({ showing }, content)` - hands its single child to the nearest
  frame while `showing` (and while it is itself shown: a page switched
  away takes its overlay with it). Built right where it stands; the content
  inherits from there. **One overlay per frame**: a newer one evicts the
  older (which keeps its `showing` but isn't shown again until re-shown).
  Overlays stack across frames: content shown on a frame gets a layer that
  is itself a frame, so an overlay opened from inside a modal stacks above
  it. No frame above it: it warns once and shows nothing.
- The layer covering a frame is a measured element
  (`elementBoundsProvider`), not pointer-catching (`pointerEvents: none`):
  overlay content reads the frame's size with `fromTarget("width")`, and
  must set `pointerEvents: "auto"` on what should be clickable (the pieces
  below do).
- `modalAssembly({ close, width, height, fullScreen, fullScreenBelow, backdrop, style }, content)` -
  the ready-made modal: backdrop plus centered window. `fullScreenBelow`: full
  screen, without backdrop, while the frame is narrower (a phone).
  `fullScreen: true/false` forces it. `backdrop: false` leaves the backdrop
  out. Parts, usable on their own: `modalBackdrop({ close, style })` (dimmed
  `modalBackdropColor` layer; a click calls `close`) and
  `modal({ fullScreen, width, height, style }, content)` (centered window
  or full frame; numbers are px; provides `modalPresentation`: `"window"`
  or `"fullScreen"`, which a `dialog()` follows).

  ```js
  build() {
    const close = callback("close", () => { this.asking = false; });
    return column(
      button("delete", callback("ask", () => { this.asking = true; })),
      overlay({ showing: this.asking },
        modalAssembly({ close, width: 340, fullScreenBelow: 480 },
          dialog({ title: "Are you sure?", close }, /* ... */))),
    );
  }
  ```

  For anything else - an animated entrance, a bottom sheet - give
  `overlay()` content of your own, a backdrop included.
- `popover({ anchor, showing, close, style }, ...content)` - content beside
  `anchor`: an element (usually `event.currentTarget`, stored in state) or a
  viewport rectangle. Placed by which quarter of the window the anchor is
  in (below it in the upper half, above in the lower; aligned to the edge
  further from the window's) - never measured. Follows an element on resize
  and scroll. A mousedown outside calls `close`. Shown through `overlay()`,
  so it needs an overlay frame, and it takes that frame's one overlay slot.
- `dropdown({ options, value, onSelect, disabled, title, placeholder, style })` -
  a button showing the chosen option's label, opening a popover list.
  `options`: `[{ value, label, style }]` (`style` previews the option in the
  list). It builds two components (button and popover), not one element.
- `drawer({ open, close, onOpen, side, size, header, title, collapsed, bar, style, modal, animate, speed }, ...content)` -
  a panel sliding in from an edge (`side`: `"left"` default, `"right"`,
  `"top"`, `"bottom"`) over its nearest positioned ancestor - place it last
  in a `position: relative` element. `open` is yours; `close()` is called
  when the user closes it (chevron, backdrop, Escape), `onOpen()` when they
  open it from its handle or bar. `size` (default 300 px) is its width or
  height. `header: false` drops the title header. `collapsed`: `"nothing"`
  (default), `"handle"` (a tab on its inner edge) or `"bar"` (a
  `drawerBarSize` = 48 px strip, showing `bar` content; leave room for it).
  `modal: true` adds a backdrop that closes every open panel. `animate`
  (default true) and `speed` as for FlipAnimationContainer, which drawers
  are built on. `drawers({ modal, animate, speed }, drawerPanel({...}), ...)`
  holds one panel per edge (a second on the same edge is dropped with a
  warning). Closed panels stay built (state, scroll kept) but inert. Panel
  content is an island; with `collapsed: "bar"` it is placed element by
  element instead, so a component keyed the same in `bar` and content
  flies between them.

Drawers are not overlays: they live where you place them, not on the
overlay frame.

## 9.9 Color schemes

A theme's colors derive from two: a **base** (frame, surfaces, text, in tones
of it) and an **accent** (emphasis, focus, the active item). `deriveColors(base, accent)`
makes them all (`chrome`, `chromeDark`, `onChrome`, `text`, `textSoft`,
`page`, `surface`, `border`, `accent`, `accentSoft`, ...). Everything uses
them as CSS variables: `themeColor.page` is
`var(--cascade-page, <default>)`, falling back to the default scheme
(`defaultColors`: base `#34495e`, accent `#2e86c1`) outside any scheme. Use
`themeColor.*` in your own styles to follow the theme.

- Each theme locator provides a `ColorScheme` for the query
  `{ type: "colorScheme" }`. `currentColorScheme()` (inside a build) returns
  the scheme of the theme in the context, or `null`.
- The variables must be set on an element: put `colorSchemeScope({ style }, ...children)`
  around your app (or around a `serviceProvider()` subtree with another
  theme), or spread `currentColorScheme().variables()` into your root
  element's style yourself.
- `ColorScheme` has observable `base` and `accent`: assign them from an event
  handler and only the scope element's variables are rewritten - nothing else
  rebuilds. `reset()` and `isChanged()` compare with the initial colors.
- Each theme locator instance owns one scheme, so changing it affects
  everything using that theme instance.

## 9.10 The Material theme

`materialTheme` (from `@liquefy/cascade.ui.material`) implements the same
widgets with mdui 2 web components (`mdui-button`, `mdui-icon`,
`mdui-button-icon`, `mdui-list-item`) and mdui design tokens for the rest.
Put it where `basicTheme` would go in your locator:

```js
new CompoundServiceLocator(new DOMServiceLocator(), materialTheme, new DOMDebugServiceLocator())
```

- Import the package's index (it registers the mdui components and imports
  mdui's CSS - needs a bundler that handles CSS imports, like Vite) in the
  browser. `src/MaterialTheme.js` alone is the node-testable locator, without
  mdui.
- Buttons are `tonal` unless `variant: "filled"`.
- Its colors are Material tonal palettes made from the scheme's base
  (`mduiColorVariables(hex)` gives the `--mdui-color-*` variables, light
  scheme only), set alongside the `--cascade-*` ones by its `ColorScheme`;
  default `materialDefaultColors` (base `#6750a4`, accent `#7d5260`).
- It patches an mdui text-field race (resize observers when a field is
  taken out and put back quickly) on import.
- To switch themes at runtime use an `ObservableCompoundServiceLocator` and
  replace the theme in its `locators`; everything built with a themed widget
  rebuilds ([7](07-services-and-hydration.md#7-services-and-hydration)).

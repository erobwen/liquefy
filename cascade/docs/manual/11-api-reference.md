# 11. API reference

Every export of the five packages, grouped by package. Signatures use
`[optional]` for optional arguments. "Shorthand" means a function
`name(...parameters)` that constructs the class with the flexible argument
list of [3.1](03-components.md#31-constructing-a-component) (key, properties
object, loose children in any order). **Internal** marks something exported
for other Cascade packages, theme authors or tests - not for application
code.

## 11.1 @liquefy/cascade.reactive

Exports: `getWorld(configuration)` (also the default export). Everything else
is a member of the world it returns. Applications normally use the
`"cascade.component"` world re-exported by cascade.component (11.2), not a
world of their own: observables of different worlds don't see each other.

`getWorld({ name, ...options })` returns the world with that name, creating
it with the options the first time. **A later call with the same name returns
the existing world and ignores its options.** Without a name, worlds are
shared by identical configuration.

Configuration options (defaults in parentheses):

| Option | Meaning |
|---|---|
| `name` | Identifies the world. |
| `timeLevels` (4) | Number of time levels for pipelines; `repeat({ time })` must be below it. |
| `sendEventsToObjects` (true) | Calls `onChange`/`onEstablish`/`onDispose` on observables that have them. |
| `useNonObservablesAsValues` (false), `valueComparisonDepthLimit` (5) | Compare non-observable values written to properties deeply instead of by identity (frozen plain data is always compared by content). |
| `requireRepeaterName`, `requireInvalidatorName` (false) | Throw when a repeater/invalidator gets no description. |
| `warnOnNestedRepeater` (true), `traceWarnings` | Warning about non-independent repeaters created while recording; printed only with `traceWarnings`. |
| `objectMetaProperty` (`"causality"`), `objectTimelinesProperty` (`"timelines"`) | Property names of an observable's meta data (`component.causality`). |
| `onEventGlobal`, `onWriteGlobal`, `onReadGlobal`, `cannotReadPropertyValue`, `emitReBuildEvents` | Global hooks (advanced). |
| `customCreateRepeater`, `customCreateInvalidator`, `customDependencyInterfaceCreator`, `customObjectlog` | Replace internals (advanced). |

World members:

| Member | Signature | Description |
|---|---|---|
| `name` | string | The world's name. |
| `observable` | `observable([target], [buildId]) → proxy` | Wraps an object or array (default `{}`) in a tracked proxy; non-objects are returned as they are; throws for an observable. `buildId` gives it a rebuild identity inside a repeater (8.12). |
| `deeplyObservable` | `deeplyObservable(object, [copy])` | Makes a tree of plain objects and arrays observable, in place or as a copy. |
| `isObservable` | `isObservable(value) → boolean` | Whether `value` is an observable of this world. |
| `repeat` | `repeat([description], action, [nonRecordedAction], [options]) → repeater` | Runs `action(repeater)` now and whenever what it read changes; `nonRecordedAction` runs after it without recording. Options: `independent` (own pipeline, not a child of the running repeater), `time` (time level), `pulledBy` (a repeater, or function returning one, that pulls this one instead of it being scheduled), `onRetract(repeater)`, `onRefresh(repeater)`, `rebuildShapeAnalysis`, `onStartBuildUpdate`, `onEndBuildUpdate` (the last three are used by component builds). |
| `invalidateOnChange` | `invalidateOnChange([description], doFirst, doAfterChange) → invalidator` | Runs `doFirst` recording reads; calls `doAfterChange` once, on the first change. |
| `linkRepeater` | `linkRepeater(repeater) → repeater` | Reattaches an existing repeater as a child at the current position. |
| `refreshIfNeeded` | `refreshIfNeeded(repeater) → repeater` | Runs a pending repeater now (a pull). |
| `retractRepeater` | `retractRepeater(repeater)` | Retracts a repeater and its subtree, two-phase; idempotent. |
| `establish` | `establish(object) → object` | Marks an observable established and calls its `onEstablish()` (once). |
| `dispose` | `dispose(object)` | Emits the dispose event and calls its `onDispose()`. |
| `finalize` | `finalize(object) → object` | Merges a rebuilt object's twin back, or establishes a new one. Internal to rebuilding. |
| `declareState` | `declareState(object, defaults) → object` | Declares state properties with baseline defaults (written only outside repeaters or at initial time). |
| `withoutRecording` | `withoutRecording(fn) → result` | Runs `fn` without recording dependencies. |
| `withoutReactions` | `withoutReactions(fn)` | Runs `fn` without notifying anyone of its writes. |
| `accessInitialValues` | `accessInitialValues(fn) → result` | Runs `fn` as if outside any repeater: writes at the baseline, reads latest. |
| `flush` | `flush(fn) → result` | Lets invalidations caused in `fn` be processed in the current wave, in order, rather than in a later one (see [8.7](08-reactivity.md#87-flush)). |
| `transaction` | `transaction(fn) → result` | Batches invalidations around `fn` (processed even if `fn` throws). |
| `postponeInvalidations` / `continueInvalidations` | `()` | Start / end (and process) a batch by hand. |
| `sameAsPreviousDeep` | `sameAsPreviousDeep(a, b, [depthLimit = 8])` | Deep comparison of plain (non-observable) values. |
| `caching` | `caching(fn) → cachedFn` | See below. |
| `log`, `logGroup`, `logUngroup`, `logToString`, `loge`, `logs`, `logss` | | Debug logging without recording. |
| `state`, `enterContext`, `leaveContext`, `invalidateObserver`, `getOrCreateTimelineWriting`, `getOrCreateEnumerationTimelineWriting`, `invalidateDownstreamEnumerationObservers`, `seekTimelineWriting`, `assignArray`, `enumerationTimelineKey`, `proceedWithPostponedInvalidations` | | **Internal**: the world's state and hooks for extensions. |

**`caching(fn)`** returns `fn` with its results cached per argument list for
as long as what they were computed from stays unchanged. Each value is
computed inside an `invalidateOnChange()`: the first change of anything it
read just clears the entry - nothing is recomputed until someone asks again,
and a cleared entry leaves no observer behind. Whoever reads a cached value
depends on its entry and is invalidated when it is cleared. Arguments are
told apart by identity for observables, by value for numbers and strings, and
element by element otherwise. Use it for many values read now and then, by
few (memory over speed). For a value read all the time, by many, whose inputs
change without changing it, use a repeater that keeps it up to date instead
(as `inherit()` does): a repeater that recomputes the same value disturbs no
reader, while a cleared cache entry invalidates every reader. Not re-exported
by cascade.component: use `world.caching`.

```js
import { world, observable } from "@liquefy/cascade.component";
const prices = observable({ factor: 2 });
const priceOf = world.caching((product) => product.base * prices.factor);
// in a build: priceOf(product) - computed once per product until prices.factor changes
```

Repeater object: `restart()` (invalidate and run again; brings back a
retracted root repeater), `retracted`, `disposed` (booleans), `options`.

## 11.2 @liquefy/cascade.component

Reactive functions, from the world `getWorld({ name: "cascade.component" })`:

| Export | Description |
|---|---|
| `world` | The world itself (for `world.caching`, `world.transaction`, `world.withoutReactions`, ...). |
| `observable`, `deeplyObservable`, `isObservable`, `repeat`, `linkRepeater`, `withoutRecording`, `sameAsPreviousDeep`, `invalidateOnChange`, `postponeInvalidations`, `continueInvalidations`, `flush`, `accessInitialValues`, `declareState`, `retractRepeater`, `refreshIfNeeded` | As in 11.1. |
| `finalize`, `state` | **Internal**, as in 11.1. (`establish`/`dispose` are not exported: use `Component.establish()`/`dispose()`.) |

Components and helpers:

| Export | Signature | Description |
|---|---|---|
| `Component` | `new Component(...parameters)` | Base class (below). |
| `ContextScope` / `contextScope` | `contextScope({ context, children })` | Build-only: its children enter the tree with `context` instead of the one where it stands (6.3). |
| `view` | `view(name, build, [methods]) → (...parameters) => Component` | A component class from a build function (5.2). |
| `callback` | `callback(key, fn) → function` | A stable named callback for the running build (5.1). |
| `frozen` | `frozen(value) → value` | Deep-freezes plain data in place: then compared by content (5.3). |
| `isPlainData` | `isPlainData(value) → boolean` | Plain object or array, not observable. |
| `RenderContext` | `new RenderContext([provided], [parent])` | A context link; the root context of an app provides `serviceLocator`. Methods `inherit(name)`, `serviceLocators()` (generator, nearest first). `RenderContext.empty` provides nothing. |
| `CompoundServiceLocator` | `new CompoundServiceLocator(...locators)` | Asks each locator in order; `locate(query)`, `hydrate(query)`. Not tracked. |
| `ObservableCompoundServiceLocator` | `new ObservableCompoundServiceLocator(...locators)` | Same, with observable `locators`: replacing one rebuilds what used it (runtime theme switch). |
| `ServiceProvider` / `serviceProvider` | `serviceProvider({ serviceLocator, child })` | Renders `child` with an extra locator in front; same target. |
| `locateService` | `locateService(query, [fallbackLocator])` | Looks up a query through the running build's context, then the fallback; throws if nothing provides it. |
| `hydrateService` | `hydrateService(query, [fallbackLocator])` | Hydrates a query tree through the running build's locators, with positional keys (`h`, `h.0`, ...; `h1`, `h2` for later documents in the same build). |
| `hydrateQuery` | `hydrateQuery(query, locator, [positionalKey = "h"])` | Hydrates through a given locator. |
| `isServiceQuery` | `isServiceQuery(value) → boolean` | A plain, non-observable object with a string `type`. |
| `toProperties` | `toProperties(arglist) → properties` | Parses a flexible argument list (loose content left in `componentContent`). For `setProperties()`-style helpers. |
| `toPropertiesWithChildren` | `toPropertiesWithChildren(arglist) → properties` | Parses it, with loose arguments as `children`. |
| `extractProperty` | `extractProperty(object, name)` | Removes and returns a property. |
| `findImplicitChildren` | `findImplicitChildren(properties)` | Moves loose content into `children`. |
| `componentPath` | `componentPath(component) → string` | `"App › Page › Card(key)"`, following creators. Debugging. |
| `aggregateToString` | `aggregateToString(component) → string` | The debug id cascade.dom puts on elements. Debugging. |
| `getCreator` | `getCreator() → Component \| null` | The component whose build is running. Advanced. |

`Component` methods to override:

| Method | Description |
|---|---|
| `setProperties(properties)` | Interpret properties (default: assign all). |
| `initialState() → object` | Declare state and defaults (runs after `setProperties()`). |
| `initialUnobservables() → object` | Seed `this.unobservable` (at initial time; the place to create owned components). |
| `provide() → object \| null` | What the subtree inherits (default `null`: no context of its own). Called once. |
| `build() → Component \| Component[] \| null` | What this component is made of. |
| `render(target, context)` | Real-time work on the target (default: build and render the result). |
| `enteredContext(given) → context` | Enter the tree with another context (as `ContextScope` does). |
| `isExpandable() → boolean` | Whether placing containers may expand it (default: composed purely by `build()`). |
| `onEstablish()`, `onDispose()` | Established / dropped for good (call super). |
| `onShow()`, `onHide()` | Shown / no longer shown (rendered or placed). |
| `onRetract()`, `onReattach(target)` | Render retracted / relinked after retraction (call super). |

`Component` methods to call:

| Method | Description |
|---|---|
| `establish() → this` | Establish a component you own. |
| `dispose()` | Dispose of a component you own. |
| `renderOnto(target, [context = RenderContext.empty])` | Render (or relink) onto a target - the root, or a child from your own `render()`. |
| `setState(values)` | Write declared state at the baseline (from anywhere; throws for undeclared keys). |
| `inherit(name)` | Nearest value provided above (throws before the component is in the tree). |
| `fromTarget(name)` | A timeless value of the target it is placed on (`"width"`, `"height"`, `"inView"`, `"seen"`). |
| `showIf(condition) → this \| null` | Conditional inclusion in a build result, keeping identity. |
| `expand(target, context, renderParent, [isLeaf], [visited])` | Build as far down as `isLeaf` says. For placing containers. |
| `buildOneStep()` | Build one step, pulling a pending build. Advanced. |
| `refreshCreatorBuild()` | Bring the creator's build up to date. Advanced. |
| `getComponentTypeName()`, `toString()` | Debug names (`"Card:42(key)"`). |

Fields: `key`, `creator`, `renderContext` (observable), `unobservable`,
`currentBuild`, `causality` (meta data), `componentTypeName` (optional
override for the debug name).

## 11.3 @liquefy/cascade.dom

Entry points: `@liquefy/cascade.dom`, and `@liquefy/cascade.dom/jsx-runtime`
/ `jsx-dev-runtime` (`jsx`, `jsxs`, `jsxDEV`, `Fragment`) for the compiler.

Rendering and services:

| Export | Signature | Description |
|---|---|---|
| `DOMElementTarget` | `DOMElementTarget.forElement(element)` | A render target for an element (9.2). Fields `element`, `lastChild`, `timeless`. Methods `appendElement(tag)`, `reattachElement(element)`, `observeBounds()`, `stopObservingBounds()`, `observeVisibility({ amount = 0.25, margin = "0px" })`, `resetVisibility()`, `stopObservingVisibility()`. |
| `DOMServiceLocator` | `new DOMServiceLocator()` | Provides `htmlElement`, `textNode` and `domComponent` queries. |
| `DOMDebugServiceLocator` | `new DOMDebugServiceLocator()` | Provides a visible placeholder for any query, warning once per name. Put it last. |
| `defaultDOMServiceLocator` | `CompoundServiceLocator` | `DOMServiceLocator` then `DOMDebugServiceLocator`: the fallback of every factory function. |
| `hydrate` | `hydrate(tree)` | Hydrates a document (or JSX) through the running build's locators, the DOM default behind. |
| `serviceQueries` | `serviceQueries(type)` | A namespace of query functions, for JSX (`<widget.button>`). |
| `locateDOMComponent` | `locateDOMComponent(name, parameters)` | **Internal**: what the factory functions call (`{ type: "domComponent", name }`). |

Elements and text:

| Export | Signature | Description |
|---|---|---|
| tag functions | `div(...parameters)` etc. | `address article aside footer header h1 h2 h3 h4 h5 h6 group main nav section search blockquote dd div dl dt figcaption figure hr li menu ol p pre ul a abbr b bdi bdo br cite code data dfn em i kbd mark q rp rt ruby s samp small span strong sub sup time u htmlVar wbr area audio img map track video embed iframe object picture htmlPortal source svg math canvas noscript script del ins caption col colgroup table tbody td tfoot th thead tr button datalist fieldset form input label legend meter optgroup option output progress select textarea details dialog summary slot template` (9.1). |
| `element` | `element(tagName, ...parameters)` | Any element by tag name, custom elements included. |
| `text` | `text(value, [properties])`, `text({ key, text })` | A Text node, through the locator. |
| `DOMElementComponent` / `taggedElement` | `taggedElement(tagName, properties)` | **Internal**: a real element, constructed directly (bypassing locators). Use `element()`. |
| `DOMTextComponent` | class | **Internal**: a Text node component. Use `text()`. |
| `applyStyle` | `applyStyle(element, newStyle, previouslySetStyle) → nextPreviouslySet` | Diffs a style object onto an element (for your own DOM components). |
| `defaultToPx` | `defaultToPx(value, [property])` | A style value as CSS: bare numbers in px unless unitless or a custom property. |

Base classes for DOM components (9.2):

| Export | Description |
|---|---|
| `DOMNodeComponent` | A component owning one real node: implement `ensureNode()` (can be placed) or `renderNode(target, existingElement)` (rendered only). `providesNode()` tells which. |
| `SingleNodeComponent` | A `build()`-composed component that must build exactly one `DOMNodeComponent`. |
| `DOMPlacingContainer` | Base of containers that place their subtree themselves: properties `children`, `style`, `isUnit`. Static `islandAttribute` (`"data-island"`). |

Measurement, layout, animation (9.3, 9.4):

| Export | Signature | Description |
|---|---|---|
| `DOMElementBoundsProvider` / `elementBoundsProvider` | `elementBoundsProvider({ child, style, className })` | Measured, size-contained div; child reads `fromTarget("width"/"height")`. |
| `DOMElementVisibilityProvider` / `elementVisibilityProvider` | `elementVisibilityProvider({ child, style, className, amount, margin })` | Watched div; child reads `fromTarget("inView"/"seen")`. |
| `FlipAnimationContainer` / `flipAnimationContainer` | `flipAnimationContainer({ enabled, speed, confine, zoomAlong, keepCorners, isUnit, style }, ...children)` | Places and animates its subtree. Statics: `speed` (1), `clock` (`now`, `requestFrame`), `islandAttribute` (`"data-flip-island"`). |
| `OverflowContainer` / `overflowContainer` | `overflowContainer({ children, style, isUnit, ellipsis, overflowSlot, onOverflow })` | A row that moves what doesn't fit into a slot; `onOverflow(count)`. |
| `DOMElementSlot` / `elementSlot` | `elementSlot({ style })` | An element for an overflow container to fill. |
| `textWidth` | `textWidth(text, { fontSize = 13, fontWeight = 400, fontFamily })` | Text width in px, measured on a canvas. |
| `fitTextWithinWidth` | `fitTextWithinWidth(text, targetWidth, { fontWeight, fontFamily })` | Font size at which one line is `targetWidth` wide. |

Portals, context, routing, head (9.5):

| Export | Signature | Description |
|---|---|---|
| `Portal` / `portal` | `portal({ style }, ...defaultChildren)` | A div whose content comes from a source; shows its default children otherwise. Methods `show()`/`hide()` are used by sources. |
| `PortalSource` / `portalSource` | `portalSource({ portal, inheritFrom = "source" }, ...children)` | Shows its children in `portal` (a Portal or a name to inherit) while shown. |
| `DOMProvidingElement` / `providingElement` | `providingElement({ child, context, style })` | A div that provides `context`'s fields to its child. |
| `BrowserLocation` / `browserLocation` | `browserLocation({ base = "/", window })` | URL as observable `path`; `navigate(path, { replace })`, `href(path)`, `back(fallback)`, `dispose()`. |
| `DocumentHead` / `documentHead` | `documentHead(describe, { document })` | Reactive document head from `{ title, description, canonical, image, type, meta, structuredData }`; `dispose()`. |

JSX runtime: `jsx(type, props, key)`, `jsxs`, `jsxDEV` (the same function),
`Fragment`.

## 11.4 @liquefy/cascade.ui

Overlays and modals (9.8):

| Export | Signature | Description |
|---|---|---|
| `OverlayFrame` / `overlayFrame` | `overlayFrame({ style, overlayContent }, ...children)` | Where overlays are shown; provides `overlayFrame`. Methods `showOverlay(provider, content, context)`, `hideOverlay(provider)` (used by `Overlay`). |
| `Overlay` / `overlay` | `overlay({ showing }, content)` | Shows its one child on the nearest frame while `showing`. |
| `ModalBackdrop` / `modalBackdrop` | `modalBackdrop({ close, style })` | Dimmed layer; click calls `close`. |
| `Modal` / `modal` | `modal({ fullScreen, width, height, style }, ...content)` | Centered window or full frame; provides `modalPresentation` (`"window"` / `"fullScreen"`). |
| `ModalAssembly` / `modalAssembly` | `modalAssembly({ close, fullScreen, fullScreenBelow, width, height, backdrop = true, style }, ...content)` | Backdrop plus modal; full screen below a frame width. |
| `modalBackdropColor` | constant | `"rgba(0, 0, 0, 0.4)"`. |
| `popover` | `popover({ anchor, showing, close, style }, ...content)` | Content beside an element or viewport rectangle, via `overlay()`. |
| `Dropdown` / `dropdown` | `dropdown({ options, value, onSelect, disabled, title, placeholder, style })` | One choice out of several (`options: [{ value, label, style }]`). |

Drawers (9.8):

| Export | Signature | Description |
|---|---|---|
| `Drawer` / `drawer` | `drawer({ modal, animate, speed, ...panel }, ...content)` | `drawers()` with one panel. |
| `Drawers` / `drawers` | `drawers({ modal = false, animate = true, speed }, ...panels)` | Panels sliding in from the edges, one per edge, on a FlipAnimationContainer. |
| `DrawerPanel` / `drawerPanel` | `drawerPanel({ open, close, onOpen, side = "left", size = 300, header = true, title, collapsed = "nothing", bar, style }, ...content)` | One panel of `drawers()`; never rendered itself. `collapsed`: `"nothing"`, `"handle"`, `"bar"`. |
| `drawerBarSize` | constant | `48` - the room a collapsed bar takes. |

Widgets (9.7):

| Export | Signature | Description |
|---|---|---|
| `widget` | `widget(name, properties)` | Asks the locators for `{ type: "widget", name, properties }`. |
| `button`, `iconButton`, `listItem` | `button(...parameters)` | Themed widgets; one loose function is `onClick`. `button` with no children shows its key as label. |
| `icon`, `textField`, `checkbox`, `colorField`, `tabBar` | `icon(...parameters)` | Themed widgets without children. |
| `card`, `controlPanel`, `alert`, `dialog` | `card(...parameters)` | Themed widgets with children. |
| `toButtonProperties` | `toButtonProperties(parameters) → properties` | Parses arguments; a loose function becomes `onClick`. For theme authors. |
| `keyAsLabel` | `keyAsLabel(key) → string` | `"openDialog"` → `"Open dialog"`. |
| `alertSeverities` | object | Icon and colors per severity, shared by the themes. For theme authors. |

Layout (9.7):

| Export | Description |
|---|---|
| `wrapper`, `row`, `column`, `center`, `middle`, `centerMiddle`, `filler` | Divs with a default style merged under yours. |
| `zStack` | Children stacked edge to edge (class `cascade-z-stack`, a stylesheet rule). |
| `flexContainerStyle`, `rowStyle`, `columnStyle`, `centerStyle`, `middleStyle`, `centerMiddleStyle` | Flex container styles. |
| `naturalSizeStyle`, `fitContainerStyle`, `fillerStyle`, `autoFillerStyle`, `overflowVisibleStyle`, `zStackElementStyle`, `layoutBorderStyle` | Element styles (`layoutBorderStyle` is for development). |

Themes and colors (9.9):

| Export | Signature | Description |
|---|---|---|
| `BasicThemeServiceLocator` / `basicTheme` | `new BasicThemeServiceLocator()`; `basicTheme` instance | The basic theme: answers `widget` queries and `{ type: "colorScheme" }`. Field `colorScheme`. |
| `basicShadow` | constant | The basic theme's shadow. |
| `ColorScheme` | `new ColorScheme({ base, accent, extraVariables })` | Observable `base`/`accent`; `reset()`, `isChanged()`, `variables()`. |
| `ColorSchemeScope` / `colorSchemeScope` | `colorSchemeScope({ style }, ...children)` | A div setting the context theme's color variables and text color. |
| `currentColorScheme` | `currentColorScheme() → ColorScheme \| null` | The scheme of the theme in the running build's context. |
| `themeColor` | object | Each color as `var(--cascade-..., fallback)`. |
| `deriveColors` | `deriveColors(base, accent) → colors` | Every color from a base and an accent. |
| `colorVariables` | `colorVariables(colors) → { "--cascade-...": color }` | Colors as CSS variables. |
| `defaultColors` | constant | `{ base: "#34495e", accent: "#2e86c1" }`. |
| `hexToRgb`, `rgbToHex`, `rgbToHsb`, `hsbToRgb` | color conversions | HSB with hue in degrees, saturation and brightness 0 to 1. |

## 11.5 @liquefy/cascade.ui.material

Importing the package registers the mdui components it uses and mdui's CSS
(browser only) - 9.10.

| Export | Signature | Description |
|---|---|---|
| `MaterialThemeServiceLocator` / `materialTheme` | `new MaterialThemeServiceLocator()`; `materialTheme` instance | The Material theme: the same widgets on mdui 2, and its `colorScheme`. |
| `mduiColorVariables` | `mduiColorVariables(hex) → { "--mdui-color-...": "r, g, b" }` | mdui's light color scheme from one color (cached). |
| `materialDefaultColors` | constant | `{ base: "#6750a4", accent: "#7d5260" }`. |

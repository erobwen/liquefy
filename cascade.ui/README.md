# cascade.ui

Themed widgets, layout, overlays, modals, popovers and color schemes for
[Cascade](https://github.com/erobwen/liquefy#readme) - and its basic theme.

```console
npm install @liquefy/cascade.ui @liquefy/cascade.dom @liquefy/cascade.component @liquefy/cascade.reactive
```

## Themed widgets

Nothing in an app names a theme when it builds a widget: `button(...)` asks
the render context's service locator for one, and whichever theme is in it
provides it. Switching the theme replaces whole components, not just their
style - with all app state kept where it was. A part of an app can have a
theme of its own (`serviceProvider()`).

`button`, `icon`, `iconButton`, `card`, `controlPanel`, `alert`, `listItem`,
`dialog`, `textField`, `checkbox`, `colorField`, `tabBar` - each with a
property contract every theme implements (see `src/widgets.js`).

Two themes to choose from: `basicTheme`, from this package - plain HTML, in
tones of one base color, softly rounded - and `materialTheme`, from
[@liquefy/cascade.ui.material](https://github.com/erobwen/liquefy/tree/main/cascade.ui.material#readme).

```js
import { CompoundServiceLocator } from "@liquefy/cascade.component";
import { DOMServiceLocator } from "@liquefy/cascade.dom";
import { basicTheme } from "@liquefy/cascade.ui";

const services = new CompoundServiceLocator(new DOMServiceLocator(), basicTheme);
```

To switch themes while the app runs, use an `ObservableCompoundServiceLocator`
and replace the theme in it: everything built with a themed widget rebuilds
with the new one.

The icons are Google's icon fonts - link them in your page:

```html
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined" rel="stylesheet">
<link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
```

(Material Symbols for the basic theme, Material Icons for the Material theme.)

## Color schemes

A theme is its colors too: a base and an accent, and every other color made
from them - tones of their hue, at preset brightness levels. They're CSS
variables (`themeColor.page` is `var(--cascade-page, ...)`): put a theme's
variables on an element with `colorSchemeScope()`, and everything in it takes
its colors - change the base color, and only that element's variables are
rewritten.

```js
import { text } from "@liquefy/cascade.dom";
import { button, currentColorScheme } from "@liquefy/cascade.ui";

// In a build(): the scheme of the theme in the render context - and a
// button giving it another base color. Everything inside a
// colorSchemeScope() of that theme follows (put one around your app).
const scheme = currentColorScheme();
return button(text("Go green"), () => { scheme.base = "#2e7d32"; });
```

## Layout and the rest

- `row`, `column`, `filler`, `centerMiddle`, `zStack`, ... and their styles
  (`fillerStyle`, `fitContainerStyle`, ...).
- `overlayFrame()` and `overlay()` - content over the app, shown from
  wherever it's built: any content, custom or animated. One overlay per
  frame: an overlay shown on a frame already showing another evicts it (the
  other isn't shown again until it's shown anew). Overlays stack across
  frames - one opened from inside another's content - not side by side on
  one. By design, for now: this may change should a use case turn up that
  needs several on one frame.
- `modalAssembly()` - what an `overlay()` usually shows: a backdrop (a click
  on it closes) and the content in a centered window - full screen, without
  the backdrop, in a frame narrower than `fullScreenBelow`, and a themed
  `dialog()` in it follows, back arrow and all. Its parts on their own:
  `modalBackdrop()` and `modal()`.

  ```js
  overlay({ showing: this.open },
    modalAssembly({ close, width: 360, fullScreenBelow: 600 },
      dialog({ title: "Settings", close }, ...)))
  ```
- `drawer()` - a panel sliding in from an edge (`side`: left, right, top or
  bottom) of its nearest positioned ancestor, over what's there. `modal`
  adds a backdrop that fades in and closes it when clicked; `header` (the
  default) a title and a chevron that closes it - or, `header: false`, the
  content is the whole panel and calls `close` itself. `collapsed` is
  what's left of it while it's closed: `"nothing"` (the default), a
  `"handle"` on its edge that opens it (`onOpen`), or a `"bar"` - the panel
  collapsed to a thin strip along the edge, with a chevron that opens it
  and, after that, `bar`: shortcuts of the app's own. Opening it, the bar
  grows into the panel: a component the app puts in `bar` while closed and
  in the content while open (the same one, keyed) flies to its new place,
  and the rest fades. Leave `drawerBarSize` of room for it. The panel is always
  there - just past the edge, and inert, when closed - and a
  FlipAnimationContainer animates it moving between the two. Moved to
  another edge, it closes on one and opens on the other.

  ```js
  drawer({ open: this.open, close, side: "right", modal: true, title: "Filters" }, ...)

  drawer({ open: this.open, close, onOpen, title: "Filters", collapsed: "bar",
    bar: [iconButton({ icon: "movie", title: "Films", onClick: chooseFilms })] }, ...)
  ```

  Several at once, one per edge, each opened and closed on its own - with
  `drawers()` and a `drawerPanel()` each (one shared backdrop when modal,
  closing every open one):

  ```js
  drawers({ modal: false },
    drawerPanel({ side: "left", open: this.navigationOpen, close: closeNavigation, title: "Pages" }, ...),
    drawerPanel({ side: "right", open: this.inspectorOpen, close: closeInspector, title: "Properties" }, ...))
  ```
- `popover()` - beside an element, following it when it moves.
- `dropdown({ options, value, onSelect })` - one choice out of several: a button
  showing it, opening a list of them all in a popover. Made of the theme's own
  button, card and list items; an option's `style` previews it in the list.

# cascade.ui

Themed widgets, layout, overlays, portals, popovers and color schemes for
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
return button({ key: "green" }, text({ key: "greenText", text: "Go green" }), () => { scheme.base = "#2e7d32"; });
```

## Layout and the rest

- `row`, `column`, `filler`, `centerMiddle`, `zStack`, ... and their styles
  (`fillerStyle`, `fitContainerStyle`, ...).
- `overlayFrame()` and `overlay()` - modal content over the app.
- `popover()` - beside an element, following it when it moves.
- `portal()` and `portalContents()` - content placed somewhere else in the tree.

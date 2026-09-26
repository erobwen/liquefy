# cascade.ui.material

A Material Design theme for [Cascade](https://github.com/erobwen/liquefy#readme)'s
themed widgets (see [@liquefy/cascade.ui](https://github.com/erobwen/liquefy/tree/main/cascade.ui#readme)),
built on [mdui 2](https://www.mdui.org/) web components.

```console
npm install @liquefy/cascade.ui.material @liquefy/cascade.ui @liquefy/cascade.dom @liquefy/cascade.component @liquefy/cascade.reactive
```

```js
import { CompoundServiceLocator } from "@liquefy/cascade.component";
import { DOMServiceLocator } from "@liquefy/cascade.dom";
import { materialTheme } from "@liquefy/cascade.ui.material";

const services = new CompoundServiceLocator(new DOMServiceLocator(), materialTheme);
```

Importing the package registers the mdui components it uses, and imports
mdui's stylesheet - so it needs a bundler that handles CSS imports (Vite and
webpack both do). Link the Material Icons font in your page:

```html
<link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
```

Its colors are made from one you pick: Material's tonal palettes, computed
from the theme's base color (mdui's own variables, `--mdui-color-*`), so
changing it recolors every mdui component - see cascade.ui's color schemes.
The default is Material's baseline purple.

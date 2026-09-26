# flow.dom

[Flow](https://github.com/erobwen/liquefy/tree/main/flow.core#readme) for the
browser: `DOMRenderTarget`, every HTML element as a function (`div()`,
`span()`, ...), minimal-update DOM rendering, and transition animations.

```console
npm install @liquefy/flow.dom @liquefy/flow.core @liquefy/causality
```

```js
import { DOMRenderTarget } from "@liquefy/flow.dom";

new DOMRenderTarget(document.getElementById("app")).setContent(new MyApp());
```

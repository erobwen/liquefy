# cascade.prerender

Every page of a built Cascade app, prerendered: each address opened in a
real browser (headless Chromium, through Playwright), left to settle, and
written down as a page of its own. A search engine, a link preview or an AI
fetching `/shop/product/12` then gets the product page itself, not an empty
shell waiting for JavaScript. When the app's code loads, it takes over in
one frame.

Why a real browser: Cascade lays out from real measurements (an element's
size, the width of text). Without a layout engine there is nothing accurate
to write down.

```console
npm install @liquefy/cascade.prerender
npx playwright install chromium
```

## In the app: the root target

The app renders onto a `PrerenderedElementTarget` instead of a plain
`DOMElementTarget`. It is the same target, except that its static
`forElement()` first removes the snapshot a prerendered page came with:

```js
import { PrerenderedElementTarget } from "@liquefy/cascade.prerender/client";

const target = PrerenderedElementTarget.forElement(document.getElementById("application"));
app.renderOnto(target, context);
```

Use it only for the root: everything rendered inside it gets plain
`DOMElementTarget`s, as always. A page that wasn't prerendered (while
developing, say) is left as it is. `@liquefy/cascade.prerender/client` is
all that goes into the app's bundle. The rest of the package (Node,
Playwright) runs at build time only.

## With Vite

Once `vite build` has built the app, its pages are prerendered into the same
folder:

```js
// vite.config.js
import { defineConfig } from "vite";
import { cascadePrerender } from "@liquefy/cascade.prerender";

export default defineConfig({
  plugins: [
    cascadePrerender({
      site: "https://shop.example",
      // The pages to start from. Every page they link to is found too.
      routes: async () => ["", ...(await fetchProductIds()).map((id) => `product/${id}`)],
      exclude: [/^checkout/, /^account/],
    }),
  ],
});
```

`CASCADE_PRERENDER=false vite build` builds without prerendering.

## From the command line

Any built app, with any build tool:

```console
npx cascade-prerender dist --base /shop/ --site https://shop.example --routes routes.txt
```

## In the app: the head

What a search engine shows, and what a shared link previews, comes from the
head. `documentHead()` (in cascade.dom) builds the head from the app's data
and follows it as the user navigates. A prerendered page is written with
that head too:

```js
import { browserLocation, documentHead } from "@liquefy/cascade.dom";

const location = browserLocation({ base: import.meta.env.BASE_URL });

documentHead(() => {
  const product = catalogue.productAt(location.path);
  if (!product) return { title: "Shop" };
  return {
    title: `${product.name} - Shop`,
    description: product.summary,
    canonical: location.href(location.path),
    image: product.photo,
    type: "product",
    // schema.org data - prices and availability shown right in search results.
    structuredData: {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      image: product.photo,
      offers: { "@type": "Offer", price: product.price, priceCurrency: "EUR", availability: "https://schema.org/InStock" },
    },
  };
});
```

## What a prerendered page is

The app's own `index.html`, with:

- the snapshot: what the app rendered into its root element, which is
  marked `data-prerendered`
- the title and the `documentHead()` tags
- the style sheets the app added as it rendered, so the snapshot looks
  right without JavaScript

Its scripts are unchanged. When the app starts, `PrerenderedElementTarget`
removes the snapshot and its style sheets, and the app renders in the same
frame.

Any address in a page that points at the local copy rendered from is changed
to point at `site` (canonical links, `og:url`), and a `sitemap.xml` is
written. Debug ids (the `id` cascade gives every element it creates) are
left out.

While prerendering, `globalThis.cascadePrerendering` is set. Use it to leave
out anything that doesn't belong in a snapshot: analytics, a cookie banner,
a notice meant for one visitor.

## Options

| Option | |
|---|---|
| `dist` | The built app's folder (the plugin uses Vite's `outDir`) |
| `base` | Where the app is served from (the plugin uses Vite's `base`) |
| `routes` | Addresses to render, below the base: a list, or a function (async if it needs to be). Default `[""]` |
| `crawl` | Also render every address within the app that a page links to (default `true`) |
| `exclude` | Addresses not to render: a RegExp, a function of the route, or a list of either |
| `root` | The id of the element the app renders into (default `"application"`) |
| `site` | Where the app will be served, e.g. `"https://shop.example"`. Used to make addresses absolute and to write `sitemap.xml` |
| `files` | `"html"` writes `product/12.html`, served at `/product/12` by GitHub Pages, Netlify, Cloudflare Pages and others (default). `"directory"` writes `product/12/index.html` |
| `viewport` | The browser's size (default `{ width: 1280, height: 800 }`) |
| `quiet`, `timeout` | A page counts as settled after `quiet` ms with no changes (default 300). After `timeout` ms (default 15000) it is captured as it is, with a warning |
| `concurrency` | How many pages render at once (default 4) |
| `keepDebugIds` | Keep cascade's debug ids (default `false`) |
| `transform(html, route)` | A last change to each page before it is written |
| `launch` | Options for Playwright's `chromium.launch()` |

## Limits

- Pages are rendered at one viewport size. On a phone, the snapshot shows the
  desktop layout until the app takes over, which happens as soon as its code
  loads.
- Shadow DOM (web components such as mdui's) is not part of the snapshot:
  their light DOM children are, but not what they draw themselves.
- The server must serve the app's `index.html` for addresses that have no
  page of their own, as single-page app hosting already does.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { serve } from "./server.js";
import { settle, capture } from "./capture.js";
import { fillTemplate, escapeText } from "./template.js";

/**
 * Prerender a built app: every address of it opened in a real browser
 * (headless Chromium, through Playwright), left to settle, and what it
 * shows written down as a page of its own - so a search engine, a link
 * preview or an AI reading the address gets the page itself, not an empty
 * shell waiting for JavaScript. The app then takes over as it starts (see
 * PrerenderedElementTarget.js).
 *
 * A real browser, because Cascade lays out from real measurements (an
 * element's size, text's width): without a layout engine, there's nothing
 * true to write down.
 *
 * Options:
 *  - dist: the built app's folder (Vite's outDir). Its index.html is the
 *    template every page is made from.
 *  - base: where the app is served from ("/", "/shop/" - Vite's base).
 *  - routes: the addresses to render, below the base ("", "product/12") -
 *    or a function giving them, async if it needs to be (the products in
 *    a shop's catalogue, say). Default: just the app's root.
 *  - crawl: also render every address the pages link to, below the base
 *    (default true) - one page linking the next, the whole app is found.
 *  - exclude: addresses not to render: a function of the route, a RegExp,
 *    or a list of either.
 *  - root: the id of the element the app renders into (default
 *    "application").
 *  - site: where the app will be: an origin, "https://shop.example". Any
 *    address in a page pointing at the browser's local copy is made to
 *    point there instead (canonical links, og:url), and a sitemap.xml is
 *    written. Without one, such addresses are made relative to the origin.
 *  - files: "html" (default) writes product/12.html - served at
 *    /product/12 by GitHub Pages, Netlify, Cloudflare Pages and most
 *    others - and "directory" product/12/index.html, served at
 *    /product/12/.
 *  - viewport: the browser's size, { width, height } (default 1280 x 800).
 *  - quiet, timeout: a page has settled once nothing in it has changed for
 *    `quiet` ms (default 300); after `timeout` ms (default 15000) it's
 *    taken as it is, with a warning.
 *  - concurrency: pages rendered at once (default 4).
 *  - keepDebugIds: keep the debug ids components give elements (default
 *    false - see capture.js).
 *  - transform(html, route): a last change to each page before it's
 *    written - returns the page.
 *  - launch: options for Playwright's chromium.launch().
 *  - log: where progress goes (default console.log; false for none).
 *
 * While prerendering, the page sees `globalThis.cascadePrerendering` set -
 * to leave out what has no place in a snapshot (analytics, a cookie
 * banner, a notice for this visitor only).
 *
 * Returns what was written: [{ route, file, settled }].
 */
export async function prerender(options) {
  const {
    dist: distOption,
    base: baseOption = "/",
    routes = [""],
    crawl = true,
    exclude = [],
    root = "application",
    site,
    files = "html",
    viewport = { width: 1280, height: 800 },
    quiet = 300,
    timeout = 15000,
    concurrency = 4,
    keepDebugIds = false,
    transform,
    launch = {},
  } = options;
  const log = options.log === false ? () => {} : (options.log || console.log);
  if (!distOption) throw new Error("cascade.prerender: no dist - the folder of the built app.");
  if (files !== "html" && files !== "directory") throw new Error(`cascade.prerender: files is "html" or "directory", not ${JSON.stringify(files)}.`);
  const dist = resolve(distOption);
  const base = ("/" + baseOption).replace(/\/+/g, "/").replace(/\/?$/, "/");
  const siteOrigin = site ? new URL(site).origin : null;

  const template = await readFile(join(dist, "index.html"), "utf8");
  const templateStyles = [...template.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)].map((match) => match[1]);
  const excluded = excluder(exclude);

  const chromium = await loadChromium();
  const server = await serve({ dist, base, template });
  const browser = await chromium.launch(launch);
  const pages = new Map();
  try {
    const queue = [];
    const seen = new Set();
    const add = (route) => {
      if (route === null || route === undefined) return;
      route = normalizeRoute(route);
      if (route === null || seen.has(route) || excluded(route)) return;
      seen.add(route);
      queue.push(route);
    };
    for (const route of await (typeof(routes) === "function" ? routes() : routes)) add(route);

    const renderOne = async (route) => {
      const context = await browser.newContext({ viewport });
      const errors = [];
      try {
        const page = await context.newPage();
        page.on("pageerror", (error) => errors.push(error.message));
        await page.addInitScript(() => { globalThis.cascadePrerendering = true; });
        const response = await page.goto(server.origin + base + route, { waitUntil: "load", timeout: timeout + 30000 });
        if (!response || !response.ok()) throw new Error(`${response ? response.status() : "no response"}`);
        const { settled } = await page.evaluate(settle, { quiet, timeout });
        const snapshot = await page.evaluate(capture, { root, keepDebugIds, templateStyles });
        return { snapshot, settled, errors };
      } finally {
        await context.close();
      }
    };

    // Workers taking routes off the queue - which crawling adds to as
    // pages are found.
    let active = 0;
    let failure = null;
    await new Promise((done) => {
      const next = () => {
        if (failure) return active === 0 && done();
        if (queue.length === 0) return active === 0 && done();
        while (queue.length > 0 && active < concurrency) {
          const route = queue.shift();
          active++;
          renderOne(route).then(({ snapshot, settled, errors }) => {
            pages.set(route, { snapshot, settled });
            log(`  prerendered /${route}${settled ? "" : "  (didn't settle - taken as it was)"}`);
            for (const error of errors) log(`    error in the page: ${error}`);
            if (crawl) for (const link of snapshot.links) add(routeOf(link, server.origin, base));
          }, (error) => {
            failure = failure || new Error(`cascade.prerender: /${route} couldn't be rendered: ${error.message}`);
          }).finally(() => {
            active--;
            next();
          });
        }
      };
      next();
    });
    if (failure) throw failure;
  } finally {
    await browser.close();
    await server.close();
  }

  // Written once everything is rendered: the template, and the files the
  // server served, stay the app as built until then.
  const written = [];
  const localOrigin = new RegExp(escapeRegExp(server.origin), "g");
  const toSite = (html) => html.replace(localOrigin, siteOrigin || "");
  for (const route of [...pages.keys()].sort()) {
    const { snapshot, settled } = pages.get(route);
    let page = fillTemplate(template, {
      root,
      html: toSite(snapshot.html),
      title: snapshot.title,
      head: snapshot.head.map(toSite),
      styles: snapshot.styles,
    });
    if (transform) page = await transform(page, route);
    const file = route === "" ? "index.html" : files === "html" ? route + ".html" : join(route, "index.html");
    await mkdir(dirname(join(dist, file)), { recursive: true });
    await writeFile(join(dist, file), page);
    written.push({ route, file, settled });
  }

  if (siteOrigin) {
    const address = (route) => siteOrigin + base + route + (files === "directory" && route !== "" ? "/" : "");
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${written.map(({ route }) => `  <url><loc>${escapeText(address(route))}</loc></url>`).join("\n")}
</urlset>
`;
    await writeFile(join(dist, "sitemap.xml"), sitemap);
  }
  log(`Prerendered ${written.length} page${written.length === 1 ? "" : "s"} into ${dist}${siteOrigin ? ", with a sitemap.xml" : ""}`);
  return written;
}

// A route as given - "/product/12/", "product/12" - as it's kept:
// "product/12". Not an address at all (an asset, with an extension): null.
export function normalizeRoute(route) {
  const segments = String(route).split(/[?#]/)[0].split("/").filter((segment) => segment.length > 0);
  if (segments.length > 0 && extname(segments[segments.length - 1]) !== "") return null;
  return segments.join("/");
}

// The route a link goes to - if it goes somewhere in the app.
export function routeOf(link, origin, base) {
  let url;
  try { url = new URL(link); } catch { return null; }
  if (url.origin !== origin) return null;
  const pathname = decodeURIComponent(url.pathname);
  if (!(pathname + "/").startsWith(base)) return null;
  return normalizeRoute(pathname.slice(base.length));
}

function excluder(exclude) {
  const tests = [].concat(exclude).map((each) => (each instanceof RegExp ? (route) => each.test(route) : each));
  return (route) => tests.some((test) => test(route));
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function loadChromium() {
  let playwright;
  try {
    playwright = await import("playwright");
  } catch {
    throw new Error("cascade.prerender renders in a real browser, through Playwright: npm install --save-dev playwright, then npx playwright install chromium.");
  }
  return playwright.chromium;
}

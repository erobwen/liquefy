import { observable } from "@liquefy/cascade.component";

/**
 * The browser's location as observable data - ported from flow.DOM's
 * pathObserver.js / DOMRenderTarget's `path` property: the path part of the
 * URL, split into segments (below the app's base), which anything can read
 * - and rebuild from, like any other observable - and change by
 * navigating.
 *
 *  - base: where the app is served from ("/", or "/liquefy/" - with Vite,
 *    import.meta.env.BASE_URL). The path is relative to it.
 *  - path: the segments - "/liquefy/animation/x" under base "/liquefy/" is
 *    ["animation", "x"]; the base itself is [].
 *  - navigate(path, { replace }): go to `path` (segments, or a string
 *    below the base) - a new history entry, or replacing the current one.
 *    Call it from event handlers, as any other change the user makes.
 *  - href(path): the URL for `path`, for a link's href.
 *
 * Back and forward (popstate) update `path` too. Unlike Flow's version, it
 * doesn't patch history.pushState/replaceState globally: navigating goes
 * through navigate(), so there's nothing else to catch.
 */
export function browserLocation(options = {}) {
  return new BrowserLocation(options);
}

export class BrowserLocation {
  constructor({ base = "/", window: view = globalThis.window } = {}) {
    this.base = base.endsWith("/") ? base : base + "/";
    this.window = view;
    this.state = observable({ path: this.read() });
    this.onPopState = () => this.update();
    this.window.addEventListener("popstate", this.onPopState);
  }

  get path() {
    return this.state.path;
  }

  read() {
    let pathname = this.window.location.pathname;
    if (pathname.startsWith(this.base)) pathname = pathname.slice(this.base.length);
    else if (pathname + "/" === this.base) pathname = "";
    return pathname.split("/").filter((segment) => segment.length > 0);
  }

  // Only a real change is written: the same path again (a popstate that
  // only changed the hash, say) rebuilds nothing.
  update() {
    const path = this.read();
    if (path.join("/") !== this.state.path.join("/")) this.state.path = path;
  }

  href(path) {
    const segments = typeof(path) === "string" ? path.split("/").filter((segment) => segment.length > 0) : path;
    return this.base + segments.join("/");
  }

  navigate(path, { replace = false } = {}) {
    const url = this.href(path);
    if (url !== this.window.location.pathname) {
      const history = this.window.history;
      if (replace) history.replaceState({}, "", url);
      else history.pushState({}, "", url);
    }
    this.update();
  }

  dispose() {
    this.window.removeEventListener("popstate", this.onPopState);
  }
}

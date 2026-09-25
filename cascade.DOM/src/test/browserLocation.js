import { JSDOM } from "jsdom";
import assert from "assert";
import { Component, RenderContext } from "@liquefy/cascade.component";
import { DOMElementTarget } from "../DOMElementTarget.js";
import { browserLocation } from "../BrowserLocation.js";
import { div } from "../HTMLTags.js";
import { text } from "../DOMTextComponent.js";

// browserLocation(): the URL's path as observable segments below the app's
// base - kept in sync with the address bar both ways.
describe("browserLocation", function () {
  let dom;
  let location;

  const at = (url) => {
    dom = new JSDOM("<!DOCTYPE html><body></body>", { url: "http://localhost" + url });
    global.document = dom.window.document;
  };

  afterEach(function () {
    if (location) location.dispose();
    location = null;
  });

  it("reads the path below its base - the base itself is the empty path", function () {
    at("/liquefy/animation/extra");
    location = browserLocation({ base: "/liquefy/", window: dom.window });
    assert.deepEqual(location.path, ["animation", "extra"]);
    location.dispose();

    at("/liquefy/");
    location = browserLocation({ base: "/liquefy/", window: dom.window });
    assert.deepEqual(location.path, []);
    location.dispose();

    at("/liquefy");
    location = browserLocation({ base: "/liquefy", window: dom.window });
    assert.deepEqual(location.path, [], "with or without the trailing slash");
  });

  it("navigate() changes the URL and the path; replace doesn't add a history entry", function () {
    at("/");
    location = browserLocation({ window: dom.window });
    const entries = dom.window.history.length;

    location.navigate(["themes"]);
    assert.equal(dom.window.location.pathname, "/themes");
    assert.deepEqual(location.path, ["themes"]);
    assert.equal(dom.window.history.length, entries + 1);

    location.navigate("animation", { replace: true });
    assert.equal(dom.window.location.pathname, "/animation");
    assert.deepEqual(location.path, ["animation"]);
    assert.equal(dom.window.history.length, entries + 1, "replaced, not added");

    assert.equal(location.href(["store"]), "/store");
  });

  it("back and forward (popstate) update the path - and whatever was built from it", function () {
    at("/");
    location = browserLocation({ window: dom.window });
    class Page extends Component {
      build() {
        return div({ key: "page" }, text({ key: "path", text: "/" + location.path.join("/") }));
      }
    }
    const container = document.createElement("div");
    new Page().renderOnto(new RenderContext(new DOMElementTarget(container)));
    assert.equal(container.textContent, "/");

    location.navigate(["store"]);
    assert.equal(container.textContent, "/store");

    // What the browser does on back: the URL changes, then popstate.
    dom.window.history.replaceState({}, "", "/");
    dom.window.dispatchEvent(new dom.window.PopStateEvent("popstate"));
    assert.deepEqual(location.path, []);
    assert.equal(container.textContent, "/");
  });
});

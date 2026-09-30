import { JSDOM } from "jsdom";
import assert from "assert";
import { RenderContext, CompoundServiceLocator, Component } from "@liquefy/cascade.component";
import { DOMElementTarget, DOMServiceLocator, div, text } from "@liquefy/cascade.dom";
import { overlayFrame, popover, basicTheme } from "../index.js";

// A popover follows its anchor element while it's shown - listening for
// resizes and scrolls - and stops while it isn't: its page switched away
// from, and back.
describe("popover", function () {
  let window, resizeListeners;

  beforeEach(function () {
    const dom = new JSDOM("<!DOCTYPE html><body></body>");
    window = dom.window;
    global.document = window.document;
    resizeListeners = 0;
    const add = window.addEventListener.bind(window);
    const remove = window.removeEventListener.bind(window);
    window.addEventListener = (type, listener, options) => { if (type === "resize") resizeListeners++; add(type, listener, options); };
    window.removeEventListener = (type, listener, options) => { if (type === "resize") resizeListeners--; remove(type, listener, options); };
  });

  it("follows its anchor again when shown again", function () {
    const anchor = document.createElement("button");
    document.body.appendChild(anchor);
    class Page extends Component {
      build() {
        return div(popover({ anchor, showing: true, close: () => {} }, text("content")));
      }
    }
    class App extends Component {
      initialState() {
        return { onPage: true };
      }
      initialUnobservables() {
        return { page: new Page().establish() };
      }
      onDispose() {
        this.unobservable.page.dispose();
        super.onDispose();
      }
      build() {
        return overlayFrame(this.onPage ? this.unobservable.page : div({ key: "other" }));
      }
    }
    const host = document.createElement("div");
    document.body.appendChild(host);
    const app = new App();
    app.renderOnto(new DOMElementTarget(host), new RenderContext({ serviceLocator: new CompoundServiceLocator(new DOMServiceLocator(), basicTheme) }));
    // The popover's own listener - and its overlay layer's, which measures.
    const shown = resizeListeners;
    assert.ok(shown >= 1);

    app.onPage = false;
    assert.equal(resizeListeners, 0, "not shown: not following");

    app.onPage = true;
    assert.equal(resizeListeners, shown, "shown again: following again");
    assert.ok(host.textContent.includes("content"));
  });
});

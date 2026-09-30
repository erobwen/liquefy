import { JSDOM } from "jsdom";
import assert from "assert";
import { RenderContext, CompoundServiceLocator, Component, callback } from "@liquefy/cascade.component";
import { DOMElementTarget, DOMServiceLocator, div, text } from "@liquefy/cascade.dom";
import { overlayFrame, overlay, modalAssembly, dialog, basicTheme } from "../index.js";

// modalAssembly(): a backdrop and a centered window - or, in a frame
// narrower than fullScreenBelow, the whole frame, without a backdrop - and
// a themed dialog inside follows by itself. jsdom has no layout: every
// element's computed size is the one the test says the frame has.
describe("modalAssembly", function () {
  let frameWidth;

  beforeEach(function () {
    const dom = new JSDOM("<!DOCTYPE html><body></body>");
    global.document = dom.window.document;
    frameWidth = 1000;
    const computed = dom.window.getComputedStyle.bind(dom.window);
    dom.window.getComputedStyle = (element) => {
      const style = computed(element);
      return new Proxy(style, {
        get: (target, name) => name === "width" ? frameWidth + "px" : name === "height" ? "700px" : name === "boxSizing" ? "content-box" : target[name],
      });
    };
  });

  function setup() {
    const closed = [];
    class Page extends Component {
      initialState() {
        return { open: true };
      }
      build() {
        const close = callback("close", () => { closed.push(true); this.open = false; });
        return overlayFrame(
          div(text("The page")),
          overlay(
            { showing: this.open },
            modalAssembly({ close, fullScreenBelow: 600, width: 360 }, dialog({ title: "Settings", close }, text("Inside"))),
          ),
        );
      }
    }
    const host = document.createElement("div");
    document.body.appendChild(host);
    const page = new Page().establish();
    page.renderOnto(new DOMElementTarget(host), new RenderContext({ serviceLocator: new CompoundServiceLocator(new DOMServiceLocator(), basicTheme) }));
    const backdrop = () => [...host.querySelectorAll("div")].find((each) => each.style.background === "rgba(0, 0, 0, 0.4)");
    const hasButton = (title) => !!host.querySelector("button[title='" + title + "']");
    return { host, page, closed, backdrop, hasButton };
  }

  it("in a wide frame: a backdrop, and a window of the given width with the dialog in it", function () {
    const { host, backdrop, hasButton } = setup();
    assert.ok(host.textContent.includes("Inside"));
    assert.ok(backdrop(), "a backdrop");
    assert.ok([...host.querySelectorAll("div")].some((each) => each.style.width === "360px"), "a window 360 wide");
    assert.ok(hasButton("Close") && !hasButton("Back"), "the dialog as a window: a close button");
  });

  it("a click on the backdrop closes it", function () {
    const { host, closed, backdrop } = setup();
    backdrop().click();
    assert.deepEqual(closed, [true]);
    assert.ok(!host.textContent.includes("Inside"), "gone");
  });

  it("in a narrow frame: full screen, no backdrop - and the dialog full screen by itself, with a back arrow", function () {
    frameWidth = 400;
    const { host, backdrop, hasButton } = setup();
    assert.ok(host.textContent.includes("Inside"));
    assert.ok(!backdrop(), "no backdrop");
    assert.ok(hasButton("Back") && !hasButton("Close"), "the dialog full screen: a back arrow");
  });

  it("follows the frame: narrowed while open, it goes full screen - the same dialog", function () {
    const { host, backdrop, hasButton } = setup();
    const before = [...host.querySelectorAll("div")].find((each) => each.textContent === "Inside");
    frameWidth = 400;
    document.defaultView.dispatchEvent(new document.defaultView.Event("resize"));
    assert.ok(!backdrop());
    assert.ok(hasButton("Back"));
    const after = [...host.querySelectorAll("div")].find((each) => each.textContent === "Inside");
    assert.equal(after, before, "the dialog's own element, kept");
  });
});

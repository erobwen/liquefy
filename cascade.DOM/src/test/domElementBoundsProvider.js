import { JSDOM } from "jsdom";
import assert from "assert";
import { RenderContext, Component } from "@liquefy/cascade.component";
import { DOMElementTarget } from "../DOMElementTarget.js";
import { DOMElementBoundsProvider } from "../DOMElementBoundsProvider.js";

// jsdom does no real layout, so getBoundingClientRect() always reports
// {width: 0, height: 0, ...} - fine for the first assertion below (only
// the plumbing is under test, not real measurement - see menuFrame.js's
// own test for the same caveat), and stubbed with a fake value afterwards
// to exercise the resize-driven re-measurement path.
describe("DOMElementBoundsProvider", function () {
  let container;
  let dom;

  beforeEach(function () {
    dom = new JSDOM("<!DOCTYPE html><body></body>");
    global.document = dom.window.document;
    global.window = dom.window;
    container = document.createElement("div");
  });

  // Reads `this.renderContext` from build() rather than render() - the
  // whole point of Component.renderOnto() now setting it unconditionally
  // (see Component.js), exercised end to end here rather than just at the
  // unit level.
  class Probe extends Component {
    build() {
      const bounds = this.renderContext;
      this.unobservable.buildCount = (this.unobservable.buildCount || 0) + 1;
      this.unobservable.lastWidth = bounds.width;
      this.unobservable.lastHeight = bounds.height;
      return null;
    }
  }

  it("passes measured bounds to the direct child via this.renderContext, readable from build()", function () {
    const context = new RenderContext(new DOMElementTarget(container));
    const probe = new Probe();
    const provider = new DOMElementBoundsProvider({ className: "bounds-provider", child: probe });

    provider.renderOnto(context);

    assert.equal(probe.unobservable.buildCount, 1);
    assert.equal(probe.unobservable.lastWidth, 0);
    assert.equal(probe.unobservable.lastHeight, 0);
    assert.equal(container.querySelector(".bounds-provider"), provider.unobservable.element);
  });

  it("re-measures on window resize and reruns the child that read the bounds", function () {
    const context = new RenderContext(new DOMElementTarget(container));
    const probe = new Probe();
    const provider = new DOMElementBoundsProvider({ child: probe });

    provider.renderOnto(context);
    assert.equal(probe.unobservable.buildCount, 1);

    provider.unobservable.element.getBoundingClientRect = () => ({ width: 640, height: 480 });
    dom.window.dispatchEvent(new dom.window.Event("resize"));

    // measure() writes width then height as two separate, unbatched writes
    // (see DOMElementBoundsProvider.js's own comment on why they can't be
    // batched here), so a child reading both - like Probe - reruns once per
    // field: a harmless extra rerun on a momentarily torn pair, not a
    // correctness issue, since both fields are consistent by the last one.
    assert.equal(probe.unobservable.buildCount, 3);
    assert.equal(probe.unobservable.lastWidth, 640);
    assert.equal(probe.unobservable.lastHeight, 480);
  });

  it("removes its resize listener once dropped from its own build()-owning parent", function () {
    let addCount = 0;
    let removeCount = 0;
    const originalAdd = dom.window.addEventListener.bind(dom.window);
    const originalRemove = dom.window.removeEventListener.bind(dom.window);
    dom.window.addEventListener = (type, listener) => {
      if (type === "resize") addCount++;
      originalAdd(type, listener);
    };
    dom.window.removeEventListener = (type, listener) => {
      if (type === "resize") removeCount++;
      originalRemove(type, listener);
    };

    class Frame extends Component {
      setProperties({ shown, child }) {
        this.shown = shown;
        this.child = child;
      }
      build() {
        return this.shown ? new DOMElementBoundsProvider({ key: "bounds", child: this.child }) : null;
      }
    }

    const context = new RenderContext(new DOMElementTarget(container));
    const frame = new Frame({ shown: true, child: new Probe() });
    frame.renderOnto(context);
    assert.equal(addCount, 1);
    assert.equal(removeCount, 0);

    frame.shown = false; // drops the keyed DOMElementBoundsProvider - disposed

    assert.equal(removeCount, 1);
  });

  // Fully styleable by its creator (see the class's own doc) - and correctly
  // so across a rebuild, not just on first construction: a property that's
  // present one rebuild and gone the next must actually clear on the real
  // element, not linger (a real bug in an earlier version of this file,
  // where a plain Object.assign(element.style, style) only ever added/
  // overwrote keys, never removed one that disappeared).
  it("re-applies style and className from its creator on every rebuild, clearing whatever is no longer given", function () {
    class Frame extends Component {
      setProperties({ style, className, child }) {
        this.style = style;
        this.className = className;
        this.child = child;
      }
      build() {
        return new DOMElementBoundsProvider({ key: "bounds", style: this.style, className: this.className, child: this.child });
      }
    }

    const context = new RenderContext(new DOMElementTarget(container));
    const frame = new Frame({
      style: { position: "relative", height: "100%" },
      className: "frame-a",
      child: new Probe(),
    });
    frame.renderOnto(context);

    const element = container.querySelector("div");
    assert.equal(element.style.position, "relative");
    assert.equal(element.style.height, "100%");
    assert.equal(element.className, "frame-a");

    // A rebuild that drops `position`, changes `height`, and adds `width` -
    // a creator restyling its child to fit a different layout, exactly the
    // scenario the whole "fully styleable" property is for.
    frame.style = { height: "50%", width: "10px" };
    frame.className = "frame-b";

    assert.equal(element.style.position, "", "a style property dropped from the new style object must be cleared, not left stale");
    assert.equal(element.style.height, "50%");
    assert.equal(element.style.width, "10px");
    assert.equal(element.className, "frame-b", "className must also update, not stick to its first value");
  });
});

import { JSDOM } from "jsdom";
import assert from "assert";
import { Component } from "@liquefy/cascade.component";
import { DOMElementTarget } from "../DOMElementTarget.js";
import { DOMElementBoundsProvider } from "../DOMElementBoundsProvider.js";
import { div } from "../HTMLTags.js";

// jsdom does no layout and has no ResizeObserver - so a stand-in one,
// reporting whatever size a test says an element has, as a browser's would
// after layout (see DOMElementTarget.observeBounds()).
class FakeResizeObserver {
  constructor(callback) {
    this.callback = callback;
    this.elements = new Set();
    FakeResizeObserver.all.add(this);
  }
  observe(element) {
    this.elements.add(element);
  }
  disconnect() {
    this.elements.clear();
    FakeResizeObserver.all.delete(this);
  }
  static report(element, width, height) {
    for (const observer of FakeResizeObserver.all) {
      if (observer.elements.has(element)) observer.callback([{ target: element, contentRect: { width, height } }]);
    }
  }
  static observing(element) {
    return [...FakeResizeObserver.all].some((observer) => observer.elements.has(element));
  }
}
FakeResizeObserver.all = new Set();

describe("DOMElementBoundsProvider", function () {
  let container;
  let dom;

  beforeEach(function () {
    dom = new JSDOM("<!DOCTYPE html><body></body>");
    global.document = dom.window.document;
    global.window = dom.window;
    dom.window.ResizeObserver = FakeResizeObserver;
    FakeResizeObserver.all.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  // Reads the size of the element it's placed in from build().
  class Probe extends Component {
    build() {
      this.unobservable.buildCount = (this.unobservable.buildCount || 0) + 1;
      this.unobservable.lastWidth = this.fromTarget("width");
      this.unobservable.lastHeight = this.fromTarget("height");
      return null;
    }
  }

  it("its child's first build already gets the size - and the observer follows every change after that", function () {
    const probe = new Probe();
    const provider = new DOMElementBoundsProvider({ className: "bounds-provider", style: { width: "640px", height: "480px" }, child: probe });
    provider.renderOnto(new DOMElementTarget(container));
    const element = provider.unobservable.node;
    assert.equal(container.querySelector(".bounds-provider"), element);
    assert.ok(FakeResizeObserver.observing(element));
    assert.equal(probe.unobservable.buildCount, 1);
    assert.equal(probe.unobservable.lastWidth, 640, "measured when first rendered");
    assert.equal(probe.unobservable.lastHeight, 480);

    FakeResizeObserver.report(element, 640, 480);
    assert.equal(probe.unobservable.buildCount, 1, "the observer's first report finds the same size: nothing to build");

    FakeResizeObserver.report(element, 300, 480);
    assert.equal(probe.unobservable.lastWidth, 300);
    assert.equal(probe.unobservable.buildCount, 2);
  });

  it("measures its content box: a border-box element's padding and border aren't room", function () {
    const probe = new Probe();
    const provider = new DOMElementBoundsProvider({
      style: { boxSizing: "border-box", width: "240px", height: "140px", padding: "10px", border: "10px solid black" },
      child: probe,
    });
    provider.renderOnto(new DOMElementTarget(container));
    assert.equal(probe.unobservable.lastWidth, 200);
    assert.equal(probe.unobservable.lastHeight, 100);
  });

  it("not in the page: no size", function () {
    const detached = document.createElement("div");
    const probe = new Probe();
    new DOMElementBoundsProvider({ style: { width: "640px" }, child: probe }).renderOnto(new DOMElementTarget(detached));
    assert.equal(probe.unobservable.lastWidth, undefined);
  });

  it("only what's placed on its element is measured - an element in between is a target of its own", function () {
    const probe = new Probe();
    class Wrapped extends Component {
      build() {
        return div({ key: "between" }, probe);
      }
    }
    const provider = new DOMElementBoundsProvider({ child: new Wrapped() });
    provider.renderOnto(new DOMElementTarget(container));
    FakeResizeObserver.report(provider.unobservable.node, 640, 480);
    assert.equal(probe.unobservable.lastWidth, undefined);
  });

  it("still follows its size after being rendered again - by a rebuild of its creator, say (a theme switch)", function () {
    const probe = new Probe();
    class Holder extends Component {
      initialState() {
        return { color: "red" };
      }
      build() {
        return new DOMElementBoundsProvider({ key: "provider", style: { color: this.color }, child: probe });
      }
    }
    const holder = new Holder();
    holder.renderOnto(new DOMElementTarget(container));
    const element = () => holder.newBuild.unobservable.node;
    FakeResizeObserver.report(element(), 300, 200);
    holder.color = "blue";
    assert.equal(element().style.color, "blue", "rendered again");
    assert.equal(probe.unobservable.lastWidth, 300);

    FakeResizeObserver.report(element(), 800, 600);
    assert.equal(probe.unobservable.lastWidth, 800, "and every change after that");
    assert.equal(probe.unobservable.lastHeight, 600);
  });

  it("stops observing once dropped from its own build()-owning parent", function () {
    class Frame extends Component {
      setProperties({ shown, child }) {
        this.shown = shown;
        this.child = child;
      }
      build() {
        return this.shown ? new DOMElementBoundsProvider({ key: "bounds", child: this.child }) : null;
      }
    }
    const frame = new Frame({ shown: true, child: new Probe() });
    frame.renderOnto(new DOMElementTarget(container));
    const element = frame.newBuild.unobservable.node;
    assert.ok(FakeResizeObserver.observing(element));

    frame.shown = false; // drops the keyed DOMElementBoundsProvider - disposed
    assert.ok(!FakeResizeObserver.observing(element));
  });

  it("without a ResizeObserver, measures again on window resizes", function () {
    delete dom.window.ResizeObserver;
    const probe = new Probe();
    const provider = new DOMElementBoundsProvider({ style: { width: "200px", height: "100px" }, child: probe });
    provider.renderOnto(new DOMElementTarget(container));
    assert.equal(probe.unobservable.lastWidth, 200);
    provider.unobservable.node.style.width = "150px";
    dom.window.dispatchEvent(new dom.window.Event("resize"));
    assert.equal(probe.unobservable.lastWidth, 150);
  });

  // Fully styleable by its creator (see the class's own doc) - and correctly
  // so across a rebuild, not just on first construction: a property that's
  // present one rebuild and gone the next must actually clear on the real
  // element, not linger (a real bug in an earlier version of this file,
  // where a plain Object.assign(element.style, style) only ever added/
  // overwrote keys, never removed one that disappeared).
  it("re-applies style and className from its creator on every rebuild, clearing whatever is no longer given - size-contained unless told otherwise", function () {
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

    const frame = new Frame({
      style: { position: "relative", height: "100%" },
      className: "frame-a",
      child: new Probe(),
    });
    frame.renderOnto(new DOMElementTarget(container));

    const element = container.querySelector("div");
    assert.equal(element.style.position, "relative");
    assert.equal(element.style.height, "100%");
    assert.equal(element.style.contain, "size layout");
    assert.equal(element.className, "frame-a");

    // A rebuild that drops `position`, changes `height`, and adds `width` -
    // a creator restyling its child to fit a different layout, exactly the
    // scenario the whole "fully styleable" property is for.
    frame.style = { height: "50%", width: "10px", contain: "inline-size layout" };
    frame.className = "frame-b";

    assert.equal(element.style.position, "", "a style property dropped from the new style object must be cleared, not left stale");
    assert.equal(element.style.height, "50%");
    assert.equal(element.style.width, "10px");
    assert.equal(element.style.contain, "inline-size layout");
    assert.equal(element.className, "frame-b", "className must also update, not stick to its first value");
  });
});

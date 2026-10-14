import { JSDOM } from "jsdom";
import assert from "assert";
import { Component, observable } from "@liquefy/cascade.component";
import { DOMElementTarget } from "../DOMElementTarget.js";
import { DOMElementVisibilityProvider } from "../DOMElementVisibilityProvider.js";
import { DOMElementBoundsProvider } from "../DOMElementBoundsProvider.js";

// jsdom has no viewport and no IntersectionObserver - so a stand-in one,
// reporting whatever a test says about an element, as a browser's would
// as it's scrolled (see DOMElementTarget.observeVisibility()): how many
// pixels of it are visible, of how tall it is, in a viewport how tall.
class FakeIntersectionObserver {
  constructor(callback, options) {
    this.callback = callback;
    this.options = options;
    this.elements = new Set();
    FakeIntersectionObserver.all.add(this);
  }
  observe(element) {
    this.elements.add(element);
  }
  unobserve(element) {
    this.elements.delete(element);
  }
  disconnect() {
    this.elements.clear();
    FakeIntersectionObserver.all.delete(this);
  }
  static report(element, visible, { height = 100, viewport = 1000 } = {}) {
    const entry = {
      target: element,
      isIntersecting: visible > 0,
      intersectionRect: { height: visible },
      boundingClientRect: { height },
      rootBounds: { height: viewport },
    };
    for (const observer of FakeIntersectionObserver.all) {
      if (observer.elements.has(element)) observer.callback([entry]);
    }
  }
  static observing(element) {
    return [...FakeIntersectionObserver.all].find((observer) => observer.elements.has(element)) || null;
  }
}
FakeIntersectionObserver.all = new Set();

describe("DOMElementVisibilityProvider", function () {
  let container;
  let dom;

  beforeEach(function () {
    dom = new JSDOM("<!DOCTYPE html><body></body>");
    global.document = dom.window.document;
    global.window = dom.window;
    dom.window.IntersectionObserver = FakeIntersectionObserver;
    FakeIntersectionObserver.all.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  // Reads whether the element it's placed in is in view, from build().
  class Probe extends Component {
    build() {
      const u = this.unobservable;
      u.builds = (u.builds || 0) + 1;
      u.inView = this.fromTarget("inView");
      u.seen = this.fromTarget("seen");
      return null;
    }
  }

  it("not seen until it comes into view - then built again; seen stays true, in view follows scrolling", function () {
    const probe = new Probe();
    const provider = new DOMElementVisibilityProvider({ child: probe });
    provider.renderOnto(new DOMElementTarget(container));
    const element = provider.unobservable.node;
    const u = probe.unobservable;
    assert.ok(FakeIntersectionObserver.observing(element));
    assert.deepEqual([u.builds, u.inView, u.seen], [1, false, false], "first built as not seen yet");

    FakeIntersectionObserver.report(element, 0);
    assert.equal(u.builds, 1, "nothing changed: nothing to build");

    FakeIntersectionObserver.report(element, 100);
    assert.deepEqual([u.builds, u.inView, u.seen], [2, true, true]);

    FakeIntersectionObserver.report(element, 0);
    assert.deepEqual([u.builds, u.inView, u.seen], [3, false, true], "scrolled out again: still seen");
  });

  it("in view once enough of it is visible - a quarter, by default", function () {
    const probe = new Probe();
    const provider = new DOMElementVisibilityProvider({ child: probe });
    provider.renderOnto(new DOMElementTarget(container));
    const element = provider.unobservable.node;
    FakeIntersectionObserver.report(element, 10);
    assert.equal(probe.unobservable.seen, false, "a sliver of it isn't enough");
    FakeIntersectionObserver.report(element, 25);
    assert.equal(probe.unobservable.seen, true);
    FakeIntersectionObserver.report(element, 20);
    assert.equal(probe.unobservable.inView, false, "less than that again: out of view");
  });

  it("taller than the viewport, it's the viewport it has to fill that much of", function () {
    const probe = new Probe();
    const provider = new DOMElementVisibilityProvider({ child: probe, amount: 0.5 });
    provider.renderOnto(new DOMElementTarget(container));
    const element = provider.unobservable.node;
    FakeIntersectionObserver.report(element, 400, { height: 3000, viewport: 1000 });
    assert.equal(probe.unobservable.seen, false);
    FakeIntersectionObserver.report(element, 500, { height: 3000, viewport: 1000 });
    assert.equal(probe.unobservable.seen, true, "half the screen - a sixth of it");
  });

  it("amount 0: any part of it at all - and a margin moves the viewport's edges", function () {
    const probe = new Probe();
    const provider = new DOMElementVisibilityProvider({ child: probe, amount: 0, margin: "0px 0px -40% 0px" });
    provider.renderOnto(new DOMElementTarget(container));
    const element = provider.unobservable.node;
    assert.equal(FakeIntersectionObserver.observing(element).options.rootMargin, "0px 0px -40% 0px");
    FakeIntersectionObserver.report(element, 1);
    assert.equal(probe.unobservable.seen, true);
  });

  it("only rebuilds what reads it: a sibling section stays as it is", function () {
    const first = new Probe();
    const second = new Probe();
    const model = observable({ unused: 0 });
    class Page extends Component {
      build() {
        model.unused;
        return [new DOMElementVisibilityProvider({ child: first }), new DOMElementVisibilityProvider({ child: second })];
      }
    }
    const page = new Page();
    page.renderOnto(new DOMElementTarget(container));
    const [firstElement] = container.children;
    FakeIntersectionObserver.report(firstElement, 100);
    assert.deepEqual([first.unobservable.builds, first.unobservable.seen], [2, true]);
    assert.deepEqual([second.unobservable.builds, second.unobservable.seen], [1, false]);
  });

  it("hidden and shown again, it's not seen until it comes into view again - and watched anew", function () {
    const model = observable({ shown: true });
    const probe = new Probe();
    const provider = new DOMElementVisibilityProvider({ child: probe });
    class Frame extends Component {
      render(target, context) {
        if (model.shown) provider.renderOnto(target, context);
      }
    }
    new Frame().renderOnto(new DOMElementTarget(container));
    const element = provider.unobservable.node;
    FakeIntersectionObserver.report(element, 100);
    assert.equal(probe.unobservable.seen, true);

    model.shown = false;
    assert.equal(probe.unobservable.seen, true, "hidden, nothing is built");
    model.shown = true;
    assert.deepEqual([probe.unobservable.seen, probe.unobservable.inView], [false, false], "shown again: built not seen");
    assert.ok(FakeIntersectionObserver.observing(element), "still watched");
    FakeIntersectionObserver.report(element, 100);
    assert.equal(probe.unobservable.seen, true, "and seen again, once in view");
  });

  it("without an IntersectionObserver, everything counts as seen at once", function () {
    delete dom.window.IntersectionObserver;
    const probe = new Probe();
    const model = observable({ shown: true });
    const provider = new DOMElementVisibilityProvider({ child: probe });
    class Frame extends Component {
      render(target, context) {
        if (model.shown) provider.renderOnto(target, context);
      }
    }
    new Frame().renderOnto(new DOMElementTarget(container));
    assert.deepEqual([probe.unobservable.inView, probe.unobservable.seen], [true, true]);
    model.shown = false;
    model.shown = true;
    assert.deepEqual([probe.unobservable.inView, probe.unobservable.seen], [true, true], "and stays so, shown again: nothing could tell otherwise");
  });

  it("stops watching once dropped from its own build()-owning parent", function () {
    const model = observable({ shown: true });
    class Holder extends Component {
      build() {
        return model.shown ? new DOMElementVisibilityProvider({ child: new Probe() }) : null;
      }
    }
    new Holder().renderOnto(new DOMElementTarget(container));
    const element = container.firstChild;
    assert.ok(FakeIntersectionObserver.observing(element));
    model.shown = false;
    assert.equal(FakeIntersectionObserver.observing(element), null);
  });

  it("a target both measured and watched keeps its size and its visibility side by side", function () {
    dom.window.ResizeObserver = class { observe() {} disconnect() {} };
    const probe = new Probe();
    const target = DOMElementTarget.forElement(container);
    target.observeVisibility();
    target.observeBounds();
    FakeIntersectionObserver.report(container, 100);
    assert.equal(target.timeless.seen, true);
    assert.ok("width" in target.timeless);
    // And a bounds provider's child still reads its size, as before.
    const bounds = new DOMElementBoundsProvider({ style: { width: "200px", height: "100px" }, child: probe });
    bounds.renderOnto(new DOMElementTarget(container));
    assert.equal(probe.fromTarget("width"), 200);
  });
});

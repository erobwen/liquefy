import { JSDOM } from "jsdom";
import assert from "assert";
import { Component, observable } from "@liquefy/cascade.component";
import { DOMElementTarget } from "../DOMElementTarget.js";
import { DOMElementVisibilityProvider } from "../DOMElementVisibilityProvider.js";
import { DOMElementBoundsProvider } from "../DOMElementBoundsProvider.js";

// jsdom has no viewport and no IntersectionObserver - so a stand-in one,
// reporting whatever a test says about an element, as a browser's would
// as it's scrolled (see DOMElementTarget.observeVisibility()).
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
  disconnect() {
    this.elements.clear();
    FakeIntersectionObserver.all.delete(this);
  }
  static report(element, isIntersecting) {
    for (const observer of FakeIntersectionObserver.all) {
      if (observer.elements.has(element)) observer.callback([{ target: element, isIntersecting }]);
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

    FakeIntersectionObserver.report(element, false);
    assert.equal(u.builds, 1, "nothing changed: nothing to build");

    FakeIntersectionObserver.report(element, true);
    assert.deepEqual([u.builds, u.inView, u.seen], [2, true, true]);

    FakeIntersectionObserver.report(element, false);
    assert.deepEqual([u.builds, u.inView, u.seen], [3, false, true], "scrolled out again: still seen");
  });

  it("takes a margin - the observer's rootMargin", function () {
    const provider = new DOMElementVisibilityProvider({ child: new Probe(), margin: "0px 0px -40% 0px" });
    provider.renderOnto(new DOMElementTarget(container));
    assert.equal(FakeIntersectionObserver.observing(provider.unobservable.node).options.rootMargin, "0px 0px -40% 0px");
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
    FakeIntersectionObserver.report(firstElement, true);
    assert.deepEqual([first.unobservable.builds, first.unobservable.seen], [2, true]);
    assert.deepEqual([second.unobservable.builds, second.unobservable.seen], [1, false]);
  });

  it("without an IntersectionObserver, everything counts as seen at once", function () {
    delete dom.window.IntersectionObserver;
    const probe = new Probe();
    new DOMElementVisibilityProvider({ child: probe }).renderOnto(new DOMElementTarget(container));
    assert.deepEqual([probe.unobservable.inView, probe.unobservable.seen], [true, true]);
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
    FakeIntersectionObserver.report(container, true);
    assert.equal(target.timeless.seen, true);
    assert.ok("width" in target.timeless);
    // And a bounds provider's child still reads its size, as before.
    const bounds = new DOMElementBoundsProvider({ style: { width: "200px", height: "100px" }, child: probe });
    bounds.renderOnto(new DOMElementTarget(container));
    assert.equal(probe.fromTarget("width"), 200);
  });
});

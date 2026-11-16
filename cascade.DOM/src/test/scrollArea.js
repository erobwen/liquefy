import { JSDOM } from "jsdom";
import assert from "assert";
import { Component } from "@liquefy/cascade.component";
import { DOMElementTarget } from "../DOMElementTarget.js";
import { scrollArea } from "../ScrollArea.js";
import { div } from "../HTMLTags.js";

// ScrollArea: its indicator and its edges follow what's laid out in it.
// jsdom has no layout, so a fake one stands in: what scrolls is 200px
// tall, and what's in it lies one below the other, each as tall as its
// title says, 20px apart - but for what's absolutely positioned, which
// lies at the top, out of the layout. jsdom has no ResizeObserver either:
// one that only records what it's told to watch stands in, so nothing here
// is ever told of a size changing.
describe("ScrollArea", function () {
  const gap = 20;
  const viewHeight = 200;
  let container;
  let view;
  let frames;
  let watched;
  let globals;

  beforeEach(function () {
    const dom = new JSDOM("<!DOCTYPE html><body></body>");
    view = dom.window;
    globals = {};
    const provide = (name, value) => {
      globals[name] = Object.getOwnPropertyDescriptor(global, name);
      global[name] = value;
    };
    frames = [];
    watched = new Set();
    provide("document", view.document);
    provide("getComputedStyle", (element) => view.getComputedStyle(element));
    provide("MutationObserver", view.MutationObserver);
    provide("requestAnimationFrame", (callback) => frames.push(callback));
    provide("cancelAnimationFrame", () => {});
    provide("ResizeObserver", class {
      observe(element) { watched.add(element); }
      unobserve(element) { watched.delete(element); }
      disconnect() { watched.clear(); }
    });
    const isScroller = (element) => element.hasAttribute("data-scroll-area");
    const laidOut = (element) => element.style.position !== "absolute";
    const define = (name, get) => Object.defineProperty(view.HTMLElement.prototype, name, { configurable: true, get });
    define("clientHeight", function () { return isScroller(this) ? viewHeight : 0; });
    define("offsetHeight", function () { return isScroller(this) ? viewHeight : Number(this.title) || 0; });
    define("offsetTop", function () {
      const parent = this.parentElement;
      if (!parent || !isScroller(parent) || !laidOut(this)) return 0;
      let top = 0;
      for (const sibling of parent.children) {
        if (sibling === this) return top;
        if (laidOut(sibling)) top += (Number(sibling.title) || 0) + gap;
      }
      return top;
    });
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(function () {
    for (const [name, descriptor] of Object.entries(globals)) {
      if (descriptor) Object.defineProperty(global, name, descriptor); else delete global[name];
    }
  });

  // What it does once a child is added or removed happens in a task of its
  // own - and it finds its elements in a frame, if they weren't there yet.
  const settle = async () => {
    for (let i = 0; i < 3; i++) {
      const pending = frames;
      frames = [];
      pending.forEach((callback) => callback());
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  };

  async function setup(heights, properties = {}) {
    const told = [];
    class Area extends Component {
      initialState() {
        return { heights };
      }
      build() {
        return scrollArea(
          { key: "area", onScrolls: (scrolls) => told.push(scrolls), ...properties },
          this.heights.map((height, index) => div({ key: "item" + index, title: String(height) })),
        );
      }
    }
    const area = new Area();
    area.renderOnto(new DOMElementTarget(container));
    await settle();
    return { area, told, scroller: container.querySelector("[data-scroll-area]"), thumb: container.querySelector("[data-scroll-indicator]") };
  }

  // As long as the view is of all there is, in a track 3px in from each end.
  const lengthFor = (all) => (viewHeight - 6) * viewHeight / all;
  const lengthOf = (thumb) => parseFloat(thumb.style.height);
  const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 0.01, (message || "") + " " + actual + " ~ " + expected);

  it("with everything in view: no indicator, no faded edges, nothing told", async function () {
    const { told, scroller, thumb } = await setup([60, 60], { fade: 20 });
    assert.equal(thumb.style.scale, "0 1");
    assert.equal(scroller.style.getPropertyValue("--cascade-scroll-fade-top"), "0px");
    assert.equal(scroller.style.getPropertyValue("--cascade-scroll-fade-bottom"), "0px");
    assert.deepEqual(told, []);
  });

  it("the indicator is as long as the view is of all that's laid out - the gaps between what's in it included", async function () {
    const { told, scroller, thumb } = await setup([60, 60, 60, 60, 60], { fade: 20 });
    // Five of 60, four gaps of 20.
    near(lengthOf(thumb), lengthFor(380));
    assert.equal(thumb.style.scale, "1 1");
    assert.equal(thumb.style.translate, "0 3px");
    assert.equal(scroller.style.getPropertyValue("--cascade-scroll-fade-top"), "0px", "at the top: nothing out of sight above");
    assert.equal(scroller.style.getPropertyValue("--cascade-scroll-fade-bottom"), "20px");
    assert.deepEqual(told, [true]);
  });

  it("only two apart, what doesn't fit for the gap between them scrolls", async function () {
    const { told, thumb } = await setup([95, 95]);
    assert.equal(thumb.style.scale, "1 1");
    near(lengthOf(thumb), lengthFor(210));
    assert.deepEqual(told, [true]);
  });

  it("follows children added and removed - though nothing it watched changed size", async function () {
    const { area, told, thumb } = await setup([60, 60, 60, 60, 60]);
    area.heights = [60, 60, 60, 60, 60, 60, 60, 60, 60];
    await settle();
    near(lengthOf(thumb), lengthFor(700), "added");
    assert.deepEqual(told, [true]);

    area.heights = [60, 60];
    await settle();
    assert.equal(thumb.style.scale, "0 1", "nothing left to scroll");
    assert.deepEqual(told, [true, false]);
  });

  it("watches the size of each child there is - no longer one that's gone", async function () {
    const { area, scroller } = await setup([60, 60, 60]);
    const [first, second, third] = scroller.children;
    assert.ok(watched.has(first) && watched.has(second) && watched.has(third));
    area.heights = [60, 60];
    await settle();
    assert.ok(watched.has(first) && watched.has(second));
    assert.ok(!watched.has(third), "gone");
  });

  it("what's out of the layout - something fading out where it was - isn't counted", async function () {
    const { scroller, thumb } = await setup([60, 60, 60, 60, 60]);
    const ghost = document.createElement("div");
    ghost.title = "500";
    ghost.style.position = "absolute";
    scroller.appendChild(ghost);
    await settle();
    near(lengthOf(thumb), lengthFor(380));
  });

  it("scrolled, the indicator is as far along its track, and the edges fade by what's out of sight beyond them", async function () {
    const { scroller, thumb } = await setup([60, 60, 60, 60, 60], { fade: 20 });
    scroller.scrollTop = 170;
    scroller.dispatchEvent(new view.Event("scroll"));
    const length = lengthFor(380);
    near(lengthOf(thumb), length);
    near(parseFloat(thumb.style.translate.split(" ")[1]), 3 + (viewHeight - 6 - length) * 170 / 180);
    assert.equal(scroller.style.getPropertyValue("--cascade-scroll-fade-top"), "20px");
    assert.equal(scroller.style.getPropertyValue("--cascade-scroll-fade-bottom"), "10px");
  });
});

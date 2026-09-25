import { JSDOM } from "jsdom";
import assert from "assert";
import { Component, RenderContext, postponeInvalidations, continueInvalidations } from "@liquefy/cascade.component";
import { DOMElementTarget } from "../DOMElementTarget.js";
import { FlipAnimationContainer, flipAnimationContainer } from "../FlipAnimationContainer.js";
import { div } from "../HTMLTags.js";
import { text } from "../DOMTextComponent.js";

// FlipAnimationContainer's moves: an element that changes place is drawn
// where it was, then carried to where it now belongs by a spring. jsdom has
// no layout, so a fake one stands in: every element a 20px-tall block,
// stacked in DOM order inside its parent and indented 10px per level - and
// drawn offset by its own and its ancestors' translate(), as a browser
// would. Frames are driven by hand.
describe("FlipAnimationContainer moves", function () {
  let container;
  let frames;
  let time;
  let originalClock;

  const translation = (element) => {
    const match = /translate\((-?[\d.e+-]+)px, (-?[\d.e+-]+)px\)/.exec(element.style.transform || "");
    return match ? { x: Number(match[1]), y: Number(match[2]) } : { x: 0, y: 0 };
  };

  // Where an element lies in the fake layout (no translations).
  const layoutOf = (element) => {
    const parent = element.parentElement;
    if (!parent || parent === document.body || !container.contains(parent)) return { x: 0, y: 0 };
    const above = layoutOf(parent);
    const index = Array.from(parent.children).indexOf(element);
    return { x: above.x + 10, y: above.y + 20 * (index + 1) };
  };

  // Where an element is drawn: its layout plus every translation on the way.
  const drawnAt = (element) => {
    let { x, y } = layoutOf(element);
    for (let each = element; each && container.contains(each); each = each.parentElement) {
      const t = translation(each);
      x += t.x;
      y += t.y;
    }
    return { x, y };
  };

  beforeEach(function () {
    const dom = new JSDOM("<!DOCTYPE html><body></body>");
    global.document = dom.window.document;
    container = document.createElement("div");
    document.body.appendChild(container);
    dom.window.Element.prototype.getBoundingClientRect = function () {
      const { x, y } = drawnAt(this);
      return { left: x, top: y, width: 100, height: 20, right: x + 100, bottom: y + 20 };
    };
    frames = [];
    time = 0;
    originalClock = FlipAnimationContainer.clock;
    FlipAnimationContainer.clock = { now: () => time, requestFrame: (callback) => frames.push(callback) };
  });

  afterEach(function () {
    FlipAnimationContainer.clock = originalClock;
  });

  function runFrames(count) {
    for (let i = 0; i < count && frames.length > 0; i++) {
      time += 16;
      const pending = frames;
      frames = [];
      pending.forEach((callback) => callback());
    }
  }

  const runToRest = () => runFrames(500);

  class Lists extends Component {
    initializeState() {
      return { a: ["one", "two", "three"], b: ["four"] };
    }
    build() {
      const item = (name) => div({ key: name }, text({ key: name + "Text", text: name }));
      return flipAnimationContainer(
        { key: "flip" },
        div({ key: "listA" }, this.a.map(item)),
        div({ key: "listB" }, this.b.map(item)),
      );
    }
  }

  function setup() {
    const lists = new Lists();
    lists.renderOnto(new RenderContext(new DOMElementTarget(container)));
    const element = (name) => Array.from(container.querySelectorAll("div")).find((each) => each.firstChild && each.firstChild.nodeType === 3 && each.textContent === name);
    return { lists, element };
  }

  it("a moved element is first drawn where it was, then carried by its spring to where it now lies", function () {
    const { lists, element } = setup();
    const three = element("three");
    const before = drawnAt(three);

    lists.a = ["three", "one", "two"];
    assert.deepEqual(drawnAt(three), before, "still drawn where it was");
    assert.notEqual(three.style.transform, "");

    runFrames(10);
    const midway = drawnAt(three);
    assert.ok(midway.y < before.y && midway.y > layoutOf(three).y, "on its way");

    runToRest();
    assert.equal(three.style.transform, "");
    assert.deepEqual(drawnAt(three), layoutOf(three), "arrived");
    assert.equal(frames.length, 0, "and the animation has stopped");
  });

  it("an element that didn't move isn't touched", function () {
    const { lists, element } = setup();
    const four = element("four");
    lists.a = ["two", "one", "three"];
    assert.equal(four.style.transform, "");
  });

  it("an element moving to another parent moves from where it was, too", function () {
    const { lists, element } = setup();
    const one = element("one");
    const before = drawnAt(one);

    // In one go: written one after the other, "one" would be in neither list
    // for a rebuild in between - dropped, and gone for good (see
    // cascade.component/README.md) - then built anew in list B.
    postponeInvalidations();
    lists.a = ["two", "three"];
    lists.b = ["four", "one"];
    continueInvalidations();
    assert.equal(one.parentElement, element("four").parentElement, "now in list B");
    assert.deepEqual(drawnAt(one), before);
    runToRest();
    assert.deepEqual(drawnAt(one), layoutOf(one));
  });

  it("redirected mid-flight, it carries on from where it's drawn - no jump - and still arrives", function () {
    const { lists, element } = setup();
    const three = element("three");
    lists.a = ["three", "one", "two"];
    runFrames(6);
    const inFlight = drawnAt(three);

    lists.a = ["one", "two", "three"];
    assert.deepEqual(drawnAt(three), inFlight, "no jump when the target changes");
    runToRest();
    assert.deepEqual(drawnAt(three), layoutOf(three));
  });

  it("keeps its velocity when redirected: it doesn't stop dead and restart", function () {
    const { lists, element } = setup();
    const three = element("three");
    lists.a = ["three", "one", "two"]; // three moves up
    runFrames(4);
    const a = drawnAt(three);
    runFrames(1);
    const b = drawnAt(three);
    const velocityBefore = b.y - a.y;
    assert.ok(velocityBefore < 0, "moving up");

    // Sent back where it came from - below where it's drawn now. With its
    // momentum kept, it carries on upward for a moment before turning,
    // like anything with mass would, instead of reversing instantly.
    lists.a = ["one", "two", "three"];
    runFrames(1);
    const c = drawnAt(three);
    assert.ok(c.y - b.y < 0, "still moving up in the first frame after the redirect");
    runToRest();
    assert.deepEqual(drawnAt(three), layoutOf(three));
  });

  it("a moving element's contents move with it, not twice as far", function () {
    class Nested extends Component {
      initializeState() {
        return { order: ["x", "y"] };
      }
      build() {
        return flipAnimationContainer(
          { key: "flip" },
          this.order.map((name) => div({ key: name }, div({ key: name + "Inner" }, text({ key: name + "Text", text: name })))),
        );
      }
    }
    const nested = new Nested();
    nested.renderOnto(new RenderContext(new DOMElementTarget(container)));
    const inner = Array.from(container.querySelectorAll("div")).find((each) => each.textContent === "y" && each.children.length === 0);
    const before = drawnAt(inner);

    nested.order = ["y", "x"];
    assert.deepEqual(drawnAt(inner), before, "the inner element is drawn where it was too");
    assert.equal(inner.style.transform, "", "moved by its parent's translation alone");
    runToRest();
    assert.deepEqual(drawnAt(inner), layoutOf(inner));
  });

  it("a new element appears at once; a removed one is gone", function () {
    const { lists, element } = setup();
    lists.a = ["one", "two", "three", "five"];
    assert.equal(element("five").style.transform, "");
    lists.a = ["one", "three", "five"];
    assert.equal(element("two"), undefined);
  });

  it("while the container isn't in the page, it just places - nothing animates", function () {
    const { lists, element } = setup();
    container.remove();
    lists.a = ["three", "two", "one"];
    assert.equal(element("three").style.transform, "");
    assert.equal(frames.length, 0);
  });
});

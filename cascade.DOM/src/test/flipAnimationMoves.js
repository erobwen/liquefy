import { JSDOM } from "jsdom";
import assert from "assert";
import { Component, RenderContext, postponeInvalidations, continueInvalidations } from "@liquefy/cascade.component";
import { DOMElementTarget } from "../DOMElementTarget.js";
import { FlipAnimationContainer, flipAnimationContainer } from "../FlipAnimationContainer.js";
import { div } from "../HTMLTags.js";
import { DOMNodeRenderComponent } from "../DOMNodeRenderComponent.js";
import { text } from "../DOMTextComponent.js";

// FlipAnimationContainer's animations: an element that changes place (or
// size) is drawn where (and as large as) it was, then carried to where it
// now belongs by a spring; a new one fades in; a removed one fades out as a
// ghost. jsdom has no layout, so a fake one stands in: every element a
// 20px-tall block - 100px wide, or as wide as its title says - stacked in
// DOM order inside its parent and indented 10px per level (an absolutely
// positioned one sits at its left/top instead, out of the stacking), and
// drawn the way a browser would draw its translate()/scale() (origin 0 0)
// and its ancestors'. Frames are driven by hand.
describe("FlipAnimationContainer animations", function () {
  let container;
  let frames;
  let time;
  let originalClock;
  let originalSpeed;

  const transformOf = (element) => {
    const transform = element.style.transform || "";
    const t = /translate\((-?[\d.e+-]+)px, (-?[\d.e+-]+)px\)/.exec(transform);
    const s = /scale\((-?[\d.e+-]+), (-?[\d.e+-]+)\)/.exec(transform);
    return { x: t ? Number(t[1]) : 0, y: t ? Number(t[2]) : 0, sx: s ? Number(s[1]) : 1, sy: s ? Number(s[2]) : 1 };
  };

  const inContainer = (element) => element && element !== container && container.contains(element);

  // Where an element lies in the fake layout (no transforms).
  const layoutOf = (element) => {
    const parent = element.parentElement;
    if (!inContainer(parent)) return { x: 0, y: 0 };
    const above = layoutOf(parent);
    if (element.style.position === "absolute") {
      return { x: above.x + parseFloat(element.style.left), y: above.y + parseFloat(element.style.top) };
    }
    const stacked = Array.from(parent.children).filter((each) => each.style.position !== "absolute");
    return { x: above.x + 10, y: above.y + 20 * (stacked.indexOf(element) + 1) };
  };

  const layoutWidthOf = (element) => Number(element.title) || 100;

  // Where an element is drawn: top-left and total scale, through its own
  // and every ancestor's transform.
  const drawn = (element) => {
    const layout = layoutOf(element);
    const own = transformOf(element);
    const parent = element.parentElement;
    if (!inContainer(parent)) return { x: layout.x + own.x, y: layout.y + own.y, sx: own.sx, sy: own.sy };
    const above = drawn(parent);
    const parentLayout = layoutOf(parent);
    return {
      x: above.x + above.sx * (layout.x - parentLayout.x + own.x),
      y: above.y + above.sy * (layout.y - parentLayout.y + own.y),
      sx: above.sx * own.sx,
      sy: above.sy * own.sy,
    };
  };
  const round = (value) => Math.round(value * 1000) / 1000;
  const drawnAt = (element) => {
    const { x, y } = drawn(element);
    return { x: round(x), y: round(y) };
  };
  const drawnWidth = (element) => round(layoutWidthOf(element) * drawn(element).sx);

  beforeEach(function () {
    const dom = new JSDOM("<!DOCTYPE html><body></body>");
    global.document = dom.window.document;
    container = document.createElement("div");
    document.body.appendChild(container);
    dom.window.Element.prototype.getBoundingClientRect = function () {
      if (!inContainer(this)) return { left: 0, top: 0, width: 1000, height: 1000, right: 1000, bottom: 1000 };
      const { x, y, sx, sy } = drawn(this);
      const width = layoutWidthOf(this) * sx;
      const height = 20 * sy;
      return { left: x, top: y, width, height, right: x + width, bottom: y + height };
    };
    frames = [];
    time = 0;
    originalClock = FlipAnimationContainer.clock;
    originalSpeed = FlipAnimationContainer.speed;
    FlipAnimationContainer.clock = { now: () => time, requestFrame: (callback) => frames.push(callback) };
  });

  afterEach(function () {
    FlipAnimationContainer.clock = originalClock;
    FlipAnimationContainer.speed = originalSpeed;
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

  it("an element with text of its own is scaled only by how large its text is drawn - never by its box changing size", function () {
    // Like a flex column that stretches its items to the widest one: when
    // the wide one leaves, the others' boxes narrow - their text must not
    // be squashed along. Moving to the smaller-font list, one does shrink.
    class Stretched extends Component {
      initializeState() {
        return { a: ["wide", "one", "two"], b: [] };
      }
      build() {
        const width = this.a.includes("wide") ? "200" : "100";
        const item = (fontSize) => (name) => div({ key: name, title: width, style: { fontSize } }, text({ key: name + "Text", text: name }));
        return flipAnimationContainer(
          { key: "flip" },
          div({ key: "listA" }, this.a.map(item("40px"))),
          div({ key: "listB" }, this.b.map(item("20px"))),
        );
      }
    }
    const stretched = new Stretched();
    stretched.renderOnto(new RenderContext(new DOMElementTarget(container)));
    const named = (name) => Array.from(container.querySelectorAll("div")).find((each) => each.textContent === name && each.firstChild.nodeType === 3);
    const two = named("two");
    const one = named("one");

    postponeInvalidations();
    stretched.a = ["two"];
    stretched.b = ["one"];
    continueInvalidations();

    const scaleOf = (element) => drawn(element);
    assert.equal(scaleOf(two).sx, 1, "the stretched sibling isn't scaled");
    assert.equal(scaleOf(two).sy, 1);
    assert.ok(Math.abs(scaleOf(one).sx - 2) < 1e-9 && Math.abs(scaleOf(one).sy - 2) < 1e-9, "the moved one starts at its old text size - uniformly");
    runFrames(10);
    assert.ok(scaleOf(one).sx > 1 && scaleOf(one).sx < 2, "and shrinks on the way");
    assert.equal(scaleOf(one).sx, scaleOf(one).sy);
    runToRest();
    assert.equal(one.style.transform, "");
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

  it("a new element fades in where it lies", function () {
    const { lists, element } = setup();
    lists.a = ["one", "two", "three", "five"];
    const five = element("five");
    assert.equal(five.style.transform, "");
    assert.ok(Number(five.style.opacity) < 0.05, "starts invisible");
    runFrames(10);
    const midway = Number(five.style.opacity);
    assert.ok(midway > 0.05 && midway < 1, "fading in");
    runToRest();
    assert.equal(five.style.opacity, "");
  });

  it("nothing fades in on the container's first render", function () {
    const { element } = setup();
    assert.equal(element("one").style.opacity, "");
    assert.equal(frames.length, 0);
  });

  it("a removed element fades out as a ghost, exactly where and how it was drawn, while the rest close the gap", function () {
    const { lists, element } = setup();
    const two = element("two");
    const three = element("three");
    const twoBefore = drawnAt(two);
    const threeBefore = drawnAt(three);

    lists.a = ["one", "three"];
    assert.ok(two.isConnected, "still shown");
    assert.equal(two.style.position, "absolute");
    assert.deepEqual(drawnAt(two), twoBefore, "right where it was");
    assert.equal(two.style.pointerEvents, "none");
    assert.deepEqual(drawnAt(three), threeBefore, "three starts where it was, too");

    runFrames(10);
    assert.ok(Number(two.style.opacity) < 1 && Number(two.style.opacity) > 0, "fading out");
    assert.ok(drawnAt(three).y < threeBefore.y, "three moving up into the gap");

    runToRest();
    assert.ok(!two.isConnected, "gone once faded");
    assert.deepEqual(drawnAt(three), layoutOf(three));
  });

  it("a leaving element that comes back while fading is restored, and moves on from where its ghost was", function () {
    class Toggled extends Component {
      initializeState() {
        return { show: true };
      }
      build() {
        return flipAnimationContainer(
          { key: "flip" },
          div({ key: "first" }, text({ key: "firstText", text: "first" })),
          div({ key: "middle", style: { color: "red" } }, text({ key: "middleText", text: "middle" })).show(this.show),
          div({ key: "last" }, text({ key: "lastText", text: "last" })),
        );
      }
    }
    const toggled = new Toggled();
    toggled.renderOnto(new RenderContext(new DOMElementTarget(container)));
    const middle = Array.from(container.querySelectorAll("div")).find((each) => each.textContent === "middle");
    const before = drawnAt(middle);

    toggled.show = false;
    runFrames(5);
    assert.equal(middle.style.position, "absolute");

    toggled.show = true;
    assert.equal(middle.style.position, "", "restored");
    assert.equal(middle.style.color, "red", "with its own style back");
    assert.deepEqual(drawnAt(middle), before, "from where its ghost was");
    runToRest();
    assert.ok(middle.isConnected);
    assert.equal(middle.style.opacity, "");
    assert.deepEqual(drawnAt(middle), layoutOf(middle));
  });

  it("a resized element is drawn at its old size, then grows to its new one - its contents not stretched along", function () {
    class Sized extends Component {
      initializeState() {
        return { wide: false };
      }
      build() {
        return flipAnimationContainer(
          { key: "flip" },
          div({ key: "box", title: this.wide ? "200" : "100" }, div({ key: "inner" }, text({ key: "innerText", text: "inner" }))),
        );
      }
    }
    const sized = new Sized();
    sized.renderOnto(new RenderContext(new DOMElementTarget(container)));
    const box = container.querySelector("[title]");
    const inner = box.firstElementChild;

    sized.wide = true;
    assert.equal(drawnWidth(box), 100, "still drawn at its old width");
    assert.equal(drawnWidth(inner), 100, "its contents at their own width, not squashed");
    runFrames(10);
    const midway = drawnWidth(box);
    assert.ok(midway > 100 && midway < 200, "growing");
    assert.equal(drawnWidth(inner), 100, "contents still not stretched");
    runToRest();
    assert.equal(drawnWidth(box), 200);
    assert.equal(box.style.transform, "");
  });

  it("an island moves as a unit, in the box the container gives it", function () {
    class Island extends DOMNodeRenderComponent {
      renderElement(context, existingElement) {
        const element = existingElement || document.createElement("output");
        context.target.reattachElement(element);
        element.textContent = this.key;
        return element;
      }
    }
    class WithIsland extends Component {
      initializeState() {
        return { islandFirst: false };
      }
      build() {
        const island = new Island({ key: "island" });
        const other = div({ key: "other" }, text({ key: "otherText", text: "other" }));
        return flipAnimationContainer({ key: "flip" }, this.islandFirst ? [island, other] : [other, island]);
      }
    }
    const withIsland = new WithIsland();
    withIsland.renderOnto(new RenderContext(new DOMElementTarget(container)));
    const holder = container.querySelector("[data-flip-island]");
    const before = drawnAt(holder);

    withIsland.islandFirst = true;
    assert.deepEqual(drawnAt(holder), before);
    assert.notEqual(holder.style.transform, "");
    runToRest();
    assert.deepEqual(drawnAt(holder), layoutOf(holder));
  });

  it("a component the app marks as a unit (isUnit) moves as one piece - nothing inside it animates on its own", function () {
    class Card extends Component {
      setProperties({ label }) {
        this.label = label;
      }
      build() {
        return div({ key: "card" }, div({ key: "title" }, text({ key: "titleText", text: this.label })), div({ key: "body" }, text({ key: "bodyText", text: "body" })));
      }
    }
    class Cards extends Component {
      initializeState() {
        return { order: ["a", "b"] };
      }
      build() {
        return flipAnimationContainer(
          { key: "flip", isUnit: (component) => component instanceof Card },
          this.order.map((label) => new Card({ key: label, label })),
        );
      }
    }
    const cards = new Cards();
    cards.renderOnto(new RenderContext(new DOMElementTarget(container)));
    const holders = () => Array.from(container.querySelectorAll("[data-flip-island]"));
    assert.equal(holders().length, 2, "each card in a box of its own");
    const [a, b] = holders();
    const titleOf = (holder) => holder.querySelector("div > div");
    const before = drawnAt(a);

    cards.order = ["b", "a"];
    assert.deepEqual(holders(), [b, a], "the same boxes, moved");
    assert.deepEqual(drawnAt(a), before, "the card starts where it was");
    assert.notEqual(a.style.transform, "");
    assert.equal(titleOf(a).style.transform, "", "its insides just come along");
    assert.equal(a.querySelector("div").style.transform, "");
    runToRest();
    assert.deepEqual(drawnAt(a), layoutOf(a));
  });

  it("runs at FlipAnimationContainer.speed - at half speed a move takes about twice as many frames", function () {
    const framesToRest = (speed) => {
      FlipAnimationContainer.speed = speed;
      container.innerHTML = "";
      const { lists } = setup();
      lists.a = ["three", "one", "two"];
      let count = 0;
      while (frames.length > 0 && count < 1000) { runFrames(1); count++; }
      return count;
    };
    const full = framesToRest(1);
    const half = framesToRest(0.5);
    assert.ok(half > full * 1.7 && half < full * 2.3, "full speed " + full + " frames, half speed " + half);
  });

  it("while the container isn't in the page, it just places - nothing animates", function () {
    const { lists, element } = setup();
    container.remove();
    lists.a = ["three", "two", "one"];
    assert.equal(element("three").style.transform, "");
    assert.equal(frames.length, 0);
  });
});

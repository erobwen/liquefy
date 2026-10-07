import { JSDOM } from "jsdom";
import assert from "assert";
import { Component, RenderContext, postponeInvalidations, continueInvalidations } from "@liquefy/cascade.component";
import { DOMElementTarget } from "../DOMElementTarget.js";
import { FlipAnimationContainer, flipAnimationContainer } from "../FlipAnimationContainer.js";
import { div } from "../HTMLTags.js";
import { DOMNodeComponent } from "../DOMNodeComponent.js";
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
    FlipAnimationContainer.enabled = true;
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
    initialState() {
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
    lists.renderOnto(new DOMElementTarget(container));
    const element = (name) => Array.from(container.querySelectorAll("div")).find((each) => each.firstChild && each.firstChild.nodeType === 3 && each.textContent === name);
    return { lists, element };
  }

  it("switched off, nothing animates - and what's on its way when it's switched off is where it belongs by the next frame", function () {
    const { lists, element } = setup();
    const three = element("three");
    FlipAnimationContainer.enabled = false;
    lists.a = ["three", "one", "two"];
    assert.equal(three.style.transform, "", "placed, not animated");
    assert.deepEqual(drawnAt(three), layoutOf(three));

    FlipAnimationContainer.enabled = true;
    lists.a = ["one", "two", "three"];
    assert.notEqual(three.style.transform, "", "on its way");
    FlipAnimationContainer.enabled = false;
    runFrames(1);
    assert.equal(three.style.transform, "", "stopped");
    assert.deepEqual(drawnAt(three), layoutOf(three), "where it belongs");
  });

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
      initialState() {
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
    stretched.renderOnto(new DOMElementTarget(container));
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
      initialState() {
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
    nested.renderOnto(new DOMElementTarget(container));
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

  it("while it fades in, a new element - and the animated element it's in - is lifted above what moves around it, unclipped, then put back", function () {
    const { lists, element } = setup();
    const listA = element("one").parentNode;
    listA.style.zIndex = "3"; // its own z-index - to be put back as it was
    listA.style.overflow = "hidden"; // clips - as a column() does
    lists.a = ["one", "two", "three", "five"];
    const five = element("five");
    assert.equal(five.style.zIndex, "1");
    assert.equal(five.style.position, "relative", "a z-index needs a position");
    assert.equal(listA.style.zIndex, "1", "and so is the list it's in: a stacking context of its own");
    assert.equal(listA.style.overflow, "visible", "drawn smaller than it is on its way, it doesn't cut off the newcomer");
    runFrames(10);
    assert.equal(five.style.zIndex, "1", "still fading in: still lifted");
    runToRest();
    assert.equal(five.style.zIndex, "");
    assert.equal(five.style.position, "");
    assert.equal(listA.style.zIndex, "3", "its own, back");
    assert.equal(listA.style.position, "");
    assert.equal(listA.style.overflow, "hidden");
  });

  it("told to confine what appears, it leaves the elements around it as they are: clipped, not lifted", function () {
    class Confined extends Component {
      initialState() {
        return { a: ["one", "two", "three"] };
      }
      build() {
        const item = (name) => div({ key: name }, text({ key: name + "Text", text: name }));
        return flipAnimationContainer({ key: "flip", confine: true }, div({ key: "listA", style: { overflow: "hidden" } }, this.a.map(item)));
      }
    }
    const confined = new Confined();
    confined.renderOnto(new DOMElementTarget(container));
    const listA = container.querySelector("[id*='(listA)']");
    confined.a = ["one", "two", "three", "five"];
    const five = Array.from(listA.children).find((each) => each.textContent === "five");
    assert.ok(Number(five.style.opacity) < 0.05, "it does fade in");
    assert.equal(five.style.zIndex, "");
    assert.equal(listA.style.zIndex, "");
    assert.equal(listA.style.overflow, "hidden", "clipped, as it's drawn");
  });

  it("what scrolls keeps scrolling while something in it appears", function () {
    const { lists, element } = setup();
    const listA = element("one").parentNode;
    listA.style.overflow = "auto";
    lists.a = ["one", "two", "three", "five"];
    assert.equal(listA.style.overflow, "auto");
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

  it("a ghost fades out where it was among its siblings - drawn above and below what it was", function () {
    const { lists, element } = setup();
    const two = element("two");
    const three = element("three");
    const listA = two.parentNode;
    lists.a = ["one", "three"];
    assert.equal(two.parentNode, listA, "in its own parent");
    assert.equal(two.nextSibling, three, "before what it was before");
  });

  it("an element on its way to another parent is lifted above what it passes over - not what it carries, nor what makes room - until it arrives", function () {
    class Shelves extends Component {
      initialState() {
        return { a: ["one", "two", "three"], b: ["four"] };
      }
      build() {
        const box = (name) => div({ key: name }, div({ key: name + "Label" }, text({ key: name + "Text", text: name })));
        return flipAnimationContainer(
          { key: "flip" },
          div({ key: "listA" }, this.a.map(box)),
          div({ key: "listB" }, this.b.map(box)),
        );
      }
    }
    const shelves = new Shelves();
    shelves.renderOnto(new DOMElementTarget(container));
    const label = (name) => Array.from(container.querySelectorAll("div")).find((each) => each.textContent === name && each.firstChild.nodeType === 3);
    const one = label("one").parentNode;
    const two = label("two").parentNode;
    postponeInvalidations();
    shelves.a = ["two", "three"];
    shelves.b = ["four", "one"];
    continueInvalidations();
    assert.notEqual(two.style.transform, "", "two moves up, making room");
    assert.equal(two.style.zIndex, "", "but stays where it is among the rest");
    assert.equal(one.style.zIndex, "1", "one, on its way to the other list, is lifted");
    assert.equal(one.style.position, "relative", "a z-index needs a position");
    assert.equal(label("one").style.zIndex, "", "what it carries goes along - not lifted itself");
    runToRest();
    assert.equal(one.style.zIndex, "", "arrived: put back");
    assert.equal(one.style.position, "");
  });

  it("an element appearing in something on its way somewhere comes along with it, on the same path", function () {
    class Boxes extends Component {
      initialState() {
        return { order: ["a", "b", "c"], extra: false };
      }
      build() {
        const box = (name) => div(
          { key: name },
          div({ key: name + "Label" }, text({ key: name + "Text", text: name })),
          name === "c" && this.extra
            ? div({ key: "extra" }, text({ key: "extraText", text: "extra" }), div({ key: "inner" }, text({ key: "innerText", text: "inner" })))
            : null,
        );
        return flipAnimationContainer({ key: "flip" }, this.order.map(box));
      }
    }
    const boxes = new Boxes();
    boxes.renderOnto(new DOMElementTarget(container));
    const named = (name) => Array.from(container.querySelectorAll("div")).find((each) => each.textContent === name && each.firstChild.nodeType === 3);
    const c = named("c").parentNode;
    postponeInvalidations();
    boxes.order = ["c", "a", "b"];
    boxes.extra = true;
    continueInvalidations();
    const extra = named("inner").parentNode;
    const inner = named("inner");
    const offset = (element) => {
      const box = drawnAt(c);
      const at = drawnAt(element);
      return { x: round(at.x - box.x), y: round(at.y - box.y) };
    };
    const atRest = (element) => ({ x: layoutOf(element).x - layoutOf(c).x, y: layoutOf(element).y - layoutOf(c).y });
    assert.notDeepEqual(drawnAt(c), layoutOf(c), "the box is on its way");
    assert.deepEqual(offset(extra), atRest(extra), "the newcomer is where it belongs in it - not where it will be in the page");
    assert.deepEqual(offset(inner), atRest(inner), "and so is what's new in it");
    runFrames(10);
    assert.deepEqual(offset(extra), atRest(extra), "and stays there, all the way");
    assert.deepEqual(offset(inner), atRest(inner));
    assert.ok(Number(extra.style.opacity) > 0 && Number(extra.style.opacity) < 1, "fading in meanwhile");
    runToRest();
    assert.deepEqual(drawnAt(extra), layoutOf(extra));
  });

  it("a ghost in something shrinking goes along with it - its place in it shrinking with it - at its own size", function () {
    class Panel extends Component {
      initialState() {
        return { open: true };
      }
      build() {
        return flipAnimationContainer(
          { key: "flip" },
          div(
            { key: "panel", title: this.open ? "200" : "100" },
            div({ key: "label" }, text({ key: "labelText", text: "label" })),
            this.open ? div({ key: "more" }, text({ key: "moreText", text: "more" })) : null,
          ),
        );
      }
    }
    const panel = new Panel();
    panel.renderOnto(new DOMElementTarget(container));
    const named = (name) => Array.from(container.querySelectorAll("div")).find((each) => each.textContent === name && each.firstChild.nodeType === 3);
    const more = named("more");
    const box = more.parentNode;
    const before = drawn(more);
    panel.open = false;
    assert.equal(more.parentNode, box, "fading out in what it was in");
    // How far into the panel it is, as a part of the panel's drawn width,
    // and how large it's drawn.
    const measure = () => {
      const at = drawn(more);
      const corner = drawn(box);
      return { into: round((at.x - corner.x) / (layoutWidthOf(box) * corner.sx)), sx: round(at.sx), sy: round(at.sy) };
    };
    assert.deepEqual(drawnAt(more), { x: round(before.x), y: round(before.y) }, "drawn where it was");
    const start = measure();
    runFrames(10);
    assert.ok(box.style.transform !== "", "the panel is still shrinking");
    assert.deepEqual(measure(), start, "as far into the panel, for its size - and its own size");
    assert.deepEqual({ sx: start.sx, sy: start.sy }, { sx: 1, sy: 1 }, "not shrunk along");
  });

  describe("zoomAlong", function () {
    // A panel 200 wide with "more" in it, or 100 wide without.
    class Panel extends Component {
      initialState() {
        return { open: true };
      }
      build() {
        return flipAnimationContainer(
          { key: "flip", zoomAlong: true },
          div(
            { key: "panel", title: this.open ? "200" : "100" },
            div({ key: "label" }, text({ key: "labelText", text: "label" })),
            this.open ? div({ key: "more" }, text({ key: "moreText", text: "more" })) : null,
          ),
        );
      }
    }
    const named = (name) => Array.from(container.querySelectorAll("div")).find((each) => each.textContent === name && each.firstChild.nodeType === 3);
    // How much the panel is drawn larger than it was at `width`, uniformly
    // (its height doesn't change).
    const panelGrowth = (box, width) => Math.sqrt(layoutWidthOf(box) * drawn(box).sx / width);

    it("a ghost in something shrinking shrinks along with it", function () {
      const panel = new Panel();
      panel.renderOnto(new DOMElementTarget(container));
      const more = named("more");
      const box = more.parentNode;
      panel.open = false;
      assert.equal(round(drawn(more).sx), 1, "as large as it was, at first");
      runFrames(10);
      const growth = panelGrowth(box, 200);
      assert.ok(growth < 0.99, "the panel is shrinking");
      assert.equal(round(drawn(more).sx), round(growth), "and so is the ghost, as much");
      assert.equal(round(drawn(more).sy), round(growth), "uniformly");
    });

    it("a newcomer in something growing starts as small as that is drawn, and grows with it", function () {
      const panel = new Panel();
      panel.open = false;
      panel.renderOnto(new DOMElementTarget(container));
      const box = named("label").parentNode;
      panel.open = true;
      const more = named("more");
      const growth = () => panelGrowth(box, 200);
      assert.ok(growth() < 0.99, "the panel starts at its old size");
      assert.equal(round(drawn(more).sx), round(growth()), "and so, for its size, does the newcomer");
      runFrames(10);
      assert.equal(round(drawn(more).sx), round(growth()), "growing with it");
      runToRest();
      assert.equal(round(drawn(more).sx), 1, "at its own size, at rest");
    });
  });

  it("a leaving box with nothing to see of its own fades out as what's in it, each where it was drawn", function () {
    // A close-up's column: its title goes back to the tile, its details
    // leave - and the column, only a box around them, leaves too.
    class Tile extends Component {
      initialState() {
        return { open: true };
      }
      build() {
        const title = div({ key: "title" }, text({ key: "titleText", text: "title" }));
        return flipAnimationContainer(
          { key: "flip" },
          div(
            { key: "tile" },
            this.open
              ? div({ key: "column" }, title, div({ key: "details" }, text({ key: "detailsText", text: "details" })))
              : title,
          ),
        );
      }
    }
    const tile = new Tile();
    tile.renderOnto(new DOMElementTarget(container));
    const named = (name) => Array.from(container.querySelectorAll("div")).find((each) => each.textContent === name && each.firstChild.nodeType === 3);
    const details = named("details");
    const column = details.parentNode;
    const card = column.parentNode;
    const before = drawnAt(details);
    tile.open = false;
    assert.ok(!column.isConnected, "the box itself is gone at once");
    assert.equal(details.parentNode, card, "what was in it fades out on its own, where the box was");
    assert.equal(details.style.position, "absolute");
    assert.deepEqual(drawnAt(details), before, "exactly where it was drawn - not where the box would now lay it out");
    runToRest();
    assert.ok(!details.isConnected, "gone once faded");
  });

  it("a leaving element that comes back after it has faded out comes back as itself - no ghost style left on it - and fades in", function () {
    class Toggled extends Component {
      initialState() {
        return { show: true };
      }
      build() {
        return flipAnimationContainer(
          { key: "flip" },
          div({ key: "first" }, text({ key: "firstText", text: "first" })),
          div({ key: "middle", style: { color: "red" } }, text({ key: "middleText", text: "middle" })).showIf(this.show),
        );
      }
    }
    const toggled = new Toggled();
    toggled.renderOnto(new DOMElementTarget(container));
    const middle = Array.from(container.querySelectorAll("div")).find((each) => each.textContent === "middle");

    toggled.show = false;
    runToRest();
    assert.ok(!middle.isConnected, "faded out and gone");

    toggled.show = true;
    assert.ok(middle.isConnected, "the same element, back");
    assert.notEqual(middle.style.position, "absolute", "no ghost style left");
    assert.equal(middle.style.left, "");
    assert.equal(middle.style.pointerEvents, "");
    assert.equal(middle.style.color, "red", "its own style");
    assert.ok(Number(middle.style.opacity) < 0.05, "fading in");
    runToRest();
    assert.equal(middle.style.opacity, "");
    assert.equal(middle.style.position, "", "nor anything of its lift, once it has appeared");
    assert.equal(middle.style.zIndex, "");
    assert.deepEqual(drawnAt(middle), layoutOf(middle));
  });

  it("a leaving element that comes back while fading is restored, and moves on from where its ghost was", function () {
    class Toggled extends Component {
      initialState() {
        return { show: true };
      }
      build() {
        return flipAnimationContainer(
          { key: "flip" },
          div({ key: "first" }, text({ key: "firstText", text: "first" })),
          div({ key: "middle", style: { color: "red" } }, text({ key: "middleText", text: "middle" })).showIf(this.show),
          div({ key: "last" }, text({ key: "lastText", text: "last" })),
        );
      }
    }
    const toggled = new Toggled();
    toggled.renderOnto(new DOMElementTarget(container));
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
      initialState() {
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
    sized.renderOnto(new DOMElementTarget(container));
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
    class Island extends DOMNodeComponent {
      renderNode(target, existingElement) {
        const element = existingElement || document.createElement("output");
        target.reattachElement(element);
        element.textContent = this.key;
        return element;
      }
    }
    class WithIsland extends Component {
      initialState() {
        return { islandFirst: false };
      }
      build() {
        const island = new Island({ key: "island" });
        const other = div({ key: "other" }, text({ key: "otherText", text: "other" }));
        return flipAnimationContainer({ key: "flip" }, this.islandFirst ? [island, other] : [other, island]);
      }
    }
    const withIsland = new WithIsland();
    withIsland.renderOnto(new DOMElementTarget(container));
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
      initialState() {
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
    cards.renderOnto(new DOMElementTarget(container));
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

  it("a container's own speed overrides FlipAnimationContainer.speed - and changing it places nothing again", function () {
    class Paced extends Component {
      initialState() {
        return { a: ["one", "two", "three"], speed: 1 };
      }
      build() {
        const item = (name) => div({ key: name }, text({ key: name + "Text", text: name }));
        return flipAnimationContainer({ key: "flip", speed: this.speed }, div({ key: "listA" }, this.a.map(item)));
      }
    }
    const framesToRest = (speed) => {
      FlipAnimationContainer.speed = 1;
      container.innerHTML = "";
      const paced = new Paced();
      paced.renderOnto(new DOMElementTarget(container));
      paced.speed = speed;
      assert.equal(frames.length, 0, "a new speed alone animates nothing");
      paced.a = ["three", "one", "two"];
      let count = 0;
      while (frames.length > 0 && count < 1000) { runFrames(1); count++; }
      return count;
    };
    const full = framesToRest(1);
    const half = framesToRest(0.5);
    assert.ok(half > full * 1.7 && half < full * 2.3, "full speed " + full + " frames, half speed " + half);
  });

  it("a leaving island fades out showing what it showed - not as an empty box - and comes back as itself", function () {
    class Island extends DOMNodeComponent {
      renderNode(target, existingElement) {
        const element = existingElement || document.createElement("output");
        target.reattachElement(element);
        element.textContent = "island";
        return element;
      }
    }
    class WithIsland extends Component {
      initialState() {
        return { show: true };
      }
      build() {
        const other = div({ key: "other" }, text("other"));
        // Kept alive while hidden - so the same one comes back.
        return flipAnimationContainer({ key: "flip" }, other, new Island({ key: "island" }).showIf(this.show));
      }
    }
    const withIsland = new WithIsland();
    withIsland.renderOnto(new DOMElementTarget(container));
    const holder = container.querySelector("[data-flip-island]");

    withIsland.show = false;
    assert.equal(holder.style.position, "absolute", "a ghost");
    assert.equal(holder.textContent, "island", "showing its island's content");

    withIsland.show = true;
    assert.equal(container.querySelectorAll("output").length, 1, "back as itself: its own node, no copy left beside it");
    runToRest();
  });

  it("while the container isn't in the page, it just places - nothing animates", function () {
    const { lists, element } = setup();
    container.remove();
    lists.a = ["three", "two", "one"];
    assert.equal(element("three").style.transform, "");
    assert.equal(frames.length, 0);
  });
});

import { Component } from "@liquefy/cascade.component";
import { DOMElementTarget } from "../../../DOMElementTarget.js";
import { FlipAnimationContainer, flipAnimationContainer } from "../../../FlipAnimationContainer.js";
import { scrollArea } from "../../../ScrollArea.js";
import { div } from "../../../HTMLTags.js";

// What ../layout.js runs, in the page: each scenario builds something in
// a real layout, changes it, and returns what it measured - for the test
// to judge.

// Practically standing still at its first frame: what's measured right
// after a change is where everything starts from.
const frozen = 0.001;

const rectOf = (element) => {
  const rect = element.getBoundingClientRect();
  const round = (value) => Math.round(value * 10) / 10;
  return { x: round(rect.left), y: round(rect.top), width: round(rect.width), height: round(rect.height) };
};
const rects = (...ids) => Object.fromEntries(ids.map((id) => [id, rectOf(document.getElementById(id))]));
const frame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const box = (key, style, ...children) => div({ key, id: key, style: { background: "#ccc", minHeight: "30px", ...style } }, ...children);

function mount(hostStyle, state, build) {
  const host = document.createElement("div");
  Object.assign(host.style, { width: "600px", height: "400px", position: "relative", ...hostStyle });
  document.body.appendChild(host);
  class Application extends Component {
    initialState() {
      return state;
    }
    build() {
      return build(this);
    }
  }
  const application = new Application();
  application.renderOnto(new DOMElementTarget(host));
  return { application, host };
}

const centering = { display: "flex", alignItems: "center", justifyContent: "center" };

window.scenarios = {
  // A centered container; the widest and tallest of what's in it leaves.
  async centeredItemLeaves(position) {
    FlipAnimationContainer.speed = frozen;
    const { application } = mount(centering, { items: ["a", "wide", "b"] }, (application) =>
      flipAnimationContainer({ key: "flip", style: { position, padding: "10px" } },
        application.items.map((key) => box(key, { width: key === "wide" ? "300px" : "100px", marginBottom: "5px" }))));
    await frame();
    const before = rects("a", "b");
    application.items = ["a", "b"];
    return { before, atStart: rects("a", "b") };
  },

  // A centered container; one goes to another list as the container shrinks.
  async centeredTraveller(position) {
    FlipAnimationContainer.speed = frozen;
    const item = (key) => box(key, { width: "80px" });
    const { application } = mount(centering, { moved: false }, (application) =>
      flipAnimationContainer({ key: "flip", id: "flip", style: { position, padding: "10px" } },
        div({ key: "first", id: "first", style: { width: "100px" } }, application.moved ? [item("u")] : [item("t"), item("u")]),
        div({ key: "second", id: "second", style: { width: "100px" } }, application.moved ? [item("v"), item("t")] : [item("v")]),
        application.moved ? null : box("extra", { height: "120px", width: "300px" })));
    await frame();
    const before = rects("t", "u", "v");
    application.moved = true;
    const parent = document.getElementById("t").parentNode;
    return { before, atStart: rects("t", "u", "v"), raised: parent.id !== "first" && parent.id !== "second" };
  },

  // A container that isn't positioned, in a scroll area; its first item,
  // half out of view above, leaves.
  async ghostInScrollArea() {
    FlipAnimationContainer.speed = frozen;
    const { application, host } = mount({ width: "300px", marginTop: "100px" }, { items: ["a", "b", "c", "d", "e", "f"] }, (application) =>
      scrollArea({ style: { height: "200px" }, scrollStyle: { flex: 1 } },
        flipAnimationContainer({ key: "flip" }, application.items.map((key) => box(key, { height: "80px", marginBottom: "5px" })))));
    await frame();
    const scroller = host.querySelector("[data-scroll-area]");
    scroller.scrollTop = 40;
    await frame();
    const before = rectOf(document.getElementById("a"));
    application.items = ["b", "c", "d", "e", "f"];
    const ghost = document.getElementById("a");
    const atStart = rectOf(ghost);
    const top = scroller.getBoundingClientRect().top;
    // What's hit above the area, were the ghost there to hit.
    ghost.style.pointerEvents = "auto";
    const drawnAboveArea = document.elementFromPoint(50, top - 20) === ghost;
    scroller.scrollTop = 0;
    return { before, atStart, drawnAboveArea, movedWithScroll: rectOf(ghost).y - atStart.y };
  },

  // A scroll area as tall as it gets, its children 20px apart; more added.
  async scrollAreaChildrenAdded(inFlipAnimationContainer) {
    FlipAnimationContainer.speed = 1;
    const area = (application) => scrollArea(
      { key: "area", fade: 20, style: { height: "200px", width: "200px" }, scrollStyle: { display: "flex", flexDirection: "column", gap: "20px", flex: 1 } },
      application.items.map((key) => box(key, { height: "60px", flex: "none" })));
    const { application, host } = mount({}, { items: ["a", "b", "c", "d", "e"] }, (application) =>
      inFlipAnimationContainer ? flipAnimationContainer({ key: "flip" }, area(application)) : div({ key: "plain" }, area(application)));
    const scroller = () => host.querySelector("[data-scroll-area]");
    const thumb = () => host.querySelector("[data-scroll-indicator]");
    const read = () => ({
      scrollHeight: scroller().scrollHeight, clientHeight: scroller().clientHeight,
      thumbHeight: parseFloat(thumb().style.height), shown: thumb().style.scale !== "0 1",
      // How far the indicator's end is from the area's.
      fromBottom: Math.round(scroller().getBoundingClientRect().bottom - thumb().getBoundingClientRect().bottom),
    });
    await wait(300);
    const before = read();
    application.items = ["a", "b", "c", "d", "e", "x", "y", "z", "w"];
    // Until what was added has faded in, and nothing is on its way.
    await wait(1500);
    const added = read();
    scroller().scrollTop = 9999;
    await wait(400);
    return { before, added, atBottom: read() };
  },

  // A row whose items stretch to its height; one grows taller. In the one
  // beside it: something at its bottom, and something as tall as it.
  async stretchingSibling(speed = frozen) {
    FlipAnimationContainer.speed = speed;
    const { application } = mount({}, { tall: false }, (application) =>
      flipAnimationContainer({ key: "flip", style: { display: "flex", alignItems: "stretch", gap: "10px" } },
        box("grower", { width: "100px" }, box("inner", { height: application.tall ? "200px" : "100px", background: "#999" })),
        box("stretcher", { width: "100px", position: "relative", display: "flex" },
          box("full", { width: "20px", minHeight: 0, background: "#999" }),
          box("bottom", { position: "absolute", bottom: 0, right: 0, width: "20px", height: "20px", minHeight: 0, background: "#555" }))));
    await frame();
    const before = rects("stretcher", "full", "bottom");
    application.tall = true;
    const atStart = rects("stretcher", "full", "bottom");
    // On its way: each as it's drawn, frame by frame, until it's there.
    const onTheWay = [];
    for (let i = 0; i < 120 && speed !== frozen; i++) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      onTheWay.push(rects("stretcher", "full", "bottom"));
    }
    return { before, atStart, onTheWay };
  },

  // A centered container growing at both ends, around something that
  // stays exactly where it is on the page - while the container's corner,
  // and so where that's laid out, moves by fractions of a pixel. Slowly:
  // the test looks at what's painted, on the way.
  async stillInCenteredGrowing() {
    FlipAnimationContainer.speed = 0.1;
    const end = (key, tall) => box(key, { width: "100px", minHeight: 0, flex: "none", height: tall ? "41px" : "20px" });
    const { application } = mount(centering, { tall: false }, (application) =>
      flipAnimationContainer({ key: "flip", style: { display: "flex", flexDirection: "column" } },
        end("top", application.tall),
        box("still", { width: "100px", height: "30px", margin: "10px 0", background: "#555" }),
        end("bottom", application.tall)));
    await frame();
    const before = rectOf(document.getElementById("still"));
    application.tall = true;
    // Its upper edge, and what's above it: nothing else is drawn there.
    return { clip: { x: before.x + 10, y: before.y - 6, width: 20, height: 12 } };
  },

  // A column as wide as what's in it; that widens.
  async shrinkToFitWidens() {
    FlipAnimationContainer.speed = frozen;
    const { application } = mount({}, { wide: false }, (application) =>
      flipAnimationContainer({ key: "flip", style: { display: "inline-flex", flexDirection: "column", gap: "5px" } },
        box("sizer", { width: application.wide ? "300px" : "150px" }),
        box("filler", { alignSelf: "stretch" })));
    await frame();
    const before = rects("filler");
    application.wide = true;
    return { before, atStart: rects("filler") };
  },

  // A wrapping row, anchored by its right edge; one leaves, and the two
  // left lie side by side - in a row that's first drawn two rows tall.
  async wrappingRowItemLeaves() {
    FlipAnimationContainer.speed = frozen;
    const { application } = mount({}, { items: ["a", "b", "c"] }, (application) =>
      flipAnimationContainer({ key: "flip", style: { position: "absolute", right: 0, top: 0, display: "flex", flexWrap: "wrap", maxWidth: "250px", gap: "10px" } },
        application.items.map((key) => box(key, { width: "100px" }))));
    await frame();
    const before = rects("a", "c");
    application.items = ["a", "c"];
    return { before, atStart: rects("a", "c") };
  },

  // Two lists in one: split, the item first in it goes to the end of the
  // upper one - which scrolls, and is too short to show it: at rest, it's
  // beyond the upper list's edge, where the lower list is. What's visible
  // of it is read every frame while it's on its way, raised.
  async travellerIntoScrolledOut() {
    FlipAnimationContainer.speed = 1;
    const item = (key) => box(key, { height: "80px", marginBottom: "10px", flex: "none" });
    const { application } = mount({}, { split: false }, (application) =>
      flipAnimationContainer({ key: "flip", style: { height: "400px", display: "flex", flexDirection: "column" } },
        application.split
          ? [
            div({ key: "upper", id: "upper", style: { height: "100px", flex: "none", overflowY: "auto" } },
              div({ key: "upperList", id: "upperList" }, item("a"), item("b"), item("t"))),
            div({ key: "lower", id: "lower", style: { flex: "1 1 auto", overflowY: "auto" } },
              div({ key: "lowerList", id: "lowerList" }, item("c"))),
          ]
          : div({ key: "all", id: "all", style: { flex: "1 1 auto", overflowY: "auto" } },
            div({ key: "allList", id: "allList" }, item("t"), item("a"), item("b"), item("c")))));
    await frame();
    application.split = true;
    const upper = document.getElementById("upper").getBoundingClientRect();
    const frames = [];
    const started = performance.now();
    while (performance.now() - started < 2000) {
      const t = document.getElementById("t");
      const raised = t.parentNode.id !== "upperList";
      const rect = t.getBoundingClientRect();
      let top = rect.top;
      let bottom = rect.bottom;
      const polygon = /polygon\(([^)]*)\)/.exec(t.style.clipPath);
      if (raised && polygon) {
        const ys = polygon[1].split(",").map((point) => parseFloat(point.trim().split(/\s+/)[1]));
        const scale = t.offsetHeight > 0 ? rect.height / t.offsetHeight : 1;
        top = Math.max(top, rect.top + Math.min(...ys) * scale);
        bottom = Math.min(bottom, rect.top + Math.max(...ys) * scale);
      }
      frames.push({ raised, top, bottom: Math.max(top, bottom), restTop: rect.top });
      if (!raised && frames.some((each) => each.raised)) break;
      await frame();
    }
    return { upperBottom: upper.bottom, frames };
  },
};
window.ready = true;

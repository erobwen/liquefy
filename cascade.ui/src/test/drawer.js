import { JSDOM } from "jsdom";
import assert from "assert";
import { RenderContext, CompoundServiceLocator, Component, callback } from "@liquefy/cascade.component";
import { DOMElementTarget, DOMServiceLocator, div, text } from "@liquefy/cascade.dom";
import { drawer, drawers, drawerPanel, drawerBarSize, basicTheme, modalBackdropColor } from "../index.js";

// drawer(): a panel at an edge when open, just past it when closed - always
// there, inert while closed - with a backdrop when modal, a header with a
// chevron that closes it, and a handle that opens it. Not animated here
// (jsdom draws no frames): the panel is simply where it belongs.
describe("drawer", function () {
  beforeEach(function () {
    const dom = new JSDOM("<!DOCTYPE html><body></body>");
    global.document = dom.window.document;
  });

  function setup(properties = {}, initiallyOpen = false) {
    const calls = [];
    class Page extends Component {
      initialState() {
        return { open: initiallyOpen };
      }
      build() {
        return div(
          { style: { position: "relative" } },
          div(text("The page")),
          drawer(
            {
              open: this.open,
              close: callback("close", () => { calls.push("close"); this.open = false; }),
              onOpen: callback("open", () => { calls.push("open"); this.open = true; }),
              title: "Filters",
              animate: false,
              ...properties,
            },
            div({ class: "content" }, text("Inside")),
          ),
        );
      }
    }
    const host = document.createElement("div");
    document.body.appendChild(host);
    const page = new Page().establish();
    page.renderOnto(new DOMElementTarget(host), new RenderContext({ serviceLocator: new CompoundServiceLocator(new DOMServiceLocator(), basicTheme) }));
    const content = () => host.querySelector(".content");
    // The panel: what holds the content and is inert while closed - and
    // the element moving it, around it.
    const panel = () => content().closest("[data-flip-island]").parentNode.parentNode;
    const sheet = () => panel().parentNode;
    const backdrop = () => [...host.querySelectorAll("div")].find((each) => each.style.background === modalBackdropColor);
    const button = (title) => host.querySelector("button[title='" + title + "']");
    return { host, page, calls, content, panel, sheet, backdrop, button };
  }

  it("closed: the panel is there, just past its edge, inert and hidden - its content placed as one piece", function () {
    const { content, panel, sheet, backdrop } = setup({ modal: true });
    assert.ok(content(), "the content is built while closed");
    assert.ok(content().closest("[data-flip-island]"), "in an island");
    assert.ok(panel().hasAttribute("inert") || panel().inert, "inert");
    assert.equal(panel().getAttribute("aria-hidden"), "true");
    assert.ok(sheet().style.left.startsWith("calc("), "past the left edge: " + sheet().style.left);
    assert.ok(!backdrop(), "no backdrop while closed");
  });

  it("open, modal: at its edge, a backdrop behind it - which closes it when clicked", function () {
    const { calls, panel, sheet, backdrop } = setup({ modal: true }, true);
    assert.equal(sheet().style.left, "0px");
    assert.ok(!panel().hasAttribute("inert") && !panel().inert, "not inert");
    assert.equal(panel().getAttribute("aria-hidden"), null);
    assert.ok(backdrop(), "a backdrop");
    backdrop().click();
    assert.deepEqual(calls, ["close"]);
    assert.ok(sheet().style.left.startsWith("calc("), "slid away again");
    assert.ok(!backdrop(), "the backdrop gone");
  });

  it("not modal: no backdrop - closed by the header's chevron, pointing at its edge", function () {
    const { calls, sheet, backdrop, button, host } = setup({}, true);
    assert.ok(!backdrop());
    assert.ok(host.textContent.includes("Filters"), "the title");
    assert.ok(button("Close").textContent.includes("chevron_left"));
    button("Close").click();
    assert.deepEqual(calls, ["close"]);
    assert.ok(sheet().style.left.startsWith("calc("));
  });

  it("Escape in the panel closes it", function () {
    const { calls, content } = setup({}, true);
    content().dispatchEvent(new document.defaultView.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    assert.deepEqual(calls, ["close"]);
  });

  it("header: false - the content is the whole panel", function () {
    const { host, button } = setup({ header: false }, true);
    assert.ok(!host.textContent.includes("Filters"));
    assert.ok(!button("Close"));
  });

  it("collapsed to a handle: it opens it, and closes it again", function () {
    const { calls, button } = setup({ collapsed: "handle", header: false });
    assert.ok(button("Open").textContent.includes("chevron_right"), "pointing inwards");
    button("Open").click();
    assert.deepEqual(calls, ["open"]);
    assert.ok(button("Close").textContent.includes("chevron_left"), "now pointing at its edge");
    button("Close").click();
    assert.deepEqual(calls, ["open", "close"]);
  });

  it("collapsed to a bar: it grows from the bar into the panel - what the app shares between them, and the chevron, the same elements, moved", function () {
    let shortcuts = 0;
    const calls = [];
    class Page extends Component {
      initialState() {
        return { open: false };
      }
      build() {
        // In the bar while closed, beside the heading while open: one
        // component, keyed.
        const shared = div({ key: "shared", class: "shared", onclick: () => { shortcuts++; } }, text("S"));
        return div(
          { style: { position: "relative" } },
          drawer(
            {
              open: this.open, title: "Filters", collapsed: "bar", modal: true, animate: false,
              close: callback("close", () => { calls.push("close"); this.open = false; }),
              onOpen: callback("open", () => { calls.push("open"); this.open = true; }),
              bar: this.open ? null : [shared, div({ class: "barOnly" }, text("B"))],
            },
            div({ class: "heading" }, this.open ? shared : null, text("Heading")),
          ),
        );
      }
    }
    const host = document.createElement("div");
    document.body.appendChild(host);
    new Page().establish().renderOnto(new DOMElementTarget(host), new RenderContext({ serviceLocator: new CompoundServiceLocator(new DOMServiceLocator(), basicTheme) }));
    const shared = () => host.querySelector(".shared");
    const button = (title) => host.querySelector("button[title='" + title + "']");
    const sheet = () => button(button("Open") ? "Open" : "Close").closest("[style*='z-index: 0']");

    // Closed: the bar - at the edge, as thick as a bar, the chevron and
    // the app's bar in it, usable over the backdrop's place.
    assert.equal(sheet().style.left, "0px");
    assert.equal(sheet().style.width, drawerBarSize + "px");
    assert.ok(host.querySelector(".barOnly"));
    assert.ok(!host.querySelector(".heading"), "no content while closed");
    const element = shared();
    const chevron = button("Open");
    shared().click();
    assert.equal(shortcuts, 1, "a shortcut works while closed");

    // Open: the panel - at the edge still, its full size: the shared
    // element beside the heading, the chevron in the header.
    chevron.click();
    assert.deepEqual(calls, ["open"]);
    assert.equal(sheet().style.left, "0px");
    assert.equal(sheet().style.width, "300px");
    assert.equal(shared(), element, "the same element");
    assert.ok(shared().parentNode.classList.contains("heading"), "beside the heading");
    assert.ok(!host.querySelector(".barOnly"), "what's only in the bar gone");
    assert.equal(button("Close"), chevron, "the same chevron, now closing it");
    assert.ok(host.textContent.includes("Filters"), "in the header");

    button("Close").click();
    assert.deepEqual(calls, ["open", "close"]);
    assert.equal(shared(), element);
    assert.ok(!shared().parentNode.classList.contains("heading"), "back in the bar");
    assert.equal(sheet().style.width, drawerBarSize + "px");
  });

  it("collapsed to nothing (the default): no handle, no bar", function () {
    const { button } = setup({ header: false });
    assert.ok(!button("Open"));
  });

  it("from the right, top or bottom: placed by that edge, its size a width or a height", function () {
    for (const [side, edge, dimension] of [["right", "right", "width"], ["top", "top", "height"], ["bottom", "bottom", "height"]]) {
      const { sheet } = setup({ side, size: 240 }, true);
      assert.equal(sheet().style[edge], "0px", side);
      assert.equal(sheet().style[dimension], "240px", side);
    }
  });

  // What's in a drawer, with state of its own: how many times it was
  // clicked.
  class Counter extends Component {
    initialState() {
      return { count: 0 };
    }
    build() {
      return div({ class: "counter", onclick: () => { this.count++; } }, text("Clicked " + this.count));
    }
  }

  it("moved to another edge, open: the sheet it leaves closes, the new one opens - with the same content, its state kept", function () {
    class Page extends Component {
      initialState() {
        return { side: "left" };
      }
      initialUnobservables() {
        return { counter: new Counter().establish() };
      }
      build() {
        return div(
          { style: { position: "relative" } },
          drawer({ open: true, side: this.side, title: "Filters", animate: false }, this.unobservable.counter),
        );
      }
    }
    const host = document.createElement("div");
    document.body.appendChild(host);
    const page = new Page().establish();
    page.renderOnto(new DOMElementTarget(host), new RenderContext({ serviceLocator: new CompoundServiceLocator(new DOMServiceLocator(), basicTheme) }));
    const counter = () => host.querySelectorAll(".counter");
    const sheetOf = (element) => element.closest("[data-flip-island]").parentNode.parentNode.parentNode;
    counter()[0].click();
    counter()[0].click();
    const leftSheet = sheetOf(counter()[0]);
    assert.equal(leftSheet.style.left, "0px");

    page.side = "right";
    assert.equal(counter().length, 1, "shown once");
    assert.equal(counter()[0].textContent, "Clicked 2", "the same counter");
    const rightSheet = sheetOf(counter()[0]);
    assert.notEqual(rightSheet, leftSheet, "in another sheet");
    assert.equal(rightSheet.style.right, "0px", "open at the right edge");
    assert.ok(leftSheet.isConnected && leftSheet.style.left.startsWith("calc("), "the left one closed - still there");
    assert.ok(leftSheet.textContent.includes("Filters"), "looking as it did");
  });

  function setupTwo(modal) {
    const calls = [];
    class Page extends Component {
      initialState() {
        return { leftOpen: false, rightOpen: false };
      }
      build() {
        return div(
          { style: { position: "relative" } },
          drawers(
            { modal, animate: false },
            drawerPanel(
              { side: "left", open: this.leftOpen, title: "Pages", close: callback("closeLeft", () => { calls.push("left"); this.leftOpen = false; }) },
              div({ class: "pages" }, text("Pages")),
            ),
            drawerPanel(
              { side: "right", open: this.rightOpen, title: "Properties", close: callback("closeRight", () => { calls.push("right"); this.rightOpen = false; }) },
              div({ class: "properties" }, text("Properties")),
            ),
          ),
        );
      }
    }
    const host = document.createElement("div");
    document.body.appendChild(host);
    const page = new Page().establish();
    page.renderOnto(new DOMElementTarget(host), new RenderContext({ serviceLocator: new CompoundServiceLocator(new DOMServiceLocator(), basicTheme) }));
    const sheetOf = (selector) => host.querySelector(selector).closest("[data-flip-island]").parentNode.parentNode.parentNode;
    const backdrop = () => [...host.querySelectorAll("div")].find((each) => each.style.background === modalBackdropColor);
    return { host, page, calls, sheetOf, backdrop };
  }

  it("drawers(): a panel per edge, each opened and closed on its own", function () {
    const { page, calls, sheetOf, backdrop } = setupTwo(false);
    page.leftOpen = true;
    assert.equal(sheetOf(".pages").style.left, "0px");
    assert.ok(sheetOf(".properties").style.right.startsWith("calc("));
    page.rightOpen = true;
    assert.equal(sheetOf(".pages").style.left, "0px", "both open");
    assert.equal(sheetOf(".properties").style.right, "0px");
    assert.ok(!backdrop());
    sheetOf(".pages").querySelector("button[title='Close']").click();
    assert.deepEqual(calls, ["left"]);
    assert.ok(sheetOf(".pages").style.left.startsWith("calc("));
    assert.equal(sheetOf(".properties").style.right, "0px", "the other still open");
  });

  it("drawers(), modal: one backdrop behind them all, closing every open one", function () {
    const { page, calls, sheetOf, backdrop } = setupTwo(true);
    assert.ok(!backdrop());
    page.leftOpen = true;
    page.rightOpen = true;
    assert.equal([...document.querySelectorAll("div")].filter((each) => each.style.background === modalBackdropColor).length, 1, "one backdrop");
    backdrop().click();
    assert.deepEqual(calls.sort(), ["left", "right"]);
    assert.ok(sheetOf(".pages").style.left.startsWith("calc(") && sheetOf(".properties").style.right.startsWith("calc("));
    assert.ok(!backdrop());
  });
});

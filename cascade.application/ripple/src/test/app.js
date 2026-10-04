import assert from "assert";
import { JSDOM } from "jsdom";
import { RenderContext, CompoundServiceLocator } from "@liquefy/cascade.component";
import { DOMElementTarget, DOMServiceLocator, DOMDebugServiceLocator } from "@liquefy/cascade.dom";
import { basicTheme } from "@liquefy/cascade.ui";
import { Ripple } from "../Ripple.js";

// The whole app, started as index.js starts it - in jsdom, its canvas text
// measuring faked - to see it shows at all: what no test of its parts
// catches (a card given what it can't take, say, leaving the page white).

const browserGlobals = ["window", "document", "navigator", "HTMLElement", "Node", "Element", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame", "MutationObserver", "KeyboardEvent", "MouseEvent", "Event"];

describe("Ripple, the app", function () {
  let dom;
  const saved = {};

  before(function () {
    dom = new JSDOM("<!DOCTYPE html><body><div id=\"application\"></div></body>", { pretendToBeVisual: true });
    const w = dom.window;
    w.HTMLCanvasElement.prototype.getContext = () => ({
      font: "",
      measureText: (text) => ({ width: text.length * 7, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2, fontBoundingBoxAscent: 9, fontBoundingBoxDescent: 3 }),
    });
    for (const name of [...browserGlobals, "ResizeObserver"]) {
      saved[name] = Object.getOwnPropertyDescriptor(globalThis, name);
      const value = name === "ResizeObserver"
        ? (w.ResizeObserver || class { observe() {} unobserve() {} disconnect() {} })
        : typeof w[name] === "function" && !/^[A-Z]/.test(name) ? w[name].bind(w) : w[name];
      Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
    }
  });

  after(function () {
    for (const name of Object.keys(saved)) {
      if (saved[name]) Object.defineProperty(globalThis, name, saved[name]);
      else delete globalThis[name];
    }
    dom.window.close();
  });

  it("starts, and shows the test document - and its cards", function () {
    const serviceLocator = new CompoundServiceLocator(new DOMServiceLocator(), basicTheme, new DOMDebugServiceLocator());
    const element = document.getElementById("application");
    const ripple = new Ripple().establish();
    ripple.renderOnto(DOMElementTarget.forElement(element), new RenderContext({ serviceLocator }));
    const shown = element.textContent;
    assert.ok(shown.includes("A word processor where a document is"));
    assert.ok(shown.includes("Ripple"));
    assert.ok(shown.includes("Click in the document"));
    assert.ok(element.querySelectorAll("[data-page]").length >= 1);
    // Not disposed: as on the page, it lives as long as the page does - and
    // disposing it now has the layout place a paragraph again with no flow
    // to go on (sequence.next null): a teardown bug of its own, to look at.
  });
});

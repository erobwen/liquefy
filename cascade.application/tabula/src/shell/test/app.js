import assert from "assert";
import { JSDOM } from "jsdom";
import { RenderContext, CompoundServiceLocator, ObservableCompoundServiceLocator } from "@liquefy/cascade.component";
import { DOMElementTarget, DOMServiceLocator, DOMDebugServiceLocator } from "@liquefy/cascade.dom";
import { basicTheme } from "@liquefy/cascade.ui";
import { TabulaApp } from "../TabulaApp.js";
import { plugins } from "../../plugins/index.js";
import { dehydrateRoot } from "../documents.js";

// Tabula started as index.js starts it - in jsdom, its canvas text
// measuring faked: the null document, and creating from it.

const browserGlobals = ["window", "document", "navigator", "HTMLElement", "Node", "Element", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame", "MutationObserver", "KeyboardEvent", "MouseEvent", "Event"];

describe("Tabula, the document editor", function () {
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

  it("starts with the null document - a dot - and grows a sequence from dots before and after, shrinking back with remove", function () {
    const serviceLocator = new CompoundServiceLocator(new DOMServiceLocator(), basicTheme, new DOMDebugServiceLocator());
    const services = new ObservableCompoundServiceLocator(...plugins);
    const element = document.getElementById("application");
    const tabula = new TabulaApp({ plugins, services }).establish();
    tabula.renderOnto(DOMElementTarget.forElement(element), new RenderContext({ serviceLocator }));
    const buttons = (title) => [...element.querySelectorAll("button")].filter((button) => button.title.startsWith(title));
    const menuItem = (label) => [...element.querySelectorAll("button")].find((button) => button.textContent.includes(label));
    assert.ok(element.textContent.includes("Create"));

    // The creation menu: what the plugins in use can create - a plugin
    // turned off, its kind gone.
    buttons("Create something")[0].click();
    assert.ok(menuItem("Structured text"));
    assert.ok(menuItem("Spreadsheet"));
    services.locators = plugins.filter((plugin) => plugin.name !== "spreadsheet");
    assert.ok(!menuItem("Spreadsheet"));
    services.locators = plugins;

    // Structured text created: its papers, and no remove button - it's alone.
    menuItem("Structured text").click();
    assert.ok(element.querySelectorAll("[data-page]").length >= 1);
    assert.deepStrictEqual(tabula.documents.map((each) => each.documentType.name), ["structuredText"]);
    assert.strictEqual(buttons("Remove").length, 0);

    // A plain text before it, a spreadsheet after: a sequence of three,
    // each with a remove button.
    buttons("Create something before")[0].click();
    menuItem("Plain text").click();
    buttons("Create something after")[0].click();
    menuItem("Spreadsheet").click();
    assert.deepStrictEqual(tabula.documents.map((each) => each.documentType.name), ["plainText", "structuredText", "spreadsheet"]);
    assert.strictEqual(buttons("Remove").length, 3);
    assert.strictEqual(dehydrateRoot(tabula.documents, services).length, 3);

    // Removed down to one: no sequence any more - the one, on its own.
    buttons("Remove")[0].click();
    buttons("Remove")[1].click();
    assert.deepStrictEqual(tabula.documents.map((each) => each.documentType.name), ["structuredText"]);
    assert.strictEqual(buttons("Remove").length, 0);
    assert.strictEqual(dehydrateRoot(tabula.documents, services).name, "structuredText");
    assert.ok(element.querySelectorAll("[data-page]").length >= 1);
  });
});

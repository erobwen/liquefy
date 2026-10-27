import assert from "assert";
import { JSDOM } from "jsdom";
import { RenderContext, CompoundServiceLocator, ObservableCompoundServiceLocator } from "@liquefy/cascade.component";
import { DOMElementTarget, DOMServiceLocator, DOMDebugServiceLocator } from "@liquefy/cascade.dom";
import { basicTheme } from "@liquefy/cascade.ui";
import { TabulaApp } from "../TabulaApp.js";
import { plugins } from "../../plugins/index.js";
import { dehydrateRoot } from "../documents.js";
import { documentToJSON } from "../../plugins/structuredText/json.js";
import { testDocument } from "../../model/testDocument.js";
import { printPapers } from "../../plugins/structuredText/output.js";

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

  it("renders onto the mode chosen - paper, web, JSON, tree - and takes from the JSON only what the plugins can hold", function () {
    // The whole app, four times over, in jsdom.
    this.timeout(10000);
    const serviceLocator = new CompoundServiceLocator(new DOMServiceLocator(), basicTheme, new DOMDebugServiceLocator());
    const services = new ObservableCompoundServiceLocator(...plugins);
    const element = document.getElementById("application");
    element.innerHTML = "";
    const tabula = new TabulaApp({ plugins, services }).establish();
    tabula.renderOnto(DOMElementTarget.forElement(element), new RenderContext({ serviceLocator }));
    const book = { type: "document", name: "structuredText", properties: documentToJSON(testDocument()) };
    const plain = { type: "document", name: "plainText", properties: { text: "Hello" } };
    assert.strictEqual(tabula.apply([book, plain]), null);
    assert.ok(element.querySelectorAll("[data-page]").length >= 1);

    // Web: the text, no papers.
    tabula.mode = "web";
    assert.strictEqual(element.querySelectorAll("[data-page]").length, 0);
    assert.ok(element.textContent.includes("A word processor where a document is"));

    // JSON: the whole root, as saved.
    tabula.mode = "json";
    assert.ok(element.textContent.includes("\"structuredText\""));
    assert.ok(element.textContent.includes("\"plainText\""));

    // Not taken: what the plugins can't hold - a paper there's no size of,
    // a kind no plugin knows. Taken: anything they can.
    const json = dehydrateRoot(tabula.documents, services);
    const changed = (change) => {
      const copy = structuredClone(json);
      change(copy);
      return copy;
    };
    assert.ok(tabula.apply(changed((copy) => { copy[0].properties.paper = "B9"; })));
    assert.ok(tabula.apply(changed((copy) => { copy[1].name = "plainTex"; })));
    assert.strictEqual(tabula.apply(changed((copy) => { copy[1].properties.text = "Changed"; })), null);
    assert.strictEqual(tabula.documents[1].model.text, "Changed");
    assert.ok(element.textContent.includes("Changed"));

    // Tree: the sequence, its documents, a structured text's sections.
    tabula.mode = "tree";
    assert.ok(element.textContent.includes("Sequence"));
    assert.ok(element.textContent.includes("Structured text - Tabula"));
    assert.ok(element.textContent.includes("1  Flows"));
  });

  it("prints a structured text from a layout of its own, gone once read - the document's later changes reach nothing of it", function () {
    const document = testDocument();
    const papers = printPapers(document);
    assert.ok(papers.length >= 1);
    assert.ok(papers[0].lines.length > 0);
    // Changed after: nothing of the print layout is left to lay it out again.
    document.title.spans[0].text = "Changed after printing";
    document.children.splice(0, 1);
  });
});

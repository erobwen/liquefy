import { JSDOM } from "jsdom";
import assert from "assert";
import { observable } from "@liquefy/cascade.component";
import { DOMElementTarget } from "@liquefy/cascade.dom";
import { PrintDocument } from "../PrintDocument.js";
import { PaperSequence } from "../PaperSequence.js";
import { DocumentEditor } from "../dom/DocumentEditor.js";
import { margins } from "../units.js";

// As in pagination.js: 10 characters across, 4 lines down - a paper 12 x 22
// mm, drawn (see the bounding rect below) a pixel to the millimeter.
const measurer = {
  measure: (text) => text.length * 1000,
  metrics: () => ({ ascent: 4000, descent: 1000 }),
};

const paragraph = (text) => observable({ style: "Normal", spans: observable([observable({ text })]) });

describe("DocumentEditor", function () {
  let window;
  let container;

  beforeEach(function () {
    const dom = new JSDOM("<!DOCTYPE html><body></body>");
    window = dom.window;
    global.document = window.document;
    container = document.createElement("div");
    document.body.appendChild(container);
    // jsdom lays nothing out: a paper is where its index says, 12 x 22 px.
    window.Element.prototype.getBoundingClientRect = function () {
      const page = this.getAttribute && this.getAttribute("data-page");
      const top = page === null ? 0 : Number(page) * 30;
      return { left: 0, top, width: page === null ? 0 : 12, height: page === null ? 0 : 22, right: 12, bottom: top + 22 };
    };
  });

  function edit(paragraphs) {
    const document = observable({
      styles: observable({ paragraph: { Normal: {} } }),
      sections: observable([observable({ paper: { width: 12000, height: 22000 }, margins: margins(1000), paragraphs: observable(paragraphs) })]),
    });
    const sequence = new PaperSequence();
    new PrintDocument({ document, measurer }).renderOnto(sequence);
    const editor = new DocumentEditor({ document, sequence, measurer }).establish();
    editor.renderOnto(new DOMElementTarget(container));
    return document;
  }

  const textarea = () => container.querySelector("textarea");
  const caret = () => container.querySelector("[data-caret]");
  const lines = (page = 0) => [...container.querySelectorAll("[data-page='" + page + "'] span")].map((span) => span.textContent);

  function click(page, x, y) {
    const paper = container.querySelector("[data-page='" + page + "']");
    paper.dispatchEvent(new window.MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: page * 30 + y }));
  }

  function type(text) {
    textarea().value = text;
    textarea().dispatchEvent(new window.Event("input", { bubbles: true }));
  }

  function press(key, options = {}) {
    textarea().dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...options }));
  }

  it("drops a caret where the papers are clicked, and types there", function () {
    const first = paragraph("aaaa bbbb");
    edit([first]);
    assert.equal(caret(), null);
    click(0, 3, 2);
    assert.equal(document.activeElement, textarea());
    assert.equal(caret().style.left, "3mm");
    assert.equal(caret().style.top, "1mm");

    type("XY");
    assert.equal(first.spans[0].text, "aaXYaa bbbb");
    assert.deepEqual(lines(), ["aaXYaa ", "bbbb"].map((line) => line.trimEnd()));
    assert.equal(caret().style.left, "5mm");
  });

  it("deletes, splits paragraphs with Enter, and moves with the keys", function () {
    const first = paragraph("aaaa");
    const document = edit([first, paragraph("bbbb")]);
    click(0, 5, 2);
    press("Backspace");
    assert.deepEqual(lines(), ["aaa", "bbbb"]);
    press("Enter");
    assert.deepEqual(lines(), ["aaa", "bbbb"]);
    assert.equal(document.sections[0].paragraphs.length, 3);
    assert.equal(caret().style.top, "6mm");
    type("c");
    assert.deepEqual(lines(), ["aaa", "c", "bbbb"]);
    press("ArrowDown");
    assert.equal(caret().style.top, "11mm");
    press("Home");
    press("Delete");
    assert.deepEqual(lines(), ["aaa", "c", "bbb"]);
    press("ArrowLeft");
    press("Backspace");
    assert.deepEqual(lines(), ["aaa", "bbb"]);
    press("End", { ctrlKey: true });
    assert.equal(caret().style.left, "4mm");
  });

  it("hides the caret while the editor doesn't have the keyboard", function () {
    edit([paragraph("aaaa")]);
    click(0, 3, 2);
    assert.ok(caret());
    textarea().blur();
    assert.equal(caret(), null);
    textarea().focus();
    assert.ok(caret());
  });

  it("follows the caret onto the next paper when the text grows past the end of one", function () {
    const first = paragraph("aaaa");
    edit([first, paragraph("b"), paragraph("c"), paragraph("d")]);
    click(0, 11, 2);
    type(" aaaa aaaa");
    assert.deepEqual(lines(0), ["aaaa aaaa", "aaaa", "b", "c"]);
    assert.deepEqual(lines(1), ["d"]);
    press("ArrowDown");
    press("ArrowDown");
    press("ArrowDown");
    assert.equal(container.querySelector("[data-page='1'] [data-caret]") !== null, true);
  });
});

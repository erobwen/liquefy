import { JSDOM } from "jsdom";
import assert from "assert";
import { observable } from "@liquefy/cascade.component";
import { DOMElementTarget } from "@liquefy/cascade.dom";
import { PrintDocument } from "../PrintDocument.js";
import { PaperSequence } from "../PaperSequence.js";
import { PaperSequenceView } from "../dom/PaperSequenceView.js";
import { margins } from "../units.js";

// As in pagination.js: 10 characters across, 4 lines down.
const measurer = {
  measure: (text) => text.length * 1000,
  metrics: () => ({ ascent: 4000, descent: 1000 }),
};

const paragraph = (text) => observable({ style: "Normal", spans: observable([observable({ text })]) });

describe("PaperSequenceView", function () {
  let container;

  beforeEach(function () {
    const dom = new JSDOM("<!DOCTYPE html><body></body>");
    global.document = dom.window.document;
    container = document.createElement("div");
  });

  // Laid out and shown as two roots of their own - the view reading the
  // paper sequence the layout renders onto, as an app does.
  function show(paragraphs) {
    const document = observable({
      styles: observable({ paragraph: { Normal: { font: { family: "Georgia", size: 12 } } } }),
      sections: observable([observable({ paper: { width: 12000, height: 22000 }, margins: margins(1000), paragraphs: observable(paragraphs) })]),
    });
    const sequence = new PaperSequence();
    new PrintDocument({ document, measurer }).renderOnto(sequence);
    new PaperSequenceView({ sequence }).renderOnto(new DOMElementTarget(container));
    return document;
  }

  const papers = () => [...container.firstChild.children];
  const runs = (paper) => [...paper.children].map((span) => span.textContent + "@" + span.style.top);

  it("shows every paper at its real size, with its text on the lines' baselines", function () {
    show([paragraph("aaaa bbbb cccc")]);
    const [paper] = papers();
    assert.equal(paper.style.width, "12mm");
    assert.equal(paper.style.height, "22mm");
    assert.deepEqual(runs(paper), ["aaaa bbbb@1mm", "cccc@6mm"]);
    const [first] = paper.children;
    assert.equal(first.style.left, "1mm");
    assert.equal(first.style.lineHeight, "5mm");
    assert.equal(first.style.fontFamily, "Georgia");
    assert.equal(first.style.fontSize, "12pt");
  });

  it("follows edits - onto a new paper, and back", function () {
    const edited = paragraph("aaaa");
    show([edited, paragraph("bbbb"), paragraph("cccc"), paragraph("dddd")]);
    assert.equal(papers().length, 1);
    const firstPaper = papers()[0];

    edited.spans[0].text = "aaaa aaaa aaaa";
    assert.equal(papers().length, 2);
    assert.equal(papers()[0], firstPaper);
    assert.deepEqual(runs(papers()[0]), ["aaaa aaaa@1mm", "aaaa@6mm", "bbbb@11mm", "cccc@16mm"]);
    assert.deepEqual(runs(papers()[1]), ["dddd@1mm"]);

    edited.spans[0].text = "aaaa";
    assert.equal(papers().length, 1);
    assert.deepEqual(runs(papers()[0]), ["aaaa@1mm", "bbbb@6mm", "cccc@11mm", "dddd@16mm"]);
  });
});

import assert from "assert";
import { repeat, retractRepeater, ObservableCompoundServiceLocator } from "@liquefy/cascade.component";
import { mm, paperSizes, margins, PaperSequence, monospaceMeasurer } from "../../print/index.js";
import { document, paragraph, sequence } from "../flows.js";
import { PageLayout, PageElement, pageKind, elementRect, placeElement, pageElements, isVerso } from "../pageLayout.js";
import { SequenceLayout } from "../../layout/DocumentLayout.js";
import { structuredTextPlugin, structuredText } from "../../plugins/structuredText/index.js";
import { framesPlugin, shape, pageNumber } from "../../plugins/frames/index.js";
import { createDocument, hydrateDocument, dehydrateDocument, HydratedDocument } from "../../shell/documents.js";
import { newElement } from "../../paper/PageLayoutEditor.js";
import { pagesInDocuments } from "../../paper/PageElementView.js";

const a4 = paperSizes.A4;
const letter = paperSizes.letter;

describe("A page layout", function () {
  it("has a first page, a last, and middle pages between - one page being a first page only", function () {
    assert.deepEqual([0, 1, 2, 3].map((index) => pageKind(index, 4)), ["first", "middle", "middle", "last"]);
    assert.deepEqual([pageKind(0, 2), pageKind(1, 2)], ["first", "last"]);
    assert.equal(pageKind(0, 1), "first");
  });

  it("measures an element from the edges nearest it - so it keeps its place on paper of another size", function () {
    const element = new PageElement({ content: null, width: mm(40), height: mm(10) });
    // Near the bottom right corner of A4: from the right and the bottom.
    placeElement(element, { x: a4.width - mm(60), top: a4.height - mm(30), width: mm(40), height: mm(10) }, a4);
    assert.deepEqual([element.horizontal, element.x, element.vertical, element.y], ["right", mm(20), "bottom", mm(20)]);
    // On Letter: as far from the same edges.
    const onLetter = elementRect(element, letter);
    assert.deepEqual(onLetter, { x: letter.width - mm(60), top: letter.height - mm(30), width: mm(40), height: mm(10) });
    // Near the top left: from the left and the top.
    placeElement(element, { x: mm(15), top: mm(12), width: mm(40), height: mm(10) }, a4);
    assert.deepEqual([element.horizontal, element.x, element.vertical, element.y], ["left", mm(15), "top", mm(12)]);
  });

  it("makes a new element as wide as asked, as tall as its kind's proportions, centred where it's put", function () {
    const element = newElement(createDocument(pageNumber), a4, { x: a4.width / 2, y: a4.height - mm(15) });
    assert.deepEqual([element.width, element.height], [mm(50), mm(12.5)]);
    const rect = elementRect(element, a4);
    assert.equal(rect.x + rect.width / 2, a4.width / 2);
    assert.equal(rect.top + rect.height / 2, a4.height - mm(15));
    assert.equal(element.vertical, "bottom");
  });

  it("is the document's - its margins what the text flows in, and each page told which it is", function () {
    const number = new PageElement({ content: createDocument(pageNumber), horizontal: "right", x: mm(10), vertical: "bottom", y: mm(10), width: mm(20), height: mm(5) });
    const band = new PageElement({ content: createDocument(shape), x: 0, y: 0, width: a4.width, height: mm(20) });
    const pageLayout = new PageLayout({ margins: margins(mm(30)), first: [band], middle: [number], last: [number] });
    const doc = document({ title: "D", paper: a4, pageLayout }, ...Array.from({ length: 200 }, (_, index) => paragraph("Paragraph " + index)));
    const seq = new PaperSequence();
    const layout = new SequenceLayout({ sequence: sequence(doc), measurer: monospaceMeasurer() }).establish();
    const root = repeat(() => layout.renderOnto(seq), { independent: true });
    try {
      const count = seq.pages.length;
      assert.ok(count >= 3);
      assert.equal(seq.pages[0].pageLayout, pageLayout);
      assert.equal(seq.linesOf(0)[1].x, mm(30));
      assert.deepEqual(pagesInDocuments(seq.pages).map(({ index }) => index), Array.from({ length: count }, (_, index) => index));
      assert.deepEqual(pageElements(pageLayout, 0, count, a4).map(({ element }) => element), [band]);
      assert.deepEqual(pageElements(pageLayout, count - 1, count, a4).map(({ rect }) => rect.x), [a4.width - mm(30)]);
      // New margins: the text flows anew.
      pageLayout.margins = margins(mm(10));
      assert.equal(seq.linesOf(0)[1].x, mm(10));
    } finally {
      retractRepeater(root);
      layout.dispose();
    }
  });

  it("is saved with the document - what's on the pages by its own plugins - and loaded back", function () {
    const services = new ObservableCompoundServiceLocator(structuredTextPlugin, framesPlugin);
    const element = new PageElement({ content: createDocument(shape), horizontal: "right", x: mm(5), vertical: "top", y: mm(5), width: mm(30), height: mm(10) });
    const doc = document({ title: "D", paper: a4, pageLayout: new PageLayout({ margins: margins(mm(25)), first: [element] }) }, paragraph("x"));
    const json = JSON.parse(JSON.stringify(dehydrateDocument(new HydratedDocument(structuredText, doc))));
    const layout = json.properties.pageLayout;
    assert.deepEqual([layout.type, layout.name, layout.properties.margins], ["pageLayout", "pages", margins(mm(25))]);
    assert.deepEqual(layout.properties.first[0], {
      type: "pageElement", name: "element",
      properties: {
        horizontal: "right", x: mm(5), vertical: "top", y: mm(5), width: mm(30), height: mm(10),
        content: { type: "document", name: "shape", properties: { fill: "#4285f4", to: null, angle: 135, rounded: false } },
      },
    });
    assert.deepEqual([layout.properties.middle, layout.properties.last], [[], []]);
    const back = hydrateDocument(json, services);
    assert.equal(back.model.pageLayout.first[0].content.documentType, shape);
    assert.deepEqual(back.model.pageLayout.margins, margins(mm(25)));
    assert.deepEqual(JSON.parse(JSON.stringify(dehydrateDocument(back))), json);
  });

  it("printed on both sides, faces pages to each other: every second page mirrored - its inner margin by the binding, on the right", function () {
    const number = new PageElement({ content: createDocument(pageNumber), horizontal: "right", x: mm(10), vertical: "bottom", y: mm(10), width: mm(20), height: mm(5) });
    const pageLayout = new PageLayout({ margins: { top: mm(20), bottom: mm(20), left: mm(30), right: mm(15) }, duplex: true, middle: [number], last: [number] });
    const doc = document({ title: "D", paper: a4, pageLayout }, ...Array.from({ length: 200 }, (_, index) => paragraph("Paragraph " + index)));
    const seq = new PaperSequence();
    const layout = new SequenceLayout({ sequence: sequence(doc), measurer: monospaceMeasurer() }).establish();
    const root = repeat(() => layout.renderOnto(seq), { independent: true });
    try {
      assert.ok(seq.pages.length >= 3);
      assert.deepEqual(seq.pages.slice(0, 3).map((format) => format.side), ["recto", "verso", "recto"]);
      // The inner margin - "left" - on the left of a right-hand page, on the
      // right of a left-hand one: the lines there from the outer margin.
      assert.deepEqual(seq.pages.slice(0, 2).map((format) => [format.margins.left, format.margins.right]), [[mm(30), mm(15)], [mm(15), mm(30)]]);
      assert.equal(seq.linesOf(0)[1].x, mm(30));
      assert.equal(seq.linesOf(1)[0].x, mm(15));
      // Everything measured from the outer side ("right"): there on both.
      const corner = (index) => pageElements(pageLayout, index, seq.pages.length, a4)[0].rect.x;
      assert.equal(corner(1), mm(10), "on a left-hand page, the outer side is the left");
      assert.equal(corner(2), a4.width - mm(10) - mm(20));
      assert.deepEqual([isVerso(pageLayout, 1), isVerso(pageLayout, 2)], [true, false]);
      // One-sided again: every page as the first.
      pageLayout.duplex = false;
      assert.ok(seq.pages.every((format) => !format.side && format.margins.left === mm(30)));
    } finally {
      retractRepeater(root);
      layout.dispose();
    }
  });

  it("places an element on a left-hand page as it's shown there, mirrored - measured from the edge nearest it, inner or outer", function () {
    const element = new PageElement({ content: null, width: mm(40), height: mm(10) });
    // Shown near the left edge of a left-hand page: the outer side - "right".
    placeElement(element, { x: mm(12), top: mm(12), width: mm(40), height: mm(10) }, a4, true);
    assert.deepEqual([element.horizontal, element.x], ["right", mm(12)]);
    assert.equal(elementRect(element, a4, true).x, mm(12));
    assert.equal(elementRect(element, a4).x, a4.width - mm(52), "on a right-hand page: the outer side on the right");
  });

  it("is saved double-sided, if it is - and only then", function () {
    const services = new ObservableCompoundServiceLocator(structuredTextPlugin, framesPlugin);
    const doc = document({ title: "D", paper: a4, pageLayout: new PageLayout({ margins: margins(mm(25)), duplex: true }) }, paragraph("x"));
    const json = JSON.parse(JSON.stringify(dehydrateDocument(new HydratedDocument(structuredText, doc))));
    assert.equal(json.properties.pageLayout.properties.duplex, true);
    assert.equal(hydrateDocument(json, services).model.pageLayout.duplex, true);
    doc.pageLayout.duplex = false;
    assert.equal(dehydrateDocument(new HydratedDocument(structuredText, doc)).properties.pageLayout.properties.duplex, undefined);
  });
});

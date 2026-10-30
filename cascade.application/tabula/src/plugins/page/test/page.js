import assert from "assert";
import { repeat, retractRepeater, ObservableCompoundServiceLocator } from "@liquefy/cascade.component";
import { PaperSequence, monospaceMeasurer, paperSizes, margins, mm } from "../../../print/index.js";
import { document, paragraph, sequence as sequenceOf } from "../../../model/flows.js";
import { InnerSequence } from "../../../model/sequences.js";
import { PageLayout } from "../../../model/pageLayout.js";
import { SequenceLayout } from "../../../layout/DocumentLayout.js";
import { hydrateDocument, dehydrateDocument, createDocument, rootDocumentTypes } from "../../../shell/documents.js";
import { structuredTextPlugin } from "../../structuredText/index.js";
import { framesPlugin, pageNumber } from "../../frames/index.js";
import { pagePlugin, page, imagePage } from "../index.js";
import { newElement } from "../../../paper/PageLayoutEditor.js";

const services = new ObservableCompoundServiceLocator(structuredTextPlugin, pagePlugin, framesPlugin);

describe("A page of its own", function () {
  it("is what an Image creates at the top level - a page, a picture across it", function () {
    const made = createDocument(imagePage);
    assert.equal(made.documentType, page);
    const [element] = made.model.pageLayout.first;
    assert.equal(element.content.documentType.name, "image");
    assert.equal(element.width, paperSizes.A4.width - mm(40));
  });

  it("is among what the creation dots create - pictures, shapes and page numbers aren't: they're on pages", function () {
    const names = rootDocumentTypes(services).map((type) => type.name);
    assert.deepEqual(names, ["structuredText", "page", "imagePage"]);
  });

  it("is saved as its paper and what's on it - and loaded again", function () {
    const made = createDocument(page);
    made.model.paper = Object.freeze({ width: paperSizes.A4.height, height: paperSizes.A4.width });
    made.model.pageLayout.first.push(newElement(createDocument(pageNumber), made.model.paper, { x: mm(100), y: mm(190) }));
    const json = JSON.parse(JSON.stringify(dehydrateDocument(made)));
    assert.deepEqual(json.properties.paper, { width: paperSizes.A4.height, height: paperSizes.A4.width });
    assert.equal(json.properties.elements[0].properties.content.name, "pageNumber");
    const back = hydrateDocument(json, services);
    assert.equal(back.documentType, page);
    assert.equal(back.model.pageLayout.first[0].content.documentType, pageNumber);
    assert.deepEqual(JSON.parse(JSON.stringify(dehydrateDocument(back))), json);
  });

  it("among pages of their own, is on the paper of the document it's in - numbered as it falls", function () {
    const pageLayout = new PageLayout({ margins: margins(mm(20)), duplex: true });
    const doc = document({ title: "Book", paper: paperSizes.A4, pageLayout }, paragraph("text"));
    const cover = createDocument(imagePage);
    cover.model.paper = paperSizes.letter;
    doc.before = new InnerSequence([cover, createDocument(page)]);
    const seq = new PaperSequence();
    const layout = new SequenceLayout({ sequence: sequenceOf(doc), measurer: monospaceMeasurer() }).establish();
    const root = repeat(() => layout.renderOnto(seq), { independent: true });
    try {
      const [insert] = seq.inserts;
      const laidOut = insert.items.map(({ pages }) => [pages.pages[0].width, pages.pages[0].side, pages.numberOf(0)]);
      assert.deepEqual(laidOut, [[paperSizes.A4.width, "recto", 1], [paperSizes.A4.width, "verso", 2]]);
      assert.equal(seq.numberOf(0), 3, "the title's page after them");
      // Keeping its own paper: its own size - one-sided, as its own is.
      cover.model.ownPaper = true;
      assert.deepEqual([insert.items[0].pages.pages[0].width, insert.items[0].pages.pages[0].side], [paperSizes.letter.width, undefined]);
    } finally {
      retractRepeater(root);
      layout.dispose();
    }
  });
});

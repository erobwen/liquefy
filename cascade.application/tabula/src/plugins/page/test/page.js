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

  it("is saved as what's on it - and its own page settings, if it has any - and loaded again", function () {
    const made = createDocument(page);
    assert.deepEqual(Object.keys(dehydrateDocument(made).properties.pageLayout.properties), ["first", "middle", "last"], "on the file's paper");
    made.model.pageLayout.landscape = true;
    made.model.pageLayout.first.push(newElement(createDocument(pageNumber), paperSizes.A4, { x: mm(100), y: mm(190) }));
    const json = JSON.parse(JSON.stringify(dehydrateDocument(made)));
    assert.equal(json.properties.pageLayout.properties.landscape, true);
    assert.equal(json.properties.pageLayout.properties.first[0].properties.content.name, "pageNumber");
    const back = hydrateDocument(json, services);
    assert.equal(back.documentType, page);
    assert.equal(back.model.pageLayout.first[0].content.documentType, pageNumber);
    assert.deepEqual(JSON.parse(JSON.stringify(dehydrateDocument(back))), json);
  });

  it("among pages of their own, is on the paper of the document it's in - numbered as it falls", function () {
    const pageLayout = new PageLayout({ margins: margins(mm(20)), duplex: true });
    const doc = document({ title: "Book", paper: paperSizes.A4, pageLayout }, paragraph("text"));
    const cover = createDocument(imagePage);
    const second = createDocument(page);
    doc.before = new InnerSequence([cover, second]);
    const seq = new PaperSequence();
    const layout = new SequenceLayout({ sequence: sequenceOf(doc), measurer: monospaceMeasurer() }).establish();
    const root = repeat(() => layout.renderOnto(seq), { independent: true });
    try {
      const [insert] = seq.inserts;
      const laidOut = insert.items.map(({ pages }) => [pages.pages[0].width, pages.pages[0].side, pages.numberOf(0)]);
      assert.deepEqual(laidOut, [[paperSizes.A4.width, "recto", 1], [paperSizes.A4.width, "verso", 2]]);
      assert.equal(seq.numberOf(0), 3, "the title's page after them");
      // Its own paper: its own size - the rest as the book has it.
      cover.model.pageLayout.paper = paperSizes.letter;
      assert.deepEqual([insert.items[0].pages.pages[0].width, insert.items[0].pages.pages[0].side], [paperSizes.letter.width, "recto"]);
      // Starting the page numbers anew: 1 - and on from there.
      second.model.startsNumbering = true;
      assert.deepEqual([insert.items[1].pages.numberOf(0), seq.numberOf(0)], [1, 2]);
      assert.equal(seq.lastNumberOf(0), 2, "of 2 - its own and the title's");
      assert.equal(insert.items[0].pages.lastNumberOf(0), 1, "the cover before it, on its own");
      second.model.startsNumbering = false;
      assert.equal(seq.numberOf(0), 3, "as they were");
    } finally {
      retractRepeater(root);
      layout.dispose();
    }
  });
});

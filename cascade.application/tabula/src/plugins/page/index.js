import { mm, Section } from "../../print/index.js";
import { documentPlugin, createDocument, HydratedDocument } from "../../shell/documents.js";
import { pageLayoutKinds, pageLayoutFamilies, pageElements, paperFromJson, paperToJson } from "../../model/pageLayout.js";
import { newElement } from "../../paper/PageLayoutEditor.js";
import { image } from "../frames/index.js";
import { pageEditor } from "./PageEditor.js";
import { newPage, pageFormat } from "./model.js";

/**
 * A page - a page layout of its own (see ../../model/pageLayout.js): one
 * paper, and what's on it - pictures, shapes, a page number - placed where
 * they're put, no text flowing through it. A cover, a part title, a page
 * that's a picture. Where images, shapes and page numbers live - on a
 * page, or on a structured text's pages: the documents created from the
 * creation dots are what's at the top level; these, what's in them.
 *
 * Saved: { "type": "document", "name": "page", "properties": { "paper":
 * "A4", "elements": [{ "type": "pageElement", ... }] } } - its paper turned
 * sideways (landscape) a size of its own, { width, height }.
 *
 * Among pages of their own in another document, it's on that one's paper -
 * its size, its sides (see ../../layout/DocumentLayout.js) - unless it
 * keeps its own (`ownPaper`) - and numbered as it falls there.
 *
 * And a shortcut, Image: a page with a picture on it, across it, ready to
 * be chosen - a page, like any other, once made.
 */
export const page = {
  name: "page",
  label: "Page",
  icon: "note",
  description: "A page of its own - pictures, shapes and page numbers on it, where you put them.",
  create: () => newPage(),
  hydrate: ({ paper = "A4", elements = [], ownPaper = false }) => newPage(paperFromJson(paper), elements, !!ownPaper),
  dehydrate: (model) => ({ paper: paperToJson(model.paper), ...(model.ownPaper ? { ownPaper: true } : {}), elements: [...model.pageLayout.first] }),
  editor: (properties) => pageEditor(properties),
  layout: ({ key, model }) => new PageOfItsOwnLayout({ key, model }),
  title: () => "Page",
  print: (model, { paperSequence = null } = {}) => [printedPage(model, paperSequence)],
};

export const imagePage = {
  name: "imagePage",
  label: "Image",
  icon: "image",
  description: "A page with a picture on it.",
  // Made as a page: what it is from then on.
  createDocument: () => {
    const model = newPage();
    const { paper } = model;
    model.pageLayout.first.push(newElement(createDocument(image), paper, { x: paper.width / 2, y: paper.height / 2 }, { width: paper.width - mm(40) }));
    return new HydratedDocument(page, model);
  },
};

export const pagePlugin = documentPlugin({
  name: "page",
  label: "Pages",
  description: "Pages of their own - a cover, a picture - with whatever's placed on them.",
  documentTypes: [page, imagePage],
  kinds: pageLayoutKinds,
  families: pageLayoutFamilies,
});

// Laid out: a paper, nothing on it - what's on it is its own, drawn by its
// editor (see PageEditor.js), printed with it.
class PageOfItsOwnLayout extends Section {
  setProperties({ model }) {
    this.model = model;
  }

  pageFormat() {
    return pageFormat(this.model, this.inherit("pageSettings"));
  }

  build() {
    return null;
  }
}

// Printed: its paper - as it's laid out, if it is - and what's on it,
// numbered as it falls.
function printedPage(model, paperSequence) {
  const format = (paperSequence && paperSequence.pages[0]) || pageFormat(model);
  const number = paperSequence ? { page: paperSequence.numberOf(0), pages: paperSequence.lastNumber() } : { page: 1, pages: 1 };
  return {
    format,
    lines: [],
    frames: pageElements(model.pageLayout, 0, 1, format).map(({ element, rect }) => {
      const kind = element.content && element.content.documentType ? element.content.documentType.frame : null;
      return { ...rect, node: kind && kind.printNode ? kind.printNode(element.content.model, number) : globalThis.document.createElement("div") };
    }),
  };
}

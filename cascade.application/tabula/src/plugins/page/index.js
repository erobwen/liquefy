import { mm, Section } from "../../print/index.js";
import { documentPlugin, createDocument, HydratedDocument } from "../../shell/documents.js";
import { pageLayoutKinds, pageLayoutFamilies, pageElements, formatIn, paperFormat, resolvePageLayout, defaultPageSettings } from "../../model/pageLayout.js";
import { newElement } from "../../paper/PageLayoutEditor.js";
import { image } from "../frames/index.js";
import { pageEditor } from "./PageEditor.js";
import { newPage } from "./model.js";

/**
 * A page - a page layout of its own (see ../../model/pageLayout.js): one
 * paper, and what's on it - pictures, shapes, a page number - placed where
 * they're put, no text flowing through it. A cover, a part title, a page
 * that's a picture. Where images, shapes and page numbers live - on a
 * page, or on a structured text's pages: the documents created from the
 * creation dots are what's at the top level; these, what's in them.
 *
 * Saved: { "type": "document", "name": "page", "properties": { "pageLayout":
 * { "type": "pageLayout", ... } } } - what's on it its first page's, and
 * the page settings it sets itself, if any - and `startsNumbering`.
 *
 * On the paper of what it's in - the file's, a document's it's among
 * pages of their own in - but for what its page layout sets itself (see
 * ../../model/pageLayout.js); numbered as it falls, or from 1.
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
  hydrate: ({ pageLayout = null, elements = [], startsNumbering = false }) => newPage({ pageLayout, elements, startsNumbering }),
  dehydrate: (model) => ({
    pageLayout: model.pageLayout,
    ...(model.startsNumbering ? { startsNumbering: true } : {}),
  }),
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
    const { paper } = defaultPageSettings;
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
    return formatIn(this, this.model.pageLayout);
  }

  numberingStart() {
    return this.model.startsNumbering ? 1 : null;
  }

  build() {
    return null;
  }
}

// Printed: its paper - as it's laid out, if it is - and what's on it,
// numbered as it falls.
function printedPage(model, paperSequence) {
  const format = (paperSequence && paperSequence.pages[0]) || paperFormat(resolvePageLayout(model.pageLayout, () => undefined));
  const number = paperSequence ? { page: paperSequence.numberOf(0), pages: paperSequence.lastNumberOf(0) } : { page: 1, pages: 1 };
  return {
    format,
    lines: [],
    frames: pageElements(model.pageLayout, 0, 1, format).map(({ element, rect }) => {
      const kind = element.content && element.content.documentType ? element.content.documentType.frame : null;
      return { ...rect, node: kind && kind.printNode ? kind.printNode(element.content.model, number) : globalThis.document.createElement("div") };
    }),
  };
}

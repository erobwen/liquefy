import { paperSizes } from "../../print/index.js";
import { Flow, Document, Section, Paragraph } from "../../model/flows.js";
import { FrameAnchor } from "../../model/frames.js";
import { PageLayout, PageElement } from "../../model/pageLayout.js";

/**
 * A structured text saved - a Document, a tree of flows (see ../../model) -
 * and loaded: every object in it a query (see ../../shell/hydration.js),
 * plain values between them. A document's properties:
 *
 *   {
 *     "title": { "type": "flow", "name": "paragraph", "properties": { "spans": ["Tabula"] } },
 *     "paper": "A4",                       // a size's name, or { "width", "height" }
 *     "pageLayout": { "type": "pageLayout", "name": "pages", "properties": {
 *       "margins": { "top": 25000, ... },  // in micrometers, as cascade.print has them
 *       "first": [...], "middle": [...], "last": [...]   // page elements
 *     } },
 *     "numberTitles": true,
 *     "indentParagraphs": false,
 *     "front": [ ...paragraphs ],          // pages before the title, if any
 *     "frontBreaks": [1],                  // the front's paragraphs starting a page (after the first)
 *     "breaks": [1, 3],                    // the children starting a page, before the body
 *     "chaptersOnNewPage": false,          // only when it's off
 *     "children": [
 *       { "type": "flow", "name": "paragraph", "properties": { "spans": ["Plain, ", { "text": "bold", "bold": true }] } },
 *       { "type": "flow", "name": "section", "properties": { "title": ..., "titleOffset": 1, "children": [...] } }
 *     ]
 *   }
 *
 * A span is a string when it's neither bold nor italic - plain values both
 * - or a frame anchor, a query of its own (see ../../model/frames.js), its
 * content a document, loaded by its own kind's plugin:
 *
 *   { "type": "frame", "name": "anchor", "properties": { "placement": "left", "width": 60000,
 *     "content": { "type": "document", "name": "image", "properties": { ... } } } }
 *
 * What makes them again - the kinds of object a structured text is made
 * of, by family, and what each family is (its base class): structured
 * text's plugin provides them (see index.js and ../../shell/documents.js's
 * documentPlugin()). A family is all that a file says of an object's class:
 * "flow" is a Flow, whoever makes it.
 */
export const structuredTextFamilies = {
  flow: { baseClass: Flow },
  frame: { baseClass: FrameAnchor },
  pageLayout: { baseClass: PageLayout },
  pageElement: { baseClass: PageElement },
};

export const structuredTextKinds = {
  flow: {
    paragraph: ({ spans = [] }) => new Paragraph(spans.map((span) => span instanceof FrameAnchor ? { anchor: span } : span)),
    section: ({ title, titleOffset = 0, children = [] }) => new Section(title, children, titleOffset),
  },
  frame: {
    anchor: ({ placement, width, content }) => new FrameAnchor({ placement, width, content }),
  },
  pageLayout: {
    pages: ({ margins, duplex = false, first = [], middle = [], last = [] }) => new PageLayout({ margins: Object.freeze({ top: 0, right: 0, bottom: 0, left: 0, ...margins }), duplex, first, middle, last }),
  },
  pageElement: {
    element: (properties) => new PageElement(properties),
  },
};

// A structured text's properties, hydrated - its title, its children, its
// page layout objects already - made into the Document.
export function documentFromProperties(properties) {
  const paper = typeof(properties.paper) === "string" ? paperSizes[properties.paper] : properties.paper;
  if (!paper) throw new Error("Unknown paper: " + JSON.stringify(properties.paper));
  const document = new Document(
    {
      title: properties.title || new Paragraph(),
      paper: Object.freeze({ width: paper.width, height: paper.height }),
      pageLayout: properties.pageLayout || new PageLayout({ margins: Object.freeze({ top: 0, right: 0, bottom: 0, left: 0 }) }),
      titleOffset: properties.titleOffset || 0,
      numberTitles: !!properties.numberTitles,
      indentParagraphs: !!properties.indentParagraphs,
      front: properties.front || [],
      chaptersOnNewPage: properties.chaptersOnNewPage !== false,
    },
    properties.children || [],
  );
  // Where its pages start: an empty paragraph where one's past the end.
  const starts = (list, indices) => (indices || []).forEach((index) => {
    while (index >= list.children.length) list.children.push(new Paragraph());
    document.pageStarts.push(list.children[index]);
  });
  starts(document.front, properties.frontBreaks);
  starts(document, properties.breaks);
  return document;
}

// And back: its properties - the objects in them as they are, each
// dehydrating itself.
export function documentProperties(document) {
  return {
    title: document.title,
    paper: paperName(document.paper) || { width: document.paper.width, height: document.paper.height },
    pageLayout: document.pageLayout,
    numberTitles: document.numberTitles,
    indentParagraphs: document.indentParagraphs,
    ...(document.titleOffset ? { titleOffset: document.titleOffset } : {}),
    ...breaks(document),
    children: [...document.children],
  };
}

// Its pages before the body (see ../../model/book.js) - none, to begin with:
// nothing saved for them.
function breaks(document) {
  const indices = (list) => list.children.map((flow, index) => document.pageStarts.includes(flow) ? index : -1).filter((index) => index >= 0);
  const front = document.front.children;
  return {
    ...(front.length > 0 ? { front: [...front], frontBreaks: indices(document.front) } : {}),
    ...(indices(document).length > 0 ? { breaks: indices(document) } : {}),
    ...(document.chaptersOnNewPage ? {} : { chaptersOnNewPage: false }),
  };
}

function paperName(paper) {
  return Object.keys(paperSizes).find((name) => paperSizes[name].width === paper.width && paperSizes[name].height === paper.height);
}

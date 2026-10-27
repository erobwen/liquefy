import { paperSizes } from "../../print/index.js";
import { Document, Section, Paragraph, isSection } from "../../model/flows.js";
import { FrameAnchor } from "../../model/frames.js";
import { PageLayout, PageElement, pageKinds } from "../../model/pageLayout.js";

/**
 * A structured text - a Document, a tree of flows (see ../../model) - as the
 * properties of its JSON, and back:
 *
 *   {
 *     "title": ["Tabula"],
 *     "paper": "A4",                       // a size's name, or { "width", "height" }
 *     "margins": { "top": 25000, ... },    // in micrometers, as cascade.print has them
 *     "numberTitles": true,
 *     "indentParagraphs": false,
 *     "pages": { "first": [...], "middle": [...], "last": [...] },  // what's drawn on them, if anything
 *     "titleOffset": 0,
 *     "children": [
 *       { "flow": "paragraph", "spans": ["Plain, ", { "text": "bold", "bold": true }] },
 *       { "flow": "section", "title": ["A section"], "titleOffset": 1, "children": [...] }
 *     ]
 *   }
 *
 * A span is a string when it's neither bold nor italic. What's at its
 * default is left out (a titleOffset of 0, say). A frame anchor's span (see
 * ../../model/frames.js) is its frame - what's in it a document of its own,
 * saved and loaded by its own kind's plugin, through `documents` (see
 * ../../shell/documents.js):
 *
 *   { "frame": { "placement": "left", "width": 60000, "content": { "type": "document", "name": "image", ... } } }
 */

export function documentToJSON(document, documents = noDocuments) {
  const flowToJSON = flowToJSONWith(documents);
  const spansToJSON = spansToJSONWith(documents);
  return {
    title: spansToJSON(document.title),
    paper: paperName(document.paper) || { width: document.paper.width, height: document.paper.height },
    margins: { ...document.pageLayout.margins },
    ...pagesToJSON(document.pageLayout, documents),
    numberTitles: document.numberTitles,
    indentParagraphs: document.indentParagraphs,
    ...(document.titleOffset ? { titleOffset: document.titleOffset } : {}),
    children: document.children.map(flowToJSON),
  };
}

export function documentFromJSON(json, documents = noDocuments) {
  const flowFromJSON = flowFromJSONWith(documents);
  const spansFromJSON = spansFromJSONWith(documents);
  const paper = typeof(json.paper) === "string" ? paperSizes[json.paper] : json.paper;
  if (!paper) throw new Error("Unknown paper: " + JSON.stringify(json.paper));
  return new Document(
    {
      title: spansFromJSON(json.title),
      paper: Object.freeze({ width: paper.width, height: paper.height }),
      pageLayout: pageLayoutFromJSON(json, documents),
      titleOffset: json.titleOffset || 0,
      numberTitles: !!json.numberTitles,
      indentParagraphs: !!json.indentParagraphs,
    },
    (json.children || []).map(flowFromJSON),
  );
}

const flowToJSONWith = (documents) => function flowToJSON(flow) {
  const spansToJSON = spansToJSONWith(documents);
  if (isSection(flow)) {
    return {
      flow: "section",
      title: spansToJSON(flow.title),
      ...(flow.titleOffset ? { titleOffset: flow.titleOffset } : {}),
      children: flow.children.map(flowToJSON),
    };
  }
  return { flow: "paragraph", spans: spansToJSON(flow) };
};

const flowFromJSONWith = (documents) => function flowFromJSON(json) {
  const spansFromJSON = spansFromJSONWith(documents);
  if (json.flow === "paragraph") return new Paragraph(spansFromJSON(json.spans));
  if (json.flow === "section") return new Section(new Paragraph(spansFromJSON(json.title)), (json.children || []).map(flowFromJSON), json.titleOffset || 0);
  throw new Error("Not a flow: " + JSON.stringify(json).slice(0, 80));
};

const spansToJSONWith = (documents) => (paragraph) => paragraph.spans.map(({ text, bold, italic, anchor }) => anchor
  ? { frame: { placement: anchor.placement, width: anchor.width, content: documents.dehydrate(anchor.content) } }
  : (bold || italic)
    ? { text, ...(bold ? { bold } : {}), ...(italic ? { italic } : {}) }
    : text);

const spansFromJSONWith = (documents) => (spans) => (spans || []).map((span) => typeof(span) === "string" ? span
  : span.frame ? { anchor: new FrameAnchor({ placement: span.frame.placement, width: span.frame.width, content: documents.hydrate(span.frame.content) }) }
  : { text: span.text, bold: !!span.bold, italic: !!span.italic });

// A page layout's pages - each page element, where it is and what's in it
// (see ../../model/pageLayout.js) - left out when there's nothing on them.
function pagesToJSON(layout, documents) {
  if (pageKinds.every(({ name }) => layout[name].length === 0)) return {};
  const pages = {};
  for (const { name } of pageKinds) {
    pages[name] = layout[name].map(({ content, horizontal, x, vertical, y, width, height }) => ({
      horizontal, x, vertical, y, width, height, content: documents.dehydrate(content),
    }));
  }
  return { pages };
}

function pageLayoutFromJSON(json, documents) {
  const pages = json.pages || {};
  const elements = (name) => (pages[name] || []).map((element) => new PageElement({ ...element, content: documents.hydrate(element.content) }));
  return new PageLayout({
    margins: Object.freeze({ top: 0, right: 0, bottom: 0, left: 0, ...json.margins }),
    first: elements("first"),
    middle: elements("middle"),
    last: elements("last"),
  });
}

// Without the plugins: no frames, nothing in them saved or loaded.
const noDocuments = {
  hydrate: () => { throw new Error("A frame, and no plugins to load what's in it"); },
  dehydrate: () => { throw new Error("A frame, and no plugins to save what's in it"); },
};

function paperName(paper) {
  return Object.keys(paperSizes).find((name) => paperSizes[name].width === paper.width && paperSizes[name].height === paper.height);
}

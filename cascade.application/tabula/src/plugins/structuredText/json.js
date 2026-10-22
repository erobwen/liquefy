import { paperSizes } from "../../print/index.js";
import { Document, Section, Paragraph, isSection } from "../../model/flows.js";

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
 *     "titleOffset": 0,
 *     "children": [
 *       { "flow": "paragraph", "spans": ["Plain, ", { "text": "bold", "bold": true }] },
 *       { "flow": "section", "title": ["A section"], "titleOffset": 1, "children": [...] }
 *     ]
 *   }
 *
 * A span is a string when it's neither bold nor italic. What's at its
 * default is left out (a titleOffset of 0, say).
 */

export function documentToJSON(document) {
  return {
    title: spansToJSON(document.title),
    paper: paperName(document.paper) || { width: document.paper.width, height: document.paper.height },
    margins: { ...document.margins },
    numberTitles: document.numberTitles,
    indentParagraphs: document.indentParagraphs,
    ...(document.titleOffset ? { titleOffset: document.titleOffset } : {}),
    children: document.children.map(flowToJSON),
  };
}

export function documentFromJSON(json) {
  const paper = typeof(json.paper) === "string" ? paperSizes[json.paper] : json.paper;
  if (!paper) throw new Error("Unknown paper: " + JSON.stringify(json.paper));
  return new Document(
    {
      title: spansFromJSON(json.title),
      paper: Object.freeze({ width: paper.width, height: paper.height }),
      margins: Object.freeze({ top: 0, right: 0, bottom: 0, left: 0, ...json.margins }),
      titleOffset: json.titleOffset || 0,
      numberTitles: !!json.numberTitles,
      indentParagraphs: !!json.indentParagraphs,
    },
    (json.children || []).map(flowFromJSON),
  );
}

function flowToJSON(flow) {
  if (isSection(flow)) {
    return {
      flow: "section",
      title: spansToJSON(flow.title),
      ...(flow.titleOffset ? { titleOffset: flow.titleOffset } : {}),
      children: flow.children.map(flowToJSON),
    };
  }
  return { flow: "paragraph", spans: spansToJSON(flow) };
}

function flowFromJSON(json) {
  if (json.flow === "paragraph") return new Paragraph(spansFromJSON(json.spans));
  if (json.flow === "section") return new Section(new Paragraph(spansFromJSON(json.title)), (json.children || []).map(flowFromJSON), json.titleOffset || 0);
  throw new Error("Not a flow: " + JSON.stringify(json).slice(0, 80));
}

const spansToJSON = (paragraph) => paragraph.spans.map(({ text, bold, italic }) => (bold || italic)
  ? { text, ...(bold ? { bold } : {}), ...(italic ? { italic } : {}) }
  : text);

const spansFromJSON = (spans) => (spans || []).map((span) => typeof(span) === "string" ? span : { text: span.text, bold: !!span.bold, italic: !!span.italic });

function paperName(paper) {
  return Object.keys(paperSizes).find((name) => paperSizes[name].width === paper.width && paperSizes[name].height === paper.height);
}

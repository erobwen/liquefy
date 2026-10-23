import { paperSizes, margins, mm } from "../../print/index.js";
import { Document, Paragraph, paragraphText } from "../../model/flows.js";
import { documentPlugin } from "../../shell/documents.js";
import { documentToJSON, documentFromJSON } from "./json.js";
import { structuredTextEditor } from "./StructuredTextEditor.js";
import { structuredTextWeb } from "./StructuredTextWeb.js";
import { printPapers, outline } from "./output.js";

/**
 * Structured text - Tabula's first kind of document: a tree of flows,
 * sections in sections, each with a title, and paragraphs of text (see
 * ../../model), laid out on paper (../../layout, ../../paper).
 */
export const structuredText = {
  name: "structuredText",
  label: "Structured text",
  icon: "article",
  description: "Sections, titles and paragraphs, on paper.",
  // As the classic app's Clear leaves one: no title, one empty paragraph -
  // their placeholders, "Title" and "Text", showing.
  create: () => new Document({ title: "", paper: paperSizes.A4, margins: margins(mm(25)) }, [new Paragraph()]),
  hydrate: (properties) => documentFromJSON(properties),
  dehydrate: (model) => documentToJSON(model),
  // On paper, edited; on the web, read only, for now.
  editor: ({ target, ...properties }) => target === "web" ? structuredTextWeb(properties) : structuredTextEditor(properties),
  title: (model) => paragraphText(model.title),
  print: (model) => printPapers(model),
  outline: (model) => outline(model),
};

export const structuredTextPlugin = documentPlugin({
  name: "structuredText",
  label: "Structured text",
  description: "Documents of sections and paragraphs, on paper.",
  documentTypes: [structuredText],
});

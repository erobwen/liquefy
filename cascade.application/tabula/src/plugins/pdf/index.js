import { observable } from "@liquefy/cascade.component";
import { pt, margins } from "../../print/index.js";
import { documentPlugin } from "../../shell/documents.js";
import { pdfView } from "./PdfView.js";
import { pdfDocument } from "./pdfjs.js";

/**
 * PDF - a PDF document, among Tabula's own: its pages shown as they are
 * (see PdfView.js), next to the papers of the documents around it, printed
 * with them. Saved in the file it's in, as base64:
 *
 *   { "type": "document", "name": "pdf", "properties": { "name": "report.pdf", "data": "JVBERi0x..." } }
 *
 * Nothing in it is edited, for now - another PDF can take its place.
 */
export const pdf = {
  name: "pdf",
  label: "PDF",
  icon: "picture_as_pdf",
  description: "A PDF document, its pages as they are.",
  create: () => observable({ name: null, data: null }),
  hydrate: (properties) => observable({ name: properties.name || null, data: properties.data || null }),
  dehydrate: (model) => ({ name: model.name, data: model.data }),
  editor: (properties) => pdfView(properties),
  title: (model) => model.name || "",
  print: (model) => printPages(model),
};

export const pdfPlugin = documentPlugin({
  name: "pdf",
  label: "PDF",
  description: "PDF documents, their pages shown and printed as they are.",
  documentTypes: [pdf],
});

// Its pages for printing (see ../../print/dom.js's printPages()): a paper of
// each page's size, the page drawn on it as a picture - at 3 pixels to a
// point, 216 to an inch.
async function printPages(model) {
  if (!model.data) return [];
  const document = await pdfDocument(model);
  const papers = [];
  for (let number = 1; number <= document.numPages; number++) {
    const page = await document.getPage(number);
    const viewport = page.getViewport({ scale: 3 });
    const canvas = globalThis.document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvas, canvasContext: canvas.getContext("2d"), viewport }).promise;
    const picture = globalThis.document.createElement("img");
    picture.src = canvas.toDataURL("image/png");
    Object.assign(picture.style, { display: "block", width: "100%", height: "100%" });
    const size = page.getViewport({ scale: 1 });
    const format = { width: pt(size.width), height: pt(size.height), margins: margins(0) };
    papers.push({ format, lines: [], frames: [{ x: 0, top: 0, width: format.width, height: format.height, node: picture }] });
  }
  return papers;
}

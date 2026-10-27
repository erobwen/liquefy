import { withoutRecording } from "@liquefy/cascade.component";
import { cssMm, paperStyle, runStyle } from "./paperStyles.js";

/**
 * Print a paper sequence - through the browser's own print dialog, onto a
 * printer (or into a PDF): one sheet per paper, each the size of its paper,
 * nothing around it.
 *
 *   printPaperSequence(sequence, { title: "Letter to Alice" })
 *
 * Drawn as on screen (see paperStyles.js), but on a document of its own - a
 * hidden iframe, printed and removed again - so nothing of the app around
 * the papers (its menu, its scroll panels, its zoom) can get onto paper, or
 * clip the papers to the screen. Every distinct paper size gets a named
 * page of its own (CSS `@page`), so a document with A4 and Letter sections
 * prints each on its own size.
 *
 * The papers' fonts must be available to the print document: system fonts
 * are; web fonts are given as `stylesheets` - URLs of the CSS declaring
 * them - and printing waits for them.
 *
 * `title` is what the browser suggests as the file name when printing to a
 * PDF (and puts in a header, where it prints one).
 */
// The iframe of the last print, until it's removed: `afterprint` removes
// it - and where that never comes, the next print does, so at most one is
// ever left in the page.
let removeLastPrint = null;

export function printPaperSequence(sequence, options = {}) {
  return printPages(papersOf(sequence), options);
}

// A paper sequence's papers, as they're laid out right now - for
// printPages().
export function papersOf(sequence) {
  return withoutRecording(() => sequence.pages.map((format, index) => ({
    format,
    lines: [...sequence.linesOf(index)],
  })));
}

/**
 * Print pages of two kinds, in order - Tabula's sequences of documents of
 * any kind (Tabula's own; cascade.print has only printPaperSequence()):
 *
 *  - `{ format, lines, frames }` - a paper, laid out (papersOf()): printed
 *    as it is, a sheet of its own size - and, optionally, `frames` on it,
 *    [{ x, top, width, height, node, under }] in µm: a DOM node for each
 *    of the frames its lines placed (see ../lineBreaking.js), filling it -
 *    or, `under`, for what's drawn under the text: a page layout's.
 *  - `{ format, node, margin }` - a DOM node, flowing: on pages of that
 *    size, `margin` (micrometers) around it, broken onto as many as it
 *    takes by the browser. For what isn't laid out on paper - a plain text,
 *    a spreadsheet.
 *
 * Each starts on a page of its own.
 */
export function printPages(papers, { title = "", stylesheets = [], document: doc = globalThis.document } = {}) {
  if (removeLastPrint) removeLastPrint();

  const iframe = doc.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0", visibility: "hidden" });
  doc.body.appendChild(iframe);
  const printDocument = iframe.contentDocument;
  const view = iframe.contentWindow;

  // A named page for every size - and margin, for flowing nodes.
  const sizes = new Map();
  const pageName = (format, margin = 0) => {
    const size = cssMm(format.width) + " " + cssMm(format.height);
    const key = size + "|" + margin;
    if (!sizes.has(key)) sizes.set(key, { name: "paper" + sizes.size, size, margin: cssMm(margin) });
    return sizes.get(key).name;
  };
  const names = papers.map((paper) => pageName(paper.format, paper.node ? paper.margin || 0 : 0));

  printDocument.open();
  printDocument.write("<!DOCTYPE html><html><head><meta charset=\"utf-8\"></head><body></body></html>");
  printDocument.close();
  printDocument.title = title;
  for (const href of stylesheets) {
    const link = printDocument.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    printDocument.head.appendChild(link);
  }
  const style = printDocument.createElement("style");
  style.textContent = [
    "html, body { margin: 0; padding: 0; background: white; }",
    ...[...sizes.values()].map(({ name, size, margin }) => "@page " + name + " { size: " + size + "; margin: " + margin + "; }"),
    // The first size is the default, for a browser without named pages.
    sizes.size > 0 ? "@page { size: " + [...sizes.values()][0].size + "; margin: 0; }" : "",
    ".paper { break-after: page; print-color-adjust: exact; -webkit-print-color-adjust: exact; }",
    ".paper:last-child { break-after: auto; }",
  ].join("\n");
  printDocument.head.appendChild(style);

  papers.forEach((paper, index) => {
    const element = printDocument.createElement("div");
    element.className = "paper";
    if (paper.node) {
      element.style.setProperty("page", names[index]);
      element.appendChild(printDocument.importNode(paper.node, true));
      printDocument.body.appendChild(element);
      return;
    }
    Object.assign(element.style, paperStyle(paper.format));
    element.style.setProperty("page", names[index]);
    const frames = paper.frames || [];
    const drawFrame = (frame) => {
      const box = printDocument.createElement("div");
      Object.assign(box.style, { position: "absolute", left: cssMm(frame.x), top: cssMm(frame.top), width: cssMm(frame.width), height: cssMm(frame.height), overflow: "hidden" });
      box.appendChild(printDocument.importNode(frame.node, true));
      element.appendChild(box);
    };
    frames.filter((frame) => frame.under).forEach(drawFrame);
    for (const line of paper.lines) {
      for (const run of line.runs) {
        if (run.frame) continue;
        const span = printDocument.createElement("span");
        Object.assign(span.style, runStyle(line, run));
        span.textContent = run.text;
        element.appendChild(span);
      }
    }
    frames.filter((frame) => !frame.under).forEach(drawFrame);
    printDocument.body.appendChild(element);
  });

  let removed = false;
  const remove = () => {
    if (removed) return;
    removed = true;
    iframe.remove();
    if (removeLastPrint === remove) removeLastPrint = null;
  };
  removeLastPrint = remove;
  view.addEventListener("afterprint", () => setTimeout(remove, 0));

  // Printed once the stylesheets and fonts are in - a moment, for system
  // fonts.
  const loaded = [...printDocument.querySelectorAll("link")].map((link) => new Promise((resolve) => {
    link.addEventListener("load", resolve);
    link.addEventListener("error", resolve);
  }));
  return Promise.all(loaded)
    .then(() => printDocument.fonts ? printDocument.fonts.ready : null)
    .then(() => {
      view.focus();
      view.print();
    })
    .catch((error) => {
      remove();
      throw error;
    });
}

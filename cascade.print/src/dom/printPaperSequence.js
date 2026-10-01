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
export function printPaperSequence(sequence, { title = "", stylesheets = [], document: doc = globalThis.document } = {}) {
  const papers = withoutRecording(() => sequence.pages.map((format, index) => ({
    format,
    lines: [...sequence.linesOf(index)],
  })));

  const iframe = doc.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0", visibility: "hidden" });
  doc.body.appendChild(iframe);
  const printDocument = iframe.contentDocument;
  const view = iframe.contentWindow;

  const sizes = new Map();
  const pageName = (format) => {
    const size = cssMm(format.width) + " " + cssMm(format.height);
    if (!sizes.has(size)) sizes.set(size, "paper" + sizes.size);
    return sizes.get(size);
  };
  const names = papers.map((paper) => pageName(paper.format));

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
    ...[...sizes].map(([size, name]) => "@page " + name + " { size: " + size + "; margin: 0; }"),
    // The first size is the default, for a browser without named pages.
    sizes.size > 0 ? "@page { size: " + [...sizes.keys()][0] + "; margin: 0; }" : "",
    ".paper { break-after: page; print-color-adjust: exact; -webkit-print-color-adjust: exact; }",
    ".paper:last-child { break-after: auto; }",
  ].join("\n");
  printDocument.head.appendChild(style);

  papers.forEach((paper, index) => {
    const element = printDocument.createElement("div");
    element.className = "paper";
    Object.assign(element.style, paperStyle(paper.format));
    element.style.setProperty("page", names[index]);
    for (const line of paper.lines) {
      for (const run of line.runs) {
        const span = printDocument.createElement("span");
        Object.assign(span.style, runStyle(line, run));
        span.textContent = run.text;
        element.appendChild(span);
      }
    }
    printDocument.body.appendChild(element);
  });

  let removed = false;
  const remove = () => {
    if (removed) return;
    removed = true;
    iframe.remove();
  };
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

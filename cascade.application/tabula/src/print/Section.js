import { frozen } from "@liquefy/cascade.component";
import { Box } from "./Box.js";

/**
 * Section - a run of paragraphs on papers of one kind, as a section is in
 * Word: it starts on a new paper, and its paragraphs (see Paragraph.js) go
 * on papers like it, one after another.
 *
 * Knows nothing of any model: a subclass says which paper - pageFormat() -
 * and builds the paragraphs that go on it - build(), each given the width
 * they're laid out in (contentWidth()) and the paper. Paragraphs that can
 * be inserted or removed are keyed, so the others keep their lines.
 *
 *   class ChapterSection extends Section {
 *     pageFormat() { return { ...paperSizes.A4, margins: margins(mm(25)) }; }
 *     build() {
 *       const format = this.pageFormat();
 *       return this.chapter.paragraphs.map((p) => new MyParagraph({ key: p.id, source: p, width: contentWidth(format), format }));
 *     }
 *   }
 */
export class Section extends Box {
  // Override: the paper - { width, height, margins } in µm.
  pageFormat() {
    throw new Error(this.constructor.name + " must implement pageFormat()");
  }

  // Override, optionally: the side of a sheet its first paper is - "recto"
  // (the default) or "verso", printed on both sides (see formatOfPage()).
  firstPageSide() {
    return "recto";
  }

  render(sequence, context) {
    const format = frozen(this.pageFormat());
    const page = sequence.pages.length;
    // Where its sides are counted from (see formatOfPage()): its first paper
    // - or the one before, if that's a left-hand one.
    const firstPage = this.firstPageSide() === "verso" ? page - 1 : page;
    sequence.pages.push(formatOfPage(format, page, firstPage));
    sequence.next = frozen({ page, y: format.margins.top, spaceAfter: 0, atPageTop: true, firstPage });
    const built = this.buildOneStep();
    for (const paragraph of built instanceof Array ? built : [built]) {
      if (paragraph) paragraph.renderOnto(sequence, context);
    }
  }
}

// The paper of page `page` in a run of them that starts at `firstPage`
// (a section's): `format`, as given - or, printed on both sides
// (`format.duplex`), every second one the back of the one before: its left
// and right margins swapped, so that the left one is always the inner one,
// by the binding, whichever side that's on. Each page's paper says which side
// it is - `side`, "recto" (right-hand: the first, and every other after it)
// or "verso" - for what shows it (the binding's shade) and what's drawn on it
// (mirrored). The width a paper leaves for text is the same on both sides:
// lines are broken once, and only placed by the paper they're on.
const versos = new WeakMap();

export function formatOfPage(format, page, firstPage = 0) {
  if (!format.duplex || (page - firstPage) % 2 === 0) return format;
  let verso = versos.get(format);
  if (!verso) {
    verso = frozen({ ...format, side: "verso", margins: frozen({ ...format.margins, left: format.margins.right, right: format.margins.left }) });
    versos.set(format, verso);
  }
  return verso;
}

// The width a paper leaves for text, inside its margins.
export function contentWidth(format) {
  return format.width - format.margins.left - format.margins.right;
}

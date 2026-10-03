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

  render(sequence, context) {
    const format = frozen(this.pageFormat());
    sequence.pages.push(format);
    sequence.next = frozen({ page: sequence.pages.length - 1, y: format.margins.top, spaceAfter: 0, atPageTop: true });
    const built = this.buildOneStep();
    for (const paragraph of built instanceof Array ? built : [built]) {
      if (paragraph) paragraph.renderOnto(sequence, context);
    }
  }
}

// The width a paper leaves for text, inside its margins.
export function contentWidth(format) {
  return format.width - format.margins.left - format.margins.right;
}

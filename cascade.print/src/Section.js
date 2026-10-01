import { Component, frozen } from "@liquefy/cascade.component";
import { Paragraph } from "./Paragraph.js";

/**
 * Section - a part of a document with a paper of its own, as in Word: its
 * size and margins (see units.js's paperSizes and margins()). A section
 * starts on a new paper, and its paragraphs go on papers like it.
 *
 * Property `section` - the model's: { paper: { width, height }, margins,
 * paragraphs: [...] }. Its paragraphs are keyed by identity, so inserting
 * or removing one keeps the others as they were - their lines included.
 */
export class Section extends Component {
  setProperties({ section }) {
    this.section = section;
  }

  // The paper this section is laid out on.
  pageFormat() {
    const { paper, margins } = this.section;
    return frozen({ width: paper.width, height: paper.height, margins });
  }

  build() {
    const format = this.pageFormat();
    const width = format.width - format.margins.left - format.margins.right;
    return this.section.paragraphs.map((paragraph) =>
      new Paragraph({ key: "paragraph" + paragraph.causality.id, paragraph, width, format }));
  }

  render(sequence, context) {
    sequence.pages.push(this.pageFormat());
    sequence.flow = frozen({ page: sequence.pages.length - 1, y: this.section.margins.top, spaceAfter: 0, atPageTop: true });
    for (const paragraph of this.buildOneStep()) paragraph.renderOnto(sequence, context);
  }
}

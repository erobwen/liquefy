import { Component, observable } from "@liquefy/cascade.component";
import { Section, contentWidth } from "../../Section.js";
import { Paragraph } from "../../Paragraph.js";
import { PaperSequence } from "../../PaperSequence.js";
import { margins } from "../../units.js";

/**
 * The smallest model there is, for the tests: paragraphs of plain text, all
 * in one font, in sections on papers - laid out with cascade.print's
 * Section and Paragraph, as any model is: they're only told which paper a
 * section is on, and what a paragraph's text is.
 *
 * Every character 1000 µm wide, lines 5000 µm tall, the baseline 4000 down.
 * The small paper, 12 x 22 mm with 1 mm margins, holds 10 characters across
 * and 4 lines down.
 */
export const measurer = {
  measure: (text) => text.length * 1000,
  metrics: () => ({ ascent: 4000, descent: 1000 }),
};

export const font = Object.freeze({ family: "Georgia", size: 12, weight: 400, italic: false });

export const smallPaper = { width: 12000, height: 22000 };

// A paragraph: its text, and how it's laid out (spaceBefore, indentLeft, ...).
export const paragraph = (text, layout = {}) => observable({ text, layout: observable(layout) });

export const section = (paragraphs, paper = smallPaper) =>
  observable({ paper, margins: margins(1000), paragraphs: observable(paragraphs) });

class PlainParagraph extends Paragraph {
  setProperties({ paragraph, width, format }) {
    super.setProperties({ source: paragraph, width, format });
  }

  // The whole document's layout, then the paragraph's own.
  content() {
    const paragraph = this.source;
    return { spans: [{ text: paragraph.text, font }], font, ...this.inherit("layout"), ...paragraph.layout };
  }
}

class PlainSection extends Section {
  setProperties({ section }) {
    this.section = section;
  }

  pageFormat() {
    return { ...this.section.paper, margins: this.section.margins };
  }

  build() {
    const format = this.pageFormat();
    return this.section.paragraphs.map((paragraph) =>
      new PlainParagraph({ key: "paragraph" + paragraph.causality.id, paragraph, width: contentWidth(format), format }));
  }
}

class PlainDocument extends Component {
  setProperties({ document }) {
    this.document = document;
  }

  provide() {
    const document = this.document;
    return { textMeasurer: measurer, get layout() { return document.layout; } };
  }

  build() {
    return this.document.sections.map((section) => new PlainSection({ key: "section" + section.causality.id, section }));
  }
}

// Sections laid out onto a new paper sequence. `layout`: for every
// paragraph - an observable, so the tests can change it.
export function layOut(sections, layout = {}) {
  const document = observable({ layout: observable(layout), sections: observable(sections) });
  const sequence = new PaperSequence();
  const component = new PlainDocument({ document });
  component.renderOnto(sequence);
  return { document, sequence, component };
}

// The Paragraph components of the first section, in order.
export function paragraphComponents(component) {
  const [firstSection] = component.currentBuild;
  return firstSection.currentBuild;
}

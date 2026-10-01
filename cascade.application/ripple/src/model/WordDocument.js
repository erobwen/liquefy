import { Component, frozen } from "@liquefy/cascade.component";
import { Section, Paragraph, contentWidth, monospaceMeasurer } from "@liquefy/cascade.print";
import { paragraphStyleOf, resolveFont } from "./styles.js";

const fallbackMeasurer = monospaceMeasurer();

/**
 * The word processor's model, laid out onto a PaperSequence with
 * cascade.print - Word's model: sections, each with a paper of its own, of
 * paragraphs, each referring to a paragraph style and holding spans, each
 * with a character style or a font of its own (see styles.js).
 *
 *   new WordDocument({ document, measurer }).renderOnto(new PaperSequence());
 *
 * `document` - observable all the way down:
 *
 *   {
 *     styles,                          // the stylesheet (see styles.js)
 *     sections: [{
 *       paper: { width, height },      // µm - see cascade.print's paperSizes
 *       margins,                       // see cascade.print's margins()
 *       paragraphs: [{ style, format?, spans: [{ text, style?, font? }] }],
 *     }],
 *   }
 *
 * `measurer` - what text is measured with; a monospace one if none is
 * given. Provided to everything in the document, as cascade.print's
 * paragraphs inherit it (`textMeasurer`) - and the stylesheet as `styles`.
 *
 * cascade.print knows nothing of this model: the components below only say
 * what it means for it - which paper a section is on, what a paragraph's
 * text and fonts are - and cascade.print breaks the lines and places them.
 */
export class WordDocument extends Component {
  setProperties({ document, measurer }) {
    this.document = document;
    this.measurer = measurer || null;
  }

  provide() {
    const document = this;
    return {
      get styles() { return document.document.styles; },
      get textMeasurer() { return document.measurer || fallbackMeasurer; },
    };
  }

  build() {
    return this.document.sections.map((section) => new WordSection({ key: "section" + section.causality.id, section }));
  }
}

// A section of the model: its paper, and its paragraphs on it - keyed by
// identity, so inserting or removing one keeps the others as they were,
// their lines included.
export class WordSection extends Section {
  setProperties({ section }) {
    this.section = section;
  }

  pageFormat() {
    const { paper, margins } = this.section;
    return frozen({ width: paper.width, height: paper.height, margins });
  }

  build() {
    const format = this.pageFormat();
    const width = contentWidth(format);
    return this.section.paragraphs.map((paragraph) =>
      new WordParagraph({ key: "paragraph" + paragraph.causality.id, paragraph, width, format }));
  }
}

// A paragraph of the model: its text in its fonts, and its layout - all from
// its style, its spans' styles and fonts, and its own direct formatting.
// Its lines are placed with the model's paragraph as their source - what a
// position on the papers then refers to.
export class WordParagraph extends Paragraph {
  setProperties({ paragraph, width, format }) {
    super.setProperties({ source: paragraph, width, format });
  }

  content() {
    const paragraph = this.source;
    const stylesheet = this.inherit("styles");
    const style = paragraphStyleOf(stylesheet, paragraph);
    return {
      spans: paragraph.spans.map((span) => ({ text: span.text, font: resolveFont(stylesheet, style, span) })),
      font: style.font,
      align: style.align,
      lineSpacing: style.lineSpacing,
      indentLeft: style.indentLeft,
      indentRight: style.indentRight,
      firstLineIndent: style.firstLineIndent,
      spaceBefore: style.spaceBefore,
      spaceAfter: style.spaceAfter,
    };
  }
}

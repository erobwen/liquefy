import { Component, frozen } from "@liquefy/cascade.component";
import { Section, Paragraph, contentWidth, monospaceMeasurer } from "@liquefy/cascade.print";
import { isSection } from "../model/parts.js";
import { typography as defaultTypography, titleStyle } from "./typography.js";

const fallbackMeasurer = monospaceMeasurer();

/**
 * Ripple's documents laid out onto a PaperSequence with cascade.print - a
 * component for every part:
 *
 *   new SequenceLayout({ sequence, measurer }).renderOnto(new PaperSequence());
 *
 *  - SequenceLayout: the root - its documents, one after another. Provides
 *    `measurer` (a monospace one if none is given) and `typography` to
 *    everything in it.
 *  - DocumentLayout: a document's paper (a cascade.print Section: each
 *    document starts on a paper of its own), and the document itself, as
 *    the section at depth 0.
 *  - SectionLayout: a section - its title, then its children, in order. It
 *    places nothing itself: what it builds renders onto the paper sequence
 *    one after another, in the tree's order - which is reading order.
 *  - ParagraphLayout: a paragraph (a cascade.print Paragraph) - a section's
 *    title, or body text. Its look is its place's (see typography.js); only
 *    its spans are bold or italic of their own.
 *
 * Only the parts are laid out here. The gaps between them - where a caret
 * can be besides the text - are placed afterwards, from what's laid out (see
 * ../paper/markers.js): they take no room, so they can never move a part.
 */
export class SequenceLayout extends Component {
  setProperties({ sequence, measurer, typography }) {
    this.sequence = sequence;
    this.measurer = measurer || null;
    this.typography = typography || defaultTypography;
  }

  provide() {
    const layout = this;
    return {
      get textMeasurer() { return layout.measurer || fallbackMeasurer; },
      get typography() { return layout.typography; },
    };
  }

  build() {
    return this.sequence.children.map((document) => new DocumentLayout({ key: "document" + document.causality.id, document }));
  }
}

export class DocumentLayout extends Section {
  setProperties({ document }) {
    this.document = document;
  }

  pageFormat() {
    const { paper, margins } = this.document;
    return frozen({ width: paper.width, height: paper.height, margins });
  }

  build() {
    const format = this.pageFormat();
    return new SectionLayout({ key: "document", section: this.document, depth: 0, width: contentWidth(format), format });
  }
}

// A section `depth` deep: its title, then each of its children - keyed by
// identity, so one inserted, moved or removed leaves the others as they
// were, their lines included.
export class SectionLayout extends Component {
  setProperties({ section, depth, width, format }) {
    this.section = section;
    this.depth = depth;
    this.width = width;
    this.format = frozen(format);
  }

  build() {
    const { section, depth, width, format } = this;
    return [
      new ParagraphLayout({ key: "title", paragraph: section.title, role: frozen({ title: depth }), width, format }),
      ...section.children.map((child) => isSection(child)
        ? new SectionLayout({ key: "part" + child.causality.id, section: child, depth: depth + 1, width, format })
        : new ParagraphLayout({ key: "part" + child.causality.id, paragraph: child, role: frozen({ body: true }), width, format })),
    ];
  }
}

// A paragraph, laid out as its role says: `{ title: depth }` - a section's
// title - or `{ body: true }`. Its lines are placed with the paragraph as
// their source - what a position on the papers then refers to.
export class ParagraphLayout extends Paragraph {
  setProperties({ paragraph, role, width, format }) {
    super.setProperties({ source: paragraph, width, format });
    this.role = frozen(role);
  }

  content() {
    const typography = this.inherit("typography");
    const style = this.role.body ? typography.body : titleStyle(typography, this.role.title);
    const { font, ...layout } = style;
    return {
      ...layout,
      font,
      spans: this.source.spans.map((span) => ({
        text: span.text,
        font: { ...font, weight: span.bold ? 700 : font.weight, italic: span.italic || font.italic },
      })),
    };
  }
}

import { Component, frozen } from "@liquefy/cascade.component";
import { Section, Paragraph, GapMarker, contentWidth, monospaceMeasurer, mm } from "@liquefy/cascade.print";
import { isSection, gap } from "../model/parts.js";
import { typography as defaultTypography, titleStyle } from "./typography.js";

const fallbackMeasurer = monospaceMeasurer();

/**
 * Ripple's documents laid out onto a PaperSequence with cascade.print - a
 * component for every part, and a gap marker for every place between parts:
 *
 *   new SequenceLayout({ sequence, measurer }).renderOnto(new PaperSequence());
 *
 *  - SequenceLayout: the root - its documents, one after another. Provides
 *    `measurer` (a monospace one if none is given) and `typography` to
 *    everything in it.
 *  - DocumentLayout: a document's paper (a cascade.print Section: each
 *    document starts on a paper of its own), and the document itself, as
 *    the section at depth 0.
 *  - SectionLayout: a section - its title, then its children, in order, with
 *    a gap before the first child, between any two, and after the last. It
 *    places nothing itself: what it builds renders onto the paper sequence
 *    one after another, in the tree's order - which is reading order.
 *  - ParagraphLayout: a paragraph (a cascade.print Paragraph) - a section's
 *    title, or body text. Its look is its place's (see typography.js); only
 *    its spans are bold or italic of their own.
 *
 * Gaps (see ../model/parts.js) are cascade.print GapMarkers: a caret row
 * each, taking no room. The gaps of a list nested deeper sit further right
 * in the margin, shallower further left - so the end of a section and the
 * place after it, at the same height, are told apart.
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

  // The sequence's own gaps are placed by its documents - a gap needs a
  // paper to be on, and before the first document there's none yet: each
  // document the gap before it, the last the one after it too.
  build() {
    const { sequence } = this;
    const count = sequence.children.length;
    return sequence.children.map((document, index) => new DocumentLayout({
      key: "document" + document.causality.id,
      document,
      before: gap(sequence, index),
      after: index === count - 1 ? gap(sequence, count) : null,
    }));
  }
}

// How tall a gap's caret is, and how far into the margin a gap at each level
// sits: the sequence's (level 0) furthest left, each level deeper a step
// nearer the text.
const gapHeight = mm(4);
const gapX = (level) => -mm(9) + level * mm(1.5);

export class DocumentLayout extends Section {
  setProperties({ document, before, after }) {
    this.document = document;
    this.before = frozen(before);
    this.after = frozen(after);
  }

  pageFormat() {
    const { paper, margins } = this.document;
    return frozen({ width: paper.width, height: paper.height, margins });
  }

  build() {
    const format = this.pageFormat();
    const marker = (key, position) => new GapMarker({ key, position, x: gapX(0), height: gapHeight, format });
    return [
      this.before ? marker("before", this.before) : null,
      new SectionLayout({ key: "document", section: this.document, depth: 0, width: contentWidth(format), format }),
      this.after ? marker("after", this.after) : null,
    ].filter(Boolean);
  }
}

// A section `depth` deep: its title, then each of its children - keyed by
// identity, so one inserted, moved or removed leaves the others as they
// were, their lines included - with the gaps of its list around them, at
// level depth + 1.
export class SectionLayout extends Component {
  setProperties({ section, depth, width, format }) {
    this.section = section;
    this.depth = depth;
    this.width = width;
    this.format = frozen(format);
  }

  build() {
    const { section, depth, width, format } = this;
    const children = section.children;
    const marker = (index) => new GapMarker({
      key: "gap" + index, position: gap(section, index), x: gapX(depth + 1), height: gapHeight, format,
    });
    const built = [
      new ParagraphLayout({ key: "title", paragraph: section.title, role: frozen({ title: depth }), width, format }),
      marker(0),
    ];
    children.forEach((child, index) => {
      built.push(isSection(child)
        ? new SectionLayout({ key: "part" + child.causality.id, section: child, depth: depth + 1, width, format })
        : new ParagraphLayout({ key: "part" + child.causality.id, paragraph: child, role: frozen({ body: true }), width, format }));
      built.push(marker(index + 1));
    });
    return built;
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

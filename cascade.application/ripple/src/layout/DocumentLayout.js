import { frozen } from "@liquefy/cascade.component";
import { Box, Section, Paragraph, contentWidth, monospaceMeasurer } from "../print/index.js";
import { isSection, titleLevel, hasExitTitle, exitTitle, paragraphText } from "../model/flows.js";
import { typography as defaultTypography, titleStyle } from "./typography.js";

const fallbackMeasurer = monospaceMeasurer();

// What an empty title shows, faintly - and an exit title before the title
// it repeats.
export const titlePlaceholder = "Title";
export const exitTitlePrefix = "❧ → ";

/**
 * Ripple's documents laid out onto a PaperSequence with cascade.print - a
 * box (see ../print/Box.js) for every flow:
 *
 *   new SequenceLayout({ sequence, measurer }).renderOnto(new PaperSequence());
 *
 *  - SequenceLayout: the root - its documents, one after another. Provides
 *    `measurer` (a monospace one if none is given) and `typography` to
 *    everything in it.
 *  - DocumentLayout: a document's paper (a cascade.print Section: each
 *    document starts on a paper of its own), and the document itself, as a
 *    section at the root.
 *  - SectionLayout: a section - its title, then its children, in order, and
 *    its exit title, if it has one (see ../model/flows.js). It places
 *    nothing itself: what it builds renders onto the paper sequence one
 *    after another, in the tree's order - which is reading order.
 *  - ParagraphLayout: a paragraph (a cascade.print Paragraph) - a section's
 *    title, or body text. Its look is its place's (see typography.js): a
 *    title's its title level's; only its spans are bold or italic of their
 *    own. An empty title shows "Title", faintly - a placeholder, no text.
 *  - ExitTitleLayout: a section's exit title - set as the title of a section
 *    directly inside it would be: a fleuron, an arrow, and its title again.
 *    Its lines' source is exitTitle(section).
 *
 * Only the flows are laid out here. The gaps between them - where a caret
 * can be besides the text - are placed afterwards, from what's laid out (see
 * ../paper/markers.js): they take no room, so they can never move a flow.
 */
export class SequenceLayout extends Box {
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
    const documents = this.sequence.children;
    return documents.map((document, index) => new DocumentLayout({
      key: "document" + document.causality.id,
      document,
      exit: hasExitTitle(document, documents[index + 1]),
    }));
  }
}

export class DocumentLayout extends Section {
  setProperties({ document, exit }) {
    this.document = document;
    this.exit = !!exit;
  }

  pageFormat() {
    const { paper, margins } = this.document;
    return frozen({ width: paper.width, height: paper.height, margins });
  }

  build() {
    const format = this.pageFormat();
    const { document, exit } = this;
    return new SectionLayout({ key: "document", section: document, level: titleLevel(document), exit, width: contentWidth(format), format });
  }
}

// A section, its title at `level`: its title, then each of its children -
// keyed by identity, so one inserted, moved or removed leaves the others as
// they were, their lines included - then, with `exit`, its exit title.
export class SectionLayout extends Box {
  setProperties({ section, level, exit, width, format }) {
    this.section = section;
    this.level = level;
    this.exit = !!exit;
    this.width = width;
    this.format = frozen(format);
  }

  build() {
    const { section, level, width, format } = this;
    const children = section.children;
    const boxes = [
      new ParagraphLayout({ key: "title", paragraph: section.title, role: frozen({ title: level }), width, format }),
      ...children.map((child, index) => isSection(child)
        ? new SectionLayout({
          key: "flow" + child.causality.id,
          section: child,
          level: titleLevel(child, level),
          exit: hasExitTitle(child, children[index + 1], level),
          width,
          format,
        })
        : new ParagraphLayout({ key: "flow" + child.causality.id, paragraph: child, role: frozen({ body: true }), width, format })),
    ];
    if (this.exit) boxes.push(new ExitTitleLayout({ key: "exit", section, level: level + 1, width, format }));
    return boxes;
  }
}

// A paragraph, laid out as its role says: `{ title: level }` - a section's
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
    const empty = this.role.title !== undefined && paragraphText(this.source) === "";
    return {
      ...layout,
      font,
      spans: empty ? [{ text: titlePlaceholder, font, placeholder: true }] : styledSpans(this.source.spans, font),
    };
  }
}

// A section's exit title, at `level` - one below the section's own.
export class ExitTitleLayout extends Paragraph {
  setProperties({ section, level, width, format }) {
    super.setProperties({ source: exitTitle(section), width, format });
    this.section = section;
    this.level = level;
  }

  content() {
    const { font, ...layout } = titleStyle(this.inherit("typography"), this.level);
    const title = this.section.title;
    return {
      ...layout,
      font,
      spans: [
        { text: exitTitlePrefix, font },
        ...(paragraphText(title) === "" ? [{ text: titlePlaceholder, font }] : styledSpans(title.spans, font)),
      ],
    };
  }
}

// A paragraph's spans, set in `font` - bold or italic as each span is.
function styledSpans(spans, font) {
  return spans.map((span) => ({
    text: span.text,
    font: { ...font, weight: span.bold ? 700 : font.weight, italic: span.italic || font.italic },
  }));
}

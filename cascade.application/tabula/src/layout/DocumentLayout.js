import { frozen } from "@liquefy/cascade.component";
import { Box, Section, Paragraph, contentWidth, monospaceMeasurer, mm } from "../print/index.js";
import { Document, isSection, titleLevel, hasExitTitle, exitTitle, paragraphText } from "../model/flows.js";
import { pageCount } from "../model/sequences.js";
import { frameSize } from "../model/frames.js";
import { typography as defaultTypography, titleStyle } from "./typography.js";

const fallbackMeasurer = monospaceMeasurer();

// What an empty title and an empty paragraph show, faintly, behind where
// their text will be - and an exit title before the title
// it goes back out to.
export const titlePlaceholder = "Title";
export const textPlaceholder = "Text";
// A paragraph's first line, following another's in a document indenting
// its paragraphs - when the typography doesn't say (see typography.js).
const defaultParagraphIndent = mm(5);

// Between a title's number and its text: an en space.
export const titleNumberGap = "\u2002";
export const exitTitlePrefix = "❧ → ";

/**
 * Tabula's documents laid out onto a PaperSequence with cascade.print - a
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
 *    its exit title, if it has one (see ../model/flows.js) - and, anchored
 *    to them, pages of their own: inner sequences (InsertLayout). A
 *    document in book mode: its chapters each on a fresh paper - a
 *    right-hand one, printed on both sides (`breakBefore` - a section's,
 *    its title's). It places
 *    nothing itself: what it builds renders onto the paper sequence one
 *    after another, in the tree's order - which is reading order.
 *  - ParagraphLayout: a paragraph (a cascade.print Paragraph) - a section's
 *    title, or body text. Its look is its place's (see typography.js): a
 *    title's its title level's; only its spans are bold or italic of their
 *    own. An empty one shows "Title" or "Text", faintly - a placeholder,
 *    no text: the caret only before its first letter, and typing there
 *    takes its place. A frame anchor in it (see ../model/frames.js) is its
 *    frame, as wide as its anchor says - no wider than the text area - and
 *    placed as it says (see ../print/lineBreaking.js).
 *  - ExitTitleLayout: a section's exit title - a fleuron, an arrow, and the
 *    title of the section it's in, what comes next being back out there -
 *    set one title level below the level of that section, whatever offsets
 *    there are in what it exits (a section directly in it, without any) -
 *    but spaced the other way round, since it belongs to what's before it:
 *    a title's space after it before it, and its space before it after.
 *    Its lines' source is exitTitle(section).
 *
 * Only the flows are laid out here. The markers beside them - where a caret
 * can be besides the text - are placed afterwards, from what's laid out (see
 * ../paper/markers.js): they take no room, so they can never move a flow.
 */
export class SequenceLayout extends Box {
  // `firstSide`: the side of a sheet its first page is - "recto" (the
  // default) or "verso": among pages of their own in another document,
  // after a right-hand page there, say (see ../print/Section.js).
  setProperties({ sequence, measurer, typography, firstSide = "recto" }) {
    this.sequence = sequence;
    this.firstSide = firstSide;
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
      firstSide: index === 0 ? this.firstSide : "recto",
    }));
  }
}

export class DocumentLayout extends Section {
  setProperties({ document, exit, firstSide = "recto" }) {
    this.document = document;
    this.exit = !!exit;
    this.firstSide = firstSide;
  }

  firstPageSide() {
    return this.firstSide;
  }

  // Its paper - and its page layout, for what shows the paper to draw on it
  // what's drawn on its pages (see ../model/pageLayout.js) - printed on both
  // sides, or one: its first page the front of a sheet, a right-hand page,
  // the next its back (see ../print/Section.js's formatOfPage()).
  pageFormat() {
    const { paper, pageLayout } = this.document;
    const sides = pageLayout.duplex ? { duplex: true, side: "recto" } : {};
    return frozen({ width: paper.width, height: paper.height, margins: pageLayout.margins, pageLayout, ...sides });
  }

  build() {
    const format = this.pageFormat();
    const { document, exit } = this;
    return new SectionLayout({
      key: "document", section: document, level: titleLevel(document), exit, width: contentWidth(format), format,
      numbered: document.numberTitles,
      indented: document.indentParagraphs,
    });
  }
}

// A section, its title at `level`: its title, then each of its children -
// keyed by identity, so one inserted, moved or removed leaves the others as
// they were, their lines included - then, with `exit`, its exit title,
// back out to `parent` (the section it's in - null for a document). In a
// document numbering its titles (`numbered`), its title has `number` -
// none for the document's own - and each section in it its own: this one's,
// a dot, and its place among the sections in it.
export class SectionLayout extends Box {
  setProperties({ section, parent = null, level, exit, width, format, numbered = false, number = null, indented = false, breakBefore = false }) {
    this.section = section;
    this.breakBefore = breakBefore;
    this.parent = parent;
    this.level = level;
    this.exit = !!exit;
    this.numbered = !!numbered;
    this.number = number;
    this.indented = !!indented;
    this.width = width;
    this.format = frozen(format);
  }

  build() {
    const { section, level, width, format, numbered, number, indented } = this;
    const children = section.children;
    let sections = 0;
    const numberOf = () => numbered ? (number ? number + "." : "") + ++sections : null;
    // A document as a book: its chapters each on a page of its own - a
    // right-hand one, printed on both sides.
    const book = section instanceof Document && section.bookMode;
    // Pages of their own anchored to a flow (see ../model/sequences.js).
    const sequence = (flow, side) => flow[side]
      ? [new InsertLayout({ key: side + flow.causality.id, sequence: flow[side], breakAfter: side === "before" || isSection(flow) || flow instanceof Document, before: side === "before" && flow instanceof Document })]
      : [];
    const boxes = [
      ...(section instanceof Document ? sequence(section, "before") : []),
      new ParagraphLayout({ key: "title", paragraph: section.title, role: frozen({ title: level, number }), width, format, breakBefore: this.breakBefore }),
      ...sequence(section.title, "after"),
      ...children.flatMap((child, index) => isSection(child)
        ? [
          ...sequence(child, "before"),
          new SectionLayout({
            key: "flow" + child.causality.id,
            section: child,
            parent: section,
            level: titleLevel(child, level),
            exit: hasExitTitle(child, children[index + 1], level),
            width,
            format,
            numbered,
            indented,
            number: numberOf(),
            breakBefore: book ? "recto" : false,
          }),
          ...sequence(child, "after"),
        ]
        : [
          new ParagraphLayout({
            key: "flow" + child.causality.id,
            paragraph: child,
            // Indented, in a document indenting its paragraphs - but the first of
            // a run, a section's first, or after a section, isn't.
            role: frozen({ body: true, indented, follows: indented && index > 0 && !isSection(children[index - 1]) }),
            width,
            format,
          }),
          ...sequence(child, "after"),
        ]),
    ];
    if (this.exit) boxes.push(new ExitTitleLayout({ key: "exit", section, parent: this.parent, level: level - section.titleOffset, width, format }));
    if (section instanceof Document) boxes.push(...sequence(section, "after"));
    return boxes;
  }
}

// Pages of their own, anchored here (see ../model/sequences.js): where they
// fall among the papers, written down for what shows them (see
// ../print/PaperSequence.js's `inserts`) - after the paper the text has
// got to, or, before a document's title, before its first. What comes
// after them, after a section (`breakAfter`), starts a fresh paper; after
// a paragraph, the text goes on filling the paper it's on. The papers after
// them counted on past their pages (`pages`): a right-hand one, or a
// left-hand one, as it falls. Before a document's title, its first paper
// a right-hand one, printed on both sides: a blank back after them (`pad`)
// where they'd end on a right-hand page.
export class InsertLayout extends Box {
  setProperties({ sequence, breakAfter = false, before = false }) {
    this.sequence = sequence;
    this.breakAfter = !!breakAfter;
    this.before = !!before;
  }

  render(sequence) {
    const next = sequence.next;
    const format = sequence.pages[next.page];
    const pages = pageCount(this.sequence);
    const pad = this.before && !!format.duplex && pages % 2 === 1;
    sequence.inserts.push(frozen({ page: next.page, before: this.before, sequence: this.sequence, format, pages, pad }));
    if (this.before) return;
    // The side of a sheet counted from a page further back - as far as
    // their pages.
    sequence.next = frozen({ ...next, firstPage: (next.firstPage || 0) - pages, ...(this.breakAfter ? { breakNext: true } : {}) });
  }
}

// A paragraph, laid out as its role says: `{ title: level, number }` - a
// section's title, with its number, if it has one, before it, fixed (see
// ../print/lineBreaking.js): shown, not text - or `{ body: true, indented,
// follows }`: body text - in a document indenting its paragraphs, not
// spaced apart, and, following another paragraph, its first line indented. Its lines are placed with the paragraph as
// their source - what a position on the papers then refers to.
export class ParagraphLayout extends Paragraph {
  setProperties({ paragraph, role, width, format, breakBefore = false }) {
    super.setProperties({ source: paragraph, width, format, breakBefore });
    this.role = frozen(role);
  }

  content() {
    const typography = this.inherit("typography");
    const style = this.role.body ? typography.body : titleStyle(typography, this.role.title);
    const { font, ...layout } = style;
    // In a document indenting its paragraphs: none spaced apart, a paragraph
    // following another on the line after it, its first line indented.
    if (this.role.body && this.role.indented) {
      layout.spaceBefore = 0;
      layout.spaceAfter = 0;
      layout.firstLineIndent = this.role.follows ? (typography.paragraphIndent ?? defaultParagraphIndent) : 0;
    }
    const placeholder = this.role.body ? textPlaceholder : titlePlaceholder;
    const number = this.role.number ? [{ text: this.role.number + titleNumberGap, font, fixed: true }] : [];
    return {
      ...layout,
      font,
      spans: [
        ...number,
        ...(paragraphText(this.source) === "" ? [{ text: placeholder, font, placeholder: true }] : styledSpans(this.source.spans, font, this.width, this.format)),
      ],
    };
  }
}

// A section's exit title, at `level` - one below that of `parent`, the
// section it goes back out to - and saying so: its title (none for a document).
export class ExitTitleLayout extends Paragraph {
  setProperties({ section, parent = null, level, width, format }) {
    super.setProperties({ source: exitTitle(section), width, format });
    this.parent = parent;
    this.level = level;
  }

  content() {
    const { font, spaceBefore = 0, spaceAfter = 0, ...layout } = titleStyle(this.inherit("typography"), this.level);
    const title = this.parent ? this.parent.title : null;
    return {
      ...layout,
      // It closes what's before it, as a title opens what's after it: its
      // spacing turned around - close to what's before, apart from what's
      // after.
      spaceBefore: spaceAfter,
      spaceAfter: spaceBefore,
      font,
      spans: [
        { text: exitTitlePrefix, font },
        // Its title's text - not its frames.
        ...(!title ? [] : paragraphText(title) === "" ? [{ text: titlePlaceholder, font }] : styledSpans(title.spans.filter((span) => !span.anchor), font)),
      ],
    };
  }
}

// A paragraph's spans, set in `font` - bold or italic as each span is - a
// frame anchor's its frame, at most `width` wide - the whole paper, for a
// page made a picture.
function styledSpans(spans, font, width = Infinity, paper = null) {
  return spans.map((span) => span.anchor ? {
    text: span.text,
    font,
    frame: {
      ...(span.anchor.placement === "page" && paper ? { width: paper.width, height: paper.height } : frameSize(span.anchor, width)),
      placement: span.anchor.placement,
      source: span.anchor,
    },
  } : {
    text: span.text,
    font: { ...font, weight: span.bold ? 700 : font.weight, italic: span.italic || font.italic },
  });
}

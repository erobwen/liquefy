import { observable } from "@liquefy/cascade.component";
import { position, gapPosition } from "@liquefy/cascade.print";

/**
 * Ripple's document model - a tree of parts, as a DAISY 2 book is: sections,
 * each with a title, holding paragraphs and the sections inside them.
 *
 *  - Part: what every node of the document is.
 *  - Paragraph: a leaf - its text, as spans. A span is styled on its own
 *    ({ text, bold, italic }); a paragraph as a whole holds no style at all.
 *  - Section: a title - a paragraph - and its children: paragraphs first,
 *    then sections, never a paragraph after a section (see
 *    checkChildren()).
 *  - Document: a section at the top - its title the document's - and the
 *    paper it's printed on.
 *  - Sequence: the root of it all - a list of documents, one after another.
 *
 * What a part looks like comes from where it is, not from the part: a
 * section's title is set as a heading for how deep the section is, and every
 * other paragraph as body text (see ../layout).
 *
 * Every part is observable, all the way down - its spans, its children - so
 * what's laid out from it follows every change.
 *
 * Positions - where a caret can be - are cascade.print's (see its
 * positions.js), of two kinds:
 *
 *   textPosition(paragraph, offset)  - in a paragraph's text
 *   gap(list, index)                 - before child `index` of `list`: a
 *                                      section, or the sequence
 *
 * A gap belongs to one list, at one level of the tree: "after A" and
 * "before B" among a section's children are the same gap; the end of a
 * section, and the place after it in the section around it, are two. Every
 * list has a gap before its first child (after a section's title), between
 * any two, and after its last - the sequence's included, before and after
 * everything.
 */
export class Part {}

export class Paragraph extends Part {
  // spans: strings, or { text, bold, italic }.
  constructor(spans = []) {
    super();
    this.spans = observable(spans.map(toSpan));
    return observable(this);
  }
}

export class Section extends Part {
  // title: a Paragraph, a string, or spans. children: paragraphs, then
  // sections.
  constructor(title, children = []) {
    super();
    this.title = toParagraph(title);
    this.children = observable(checkChildren(children));
    return observable(this);
  }
}

export class Document extends Section {
  constructor({ title, paper, margins }, children = []) {
    super(title, children);
    this.paper = paper;
    this.margins = margins;
  }
}

export class Sequence extends Part {
  constructor(children = []) {
    super();
    children.forEach((child, index) => {
      if (!(child instanceof Document)) throw new Error("A sequence's child " + index + " isn't a document.");
    });
    this.children = observable(children);
    return observable(this);
  }
}

export const textPosition = (paragraph, offset, lineEnd = false) => position(paragraph, offset, lineEnd);
export const gap = (list, index) => gapPosition(list, index);

export const isParagraph = (part) => part instanceof Paragraph;
export const isSection = (part) => part instanceof Section;

// A section's children as they may be: parts, paragraphs before sections.
// Throws otherwise; returns them as they are.
export function checkChildren(children) {
  let sectionSeen = false;
  children.forEach((child, index) => {
    if (!(child instanceof Paragraph) && !(child instanceof Section)) throw new Error("A section's child " + index + " isn't a paragraph or a section.");
    if (child instanceof Document) throw new Error("A document can't be inside a section.");
    if (child instanceof Section) sectionSeen = true;
    else if (sectionSeen) throw new Error("A section's paragraphs come before its sections - child " + index + " is a paragraph after a section.");
  });
  return children;
}

// The text of a paragraph, all its spans together.
export function paragraphText(paragraph) {
  let text = "";
  for (const span of paragraph.spans) text += span.text;
  return text;
}

function toSpan(span) {
  if (typeof(span) === "string") return observable({ text: span, bold: false, italic: false });
  return observable({ text: span.text, bold: !!span.bold, italic: !!span.italic });
}

function toParagraph(title) {
  if (title instanceof Paragraph) return title;
  return new Paragraph(typeof(title) === "string" ? [title] : title || []);
}

/**
 * Writing a document down, compactly:
 *
 *   document({ title: "A book", paper, margins },
 *     paragraph("An introduction, ", bold("in bold"), "."),
 *     section("The first chapter",
 *       paragraph("..."),
 *       section("Its first part", paragraph("...")),
 *     ),
 *   )
 */
export const paragraph = (...spans) => new Paragraph(spans);
export const section = (title, ...children) => new Section(title, children);
export const document = (properties, ...children) => new Document(properties, children);
export const sequence = (...documents) => new Sequence(documents);
export const bold = (text) => ({ text, bold: true });
export const italic = (text) => ({ text, italic: true });
export const boldItalic = (text) => ({ text, bold: true, italic: true });

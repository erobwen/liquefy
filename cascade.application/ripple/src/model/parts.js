import { observable } from "@liquefy/cascade.component";

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
 * Positions - where a caret can be - are of three kinds:
 *
 *   textPosition(paragraph, offset, lineEnd)  - in a paragraph's text, as
 *                                               cascade.print's positions are
 *   gap(list, index)                          - before child `index` of
 *                                               `list`: a section, or the
 *                                               sequence
 *   partStart(part), partEnd(part)            - at the very start and end of
 *                                               a part: a document, a
 *                                               section, a title, a paragraph
 *
 * A gap belongs to one list, at one level of the tree: "after A" and
 * "before B" among a section's children are the same gap; the end of a
 * section, and the place after it in the section around it, are two. Every
 * list has a gap before its first child (after a section's title), between
 * any two, and after its last - the sequence's included, before and after
 * everything. And every part has a start and an end of its own, besides the
 * gaps around it: between two paragraphs A and B, the end of A, the gap
 * between them, and the start of B are three places.
 *
 * Gaps and part starts and ends are markers - places between text.
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

export const textPosition = (paragraph, offset, lineEnd = false) => Object.freeze({ paragraph, offset, lineEnd });
export const gap = (list, index) => Object.freeze({ list, index });
export const partStart = (part) => Object.freeze({ part, edge: "start" });
export const partEnd = (part) => Object.freeze({ part, edge: "end" });
export const isGap = (at) => !!at && "list" in at;
export const isPartEdge = (at) => !!at && "part" in at;
// A marker: a place between text - a gap, or a part's start or end.
export const isMarker = (at) => isGap(at) || isPartEdge(at);

// The same place - in the text wherever a line break puts it, the same gap,
// or the same part's same edge.
export function samePosition(a, b) {
  if (isGap(a) || isGap(b)) return isGap(a) && isGap(b) && a.list === b.list && a.index === b.index;
  if (isPartEdge(a) || isPartEdge(b)) return isPartEdge(a) && isPartEdge(b) && a.part === b.part && a.edge === b.edge;
  return a.paragraph === b.paragraph && a.offset === b.offset;
}

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

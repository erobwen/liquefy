import { observable } from "@liquefy/cascade.component";

/**
 * Ripple's document model - a tree of flows, as a DAISY 2 book is: sections,
 * each with a title, holding paragraphs and the sections inside them.
 *
 *  - Flow: what every node of the document is.
 *  - Paragraph: a leaf - its text, as spans. A span is styled on its own
 *    ({ text, bold, italic }); a paragraph as a whole holds no style at all.
 *  - Section: a title - a paragraph - and its children: paragraphs and
 *    sections, in any order (see checkChildren()) - a paragraph after a
 *    section closed by the section's exit title (see below).
 *  - Document: a section at the top - its title the document's - and the
 *    paper it's printed on.
 *  - Sequence: the root of it all - a list of documents, one after another.
 *
 * What a flow looks like comes from where it is, not from the flow: a
 * section's title is set as a heading for how deep the section is, and every
 * other paragraph as body text (see ../layout).
 *
 * Every flow is observable, all the way down - its spans, its children - so
 * what's laid out from it follows every change.
 *
 * Positions - where a caret can be - are of three kinds:
 *
 *   textPosition(paragraph, offset, lineEnd)  - in a paragraph's text, as
 *                                               cascade.print's positions are
 *   gap(list, index, slot)                    - before child `index` of
 *                                               `list`: a section, or the
 *                                               sequence - its split marker
 *                                               (slot 0) or join marker (1)
 *   flowStart(flow), flowEnd(flow)            - at the very start and end of
 *                                               a flow: a document, a
 *                                               section, a title, a paragraph
 *
 * A gap is between two flows lying side by side in a list - two siblings,
 * or a section's title and its first child - and belongs to that list, at
 * one level of the tree: "after A" and "before B" among a section's children
 * are the same gap. Before a list's first flow and after its last there's no
 * gap: those places are the flows' own start and end. Every flow has a start
 * and an end of its own: between two paragraphs A and B, the end of A, the
 * gap between them, and the start of B are three places; and the end of a
 * section's last paragraph, and the end of the section, are two.
 *
 * A gap may be two places, one above the other: its split marker (slot 0,
 * the upper - splitMarker()), where something is added between the two
 * flows, and its join marker (slot 1, the lower - joinMarker()), where the
 * two flows are joined into one. A gap with one place has only its split
 * marker (see ../paper/markers.js for which gaps have both).
 *
 * Gaps and flow starts and ends are markers - places between text.
 *
 * Title levels: a section's title is set for its level (see titleLevel()) -
 * 1 for a section at the root, its parent's + 1 for one inside another,
 * each pushed further down by its own `titleOffset`. A paragraph's level is
 * infinite: below every title.
 *
 * A section A can be followed by a sibling B of a higher level than A's - a
 * paragraph after a section, or a section with a title offset - and seeing
 * B, nobody could tell whether B is inside A, or after it. Such an A has an
 * exit title (see hasExitTitle()): after all that's in it, saying that what
 * comes next is back out of A, in the section A is in - a fleuron, an arrow,
 * and that section's title, set a title level below it. A sibling of the same
 * level, or a lower one, needs none: its title says where it is.
 * It's no text of the document's - nowhere a caret can be - only laid out:
 * exitTitle(A) is what stands for it there.
 */
export class Flow {}

export class Paragraph extends Flow {
  // spans: strings, or { text, bold, italic }.
  constructor(spans = []) {
    super();
    this.spans = observable(spans.map(toSpan));
    return observable(this);
  }
}

export class Section extends Flow {
  // title: a Paragraph, a string, or spans - always there, if empty (then
  // laid out as a placeholder, see ../layout). children: paragraphs and
  // sections. titleOffset: how many title levels further down than its
  // place makes it (see titleLevel()).
  constructor(title, children = [], titleOffset = 0) {
    super();
    this.title = toParagraph(title);
    this.titleOffset = titleOffset;
    this.children = observable(checkChildren(children));
    return observable(this);
  }
}

export class Document extends Section {
  constructor({ title, paper, margins, titleOffset = 0 }, children = []) {
    super(title, children, titleOffset);
    this.paper = paper;
    this.margins = margins;
  }
}

export class Sequence extends Flow {
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
export const gap = (list, index, slot = 0) => Object.freeze({ list, index, slot });
export const splitMarker = (list, index) => gap(list, index, 0);
export const joinMarker = (list, index) => gap(list, index, 1);
export const isSplitMarker = (at) => isGap(at) && at.slot === 0;
export const isJoinMarker = (at) => isGap(at) && at.slot === 1;
export const flowStart = (flow) => Object.freeze({ flow, edge: "start" });
export const flowEnd = (flow) => Object.freeze({ flow, edge: "end" });
export const isGap = (at) => !!at && "list" in at;
export const isFlowEdge = (at) => !!at && "flow" in at;
// A marker: a place between text - a gap, or a flow's start or end.
export const isMarker = (at) => isGap(at) || isFlowEdge(at);

// The same place - in the text wherever a line break puts it, the same gap
// in the same slot, or the same flow's same edge.
export function samePosition(a, b) {
  if (isGap(a) || isGap(b)) return isGap(a) && isGap(b) && a.list === b.list && a.index === b.index && a.slot === b.slot;
  if (isFlowEdge(a) || isFlowEdge(b)) return isFlowEdge(a) && isFlowEdge(b) && a.flow === b.flow && a.edge === b.edge;
  return a.paragraph === b.paragraph && a.offset === b.offset;
}

export const isParagraph = (flow) => flow instanceof Paragraph;
export const isSection = (flow) => flow instanceof Section;

// A flow's title level, inside a section of `parentLevel` (0 at the root):
// a section's its parent's + 1 + its own offset; a paragraph's infinite.
export function titleLevel(flow, parentLevel = 0) {
  return isSection(flow) ? parentLevel + 1 + flow.titleOffset : Infinity;
}

// Whether `flow`, followed by `next` in a list inside a section of
// `parentLevel`, has an exit title: a section, followed by a flow of a
// higher title level - a paragraph, or a section further down.
export function hasExitTitle(flow, next, parentLevel = 0) {
  return isSection(flow) && !!next && titleLevel(next, parentLevel) > titleLevel(flow, parentLevel);
}

// What stands for a section's exit title where it's laid out - the same one
// every time it's asked for: { exitOf: section }.
const exitTitles = new WeakMap();
export function exitTitle(section) {
  let exit = exitTitles.get(section);
  if (!exit) exitTitles.set(section, exit = Object.freeze({ exitOf: section }));
  return exit;
}

// A section's children as they may be: paragraphs and sections, in any
// order - no documents. Throws otherwise; returns them as they are.
export function checkChildren(children) {
  children.forEach((child, index) => {
    if (!(child instanceof Paragraph) && !(child instanceof Section)) throw new Error("A section's child " + index + " isn't a paragraph or a section.");
    if (child instanceof Document) throw new Error("A document can't be inside a section.");
  });
  return children;
}

// The text of a paragraph, all its spans together.
export function paragraphText(paragraph) {
  let text = "";
  for (const span of paragraph.spans) text += span.text;
  return text;
}

// A span, as a paragraph holds it: a string, or { text, bold, italic }.
export const makeSpan = (span) => toSpan(span);

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
 *       section("A section in it", paragraph("...")),
 *       section({ title: "Set a level further down", titleOffset: 1 }, paragraph("...")),
 *     ),
 *   )
 */
export const paragraph = (...spans) => new Paragraph(spans);
// The title, or { title, titleOffset }.
export const section = (title, ...children) => isTitleWithOffset(title)
  ? new Section(title.title, children, title.titleOffset)
  : new Section(title, children);
const isTitleWithOffset = (title) => !!title && typeof(title) === "object" && !Array.isArray(title) && !(title instanceof Paragraph) && "titleOffset" in title;
export const document = (properties, ...children) => new Document(properties, children);
export const sequence = (...documents) => new Sequence(documents);
export const bold = (text) => ({ text, bold: true });
export const italic = (text) => ({ text, italic: true });
export const boldItalic = (text) => ({ text, bold: true, italic: true });

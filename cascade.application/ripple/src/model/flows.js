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
 * Positions - where a caret can be - are of two kinds:
 *
 *   textPosition(paragraph, offset, lineEnd)  - in a paragraph's text, as
 *                                               cascade.print's positions are
 *   flowStart(flow), flowEnd(flow)            - at the very start and end of
 *                                               a flow - its pre and post
 *                                               marker: a document's, a
 *                                               section's, a title's, a
 *                                               paragraph's
 *
 * Every flow has a start and an end of its own: the end of a section's last
 * paragraph, and the end of the section, are two places. Flow starts and
 * ends are markers - places beside the text.
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

// A document - the root of a tree of flows - holds what goes for all of it:
// its paper, and whether its titles are numbered (`numberTitles`, see
// titleNumber()).
export class Document extends Section {
  constructor({ title, paper, margins, titleOffset = 0, numberTitles = false }, children = []) {
    super(title, children, titleOffset);
    this.paper = paper;
    this.margins = margins;
    this.numberTitles = !!numberTitles;
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
export const flowStart = (flow) => Object.freeze({ flow, edge: "start" });
export const flowEnd = (flow) => Object.freeze({ flow, edge: "end" });
export const isFlowEdge = (at) => !!at && "flow" in at;
// A marker: a place beside the text - a flow's start or end.
export const isMarker = (at) => isFlowEdge(at);

// The same place - in the text wherever a line break puts it, or the same
// flow's same edge.
export function samePosition(a, b) {
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

// The sections a flow is in, outermost - its document - first: for a
// section's title, that section last. Null if it's nowhere under `root` (a
// sequence, or a document).
export function sectionsAround(root, flow) {
  const visit = (section, path) => {
    const here = [...path, section];
    if (section.title === flow) return here;
    for (const child of section.children) {
      if (child === flow) return here;
      if (isSection(child)) {
        const found = visit(child, here);
        if (found) return found;
      }
    }
    return null;
  };
  for (const document of root instanceof Sequence ? root.children : [root]) {
    if (document === flow) return [];
    const found = visit(document, []);
    if (found) return found;
  }
  return null;
}

// The flow a position is in - a title standing for its section; at a
// marker, the marker's flow - and the sections it's in, outermost first:
// { flow, around }. Null with no position, or one in what isn't there any
// more.
export function focusedFlow(root, at) {
  if (!at) return null;
  const flow = isFlowEdge(at) ? at.flow : at.paragraph;
  const around = sectionsAround(root, flow);
  if (!around) return null;
  const last = around[around.length - 1];
  if (last && last.title === flow) return { flow: last, around: around.slice(0, -1) };
  return { flow, around };
}

// A title's number, in a document numbering its titles - "2.1" for the
// first section in its second: the place of each section it's in, and its
// own, among the sections beside it (paragraphs not counted), from the
// document down. `around` are the sections it's in, outermost - the
// document - first (see sectionsAround()). The document's own title has
// none, nor any title in a document not numbering them: null.
export function titleNumber(section, around) {
  if (around.length === 0 || !around[0].numberTitles) return null;
  const path = [...around.slice(1), section];
  return path.map((each, index) => {
    const parent = index === 0 ? around[0] : path[index - 1];
    return String(parent.children.filter(isSection).indexOf(each) + 1);
  }).join(".");
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

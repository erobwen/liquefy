import { mm, px, contentWidth } from "../print/index.js";
import { Sequence, Document, isSection, flowStart, flowEnd, titleLevel, hasExitTitle, exitTitle } from "../model/flows.js";

/**
 * Where a caret can be in a laid-out Tabula document: its caret rows - every
 * line of text, and every marker - in reading order.
 *
 * Markers are the places beside the text (see ../model/flows.js): every
 * flow's start and end - its pre and post marker - a document's, a
 * section's, a paragraph's; a title has only a start (an end would do
 * nothing a title's text doesn't). A section reads:
 *
 *   start(section)  start(title) [title text]
 *     start(child) ... end(child)  ...
 *   end(section)
 *
 * Nothing between two flows: the caret goes from line to line, as in any
 * word processor, and the structure is edited from the text (see
 * ./editing.js).
 *
 * The lines are cascade.print's, as laid out. The markers are placed here,
 * after the text is laid out and from it - so they can never move a flow:
 * a marker takes no room. Each is a vertical bar, as tall as a caret in the
 * text, beside its flow: a start on the flow's first line, left of its
 * bounding box (as far as its lines reach); an end on its last line, at the
 * right edge of its area - the text area. Between two flows' text, the
 * markers there form a run - what ends after the one (innermost first),
 * what starts before the other (outermost first). The ends of flows nested
 * in each other, ending together, are all in the same spot, one on top of
 * the other: the caret still goes through them one by one, in reading
 * order, and which one it's at, its area shows. The starts step out to the
 * left from their flows, `besideStep` (2px) apart, the innermost a step
 * from its box.
 *
 * Every marker also has an area - what it stands for: its flow's content
 * box (see flowBoxes()), rectangles across the text area, one for each
 * paper it's on. Flows ending (or starting) together have their areas one
 * inside another.
 *
 * Every flow laid out is boxes on the papers (see ../print/Box.js): its line
 * boxes, and around them its content box - the bounding box of all that's
 * in it, its exit title included - and its delimiter boxes, what opens and
 * closes it apart from what it holds: a start delimiter box and an end
 * delimiter box. A paragraph has none. A section's are its content box but
 * for the span its children take up: from its top down to the top of its
 * first child (its title, and the room after it), and from the bottom of its
 * last child down to its bottom (its exit title, if it has one - see
 * ../model/flows.js - and the room before it). Each across the text area,
 * as every area is (flowBoxes() gives them). Like the markers, these boxes
 * are worked out here from the line boxes - the paper sequence holds no
 * others.
 *
 * An exit title is laid out text, but no place for a caret: no caret row.
 * The section's end is beside it.
 *
 * A caret row is a placed line (cascade.print's), or a marker row:
 *
 *   { marker, kind, type, level, x, top, height, area }       - beside
 *   { marker, kind, type, level, x, width, y, below: true, area } - below
 *     - marker: its position; kind: "flowStart" or "flowEnd"; type: which
 *       of markerTypes it is
 *     - level: how deep it is in the tree (a document 1, ...)
 *     - beside a line: x, the bar's; top, height: a caret's on the line
 *     - below a line: x, width, the text area; y, the bar's
 *     - area: [{ page, x, top, width, height }]
 *
 * Section ends - a section's, a document's - can go below instead
 * (`sectionEnds` "below"; "beside", by default): a horizontal bar across the
 * text area, `belowGap` under the section's last line - easier found, and a
 * row of their own for moving up and down. Ends of sections nested in each
 * other, ending together, are all at one height, one on top of the other:
 * moving up and down goes through them one by one, in reading order.
 *
 * Returned as [{ page, row }], in reading order.
 *
 * Which markers there are can be chosen, by type - to try out which places a
 * caret should be able to go (see markerTypes below): `types` maps a type to
 * whether its markers are there, every type there unless it says false. In
 * a document numbering its titles, though, a section's start is always
 * there, whatever `types` says: the place before its title's number, which
 * is no text (see ../layout).
 */

// The types of markers, as an editor shows them to be chosen.
export const markerTypes = Object.freeze([
  Object.freeze({ type: "paragraphStart", label: "Paragraph start" }),
  Object.freeze({ type: "paragraphEnd", label: "Paragraph end" }),
  Object.freeze({ type: "titleStart", label: "Title start" }),
  Object.freeze({ type: "sectionStart", label: "Section start" }),
  Object.freeze({ type: "sectionEnd", label: "Section end" }),
]);

// How far a start or end beside its flow is from the one inside it - the
// innermost, from the flow's bounding box.
export const besideStep = px(2);

export function caretRows(sequence, root, { types = {}, sectionEnds = "beside" } = {}) {
  const items = readingOrder(root).filter((item) => item.block || item.always || types[item.type] !== false);
  const lines = linesByParagraph(sequence);
  const boundsOf = lineBounds(lines);
  const boxOf = boxesFrom(flowExtents(lines), sequence);
  let run = [];
  const flush = () => {
    placeRun(run, boundsOf, boxOf, sequence, sectionEnds);
    run = [];
  };
  for (const item of items) {
    if (item.block) flush();
    else run.push(item);
  }
  flush();
  const rows = [];
  for (const item of items) {
    if (item.block) {
      // An exit title is laid out, but no place for a caret.
      if (item.exit) continue;
      for (const placed of lines.get(item.block) || []) rows.push({ page: placed.page, row: placed.line });
    } else if (item.placed) {
      rows.push(item.placed);
    }
  }
  return rows;
}

// Every paragraph and every marker of the tree, in reading order: { block }
// for a paragraph's text (a title, or body text) - { block, exit: true } for
// a section's exit title, after all that's in it - and for a marker
// { marker, kind, type, level, flow, always } - `type` one of markerTypes';
// `always` there, whatever `types` says: a section's start, in a document
// numbering its titles.
export function readingOrder(root) {
  const items = [];
  const visitParagraph = (paragraph, level, role) => {
    items.push({ marker: flowStart(paragraph), kind: "flowStart", type: role + "Start", level, flow: paragraph });
    items.push({ block: paragraph });
    if (role !== "title") items.push({ marker: flowEnd(paragraph), kind: "flowEnd", type: role + "End", level, flow: paragraph });
  };
  // `titleAt`: the section's title level; `exit`: whether it has an exit
  // title (see ../model/flows.js).
  // `numbered`: whether its document numbers its titles - its start, then,
  // always there: a place before the number, which is no text.
  const visitSection = (section, level, titleAt, exit, numbered = false) => {
    items.push({ marker: flowStart(section), kind: "flowStart", type: "sectionStart", level, flow: section, always: numbered });
    visitParagraph(section.title, level + 1, "title");
    const children = section.children;
    const numbering = numbered || (section instanceof Document && section.numberTitles);
    children.forEach((child, index) => {
      if (isSection(child)) visitSection(child, level + 1, titleLevel(child, titleAt), hasExitTitle(child, children[index + 1], titleAt), numbering);
      else visitParagraph(child, level + 1, "paragraph");
    });
    if (exit) items.push({ block: exitTitle(section), exit: true });
    items.push({ marker: flowEnd(section), kind: "flowEnd", type: "sectionEnd", level, flow: section });
  };
  if (root instanceof Sequence) {
    const documents = root.children;
    documents.forEach((document, index) => visitSection(document, 1, titleLevel(document), hasExitTitle(document, documents[index + 1])));
  } else {
    visitSection(root, 1, titleLevel(root), false);
  }
  return items;
}

// Every placed line, by the paragraph it's of: [{ page, line }], in order.
function linesByParagraph(sequence) {
  const result = new Map();
  sequence.pages.forEach((format, page) => {
    for (const line of sequence.linesOf(page)) {
      let list = result.get(line.paragraph);
      if (!list) result.set(line.paragraph, list = []);
      list.push({ page, line });
    }
  });
  return result;
}

// Every paragraph a flow's lines are of, in order: its own - or a section's
// title, its children's, and its exit title.
function eachParagraph(flow, visit) {
  if (!isSection(flow)) return visit(flow);
  visit(flow.title);
  flow.children.forEach((child) => eachParagraph(child, visit));
  visit(exitTitle(flow));
}

// The papers a flow is on, and how far down each it reaches: [[page, { top,
// bottom }]], by page. Worked out for a flow the first time it's asked for.
function flowExtents(lines) {
  const known = new Map();
  return (flow) => {
    if (known.has(flow)) return known.get(flow);
    const pages = new Map();
    eachParagraph(flow, (paragraph) => {
      for (const { page, line } of lines.get(paragraph) || []) {
        const extent = pages.get(page);
        const bottom = line.top + line.height;
        if (!extent) pages.set(page, { top: line.top, bottom });
        else {
          extent.top = Math.min(extent.top, line.top);
          extent.bottom = Math.max(extent.bottom, bottom);
        }
      }
    });
    const extents = [...pages].sort(([a], [b]) => a - b);
    known.set(flow, extents);
    return extents;
  };
}

// A flow's first and last lines ({ page, line }), and how far left and
// right its lines reach: { first, last, left, right }. Null for a flow with
// no lines. Worked out for a flow the first time it's asked for.
function lineBounds(lines) {
  const known = new Map();
  return (flow) => {
    if (known.has(flow)) return known.get(flow);
    let box = null;
    eachParagraph(flow, (paragraph) => {
      for (const placed of lines.get(paragraph) || []) {
        const { x, width } = placed.line;
        if (!box) box = { first: placed, last: placed, left: x, right: x + width };
        else {
          box.last = placed;
          box.left = Math.min(box.left, x);
          box.right = Math.max(box.right, x + width);
        }
      }
    });
    known.set(flow, box);
    return box;
  };
}

const closes = (item) => item.kind === "flowEnd";
const opens = (item) => item.kind === "flowStart";

// A run's starts and ends beside their flows, each with its area: the ends
// at the right edge of the text area, all in one spot - or, a section's,
// with `sectionEnds` "below", under its last line, all at one height; the
// starts left of their flows, the innermost (the last) a step out, every
// one before it a step further.
function placeRun(run, boundsOf, boxOf, sequence, sectionEnds) {
  for (const item of run.filter(closes)) {
    const bounds = boundsOf(item.flow);
    if (!bounds) continue;
    item.placed = sectionEnds === "below" && item.type === "sectionEnd"
      ? belowRow(item, bounds.last, sequence)
      : besideRow(item, bounds.last, textAreaRight(sequence, bounds.last.page));
  }
  const starts = run.filter(opens);
  starts.forEach((item, index) => {
    const bounds = boundsOf(item.flow);
    if (bounds) item.placed = besideRow(item, bounds.first, bounds.left - besideStep * (starts.length - index));
  });
  for (const item of run) {
    if (item.placed) item.placed.row = Object.freeze({ ...item.placed.row, area: boxOf(item.flow).content });
  }
}

const textAreaRight = (sequence, page) => sequence.pages[page].margins.left + contentWidth(sequence.pages[page]);

// A vertical bar at `x` beside a placed line - as tall as a caret on it.
function besideRow(item, { page, line }, x) {
  return {
    page,
    row: {
      marker: item.marker, kind: item.kind, type: item.type, level: item.level,
      x, top: line.baseline - line.ascent, height: line.ascent + line.descent,
    },
  };
}

// How far under a section's last line its end goes, with `sectionEnds`
// "below".
export const belowGap = mm(1);

// A horizontal bar across the text area, just under a placed line: a
// section's end, below it.
function belowRow(item, { page, line }, sequence) {
  const format = sequence.pages[page];
  return {
    page,
    row: {
      marker: item.marker, kind: item.kind, type: item.type, level: item.level,
      x: format.margins.left, width: contentWidth(format), y: line.top + line.height + belowGap, below: true,
    },
  };
}

// The boxes of every flow laid out on a paper sequence (see the class doc):
// flowBoxes(sequence)(flow) is the flow's.
export function flowBoxes(sequence) {
  return boxesFrom(flowExtents(linesByParagraph(sequence)), sequence);
}

// A flow's boxes, each rectangles across the text area, one per paper it's
// on - from its extents (flowExtents()):
//
//   { content, startDelimiter, endDelimiter }
//
//  - content: from its first line to its last, a section's title and exit
//    title included.
//  - startDelimiter: what opens it, before what it holds - a section's,
//    from its top down to the top of its first child: its title, and the
//    room after it. A section with nothing in it: all of it.
//  - endDelimiter: what closes it, after what it holds - a section's, from
//    the bottom of its last child down to its own bottom: its exit title, if
//    it has one, and the room before it.
//
// Either delimiter null when there's nothing there - a paragraph's always.
// Worked out for a flow the first time it's asked for; frozen.
function boxesFrom(extentOf, sequence) {
  const known = new Map();
  const rect = (page, top, bottom) => {
    const format = sequence.pages[page];
    return Object.freeze({ page, x: format.margins.left, top, width: contentWidth(format), height: Math.max(0, bottom - top) });
  };
  const frozenOrNull = (rects) => rects.length > 0 ? Object.freeze(rects) : null;
  return (flow) => {
    if (known.has(flow)) return known.get(flow);
    const own = extentOf(flow);
    const content = Object.freeze(own.map(([page, { top, bottom }]) => rect(page, top, bottom)));
    let startDelimiter = null;
    let endDelimiter = null;
    if (isSection(flow)) {
      const children = flow.children.map(extentOf).filter((extents) => extents.length > 0);
      if (children.length === 0) startDelimiter = content;
      else {
        const [firstPage, { top: firstTop }] = children[0][0];
        const last = children[children.length - 1];
        const [lastPage, { bottom: lastBottom }] = last[last.length - 1];
        const start = [];
        const end = [];
        for (const [page, { top, bottom }] of own) {
          if (page < firstPage) start.push(rect(page, top, bottom));
          else if (page === firstPage && firstTop > top) start.push(rect(page, top, firstTop));
          if (page > lastPage) end.push(rect(page, top, bottom));
          else if (page === lastPage && bottom > lastBottom) end.push(rect(page, lastBottom, bottom));
        }
        startDelimiter = frozenOrNull(start);
        endDelimiter = frozenOrNull(end);
      }
    }
    const box = Object.freeze({ content, startDelimiter, endDelimiter });
    known.set(flow, box);
    return box;
  };
}

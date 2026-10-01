import { mm, contentWidth } from "@liquefy/cascade.print";
import { Sequence, isSection, gap, partStart, partEnd } from "../model/parts.js";

/**
 * Where a caret can be in a laid-out Ripple document: its caret rows - every
 * line of text, and every marker - in reading order.
 *
 * Markers are the places between text (see ../model/parts.js): every part's
 * start and end - a document's, a section's, a title's, a paragraph's - and
 * the gaps of every list, before, between and after its children. A section
 * reads:
 *
 *   start(section)  start(title) [title text] end(title)  gap(0)
 *     start(child) ... end(child)  gap(1)  ...  gap(n)
 *   end(section)
 *
 * The lines are cascade.print's, as laid out. The markers are placed here,
 * after the text is laid out and from it - so they can never move a part:
 * a marker takes no room, it's put in the room there is. Between two parts
 * lying one after the other, the markers in between form a run - what closes
 * after the one (part ends, and list ends: innermost first), the gap between
 * the two if they're siblings, and what opens before the other (list starts,
 * and part starts: outermost first). A marker's bar is a horizontal line
 * across the text area, at a height:
 *
 *  - The gap between two siblings: dead centre between them, from the lower
 *    edge of the one to the upper edge of the other.
 *  - What closes: spread evenly from the lower edge of the part before down
 *    to that centre - the outermost at the centre - or, with nothing after
 *    on the paper, down to a fixed distance (`edge`) below.
 *  - What opens: the same, mirrored - spread evenly from the centre (or
 *    `edge` above) down towards the part after, the innermost nearest it.
 *
 * A run between two parts on different papers goes on both: what closes,
 * and the gap, below the part before, on its paper; what opens above the
 * part after, on its.
 *
 * Every marker also has an area - what it stands for, as rectangles across
 * the text area, one for each paper it's on:
 *
 *  - A part's start or end: the part's bounding box - a section's, from its
 *    title to its last line. Parts ending (or starting) together have their
 *    areas one inside another.
 *  - A gap: the room of its run - from the lower edge of the part before to
 *    the upper edge of the part after (or `edge` beyond, with none); its bar
 *    in the middle of it, for a gap between siblings.
 *
 * A caret row is a placed line (cascade.print's), or a marker row:
 *
 *   { marker, kind, level, x, width, y, area }
 *     - marker: its position; kind: "partStart", "partEnd", "between",
 *       "listStart" or "listEnd"
 *     - level: how deep it is in the tree (the sequence's gaps 0, a
 *       document and its gaps 1, ...)
 *     - x, width: the text area; y: the bar's
 *     - area: [{ page, x, top, width, height }]
 *
 * Returned as [{ page, row }], in reading order.
 */

// How far a marker with nothing beyond it is from its part: about half the
// room between two paragraphs.
export const edgeDistance = mm(1.5);

export function caretRows(sequence, root, { edge = edgeDistance } = {}) {
  const items = readingOrder(root);
  const lines = linesByParagraph(sequence);
  const extentOf = partExtents(lines);
  placeMarkers(items, lines, extentOf, sequence, edge);
  const rows = [];
  for (const item of items) {
    if (item.block) {
      for (const placed of lines.get(item.block) || []) rows.push({ page: placed.page, row: placed.line });
    } else if (item.placed) {
      rows.push(item.placed);
    }
  }
  return rows;
}

// Every paragraph and every marker of the tree, in reading order: { block }
// for a paragraph's text (a title, or body text), and for a marker
// { marker, kind, level, part } - `part` being, for a part's start or end,
// the part.
export function readingOrder(root) {
  const items = [];
  const gapItem = (list, index, level, hasTitle) => {
    const count = list.children.length;
    const kind = index === count ? "listEnd" : (index === 0 && !hasTitle ? "listStart" : "between");
    items.push({ marker: gap(list, index), kind, level });
  };
  const visitParagraph = (paragraph, level) => {
    items.push({ marker: partStart(paragraph), kind: "partStart", level, part: paragraph });
    items.push({ block: paragraph });
    items.push({ marker: partEnd(paragraph), kind: "partEnd", level, part: paragraph });
  };
  const visitSection = (section, level) => {
    items.push({ marker: partStart(section), kind: "partStart", level, part: section });
    visitParagraph(section.title, level + 1);
    section.children.forEach((child, index) => {
      gapItem(section, index, level + 1, true);
      if (isSection(child)) visitSection(child, level + 1);
      else visitParagraph(child, level + 1);
    });
    gapItem(section, section.children.length, level + 1, true);
    items.push({ marker: partEnd(section), kind: "partEnd", level, part: section });
  };
  if (root instanceof Sequence) {
    root.children.forEach((document, index) => {
      gapItem(root, index, 0, false);
      visitSection(document, 1);
    });
    gapItem(root, root.children.length, 0, false);
  } else {
    visitSection(root, 1);
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

// The papers a part is on, and how far down each it reaches: [[page, { top,
// bottom }]], by page - from its own lines and its children's, a section's
// title included. Worked out for a part the first time it's asked for.
function partExtents(lines) {
  const known = new Map();
  return (part) => {
    if (known.has(part)) return known.get(part);
    const pages = new Map();
    const visit = (each) => {
      if (isSection(each)) {
        visit(each.title);
        each.children.forEach(visit);
        return;
      }
      for (const { page, line } of lines.get(each) || []) {
        const extent = pages.get(page);
        const bottom = line.top + line.height;
        if (!extent) pages.set(page, { top: line.top, bottom });
        else {
          extent.top = Math.min(extent.top, line.top);
          extent.bottom = Math.max(extent.bottom, bottom);
        }
      }
    };
    visit(part);
    const extents = [...pages].sort(([a], [b]) => a - b);
    known.set(part, extents);
    return extents;
  };
}

// Each marker given its `placed` row - the runs between two paragraphs'
// text, placed as the class doc says.
function placeMarkers(items, lines, extentOf, sequence, edge) {
  const blockExtent = (paragraph) => {
    const placed = lines.get(paragraph);
    if (!placed || placed.length === 0) return null;
    const first = placed[0];
    const last = placed[placed.length - 1];
    return { firstPage: first.page, top: first.line.top, lastPage: last.page, bottom: last.line.top + last.line.height };
  };
  let before = null;
  let run = [];
  const flush = (after) => {
    if (run.length > 0) placeRun(run, before, after, extentOf, sequence, edge);
    run = [];
  };
  for (const item of items) {
    if (item.block) {
      const extent = blockExtent(item.block);
      if (!extent) continue;
      flush(extent);
      before = extent;
    } else {
      run.push(item);
    }
  }
  flush(null);
}

const closes = (item) => item.kind === "partEnd" || item.kind === "listEnd";
const opens = (item) => item.kind === "partStart" || item.kind === "listStart";

function placeRun(run, before, after, extentOf, sequence, edge) {
  const closing = run.filter(closes);
  const between = run.filter((item) => item.kind === "between");
  const opening = run.filter(opens);
  const onePaper = before && after && before.lastPage === after.firstPage;
  // The room the run is in - what its gaps stand for.
  const room = [];
  const rect = (page, top, bottom) => {
    const format = sequence.pages[page];
    return { page, x: format.margins.left, top, width: contentWidth(format), height: Math.max(0, bottom - top) };
  };

  if (onePaper) {
    const centre = Math.round((before.bottom + after.top) / 2);
    const lower = [...closing, ...between];
    spreadDown(lower, before.lastPage, before.bottom, centre, sequence);
    // With something at the centre already, what opens below it.
    spreadAfter(opening, after.firstPage, centre, after.top, sequence, lower.length === 0);
    room.push(rect(before.lastPage, before.bottom, after.top));
  } else {
    const lower = before ? [...closing, ...between] : [];
    const upper = before ? opening : [...closing, ...between, ...opening];
    if (before) {
      spreadDown(lower, before.lastPage, before.bottom, before.bottom + edge, sequence);
      room.push(rect(before.lastPage, before.bottom, after ? pageBottom(sequence, before.lastPage) : before.bottom + edge));
    }
    if (after) {
      spreadAfter(upper, after.firstPage, after.top - edge, after.top, sequence, true);
      room.push(rect(after.firstPage, before ? pageTop(sequence, after.firstPage) : after.top - edge, after.top));
    } else if (upper.length > 0 && before) {
      spreadDown(upper, before.lastPage, before.bottom + edge, before.bottom + 2 * edge, sequence);
    }
  }

  for (const item of run) {
    if (!item.placed) continue;
    const area = item.part
      ? extentOf(item.part).map(([page, { top, bottom }]) => rect(page, top, bottom))
      : room;
    item.placed.row = Object.freeze({ ...item.placed.row, area: Object.freeze(area) });
  }
}

const pageBottom = (sequence, page) => sequence.pages[page].height - sequence.pages[page].margins.bottom;
const pageTop = (sequence, page) => sequence.pages[page].margins.top;

// `items` spread evenly below `from`, down to `to` - the last of them at
// `to`.
function spreadDown(items, page, from, to, sequence) {
  items.forEach((item, index) => {
    item.placed = markerRow(item, page, Math.round(from + (to - from) * (index + 1) / items.length), sequence);
  });
}

// `items` spread evenly from `from` towards `to`, short of it - the first of
// them at `from`, or (`atFrom` false: something's there already) a step
// below it.
function spreadAfter(items, page, from, to, sequence, atFrom) {
  const steps = atFrom ? items.length : items.length + 1;
  items.forEach((item, index) => {
    const step = atFrom ? index : index + 1;
    item.placed = markerRow(item, page, Math.round(from + (to - from) * step / steps), sequence);
  });
}

function markerRow(item, page, y, sequence) {
  const format = sequence.pages[page];
  return {
    page,
    row: { marker: item.marker, kind: item.kind, level: item.level, x: format.margins.left, width: contentWidth(format), y },
  };
}

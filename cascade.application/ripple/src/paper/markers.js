import { mm, px, contentWidth } from "@liquefy/cascade.print";
import { Sequence, isSection, gap, partStart, partEnd } from "../model/parts.js";

/**
 * Where a caret can be in a laid-out Ripple document: its caret rows - every
 * line of text, and every marker - in reading order.
 *
 * Markers are the places between text (see ../model/parts.js): every part's
 * start and end - a document's, a section's, a title's, a paragraph's - and
 * the gaps between two parts lying side by side in a list: two siblings, or a
 * section's title and its first child. A section reads:
 *
 *   start(section)  start(title) [title text] end(title)  gap(0)
 *     start(child) ... end(child)  gap(1)  ...  start(last) ... end(last)
 *   end(section)
 *
 * No gap before a list's first part, nor after its last: those places are
 * the parts' own start and end.
 *
 * The lines are cascade.print's, as laid out. The markers are placed here,
 * after the text is laid out and from it - so they can never move a part:
 * a marker takes no room, it's put in the room there is. Between two parts
 * lying one after the other, the markers in between form a run - what closes
 * after the one (part ends, and list ends: innermost first), the gap between
 * the two if they're siblings, and what opens before the other (list starts,
 * and part starts: outermost first).
 *
 * A part's start and end are, by default, beside the part (`beside`): a
 * vertical bar, as tall as a caret in the text, on the part's first line
 * (its start) or its last (its end) - left of the part's bounding box (its
 * start) or right of it (its end), the box being as far as the part's lines
 * reach. The innermost of a run is `besideStep` (2px) out from its box, and
 * every part around it another step further out: ends of parts nested in
 * each other, ending together, step out to the right one by one; starts to
 * the left.
 *
 * A gap's bar - and, with `beside` false, every marker's: starts and ends
 * between the parts, as they were placed before - is a horizontal line
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
 *    the upper edge of the part after (or the paper's edge, across a page
 *    break); its bar in the middle of it.
 *
 * A caret row is a placed line (cascade.print's), or a marker row:
 *
 *   { marker, kind, type, level, x, width, y, area }        - a horizontal bar
 *   { marker, kind, type, level, x, top, height, vertical: true, area }
 *                                                            - a vertical bar
 *     - marker: its position; kind: "partStart", "partEnd" or "between";
 *       type: which of markerTypes it is
 *     - level: how deep it is in the tree (the sequence's gaps 0, a
 *       document and its gaps 1, ...)
 *     - a horizontal bar: x, width: the text area; y: the bar's
 *     - a vertical bar: x: the bar's; top, height: a caret's on the line
 *       it's beside
 *     - area: [{ page, x, top, width, height }]
 *
 * Returned as [{ page, row }], in reading order.
 *
 * Which markers there are can be chosen, by type - to try out which places a
 * caret should be able to go (see markerTypes below): `types` maps a type to
 * whether its markers are there, every type there unless it says false. A
 * marker not there isn't placed at all - the others share the room.
 */

// The types of markers, as an editor shows them to be chosen.
export const markerTypes = Object.freeze([
  Object.freeze({ type: "paragraphStart", label: "Paragraph start" }),
  Object.freeze({ type: "paragraphEnd", label: "Paragraph end" }),
  Object.freeze({ type: "titleStart", label: "Title start" }),
  Object.freeze({ type: "titleEnd", label: "Title end" }),
  Object.freeze({ type: "sectionStart", label: "Section start" }),
  Object.freeze({ type: "sectionEnd", label: "Section end" }),
  Object.freeze({ type: "titleGap", label: "Between title and content" }),
  Object.freeze({ type: "siblingGap", label: "Between siblings" }),
]);

// How far a marker with nothing beyond it is from its part: about half the
// room between two paragraphs.
export const edgeDistance = mm(1.5);

// How far a start or end beside its part is from the one inside it - the
// innermost, from the part's bounding box.
export const besideStep = px(2);

export function caretRows(sequence, root, { edge = edgeDistance, types = {}, beside = true } = {}) {
  const items = readingOrder(root).filter((item) => item.block || types[item.type] !== false);
  const lines = linesByParagraph(sequence);
  const extentOf = partExtents(lines);
  placeMarkers(items, lines, extentOf, sequence, { edge, beside, boxOf: beside ? partBoxes(lines) : null });
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
// { marker, kind, type, level, part } - `type` one of markerTypes', `part`
// being, for a part's start or end, the part.
export function readingOrder(root) {
  const items = [];
  // The gap before child `index` - between it and the part before it in the
  // list: the child before, or the section's title.
  // A section's gap 0 is between its title and its content; every other
  // gap between two siblings.
  const gapItem = (list, index, level, afterTitle) => {
    items.push({ marker: gap(list, index), kind: "between", type: afterTitle ? "titleGap" : "siblingGap", level });
  };
  const visitParagraph = (paragraph, level, role) => {
    items.push({ marker: partStart(paragraph), kind: "partStart", type: role + "Start", level, part: paragraph });
    items.push({ block: paragraph });
    items.push({ marker: partEnd(paragraph), kind: "partEnd", type: role + "End", level, part: paragraph });
  };
  const visitSection = (section, level) => {
    items.push({ marker: partStart(section), kind: "partStart", type: "sectionStart", level, part: section });
    visitParagraph(section.title, level + 1, "title");
    section.children.forEach((child, index) => {
      gapItem(section, index, level + 1, index === 0);
      if (isSection(child)) visitSection(child, level + 1);
      else visitParagraph(child, level + 1, "paragraph");
    });
    items.push({ marker: partEnd(section), kind: "partEnd", type: "sectionEnd", level, part: section });
  };
  if (root instanceof Sequence) {
    root.children.forEach((document, index) => {
      if (index > 0) gapItem(root, index, 0, false);
      visitSection(document, 1);
    });
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

// A part's first and last lines ({ page, line }), and how far left and
// right its lines reach: { first, last, left, right } - from its own lines
// and its children's, a section's title included. Null for a part with no
// lines. Worked out for a part the first time it's asked for.
function partBoxes(lines) {
  const known = new Map();
  return (part) => {
    if (known.has(part)) return known.get(part);
    let box = null;
    const visit = (each) => {
      if (isSection(each)) {
        visit(each.title);
        each.children.forEach(visit);
        return;
      }
      for (const placed of lines.get(each) || []) {
        const { x, width } = placed.line;
        if (!box) box = { first: placed, last: placed, left: x, right: x + width };
        else {
          box.last = placed;
          box.left = Math.min(box.left, x);
          box.right = Math.max(box.right, x + width);
        }
      }
    };
    visit(part);
    known.set(part, box);
    return box;
  };
}

// Each marker given its `placed` row - the runs between two paragraphs'
// text, placed as the class doc says.
function placeMarkers(items, lines, extentOf, sequence, options) {
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
    if (run.length > 0) placeRun(run, before, after, extentOf, sequence, options);
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

const closes = (item) => item.kind === "partEnd";
const opens = (item) => item.kind === "partStart";

function placeRun(run, before, after, extentOf, sequence, { edge, beside, boxOf }) {
  // Beside their parts, starts and ends take none of the room between the
  // parts: only the gaps are spread there.
  if (beside) placeBeside(run, boxOf);
  const closing = beside ? [] : run.filter(closes);
  const between = run.filter((item) => item.kind === "between");
  const opening = beside ? [] : run.filter(opens);
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

// A run's starts and ends beside their parts: the ends right of them, the
// innermost (the first) a step out, every one after it a step further; the
// starts left of them, the innermost (the last) a step out, every one
// before it a step further.
function placeBeside(run, boxOf) {
  const ends = run.filter(closes);
  const starts = run.filter(opens);
  ends.forEach((item, index) => {
    const box = boxOf(item.part);
    if (box) item.placed = besideRow(item, box.last, box.right + besideStep * (index + 1));
  });
  starts.forEach((item, index) => {
    const box = boxOf(item.part);
    if (box) item.placed = besideRow(item, box.first, box.left - besideStep * (starts.length - index));
  });
}

// A vertical bar at `x` beside a placed line - as tall as a caret on it.
function besideRow(item, { page, line }, x) {
  return {
    page,
    row: {
      marker: item.marker, kind: item.kind, type: item.type, level: item.level,
      x, top: line.baseline - line.ascent, height: line.ascent + line.descent, vertical: true,
    },
  };
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
    row: { marker: item.marker, kind: item.kind, type: item.type, level: item.level, x: format.margins.left, width: contentWidth(format), y },
  };
}

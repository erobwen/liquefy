import { mm, px, contentWidth } from "../print/index.js";
import { Sequence, isSection, splitMarker, joinMarker, isJoinMarker, flowStart, flowEnd, titleLevel, hasExitTitle, exitTitle } from "../model/flows.js";

/**
 * Where a caret can be in a laid-out Ripple document: its caret rows - every
 * line of text, and every marker - in reading order.
 *
 * Markers are the places between text (see ../model/flows.js): every flow's
 * start and end - a document's, a section's, a title's, a paragraph's - and
 * the gaps between two flows lying side by side in a list: two siblings, or a
 * section's title and its first child. A section reads:
 *
 *   start(section)  start(title) [title text] end(title)  gap(0)
 *     start(child) ... end(child)  gap(1)  ...  start(last) ... end(last)
 *   end(section)
 *
 * No gap before a list's first flow, nor after its last: those places are
 * the flows' own start and end.
 *
 * The lines are cascade.print's, as laid out. The markers are placed here,
 * after the text is laid out and from it - so they can never move a flow:
 * a marker takes no room, it's put in the room there is. Between two flows
 * lying one after the other, the markers in between form a run - what closes
 * after the one (flow ends, and list ends: innermost first), the gap between
 * the two if they're siblings, and what opens before the other (list starts,
 * and flow starts: outermost first).
 *
 * A flow's start and end are, by default, beside the flow (`beside`): a
 * vertical bar, as tall as a caret in the text, on the flow's first line
 * (its start) or its last (its end) - left of the flow's bounding box (its
 * start) or right of it (its end), the box being as far as the flow's lines
 * reach. The innermost of a run is `besideStep` (2px) out from its box, and
 * every flow around it another step further out: ends of flows nested in
 * each other, ending together, step out to the right one by one; starts to
 * the left.
 *
 * A gap's bar - and, with `beside` false, every marker's: starts and ends
 * between the flows, as they were placed before - is a horizontal line
 * across the text area, at a height:
 *
 *  - The gap between two siblings: dead centre between them, from the lower
 *    edge of the one to the upper edge of the other. A gap with a join
 *    marker as well as its split marker (see ../model/flows.js) is two
 *    bars: the split marker a third of the way down, the join marker two
 *    thirds. Which gaps have one is `joinMarkers`: "none" (the default),
 *    "beforeSections" - every gap before a flow with a title, a section (a
 *    document too) - or "all".
 *  - What closes: spread evenly from the lower edge of the flow before down
 *    towards the (first) gap, short of it - or, with no gap, down to the
 *    centre, the outermost there - or, with nothing after on the paper, down
 *    to a fixed distance (`edge`) below.
 *  - What opens: the same, mirrored - spread evenly from the (last) gap or
 *    the centre (or `edge` above) down towards the flow after, the innermost
 *    nearest it.
 *
 * A run between two flows on different papers goes on both: what closes,
 * and the gap, below the flow before, on its paper; what opens above the
 * flow after, on its.
 *
 * Every marker also has an area - what it stands for, as rectangles across
 * the text area, one for each paper it's on:
 *
 *  - A flow's start or end: the flow's bounding box - a section's, from its
 *    title to its last line. Flows ending (or starting) together have their
 *    areas one inside another.
 *  - A gap: the room of its run - from the lower edge of the flow before to
 *    the upper edge of the flow after (or the paper's edge, across a page
 *    break); its bar in the middle of it.
 *  - A join marker - where the flows on either side would be joined: that
 *    room, and every delimiter box around
 *    it, all that what's put there replaces - the end delimiter box of the
 *    flow before, and the start delimiter box of the flow after (see below).
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
 * The markers around it are placed as around any text - the section's end
 * after it, beside it or below it.
 *
 * A caret row is a placed line (cascade.print's), or a marker row:
 *
 *   { marker, kind, type, level, x, width, y, area }        - a horizontal bar
 *   { marker, kind, type, level, x, top, height, vertical: true, area }
 *                                                            - a vertical bar
 *     - marker: its position; kind: "flowStart", "flowEnd" or "between";
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

// How far a marker with nothing beyond it is from its flow: about half the
// room between two paragraphs.
export const edgeDistance = mm(1.5);

// How far a start or end beside its flow is from the one inside it - the
// innermost, from the flow's bounding box.
export const besideStep = px(2);

export function caretRows(sequence, root, { edge = edgeDistance, types = {}, beside = true, joinMarkers = "none" } = {}) {
  const items = readingOrder(root, { joinMarkers }).filter((item) => item.block || types[item.type] !== false);
  const lines = linesByParagraph(sequence);
  const extentOf = flowExtents(lines);
  const boxOf = boxesFrom(extentOf, sequence);
  placeMarkers(items, lines, extentOf, sequence, { edge, beside, boundsOf: beside ? lineBounds(lines) : null, boxOf });
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
// { marker, kind, type, level, flow } - `type` one of markerTypes', `flow`
// being, for a flow's start or end, the flow. A gap with a join marker (see
// `joinMarkers` in the class doc) twice: its split marker, then its join
// marker.
export function readingOrder(root, { joinMarkers = "none" } = {}) {
  const items = [];
  // The gap before child `index` - between it and the flow before it in the
  // list: the child before, or the section's title.
  // A section's gap 0 is between its title and its content; every other
  // gap between two siblings.
  const gapItem = (list, index, level, afterTitle) => {
    const type = afterTitle ? "titleGap" : "siblingGap";
    items.push({ marker: splitMarker(list, index), kind: "between", type, level });
    if (joinMarkers === "all" || (joinMarkers === "beforeSections" && isSection(list.children[index]))) {
      items.push({ marker: joinMarker(list, index), kind: "between", type, level });
    }
  };
  const visitParagraph = (paragraph, level, role) => {
    items.push({ marker: flowStart(paragraph), kind: "flowStart", type: role + "Start", level, flow: paragraph });
    items.push({ block: paragraph });
    items.push({ marker: flowEnd(paragraph), kind: "flowEnd", type: role + "End", level, flow: paragraph });
  };
  // `titleAt`: the section's title level; `exit`: whether it has an exit
  // title (see ../model/flows.js).
  const visitSection = (section, level, titleAt, exit) => {
    items.push({ marker: flowStart(section), kind: "flowStart", type: "sectionStart", level, flow: section });
    visitParagraph(section.title, level + 1, "title");
    const children = section.children;
    children.forEach((child, index) => {
      gapItem(section, index, level + 1, index === 0);
      if (isSection(child)) visitSection(child, level + 1, titleLevel(child, titleAt), hasExitTitle(child, children[index + 1], titleAt));
      else visitParagraph(child, level + 1, "paragraph");
    });
    if (exit) items.push({ block: exitTitle(section), exit: true });
    items.push({ marker: flowEnd(section), kind: "flowEnd", type: "sectionEnd", level, flow: section });
  };
  if (root instanceof Sequence) {
    const documents = root.children;
    documents.forEach((document, index) => {
      if (index > 0) gapItem(root, index, 0, false);
      visitSection(document, 1, titleLevel(document), hasExitTitle(document, documents[index + 1]));
    });
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

// The papers a flow is on, and how far down each it reaches: [[page, { top,
// bottom }]], by page - from its own lines and its children's, a section's
// title and exit title included. Worked out for a flow the first time it's
// asked for.
function flowExtents(lines) {
  const known = new Map();
  return (flow) => {
    if (known.has(flow)) return known.get(flow);
    const pages = new Map();
    const visit = (each) => {
      if (isSection(each)) {
        visit(each.title);
        each.children.forEach(visit);
        visit(exitTitle(each));
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
    visit(flow);
    const extents = [...pages].sort(([a], [b]) => a - b);
    known.set(flow, extents);
    return extents;
  };
}

// A flow's first and last lines ({ page, line }), and how far left and
// right its lines reach: { first, last, left, right } - from its own lines
// and its children's, a section's title and exit title included. Null for
// a flow with no lines. Worked out for a flow the first time it's asked for.
function lineBounds(lines) {
  const known = new Map();
  return (flow) => {
    if (known.has(flow)) return known.get(flow);
    let box = null;
    const visit = (each) => {
      if (isSection(each)) {
        visit(each.title);
        each.children.forEach(visit);
        visit(exitTitle(each));
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
    visit(flow);
    known.set(flow, box);
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

const closes = (item) => item.kind === "flowEnd";
const opens = (item) => item.kind === "flowStart";

function placeRun(run, before, after, extentOf, sequence, { edge, beside, boundsOf, boxOf }) {
  // Beside their flows, starts and ends take none of the room between the
  // flows: only the gaps are spread there.
  if (beside) placeBeside(run, boundsOf);
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
    const page = before.lastPage;
    if (between.length > 0) {
      // The gaps evenly between the flows: one dead centre - two a third and
      // two thirds of the way down. What closes above them, what opens below.
      const ys = between.map((item, index) => Math.round(before.bottom + (after.top - before.bottom) * (index + 1) / (between.length + 1)));
      between.forEach((item, index) => { item.placed = markerRow(item, page, ys[index], sequence); });
      spreadAfter(closing, page, before.bottom, ys[0], sequence, false);
      spreadAfter(opening, page, ys[ys.length - 1], after.top, sequence, false);
    } else {
      const centre = Math.round((before.bottom + after.top) / 2);
      spreadDown(closing, page, before.bottom, centre, sequence);
      // With something at the centre already, what opens below it.
      spreadAfter(opening, page, centre, after.top, sequence, closing.length === 0);
    }
    room.push(rect(page, before.bottom, after.top));
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
    let area = item.flow ? boxOf(item.flow).content : room;
    // A join marker - where what's on either side would be joined: every
    // delimiter around it too, the end delimiter box of the flow before and
    // the start delimiter box of the flow after - all that what's put there
    // replaces.
    if (isJoinMarker(item.marker)) {
      const { list, index } = item.marker;
      const before = index > 0 ? list.children[index - 1] : null;
      const after = list.children[index];
      const around = [
        ...((before && boxOf(before).endDelimiter) || []),
        ...((after && boxOf(after).startDelimiter) || []),
      ];
      if (around.length > 0) area = joined([...room, ...around]);
    }
    item.placed.row = Object.freeze({ ...item.placed.row, area: Object.freeze(area) });
  }
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
// Worked out for a flow the first time it's asked for.
function boxesFrom(extentOf, sequence) {
  const known = new Map();
  const rect = (page, top, bottom) => {
    const format = sequence.pages[page];
    return { page, x: format.margins.left, top, width: contentWidth(format), height: Math.max(0, bottom - top) };
  };
  return (flow) => {
    if (known.has(flow)) return known.get(flow);
    const own = extentOf(flow);
    const content = own.map(([page, { top, bottom }]) => rect(page, top, bottom));
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
        startDelimiter = start.length > 0 ? start : null;
        endDelimiter = end.length > 0 ? end : null;
      }
    }
    const box = Object.freeze({ content, startDelimiter, endDelimiter });
    known.set(flow, box);
    return box;
  };
}

// Rectangles, the ones touching one above the other on a paper - as wide,
// as far left - joined into one.
function joined(rects) {
  const result = [];
  for (const each of [...rects].sort((a, b) => a.page - b.page || a.top - b.top)) {
    const last = result[result.length - 1];
    if (last && last.page === each.page && last.x === each.x && last.width === each.width && each.top <= last.top + last.height) {
      last.height = Math.max(last.height, each.top + each.height - last.top);
    } else {
      result.push({ ...each });
    }
  }
  return result;
}

// A run's starts and ends beside their flows: the ends right of them, the
// innermost (the first) a step out, every one after it a step further; the
// starts left of them, the innermost (the last) a step out, every one
// before it a step further.
function placeBeside(run, boundsOf) {
  const ends = run.filter(closes);
  const starts = run.filter(opens);
  ends.forEach((item, index) => {
    const box = boundsOf(item.flow);
    if (box) item.placed = besideRow(item, box.last, box.right + besideStep * (index + 1));
  });
  starts.forEach((item, index) => {
    const box = boundsOf(item.flow);
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

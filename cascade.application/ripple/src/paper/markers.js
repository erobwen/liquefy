import { mm, contentWidth } from "@liquefy/cascade.print";
import { Sequence, isSection, gap } from "../model/parts.js";

/**
 * Where a caret can be in a laid-out Ripple document: its caret rows - every
 * line of text, and every gap between parts (see ../model/parts.js) - in
 * reading order.
 *
 * The lines are cascade.print's, as laid out. The gaps are placed here,
 * after the text is laid out and from it - so they can never move a part:
 * a gap takes no room, it's put in the room there is. A gap's marker is a
 * horizontal bar across the text area, at a height:
 *
 *  - Between two siblings - two parts of one list, or a section's title and
 *    its first child: dead centre between them, from the lower edge of the
 *    one to the upper edge of the other.
 *  - Where lists end together - a section ending as its parent does, and
 *    maybe that one's parent: the gaps stacked between the part they end
 *    after and the outermost of them - the sibling gap after it, dead
 *    centre as above, or, with nothing after on the paper, a fixed distance
 *    (`edge`) below - evenly spread, the innermost nearest the part.
 *  - Where lists start together - a list starting as its parent does (the
 *    sequence and its first document's start): the same, mirrored - the
 *    gaps spread evenly from the marker before them (the sibling gap, or
 *    `edge` above the part) down to the part they start with, the innermost
 *    nearest it.
 *
 * A run of gaps between two parts on different papers goes on both: what
 * ends, after the part before, on its paper; what starts, before the part
 * after, on its.
 *
 * Every gap also has an area - what it stands for on the papers, as
 * rectangles (one for each paper it's on), across the text area:
 *
 *  - Between two siblings: the room between them, from the lower edge of the
 *    one to the upper edge of the other - its bar in the middle of it.
 *  - At a list's start: the part it's before, its whole bounding box.
 *  - At a list's end: the part it's after - the list's last child - its
 *    whole bounding box. Lists ending together have their areas one inside
 *    another: a paragraph, the section it ends, the section that one ends...
 *
 * A caret row is a placed line (cascade.print's), or a gap row:
 *
 *   { gap, level, kind, x, width, y, area }
 *     - x, width: the text area; y: the bar's
 *     - kind: "between", "start" or "end"
 *     - area: [{ page, x, top, width, height }]
 *
 * `level` is how deep the gap's list is - the sequence's 0, a document's 1.
 * Returned as [{ page, row }], in reading order.
 */

// How far a marker with nothing beyond it is from its part: about half the
// room between two paragraphs.
export const edgeDistance = mm(1.5);

export function caretRows(sequence, root, { edge = edgeDistance } = {}) {
  const items = readingOrder(root);
  const lines = linesByParagraph(sequence);
  placeGaps(items, lines, sequence, edge);
  const extents = partExtents(lines);
  for (const item of items) {
    if (item.placed) item.placed.row = Object.freeze({ ...item.placed.row, area: Object.freeze(areaOf(item, extents, sequence)) });
  }
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

// Every part and every gap of the tree, in reading order: { block } for a
// paragraph (a title or body text), { gap, level, kind, before, after } for
// a gap - kind "between" (two siblings, or a title and its first child),
// "end" (after a list's last child, or in a list with none), "start" (before
// the first child of a list with no title of its own: the sequence) - and
// the parts on either side of it, where there are.
export function readingOrder(root) {
  const items = [];
  const gapItem = (list, index, level, hasTitle) => {
    const children = list.children;
    const count = children.length;
    const kind = index === count ? "end" : (index === 0 && !hasTitle ? "start" : "between");
    const before = index > 0 ? children[index - 1] : (hasTitle ? list.title : null);
    const after = index < count ? children[index] : null;
    items.push({ gap: gap(list, index), level, kind, before, after });
  };
  const visitSection = (section, depth) => {
    items.push({ block: section.title });
    section.children.forEach((child, index) => {
      gapItem(section, index, depth + 1, true);
      if (isSection(child)) visitSection(child, depth + 1);
      else items.push({ block: child });
    });
    gapItem(section, section.children.length, depth + 1, true);
  };
  if (root instanceof Sequence) {
    root.children.forEach((document, index) => {
      gapItem(root, index, 0, false);
      visitSection(document, 0);
    });
    gapItem(root, root.children.length, 0, false);
  } else {
    visitSection(root, 0);
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

// Each gap given a `placed` row: the runs of gaps between two parts, placed
// as the class doc says.
function placeGaps(items, lines, sequence, edge) {
  const extentOf = (paragraph) => {
    const placed = lines.get(paragraph);
    if (!placed || placed.length === 0) return null;
    const first = placed[0];
    const last = placed[placed.length - 1];
    return {
      firstPage: first.page,
      top: first.line.top,
      lastPage: last.page,
      bottom: last.line.top + last.line.height,
    };
  };
  let before = null;
  let run = [];
  const flush = (after) => {
    if (run.length > 0) placeRun(run, before, after, sequence, edge);
    run = [];
  };
  for (const item of items) {
    if (item.block) {
      const extent = extentOf(item.block);
      if (!extent) continue;
      flush(extent);
      before = extent;
    } else {
      run.push(item);
    }
  }
  flush(null);
}

function placeRun(run, before, after, sequence, edge) {
  const between = run.filter((item) => item.kind === "between");
  const ends = run.filter((item) => item.kind === "end");
  const starts = run.filter((item) => item.kind === "start");
  // What closes after the part before - its ends, innermost first, and the
  // sibling gap outermost - and what opens before the part after.
  const closing = [...ends, ...between];
  const opening = starts;
  const onePaper = before && after && before.lastPage === after.firstPage;

  if (onePaper) {
    const centre = Math.round((before.bottom + after.top) / 2);
    spread(closing, before.lastPage, before.bottom, centre, sequence);
    // With something at the centre already, the starts below it.
    spreadAfter(opening, after.firstPage, centre, after.top, sequence, closing.length === 0);
    return;
  }
  if (before) {
    spread(closing, before.lastPage, before.bottom, before.bottom + edge, sequence);
  } else {
    // Nothing before: what would close goes with what opens.
    opening.unshift(...closing);
  }
  if (after) {
    spreadAfter(opening, after.firstPage, after.top - edge, after.top, sequence, true);
  } else if (before) {
    spread(opening, before.lastPage, before.bottom + edge, before.bottom + 2 * edge, sequence);
  }
}

// `gaps` spread evenly above `to`, from `from` - the last of them at `to`.
function spread(gaps, page, from, to, sequence) {
  gaps.forEach((item, index) => {
    item.placed = gapRow(item, page, Math.round(from + (to - from) * (index + 1) / gaps.length), sequence);
  });
}

// `gaps` spread evenly from `from` towards `to`, short of it - the first of
// them at `from`, or (`atFrom` false: something's there already) a step
// below it.
function spreadAfter(gaps, page, from, to, sequence, atFrom) {
  const steps = atFrom ? gaps.length : gaps.length + 1;
  gaps.forEach((item, index) => {
    const step = atFrom ? index : index + 1;
    item.placed = gapRow(item, page, Math.round(from + (to - from) * step / steps), sequence);
  });
}

// The papers a part is on, and how far down each it reaches: { page: { top,
// bottom } }, from its own lines and its children's, a section's title
// included. Worked out for a part the first time it's asked for.
function partExtents(lines) {
  const known = new Map();
  const extentOf = (part) => {
    if (known.has(part)) return known.get(part);
    const pages = new Map();
    const add = (page, top, bottom) => {
      const extent = pages.get(page);
      if (!extent) pages.set(page, { top, bottom });
      else {
        extent.top = Math.min(extent.top, top);
        extent.bottom = Math.max(extent.bottom, bottom);
      }
    };
    const visit = (each) => {
      if (isSection(each)) {
        visit(each.title);
        each.children.forEach(visit);
      } else {
        for (const { page, line } of lines.get(each) || []) add(page, line.top, line.top + line.height);
      }
    };
    visit(part);
    known.set(part, pages);
    return pages;
  };
  return extentOf;
}

// A gap's area (see the class doc).
function areaOf(item, extentOf, sequence) {
  const rect = (page, top, bottom) => {
    const format = sequence.pages[page];
    return { page, x: format.margins.left, top, width: contentWidth(format), height: Math.max(0, bottom - top) };
  };
  const boxOf = (part) => [...extentOf(part)].sort(([a], [b]) => a - b).map(([page, { top, bottom }]) => rect(page, top, bottom));
  if (item.kind === "start") return item.after ? boxOf(item.after) : [];
  if (item.kind === "end") return item.before ? boxOf(item.before) : [];
  // Between: the room between the two - on each paper, if they're on two.
  const before = item.before ? [...extentOf(item.before)].sort(([a], [b]) => a - b) : [];
  const after = item.after ? [...extentOf(item.after)].sort(([a], [b]) => a - b) : [];
  if (before.length === 0 || after.length === 0) return [];
  const [lastPage, { bottom }] = before[before.length - 1];
  const [firstPage, { top }] = after[0];
  if (lastPage === firstPage) return [rect(lastPage, bottom, top)];
  const below = sequence.pages[lastPage];
  const above = sequence.pages[firstPage];
  return [
    rect(lastPage, bottom, below.height - below.margins.bottom),
    rect(firstPage, above.margins.top, top),
  ];
}

function gapRow(item, page, y, sequence) {
  const format = sequence.pages[page];
  return {
    page,
    row: { gap: item.gap, level: item.level, kind: item.kind, x: format.margins.left, width: contentWidth(format), y },
  };
}

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
 * A caret row is a placed line (cascade.print's), or a gap row:
 *
 *   { gap, level, x, width, y }   - x, width: the text area; y: the bar's
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
// paragraph (a title or body text), { gap, level, kind } for a gap - kind
// "between" (two siblings, or a title and its first child), "end" (after a
// list's last child, or in a list with none), "start" (before the first
// child of a list with no title of its own: the sequence).
export function readingOrder(root) {
  const items = [];
  const gapItem = (list, index, level, hasTitle) => {
    const count = list.children.length;
    const kind = index === count ? "end" : (index === 0 && !hasTitle ? "start" : "between");
    items.push({ gap: gap(list, index), level, kind });
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

function gapRow(item, page, y, sequence) {
  const format = sequence.pages[page];
  return {
    page,
    row: Object.freeze({ gap: item.gap, level: item.level, x: format.margins.left, width: contentWidth(format), y }),
  };
}

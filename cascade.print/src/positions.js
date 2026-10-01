/**
 * Between a paper sequence and the model: which place a point on a paper is
 * (hitTest()), where on the papers a place is (caretAt()), and moving from
 * one place to the next - in the text, and between a model's parts.
 *
 * A position is one of two kinds:
 *
 *   { paragraph, offset, lineEnd }   - in a paragraph's text
 *   { list, index }                  - a gap: before item `index` of a list
 *
 * In the text: `paragraph` is whatever the paragraph's lines were placed with
 * as their source (see Paragraph.js) - a model's own paragraph object,
 * typically - and `offset` counts characters through its text. Where a
 * paragraph is broken between two lines, the end of one and the start of the
 * next are the same offset: `lineEnd` says which - true for the end of the
 * first (where End puts the caret), false for the start of the next (where
 * text typed there goes).
 *
 * A gap is a place between a model's parts - between two paragraphs, before
 * the first item of a list, after the last: `list` is whatever holds them
 * (opaque here, as a paragraph is), `index` which item it's before. One gap
 * belongs to one list - so "after A" and "before B" in a list are the same
 * gap, and the end of a list nested inside another, and the place after it
 * in the outer one, are two. A model marks its gaps on the papers with
 * GapMarker (see GapMarker.js).
 *
 * Neither says anything about papers or lines, so a new layout never makes a
 * position wrong. Nothing here looks into a model: what it needs, the caret
 * rows on the papers know (PaperSequence's rowsOf()) - every line, and every
 * gap, in reading order. Moving through them is moving through the places a
 * caret can be: the characters of a line, a gap, the next line.
 *
 * Measuring goes through the same measurer the lines were broken with, so a
 * caret lands exactly between the characters the line breaking measured -
 * measured as prefixes of a whole run, as the run is drawn.
 */

export function position(paragraph, offset, lineEnd = false) {
  return Object.freeze({ paragraph, offset, lineEnd });
}

export function gapPosition(list, index) {
  return Object.freeze({ list, index });
}

export function isGapPosition(at) {
  return !!at && "list" in at;
}

// The same place - in the text wherever a line break puts it, or the same
// gap.
export function samePosition(a, b) {
  if (isGapPosition(a) || isGapPosition(b)) {
    return isGapPosition(a) && isGapPosition(b) && a.list === b.list && a.index === b.index;
  }
  return a.paragraph === b.paragraph && a.offset === b.offset;
}

// Every placed line, in reading order: { page, index, line }.
export function placedLines(sequence) {
  const result = [];
  sequence.pages.forEach((format, page) => {
    sequence.linesOf(page).forEach((line, index) => result.push({ page, index, line }));
  });
  return result;
}

// Every caret row - every line, every gap - in reading order: { page, index,
// row }. A gap row has `gap`, its position; a line doesn't.
export function caretRows(sequence) {
  const result = [];
  sequence.pages.forEach((format, page) => {
    sequence.rowsOf(page).forEach((row, index) => result.push({ page, index, row }));
  });
  return result;
}

const isGapRow = (row) => "gap" in row;

// The caret row a position is on, with its place in reading order (`order`,
// into caretRows()). Null if it isn't laid out.
export function rowAt(sequence, at, rows = caretRows(sequence)) {
  if (isGapPosition(at)) {
    for (let order = 0; order < rows.length; order++) {
      const { row } = rows[order];
      if (isGapRow(row) && samePosition(row.gap, at)) return { ...rows[order], order };
    }
    return null;
  }
  let found = null;
  for (let order = 0; order < rows.length; order++) {
    const { row } = rows[order];
    if (isGapRow(row) || row.paragraph !== at.paragraph || at.offset < row.start || at.offset > row.end) continue;
    // A break between two lines: the first, at a line end - the second
    // otherwise.
    if (found && at.lineEnd) break;
    found = { ...rows[order], order };
    if (at.offset < row.end) break;
  }
  return found;
}

// The placed line a text position is on, with its place in reading order
// (`order`, into placedLines()). Null if the paragraph isn't laid out.
export function lineAt(sequence, at, lines = placedLines(sequence)) {
  const found = rowAt(sequence, at, lines.map(({ page, index, line }) => ({ page, index, row: line })));
  return found ? { page: found.page, index: found.index, line: found.row, order: found.order } : null;
}

// Where the caret for a position goes: { page, x, top, height } in µm on
// its paper - in the text, as tall as the font at that place reaches, on its
// line's baseline; at a gap, where its marker put it (and `gap: true`). Null
// if it isn't laid out.
export function caretAt(sequence, at, measurer) {
  const found = rowAt(sequence, at);
  if (!found) return null;
  const { row, page } = found;
  if (isGapRow(row)) return { page, x: row.x, top: row.top, height: row.height, gap: true };
  const x = xInLine(row, at.offset, measurer);
  const run = runAt(row, at.offset);
  const ascent = run ? run.ascent : row.ascent;
  const descent = run ? run.descent : row.descent;
  return { page, x, top: row.baseline - ascent, height: ascent + descent };
}

// What a selection from `start` to `end` (`start` first, in reading
// order) covers on the papers: a rectangle per line,
// { page, x, top, width, height } in µm, as tall as the line. A line the
// selection goes on past the end of its paragraph from also covers the
// paragraph break, as wide as a space: selected, an empty paragraph shows.
// Either end may be a gap: the selection then starts or ends between lines.
export function selectionRects(sequence, start, end, measurer) {
  const rows = caretRows(sequence);
  const first = rowAt(sequence, start, rows);
  const last = rowAt(sequence, end, rows);
  if (!first || !last) return [];
  const rects = [];
  for (let order = first.order; order <= last.order; order++) {
    const { page, row } = rows[order];
    if (isGapRow(row)) continue;
    const from = order === first.order && !isGapPosition(start) ? start.offset : row.start;
    const to = order === last.order && !isGapPosition(end) ? end.offset : row.end;
    const left = xInLine(row, from, measurer);
    let right = xInLine(row, to, measurer);
    if ((order !== last.order || isGapPosition(end)) && row.last) {
      const lastRun = row.runs[row.runs.length - 1];
      right += lastRun ? measurer.measure(" ", lastRun.font) : Math.round(row.height / 4);
    }
    if (right > left) rects.push({ page, x: left, top: row.top, width: right - left, height: row.height });
  }
  return rects;
}

// The place nearest to a point on paper `page` (µm from its top left
// corner): on the caret row the point is on - or the nearest one, above or
// below it - in a line, at the character boundary nearest to it; a gap, as
// it is. A point on a line is on that line, even where a gap's caret reaches
// over it; of gaps the same way away, the one nearest across. Null if
// nothing is on that paper.
export function hitTest(sequence, page, x, y, measurer) {
  const rows = sequence.rowsOf(page);
  if (rows.length === 0) return null;
  let nearest = null;
  let best = null;
  for (const row of rows) {
    const away = Math.max(0, row.top - y, y - (row.top + row.height));
    const gap = isGapRow(row);
    // Nearer up and down first; at the same distance, a line before a gap,
    // and of gaps, the nearest across.
    const score = [away, gap ? 1 : 0, gap ? Math.abs(x - row.x) : 0];
    if (best === null || score[0] < best[0] || (score[0] === best[0] && (score[1] < best[1] || (score[1] === best[1] && score[2] < best[2])))) {
      best = score;
      nearest = row;
    }
  }
  return isGapRow(nearest) ? nearest.gap : positionInLine(nearest, x, measurer);
}

// The place on `line` nearest to `x`: a boundary between two characters -
// or, beyond the end of a line the paragraph goes on from, its end (after
// the space it was broken at).
export function positionInLine(line, x, measurer) {
  const paragraph = line.paragraph;
  const isLast = line.last;
  let best = line.start;
  let distance = Math.abs(x - line.x);
  for (const run of line.runs) {
    for (let count = 0; count <= run.text.length; count++) {
      const at = line.x + run.x + measurer.measure(run.text.slice(0, count), run.font);
      if (Math.abs(x - at) < distance) {
        distance = Math.abs(x - at);
        best = run.start + count;
      }
    }
  }
  const visibleEnd = line.runs.length > 0 ? lastRunEnd(line) : line.start;
  if (best === visibleEnd && !isLast && line.end > visibleEnd && x > line.x + line.width) {
    return position(paragraph, line.end, true);
  }
  return position(paragraph, best, best === line.end && !isLast);
}

// Home and End: the start and end of the line a position is on. A gap is a
// row of one place: it stays.
export function lineStart(sequence, at) {
  const found = rowAt(sequence, at);
  if (!found || isGapRow(found.row)) return at;
  return position(at.paragraph, found.row.start);
}

export function lineEnd(sequence, at) {
  const found = rowAt(sequence, at);
  if (!found || isGapRow(found.row)) return at;
  return position(at.paragraph, found.row.end, !found.row.last);
}

// Up and down: the caret row before or after the one a position is on - a
// line, or a gap; on another paper, if it's the first or last on this one -
// at `goalX` on a line: the x the caret had when moving up and down began,
// so passing a short line doesn't pull it to the left for good. Beyond the
// first or last row: the start or end of the line, or the gap, it's on.
export function rowAbove(sequence, at, goalX, measurer) {
  return verticalMove(sequence, at, goalX, measurer, -1);
}

export function rowBelow(sequence, at, goalX, measurer) {
  return verticalMove(sequence, at, goalX, measurer, 1);
}

// The same, as they were called while there were only lines.
export const lineAbove = rowAbove;
export const lineBelow = rowBelow;

function verticalMove(sequence, at, goalX, measurer, direction) {
  const rows = caretRows(sequence);
  const found = rowAt(sequence, at, rows);
  if (!found) return at;
  const target = rows[found.order + direction];
  if (!target) return direction < 0 ? lineStart(sequence, at) : lineEnd(sequence, at);
  return isGapRow(target.row) ? target.row.gap : positionInLine(target.row, goalX, measurer);
}

// Left and right: the place before or after a position, in reading order -
// a character back or forward in a line (a surrogate pair, most emoji, being
// one), and from a line's end or start into the row before or after it: a
// gap, or the next line - of the same paragraph, or the next. Every place a
// caret can be is reached, gaps included. At either end of everything, the
// position stays.
export function stepRight(sequence, at) {
  const rows = caretRows(sequence);
  const found = rowAt(sequence, at, rows);
  if (!found) return at;
  let { order, row } = found;
  if (!isGapRow(row)) {
    // At a line's end, after the space it was broken at, is the next line's
    // start, as far as moving goes.
    if (at.lineEnd && !row.last && rows[order + 1]) {
      order += 1;
      row = rows[order].row;
    }
    const next = at.offset + characterAfter(rowText(row), at.offset - row.start);
    if (next < row.end || (next === row.end && row.last)) return position(row.paragraph, next);
  }
  const following = rows[order + 1];
  return following ? firstPlace(following.row) : at;
}

export function stepLeft(sequence, at) {
  const rows = caretRows(sequence);
  const found = rowAt(sequence, at, rows);
  if (!found) return at;
  const { order, row } = found;
  if (!isGapRow(row) && at.offset > row.start) {
    return position(row.paragraph, at.offset - characterBefore(rowText(row), at.offset - row.start));
  }
  const preceding = rows[order - 1];
  return preceding ? lastPlace(preceding.row) : at;
}

// The very first and last places of everything laid out.
export function sequenceStart(sequence) {
  const rows = caretRows(sequence);
  return rows.length > 0 ? firstPlace(rows[0].row) : null;
}

export function sequenceEnd(sequence) {
  const rows = caretRows(sequence);
  return rows.length > 0 ? lastPlace(rows[rows.length - 1].row) : null;
}

// Which of two positions comes first, in reading order: negative if `a`
// does, positive if `b` does, 0 for the same place. Positions not laid out
// count as the same.
export function comparePositions(sequence, a, b) {
  if (samePosition(a, b)) return 0;
  if (!isGapPosition(a) && !isGapPosition(b) && a.paragraph === b.paragraph) return a.offset - b.offset;
  const rows = caretRows(sequence);
  const rowA = rowAt(sequence, a, rows);
  const rowB = rowAt(sequence, b, rows);
  if (!rowA || !rowB) return 0;
  return rowA.order - rowB.order;
}

// The two ends of a selection, in reading order: [start, end].
export function orderedRange(sequence, anchor, focus) {
  return comparePositions(sequence, anchor, focus) <= 0 ? [anchor, focus] : [focus, anchor];
}

// A row's first and last places: a line's start, and its end - a line the
// paragraph goes on from ends a character before its end, which is where the
// next line starts.
function firstPlace(row) {
  return isGapRow(row) ? row.gap : position(row.paragraph, row.start);
}

function lastPlace(row) {
  if (isGapRow(row)) return row.gap;
  if (row.last || row.end === row.start) return position(row.paragraph, row.end);
  return position(row.paragraph, row.end - characterBefore(rowText(row), row.end - row.start));
}

// A line's text, from its start: its runs, and the space it was broken at.
function rowText(row) {
  let text = "";
  for (const run of row.runs) text += run.text;
  return text + (row.trailing || "");
}

// The x of `offset` on `line`, from the paper's left edge.
function xInLine(line, offset, measurer) {
  for (const run of line.runs) {
    if (offset >= run.start && offset <= run.start + run.text.length) {
      return line.x + run.x + measurer.measure(run.text.slice(0, offset - run.start), run.font);
    }
  }
  if (line.runs.length === 0) return line.x;
  // In the whitespace a line was broken at - after its last run.
  const last = line.runs[line.runs.length - 1];
  const trailing = line.trailing.slice(0, offset - lastRunEnd(line));
  return line.x + line.width + measurer.measure(trailing, last.font);
}

// The run the text at `offset` is formatted by: the one it's in - at a
// boundary, the one before, as typing there would be.
function runAt(line, offset) {
  let result = null;
  for (const run of line.runs) {
    if (offset >= run.start && offset <= run.start + run.text.length) {
      if (offset > run.start || !result) result = run;
      if (offset < run.start + run.text.length) break;
    }
  }
  return result || line.runs[line.runs.length - 1] || null;
}

function lastRunEnd(line) {
  const last = line.runs[line.runs.length - 1];
  return last.start + last.text.length;
}

function isLowSurrogate(code) {
  return code >= 0xdc00 && code <= 0xdfff;
}

function isHighSurrogate(code) {
  return code >= 0xd800 && code <= 0xdbff;
}

// How many code units the character before (after) `offset` in `text` is.
function characterBefore(text, offset) {
  return offset >= 2 && isLowSurrogate(text.charCodeAt(offset - 1)) && isHighSurrogate(text.charCodeAt(offset - 2)) ? 2 : 1;
}

function characterAfter(text, offset) {
  return isHighSurrogate(text.charCodeAt(offset)) && isLowSurrogate(text.charCodeAt(offset + 1)) ? 2 : 1;
}

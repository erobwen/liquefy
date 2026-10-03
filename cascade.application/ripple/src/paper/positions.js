import { positionInLine } from "../print/index.js";
import { textPosition, isMarker, samePosition } from "../model/flows.js";

/**
 * The caret in a laid-out Ripple document: where a position is on the
 * papers, which position a point is, and moving from one place to the next -
 * all on the document's caret rows (see markers.js), every line and every
 * marker, in reading order. `rows` is what caretRows() returns.
 *
 * Positions are the model's (see ../model/flows.js): in a paragraph's text,
 * or a marker - a gap, or a flow's start or end. On a line, everything is as
 * in cascade.print's positions.js - the characters of the line, measured
 * with the measurer the lines were broken with. A marker is a row of one
 * place: its bar - a horizontal line across the text area, or a flow's start
 * or end beside the flow, a vertical one.
 */

const isMarkerRow = (row) => "marker" in row;
const isBesideRow = (row) => isMarkerRow(row) && !!row.vertical;

// The caret row a position is on, with its place in reading order
// (`order`, into rows). Null if it isn't laid out.
export function rowAt(rows, at) {
  if (isMarker(at)) {
    for (let order = 0; order < rows.length; order++) {
      const { row } = rows[order];
      if (isMarkerRow(row) && samePosition(row.marker, at)) return { ...rows[order], order };
    }
    return null;
  }
  let found = null;
  for (let order = 0; order < rows.length; order++) {
    const { row } = rows[order];
    if (isMarkerRow(row) || row.paragraph !== at.paragraph || at.offset < row.start || at.offset > row.end) continue;
    // A break between two lines: the first, at a line end - the second
    // otherwise.
    if (found && at.lineEnd) break;
    found = { ...rows[order], order };
    if (at.offset < row.end) break;
  }
  return found;
}

// Where the caret for a position goes, in µm on its paper: in the text,
// { page, x, top, height } - as tall as the font at that place reaches, on
// its line's baseline; at a marker, its bar - { page, x, width, y,
// marker: true }, a horizontal line, or beside its flow a vertical one,
// shaped as in the text. Null if it isn't laid out.
export function caretAt(rows, at, measurer) {
  const found = rowAt(rows, at);
  if (!found) return null;
  const { row, page } = found;
  if (isBesideRow(row)) return { page, x: row.x, top: row.top, height: row.height };
  if (isMarkerRow(row)) return { page, x: row.x, width: row.width, y: row.y, marker: true };
  const x = xInLine(row, at.offset, measurer);
  const run = runAt(row, at.offset);
  const ascent = run ? run.ascent : row.ascent;
  const descent = run ? run.descent : row.descent;
  return { page, x, top: row.baseline - ascent, height: ascent + descent };
}

// What a selection from `start` to `end` (`start` first, in reading order)
// covers: a rectangle per line, { page, x, top, width, height } in µm.
// Either end may be a gap: the selection then starts or ends between lines.
export function selectionRects(rows, start, end, measurer) {
  const first = rowAt(rows, start);
  const last = rowAt(rows, end);
  if (!first || !last) return [];
  const rects = [];
  for (let order = first.order; order <= last.order; order++) {
    const { page, row } = rows[order];
    if (isMarkerRow(row)) continue;
    const from = order === first.order && !isMarker(start) ? start.offset : row.start;
    const to = order === last.order && !isMarker(end) ? end.offset : row.end;
    const left = xInLine(row, from, measurer);
    let right = xInLine(row, to, measurer);
    if ((order !== last.order || isMarker(end)) && row.last) {
      const lastRun = row.runs[row.runs.length - 1];
      right += lastRun ? measurer.measure(" ", lastRun.font) : Math.round(row.height / 4);
    }
    if (right > left) rects.push({ page, x: left, top: row.top, width: right - left, height: row.height });
  }
  return rects;
}

// The place nearest to a point on paper `page` (µm from its top left
// corner): on a line, the line - at the character boundary nearest across;
// anywhere else, the nearest row up or down: a line, or a gap's marker.
// Beside a line, a start or end beside it - the nearest across - if nearer
// than the line's text. Null if nothing is on that paper.
export function hitTest(rows, page, x, y, measurer) {
  let nearest = null;
  let distance = Infinity;
  for (let order = 0; order < rows.length; order++) {
    const { page: rowPage, row } = rows[order];
    if (rowPage !== page || isBesideRow(row)) continue;
    const away = isMarkerRow(row) ? Math.abs(y - row.y) : Math.max(0, row.top - y, y - (row.top + row.height));
    // On a line, that line - a marker as near never takes it.
    if (away < distance || (away === distance && away === 0 && !isMarkerRow(row))) {
      distance = away;
      nearest = order;
    }
  }
  if (nearest === null) return null;
  const { row } = rows[nearest];
  return isMarkerRow(row) ? row.marker : placeOnLine(rows, nearest, x, measurer);
}

// The place on the line at `order` nearest `x` across: in its text - or a
// start or end beside it, if nearer than the text.
function placeOnLine(rows, order, x, measurer) {
  const line = rows[order].row;
  let across = Math.max(0, line.x - x, x - (line.x + line.width));
  let beside = null;
  for (const row of besideLine(rows, order)) {
    const away = Math.abs(x - row.x);
    if (away < across) {
      across = away;
      beside = row;
    }
  }
  return beside ? beside.marker : toModel(positionInLine(line, x, measurer));
}

// The starts and ends beside the line at `order`: the starts just before it
// in reading order, the ends just after.
function besideLine(rows, order) {
  const result = [];
  for (let i = order - 1; i >= 0 && isBesideRow(rows[i].row) && rows[i].row.kind === "flowStart"; i--) result.push(rows[i].row);
  for (let i = order + 1; i < rows.length && isBesideRow(rows[i].row) && rows[i].row.kind === "flowEnd"; i++) result.push(rows[i].row);
  return result;
}

// The line a start or end at `order` is beside: a start the line after it,
// an end the line before.
function lineBeside(rows, order) {
  const step = rows[order].row.kind === "flowStart" ? 1 : -1;
  let line = order;
  while (rows[line + step] && isBesideRow(rows[line].row)) line += step;
  return line;
}

// Home and End: the start and end of the line a position is on. A gap is a
// row of one place: it stays.
export function lineStart(rows, at) {
  const found = rowAt(rows, at);
  if (!found || isMarkerRow(found.row)) return at;
  return textPosition(at.paragraph, found.row.start);
}

export function lineEnd(rows, at) {
  const found = rowAt(rows, at);
  if (!found || isMarkerRow(found.row)) return at;
  return textPosition(at.paragraph, found.row.end, !found.row.last);
}

// Up and down: the caret row before or after - a line, at `goalX` (the x
// the caret had when moving up and down began), or a gap. Starts and ends
// beside a line are on its row: moving up and down goes past them, from the
// line to the next - to one only with `goalX` nearer it than the line's
// text, as a click there would. Beyond the first or last row: the start or
// end of the line, or the gap, it's on.
export function rowAbove(rows, at, goalX, measurer) {
  return verticalMove(rows, at, goalX, measurer, -1);
}

export function rowBelow(rows, at, goalX, measurer) {
  return verticalMove(rows, at, goalX, measurer, 1);
}

function verticalMove(rows, at, goalX, measurer, direction) {
  const found = rowAt(rows, at);
  if (!found) return at;
  // Beside a line: from the line.
  let target = (isBesideRow(found.row) ? lineBeside(rows, found.order) : found.order) + direction;
  while (rows[target] && isBesideRow(rows[target].row)) target += direction;
  if (!rows[target]) return direction < 0 ? lineStart(rows, at) : lineEnd(rows, at);
  const { row } = rows[target];
  return isMarkerRow(row) ? row.marker : placeOnLine(rows, target, goalX, measurer);
}

// Left and right: the place before or after a position, in reading order -
// a character back or forward in a line (a surrogate pair, most emoji, being
// one), and from a line's end or start into the row before or after it: a
// gap, or the next line. Every place a caret can be is reached. At either
// end of everything, the position stays.
export function stepRight(rows, at) {
  const found = rowAt(rows, at);
  if (!found) return at;
  let { order, row } = found;
  if (!isMarkerRow(row)) {
    // At a line's end, after the space it was broken at, is the next line's
    // start, as far as moving goes.
    if (at.lineEnd && !row.last && rows[order + 1]) {
      order += 1;
      row = rows[order].row;
    }
    const next = at.offset + characterAfter(rowText(row), at.offset - row.start);
    if (next < row.end || (next === row.end && row.last)) return textPosition(row.paragraph, next);
  }
  const following = rows[order + 1];
  return following ? firstPlace(following.row) : at;
}

export function stepLeft(rows, at) {
  const found = rowAt(rows, at);
  if (!found) return at;
  const { order, row } = found;
  if (!isMarkerRow(row) && at.offset > row.start) {
    return textPosition(row.paragraph, at.offset - characterBefore(rowText(row), at.offset - row.start));
  }
  const preceding = rows[order - 1];
  return preceding ? lastPlace(preceding.row) : at;
}

// The very first and last places of everything.
export function sequenceStart(rows) {
  return rows.length > 0 ? firstPlace(rows[0].row) : null;
}

export function sequenceEnd(rows) {
  return rows.length > 0 ? lastPlace(rows[rows.length - 1].row) : null;
}

// Which of two positions comes first, in reading order: negative if `a`
// does, positive if `b` does, 0 for the same place.
export function comparePositions(rows, a, b) {
  if (samePosition(a, b)) return 0;
  if (!isMarker(a) && !isMarker(b) && a.paragraph === b.paragraph) return a.offset - b.offset;
  const rowA = rowAt(rows, a);
  const rowB = rowAt(rows, b);
  if (!rowA || !rowB) return 0;
  return rowA.order - rowB.order;
}

// The two ends of a selection, in reading order: [start, end].
export function orderedRange(rows, anchor, focus) {
  return comparePositions(rows, anchor, focus) <= 0 ? [anchor, focus] : [focus, anchor];
}

// cascade.print's text position, as the model's (the same shape - frozen).
const toModel = (at) => textPosition(at.paragraph, at.offset, at.lineEnd);

// A row's first and last places: a line's start, and its end - a line the
// paragraph goes on from ends a character before its end, which is where the
// next line starts.
function firstPlace(row) {
  return isMarkerRow(row) ? row.marker : textPosition(row.paragraph, row.start);
}

function lastPlace(row) {
  if (isMarkerRow(row)) return row.marker;
  if (row.last || row.end === row.start) return textPosition(row.paragraph, row.end);
  return textPosition(row.paragraph, row.end - characterBefore(rowText(row), row.end - row.start));
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

function characterBefore(text, offset) {
  return offset >= 2 && isLowSurrogate(text.charCodeAt(offset - 1)) && isHighSurrogate(text.charCodeAt(offset - 2)) ? 2 : 1;
}

function characterAfter(text, offset) {
  return isHighSurrogate(text.charCodeAt(offset)) && isLowSurrogate(text.charCodeAt(offset + 1)) ? 2 : 1;
}


/**
 * Between a paper sequence and the model: which place in the text a point
 * on a paper is (hitTest()), and where on the papers a place in the text is
 * (caretAt()) - the two directions every placed line knows enough for, with
 * its paragraph and its range in it (see Paragraph.js). And the moves that
 * depend on how the text is laid out: to the start or end of a line, to the
 * line above or below.
 *
 * A position is a place in a paragraph's text:
 *
 *   { paragraph, offset, lineEnd }
 *
 * `paragraph` is whatever the paragraph's lines were placed with as their
 * source (see Paragraph.js) - a model's own paragraph object, typically - and
 * `offset` counts characters through its text. A position says nothing
 * about papers or lines, so a new layout never makes it wrong. Where a
 * paragraph is broken between two lines, the end of one and the start of
 * the next are the same offset: `lineEnd` says which - true for the end of
 * the first (where End puts the caret), false for the start of the next
 * (where text typed there goes). Nothing here looks into a paragraph: what
 * it needs, its lines know.
 *
 * Measuring goes through the same measurer the lines were broken with, so a
 * caret lands exactly between the characters the line breaking measured -
 * measured as prefixes of a whole run, as the run is drawn.
 */

export function position(paragraph, offset, lineEnd = false) {
  return Object.freeze({ paragraph, offset, lineEnd });
}

// The same place in the text - wherever a line break puts it.
export function samePosition(a, b) {
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

// The placed line a position is on, with its place in reading order
// (`order`, into placedLines()). Null if the paragraph isn't laid out.
export function lineAt(sequence, at, lines = placedLines(sequence)) {
  let found = null;
  for (let order = 0; order < lines.length; order++) {
    const { line } = lines[order];
    if (line.paragraph !== at.paragraph || at.offset < line.start || at.offset > line.end) continue;
    // A break between two lines: the first, at a line end - the second
    // otherwise.
    if (found && at.lineEnd) break;
    found = { ...lines[order], order };
    if (at.offset < line.end) break;
  }
  return found;
}

// Where the caret for a position goes: { page, x, top, height } in µm on
// its paper - as tall as the font at that place reaches, on its line's
// baseline. Null if the paragraph isn't laid out.
export function caretAt(sequence, at, measurer) {
  const found = lineAt(sequence, at);
  if (!found) return null;
  const { line, page } = found;
  const x = xInLine(line, at.offset, measurer);
  const run = runAt(line, at.offset);
  const ascent = run ? run.ascent : line.ascent;
  const descent = run ? run.descent : line.descent;
  return { page, x, top: line.baseline - ascent, height: ascent + descent };
}

// What a selection from `start` to `end` (`start` first, in reading
// order) covers on the papers: a rectangle per line,
// { page, x, top, width, height } in µm, as tall as the line. A line the
// selection goes on past the end of its paragraph from also covers the
// paragraph break, as wide as a space: selected, an empty paragraph shows.
export function selectionRects(sequence, start, end, measurer) {
  const lines = placedLines(sequence);
  const first = lineAt(sequence, start, lines);
  const last = lineAt(sequence, end, lines);
  if (!first || !last) return [];
  const rects = [];
  for (let order = first.order; order <= last.order; order++) {
    const { page, line } = lines[order];
    const left = xInLine(line, order === first.order ? start.offset : line.start, measurer);
    let right = xInLine(line, order === last.order ? end.offset : line.end, measurer);
    if (order !== last.order && line.last) {
      const lastRun = line.runs[line.runs.length - 1];
      right += lastRun ? measurer.measure(" ", lastRun.font) : Math.round(line.height / 4);
    }
    if (right > left) rects.push({ page, x: left, top: line.top, width: right - left, height: line.height });
  }
  return rects;
}

// The place in the text nearest to a point on paper `page` (µm from its top
// left corner): on the line the point is on - or the nearest line, above or
// below it, in between - at the character boundary nearest to it. Null if
// nothing is on that paper.
export function hitTest(sequence, page, x, y, measurer) {
  const lines = sequence.linesOf(page);
  if (lines.length === 0) return null;
  let nearest = null;
  let distance = Infinity;
  for (const line of lines) {
    const below = y - (line.top + line.height);
    const above = line.top - y;
    const away = Math.max(0, below, above);
    if (away < distance) {
      distance = away;
      nearest = line;
    }
    if (away === 0) break;
  }
  return positionInLine(nearest, x, measurer);
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
    // A placeholder is no text: only its start is a place.
    for (let count = 0; count <= (run.placeholder ? 0 : run.text.length); count++) {
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

// Home and End: the start and end of the line a position is on.
export function lineStart(sequence, at) {
  const found = lineAt(sequence, at);
  return found ? position(at.paragraph, found.line.start) : at;
}

export function lineEnd(sequence, at) {
  const found = lineAt(sequence, at);
  if (!found) return at;
  const isLast = found.line.last;
  return position(at.paragraph, found.line.end, !isLast);
}

// Up and down: the line before or after the one a position is on - on
// another paper, if it's the first or last on this one - at `goalX`: the x
// the caret had when moving up and down began, so passing a short line
// doesn't pull it to the left for good. Beyond the first or last line: the
// start or end of it.
export function lineAbove(sequence, at, goalX, measurer) {
  return verticalMove(sequence, at, goalX, measurer, -1);
}

export function lineBelow(sequence, at, goalX, measurer) {
  return verticalMove(sequence, at, goalX, measurer, 1);
}

function verticalMove(sequence, at, goalX, measurer, direction) {
  const lines = placedLines(sequence);
  const found = lineAt(sequence, at, lines);
  if (!found) return at;
  const target = lines[found.order + direction];
  if (!target) return direction < 0 ? lineStart(sequence, at) : lineEnd(sequence, at);
  return positionInLine(target.line, goalX, measurer);
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

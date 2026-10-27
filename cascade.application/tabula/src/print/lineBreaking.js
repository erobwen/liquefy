/**
 * Line breaking - the first of a paragraph's two steps (see Paragraph.js):
 * its text divided into lines for a given width, measured but not yet
 * placed anywhere. Nothing here depends on where the paragraph ends up, so
 * a paragraph pushed down the page, or onto the next one, keeps its lines -
 * only a different width breaks it again.
 *
 * Knows nothing of any model's styles: what it's given is resolved already.
 *
 *  - spans: the paragraph's text, [{ text, font, placeholder, fixed }] -
 *    each font resolved: { family, size, weight, italic }, size in points
 *    (see monospaceMeasurer.js for what a measurer does with one). A span
 *    with `placeholder` true is shown in place of text there isn't - "Title"
 *    in an empty title - laid out and measured as text, but taking no
 *    offsets: its runs (`placeholder: true` too) all start where it is, and
 *    a position is never inside one. A span with `fixed` true is the same,
 *    but shown with the text, not in place of it - a title's number, before
 *    it - its runs `fixed: true`: a position where one starts is after it,
 *    before the text.
 *    A span with `frame` is a frame (see Tabula's ../model/frames.js): a
 *    rectangle in the text, `{ width, height, placement, source }` in µm,
 *    its text one character - one offset, a place before it and one after.
 *    Where it goes is its `placement`:
 *     - "inline": in the line, a word of its own as wide as it is, on the
 *       baseline - the line as tall as it reaches;
 *     - "block": a line of its own, centred - text above and below it -
 *       below any frame beside the text (that line's `before`);
 *     - "left", "right": at that side, its top at the top of the line it's
 *       on - or the next line's, with text before it on its own - the
 *       lines beside it narrowed by its width and `frameGap`. Reaching
 *       further down than the paragraph's last line, the paragraph ends
 *       below it (that line's `after`). In the text, it takes no room.
 *    Each line lists the frames placed on it - `frames`, [{ x, top, width,
 *    height, source }], x from the content area's left, top from the
 *    line's top - and a frame's run is marked `frame`: the frame's place
 *    in the text, drawn as the frame, not as text.
 *  - font: the paragraph's own font - for the height of a paragraph with no
 *    text in it.
 *  - width: of the content area, in µm.
 *  - align ("left", "center", "right"), lineSpacing (a multiple of the
 *    line's height), indentLeft, indentRight, firstLineIndent, frameGap
 *    (µm) - all optional.
 *  - measurer.
 *
 * Returns the lines, each:
 *
 *   {
 *     x,                // where the line starts, from the left of the content area
 *     width,            // of its text, trailing space left out
 *     ascent, descent,  // the tallest font on it, above and below the baseline
 *     height,           // what it takes up on the page, line spacing included
 *     start, end,       // its range in the paragraph's text (offsets across all spans)
 *     runs: [{ text, font, x, width, start, ascent, descent }],  // x from the line's own start
 *     trailing,         // the whitespace it was broken at, after its last run
 *     last,             // whether it's the paragraph's last line
 *     frames,           // the frames placed on it (see above)
 *     before,           // a frame's own line's: the room frames beside the text take above it
 *     after,            // the last line's: how far frames beside the text reach below it
 *   }
 *
 * Lines break at whitespace - the whitespace stays at the end of the line it
 * follows, not counted in its width. A word wider than a whole line is
 * broken between characters. A paragraph with no text still has one line,
 * as tall as its font.
 */
export function breakIntoLines({ spans, font, width, measurer, align = "left", lineSpacing = 1, indentLeft = 0, indentRight = 0, firstLineIndent = 0, frameGap = 4000 }) {
  const style = { font, align, lineSpacing, indentLeft, indentRight, firstLineIndent };
  const words = splitIntoWords(spans, measurer);
  const fullLimit = Math.max(0, width - style.indentLeft - style.indentRight);
  const end = words.length > 0 ? words[words.length - 1].end : 0;

  const lines = [];
  // How far down the next line starts, from the paragraph's top.
  let y = 0;
  // The frames beside the text, reaching down to the line at `y` or
  // further - { frame, side, x, bottom } - and those starting with the
  // line being made, or the one after it.
  let beside = [];
  let starting = [];
  let waiting = [];
  const started = new Set();
  // What the frames beside the line at `y` take, at each side.
  const taken = (side) => beside.filter((each) => each.side === side).reduce((sum, each) => sum + each.frame.width + frameGap, 0);
  const limit = () => Math.max(0, fullLimit - (lines.length === 0 ? style.firstLineIndent : 0) - taken("left") - taken("right"));
  // A frame beside the text, from the line at `y` on: after what's at
  // its side already.
  const startBeside = (frame) => {
    const side = frame.placement;
    const x = side === "left" ? style.indentLeft + taken("left") : style.indentLeft + fullLimit - taken("right") - frame.width;
    const placed = { frame, side, x, bottom: y + frame.height };
    beside.push(placed);
    return placed;
  };
  const placedBeside = (top) => ({ frame, x }) => ({ x, top, width: frame.width, height: frame.height, source: frame.source });

  const close = (lineWords, { block = false } = {}) => {
    // A frame's own line: below the frames beside the text, none beside it.
    const before = block ? Math.max(0, ...beside.map((each) => each.bottom - y)) : 0;
    if (before > 0) {
      y += before;
      beside = [];
    }
    const line = makeLine(lineWords, lines.length, block ? { ...style, lineSpacing: 1, firstLineIndent: 0 } : style, measurer, limit(), end);
    // A frame of its own line: centred in all of it. Otherwise, after the
    // frames on the left.
    if (block) line.x = style.indentLeft + Math.round((fullLimit - line.width) / 2);
    else line.x += taken("left");
    line.frames = [
      // Starting with it - above it, cleared, where it started.
      ...starting.map(placedBeside(-before)),
      ...line.runs.filter((run) => run.frame && run.width > 0).map((run) => ({
        x: line.x + run.x, top: line.ascent - run.frame.height, width: run.frame.width, height: run.frame.height, source: run.frame.source,
      })),
    ];
    if (before > 0) line.before = before;
    line.last = false;
    lines.push(line);
    y += line.height;
    beside = beside.filter((each) => each.bottom > y);
    starting = waiting.map(startBeside);
    waiting = [];
  };

  let current = [];
  let used = 0;
  const pending = [...words];
  while (pending.length > 0) {
    const word = pending.shift();
    const frame = word.frame;
    if (frame && frame.placement === "block") {
      if (current.length > 0) close(current);
      close([word], { block: true });
      current = [];
      used = 0;
      continue;
    }
    if (frame && !started.has(frame) && (frame.placement === "left" || frame.placement === "right")) {
      started.add(frame);
      // Its top at this line's, if nothing's on it yet - else the next's.
      if (current.length === 0) starting.push(startBeside(frame));
      else waiting.push(frame);
    }
    const room = limit();
    if (word.width === 0 || used + word.width <= room) {
      current.push(word);
      used += word.width + word.spaceWidth;
    } else if (current.length > 0) {
      close(current);
      current = [];
      used = 0;
      pending.unshift(word);
    } else {
      // Wider than a whole line on its own: as much of it as fits, the rest
      // on the lines after.
      const [head, tail] = splitWord(word, room, measurer);
      close([head]);
      if (tail) pending.unshift(tail);
    }
  }
  if (current.length > 0 || lines.length === 0) close(current);
  const last = lines[lines.length - 1];
  last.last = true;
  // Frames that were to start with a line after the last: below it, the
  // paragraph ending below them - and below every frame beside it.
  last.frames.push(...starting.map(placedBeside(last.height)));
  last.after = Math.max(0, ...beside.map((each) => each.bottom - y));
  return lines;
}

// Whitespace a line can break at: every kind but the non-breaking ones - a
// no-break space (U+00A0), a figure space (U+2007), a narrow no-break space
// (U+202F) - which keep "10 km" together, as a word.
const breakable = "\\t\\n\\v\\f\\r \\u1680\\u2000-\\u2006\\u2008-\\u200a\\u2028\\u2029\\u205f\\u3000";
const tokens = new RegExp("[" + breakable + "]+|[^" + breakable + "]+", "g");
const isBreakable = new RegExp("^[" + breakable + "]");

// Words, each its pieces (one per span it crosses) and the whitespace after
// it. A word crossing a span boundary is one word: "bold" + "er" in two
// fonts breaks nowhere in between.
function splitIntoWords(spans, measurer) {
  const words = [];
  let word = null;
  let offset = 0;
  for (const span of spans) {
    const font = span.font;
    if (span.frame) {
      // A word of its own: one offset, as wide as it is in the line - none,
      // beside the text.
      const frame = span.frame;
      word = newWord(words);
      word.frame = frame;
      addPiece(word, { text: span.text, font, start: offset, width: isBesideText(frame) ? 0 : frame.width, frame });
      offset += span.text.length;
      word.end = offset;
      continue;
    }
    const placeholder = !!span.placeholder;
    const fixed = !!span.fixed;
    for (const token of span.text.match(tokens) || []) {
      const piece = { text: token, font, start: offset, width: measurer.measure(token, font), placeholder, fixed };
      // A placeholder, or something fixed, is shown, but isn't text: it
      // takes no offsets.
      if (!placeholder && !fixed) offset += token.length;
      if (isBreakable.test(token)) {
        if (word) {
          word.space.push(piece);
          word.spaceWidth += piece.width;
        } else {
          // Leading whitespace: shown - a word of its own, so a line can
          // break after it, as after any whitespace.
          word = newWord(words);
          word.leading = true;
          addPiece(word, piece);
        }
      } else {
        if (!word || word.space.length > 0 || word.leading || word.frame) word = newWord(words);
        addPiece(word, piece);
      }
      word.end = offset;
    }
  }
  return words;
}

function newWord(words) {
  const word = { pieces: [], space: [], width: 0, spaceWidth: 0, end: 0 };
  words.push(word);
  return word;
}

function addPiece(word, piece) {
  word.pieces.push(piece);
  word.width += piece.width;
}

// The first characters of `word` that fit within `limit` (at least one, so
// breaking always gets somewhere), and the rest - null if there's none.
function splitWord(word, limit, measurer) {
  const head = { pieces: [], space: [], width: 0, spaceWidth: 0, end: 0 };
  const tail = { pieces: [], space: word.space, width: 0, spaceWidth: word.spaceWidth, end: word.end };
  let full = false;
  for (const piece of word.pieces) {
    if (full) {
      addPiece(tail, piece);
      continue;
    }
    let count = 0;
    let width = 0;
    while (count < piece.text.length) {
      const next = measurer.measure(piece.text.slice(0, count + 1), piece.font);
      if (head.width + next > limit && (count > 0 || head.pieces.length > 0)) break;
      count++;
      width = next;
    }
    if (count > 0) addPiece(head, { ...piece, text: piece.text.slice(0, count), width });
    if (count < piece.text.length) {
      full = true;
      const rest = piece.text.slice(count);
      addPiece(tail, { ...piece, text: rest, start: piece.placeholder || piece.fixed ? piece.start : piece.start + count, width: measurer.measure(rest, piece.font) });
    }
  }
  // All of it fit after all: no rest - the whitespace after it goes with
  // the head, as it would with the whole word.
  if (tail.pieces.length === 0) {
    head.space = word.space;
    head.spaceWidth = word.spaceWidth;
    head.end = word.end;
    return [head, null];
  }
  head.end = tail.pieces[0].start;
  return [head, tail];
}

function makeLine(words, index, style, measurer, limit, paragraphEnd) {
  // Every word's whitespace is on the line, except after the last word:
  // that trails, part of the line's range but not of its width.
  const pieces = [];
  words.forEach((word, wordIndex) => {
    pieces.push(...word.pieces);
    if (wordIndex < words.length - 1) pieces.push(...word.space);
  });

  const runs = [];
  let x = 0;
  for (const piece of pieces) {
    const last = runs[runs.length - 1];
    if (last && !last.frame && !piece.frame && sameFont(last.font, piece.font) && !!last.placeholder === piece.placeholder && !!last.fixed === piece.fixed) {
      last.text += piece.text;
      last.width += piece.width;
    } else {
      const run = { text: piece.text, font: piece.font, x, width: piece.width, start: piece.start };
      if (piece.placeholder) run.placeholder = true;
      if (piece.fixed) run.fixed = true;
      if (piece.frame) run.frame = piece.frame;
      runs.push(run);
    }
    x += piece.width;
  }
  const width = x;

  // Every run knows how far its own font reaches - what draws it needs that
  // to put it on the line's baseline.
  let ascent = 0;
  let descent = 0;
  const fontsReach = runs.length > 0 ? runs : [{ font: style.font }];
  for (const run of fontsReach) {
    // A frame in the line stands on the baseline, as tall as it is.
    const metrics = run.frame && !isBesideText(run.frame) ? { ascent: run.frame.height, descent: 0 } : measurer.metrics(run.font);
    run.ascent = metrics.ascent;
    run.descent = metrics.descent;
    ascent = Math.max(ascent, metrics.ascent);
    descent = Math.max(descent, metrics.descent);
  }

  let lineX = style.indentLeft + (index === 0 ? style.firstLineIndent : 0);
  if (style.align === "center") lineX += Math.round((limit - width) / 2);
  else if (style.align === "right") lineX += limit - width;

  const start = pieces.length > 0 ? pieces[0].start : (words.length > 0 ? words[0].end : paragraphEnd);
  const end = words.length > 0 ? words[words.length - 1].end : paragraphEnd;
  const lastWord = words[words.length - 1];
  return {
    x: lineX,
    width,
    ascent,
    descent,
    height: Math.round((ascent + descent) * style.lineSpacing),
    start,
    end,
    runs,
    trailing: lastWord ? lastWord.space.map((piece) => piece.text).join("") : "",
  };
}

function sameFont(a, b) {
  return a.family === b.family && a.size === b.size && a.weight === b.weight && a.italic === b.italic;
}

const isBesideText = (frame) => frame.placement === "left" || frame.placement === "right";

// The width of a run's first `count` characters - a frame's: all of it, or
// nothing.
export function runPrefixWidth(run, count, measurer) {
  if (run.frame) return count > 0 ? run.width : 0;
  return measurer.measure(run.text.slice(0, count), run.font);
}

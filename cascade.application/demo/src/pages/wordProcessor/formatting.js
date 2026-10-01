import { observable } from "@liquefy/cascade.component";
import { paragraphsOf, paragraphLength, orderedRange, spanAt } from "./editing.js";
import { paragraphStyleOf, resolveParagraphStyle, resolveFont } from "./styles.js";
import { mm } from "@liquefy/cascade.print";

/**
 * Formatting a document's model - the formatting a word processor's toolbar
 * does, as plain functions on the model, like editing.js's edits: what a
 * selection looks like, and changing it.
 *
 *  - Text: bold, italic - direct formatting on spans (a span's `font`),
 *    on top of their styles. The spans are split where a selection starts
 *    and ends, and spans left formatted alike are joined again.
 *  - Paragraphs: their style (`paragraph.style`), and alignment - direct
 *    paragraph formatting (`paragraph.format.align`, see styles.js's
 *    paragraphStyleOf()).
 *
 * A selection is two positions, either way round (see editing.js).
 */

// The part of every paragraph a selection covers: [{ paragraph, start, end }].
export function paragraphRanges(document, anchor, focus) {
  const [start, end] = orderedRange(document, anchor, focus);
  const all = paragraphsOf(document);
  const from = all.findIndex((each) => each.paragraph === start.paragraph);
  const to = all.findIndex((each) => each.paragraph === end.paragraph);
  return all.slice(from, to + 1).map(({ paragraph }) => ({
    paragraph,
    start: paragraph === start.paragraph ? start.offset : 0,
    end: paragraph === end.paragraph ? end.offset : paragraphLength(paragraph),
  }));
}

// The font of the text at a position - of what typing there would be in
// (see editing.js's spanAt()), resolved through its styles.
export function fontAt(document, at) {
  const style = paragraphStyleOf(document.styles, at.paragraph);
  const { span } = spanAt(at.paragraph, at.offset);
  return resolveFont(document.styles, style, span || {});
}

// Whether all the text selected is in a font `test` says yes to - with
// nothing selected, the font at the position.
export function isFormatted(document, anchor, focus, test) {
  let any = false;
  for (const { paragraph, start, end } of paragraphRanges(document, anchor, focus)) {
    const style = paragraphStyleOf(document.styles, paragraph);
    let at = 0;
    for (const span of paragraph.spans) {
      const spanStart = at;
      at += span.text.length;
      if (at <= start || spanStart >= end) continue;
      any = true;
      if (!test(resolveFont(document.styles, style, span))) return false;
    }
  }
  return any || test(fontAt(document, anchor));
}

// The selected text given `font` - { weight: 700 }, { italic: false } - as
// direct formatting, over whatever its styles say.
export function formatText(document, anchor, focus, font) {
  for (const { paragraph, start, end } of paragraphRanges(document, anchor, focus)) {
    if (start >= end) continue;
    splitSpanAt(paragraph, start);
    splitSpanAt(paragraph, end);
    const style = paragraphStyleOf(document.styles, paragraph);
    let at = 0;
    for (const span of paragraph.spans) {
      const spanStart = at;
      at += span.text.length;
      if (spanStart >= start && at <= end && span.text.length > 0) span.font = directFont(document, style, span, font);
    }
    joinAlikeSpans(paragraph);
  }
}

// Bold and italic, as a toolbar toggles them: off if all the selected text
// already is, on otherwise.
export function toggleBold(document, anchor, focus) {
  const bold = isFormatted(document, anchor, focus, (font) => font.weight >= 600);
  formatText(document, anchor, focus, { weight: bold ? 400 : 700 });
}

export function toggleItalic(document, anchor, focus) {
  const italic = isFormatted(document, anchor, focus, (font) => !!font.italic);
  formatText(document, anchor, focus, { italic: !italic });
}

// The paragraph style of every paragraph the selection touches.
export function setParagraphStyle(document, anchor, focus, style) {
  for (const { paragraph } of paragraphRanges(document, anchor, focus)) {
    if (paragraph.style !== style) paragraph.style = style;
  }
}

// The alignment of every paragraph the selection touches: "left",
// "center" or "right".
export function setAlignment(document, anchor, focus, align) {
  setParagraphFormat(document, anchor, focus, { align });
}

// First line indent, as a toolbar toggles it: off for every paragraph the
// selection touches if all of them are indented, `indent` (µm) for all of
// them otherwise.
export function toggleFirstLineIndent(document, anchor, focus, indent = mm(6)) {
  const ranges = paragraphRanges(document, anchor, focus);
  const indented = ranges.every(({ paragraph }) => paragraphStyleOf(document.styles, paragraph).firstLineIndent > 0);
  setParagraphFormat(document, anchor, focus, { firstLineIndent: indented ? 0 : indent });
}

// Direct paragraph formatting - `format`'s values set on every paragraph
// the selection touches, on top of their styles. And none its style already
// gives it, as for text (see directFont()): indenting and unindenting again
// leaves a paragraph as it was.
export function setParagraphFormat(document, anchor, focus, format) {
  for (const { paragraph } of paragraphRanges(document, anchor, focus)) {
    const inherited = resolveParagraphStyle(document.styles, paragraph.style);
    const result = { ...paragraph.format, ...format };
    for (const key of Object.keys(result)) {
      if (result[key] === inherited[key]) delete result[key];
    }
    paragraph.format = Object.keys(result).length > 0 ? result : undefined;
  }
}

// What the paragraph at a position looks like: its style name, its
// alignment, and its first line indent (µm).
export function paragraphFormatAt(document, at) {
  const style = paragraphStyleOf(document.styles, at.paragraph);
  return { style: at.paragraph.style, align: style.align, firstLineIndent: style.firstLineIndent };
}

// A span's direct font with `font` on it - and nothing its styles already
// give it: bold made bold in a bold heading is no direct formatting at all,
// so unbolding and bolding again leaves the span as it was.
function directFont(document, paragraphStyle, span, font) {
  const inherited = resolveFont(document.styles, paragraphStyle, { style: span.style });
  const result = { ...span.font, ...font };
  for (const key of Object.keys(result)) {
    if (result[key] === inherited[key]) delete result[key];
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

// A span boundary at `offset`, splitting the span it's inside, if any.
function splitSpanAt(paragraph, offset) {
  let at = 0;
  const spans = paragraph.spans;
  for (let index = 0; index < spans.length; index++) {
    const span = spans[index];
    const start = at;
    at += span.text.length;
    if (offset > start && offset < at) {
      const rest = observable({ ...formatOf(span), text: span.text.slice(offset - start) });
      span.text = span.text.slice(0, offset - start);
      spans.splice(index + 1, 0, rest);
      return;
    }
  }
}

// Neighbouring spans formatted alike made one - formatting a selection
// and back again leaves the paragraph as it was. Empty spans go, unless
// they're all there is.
function joinAlikeSpans(paragraph) {
  const joined = [];
  for (const span of paragraph.spans) {
    const previous = joined[joined.length - 1];
    if (span.text.length === 0 && paragraph.spans.length > 1) continue;
    if (previous && sameFormat(previous, span)) previous.text += span.text;
    else joined.push(span);
  }
  if (joined.length !== paragraph.spans.length) paragraph.spans.splice(0, paragraph.spans.length, ...joined);
}

function sameFormat(a, b) {
  if ((a.style || null) !== (b.style || null)) return false;
  const fontA = a.font || {};
  const fontB = b.font || {};
  const keys = new Set([...Object.keys(fontA), ...Object.keys(fontB)]);
  for (const key of keys) if (fontA[key] !== fontB[key]) return false;
  return true;
}

function formatOf(span) {
  const result = {};
  if (span.style) result.style = span.style;
  if (span.font) result.font = span.font;
  return result;
}

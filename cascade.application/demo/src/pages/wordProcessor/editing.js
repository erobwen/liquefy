import { observable } from "@liquefy/cascade.component";
import { position, samePosition } from "@liquefy/cascade.print";

// Positions are cascade.print's - the same that clicking on a paper gives.
export { position, samePosition };

/**
 * Editing a document's model - the edits a word processor makes as you
 * type, as plain functions on the model (see styles.js and WordDocument.js
 * for its shape). Nothing here knows about layout: a change to the model is
 * all an edit is, and the layout follows.
 *
 * A position in the document is cascade.print's (see its positions.js): a
 * place in one paragraph's text, { paragraph, offset, lineEnd } -
 * `paragraph` the model's paragraph itself, `offset` counting characters
 * across all its spans.
 *
 * Every edit returns the position after it - where the caret goes.
 */

export function paragraphText(paragraph) {
  let result = "";
  for (const span of paragraph.spans) result += span.text;
  return result;
}

export function paragraphLength(paragraph) {
  let length = 0;
  for (const span of paragraph.spans) length += span.text.length;
  return length;
}

// Every paragraph of the document, in order, with the section it's in and
// its index there.
export function paragraphsOf(document) {
  const result = [];
  for (const section of document.sections) {
    section.paragraphs.forEach((paragraph, index) => result.push({ section, paragraph, index }));
  }
  return result;
}

function locate(document, paragraph) {
  const all = paragraphsOf(document);
  const at = all.findIndex((each) => each.paragraph === paragraph);
  if (at < 0) throw new Error("Not a paragraph of this document.");
  return { ...all[at], previous: all[at - 1] || null, next: all[at + 1] || null };
}

export function documentStart(document) {
  const [first] = paragraphsOf(document);
  return first ? position(first.paragraph, 0) : null;
}

export function documentEnd(document) {
  const all = paragraphsOf(document);
  const last = all[all.length - 1];
  return last ? position(last.paragraph, paragraphLength(last.paragraph)) : null;
}

// One character back, or forward - a surrogate pair (most emoji) being one
// character - into the paragraph before or after at either end.
export function moveLeft(document, { paragraph, offset }) {
  if (offset > 0) return position(paragraph, offset - characterBefore(paragraphText(paragraph), offset));
  const { previous } = locate(document, paragraph);
  return previous ? position(previous.paragraph, paragraphLength(previous.paragraph)) : position(paragraph, 0);
}

export function moveRight(document, { paragraph, offset }) {
  const text = paragraphText(paragraph);
  if (offset < text.length) return position(paragraph, offset + characterAfter(text, offset));
  const { next } = locate(document, paragraph);
  return next ? position(next.paragraph, 0) : position(paragraph, text.length);
}

// Text typed at `at`. Into the span the position is in - at a boundary
// between two spans, the one before it, as in Word: typing after a bold word
// goes on in bold. A line break in the text splits the paragraph there.
export function insertText(document, at, text) {
  const [first, ...rest] = text.replace(/\r\n?/g, "\n").split("\n");
  let result = insertIntoParagraph(at, first);
  for (const line of rest) {
    result = splitParagraph(document, result);
    result = insertIntoParagraph(result, line);
  }
  return result;
}

function insertIntoParagraph({ paragraph, offset }, text) {
  if (text.length === 0) return position(paragraph, offset);
  if (paragraph.spans.length === 0) {
    paragraph.spans.push(observable({ text }));
  } else {
    const { span, local } = spanAt(paragraph, offset);
    span.text = span.text.slice(0, local) + text + span.text.slice(local);
  }
  return position(paragraph, offset + text.length);
}

// Backspace: the character before `at` - or, at the start of a paragraph,
// the break between it and the one before: the two become one.
export function deleteBackward(document, at) {
  const { paragraph, offset } = at;
  if (offset > 0) {
    const length = characterBefore(paragraphText(paragraph), offset);
    deleteRange(paragraph, offset - length, offset);
    return position(paragraph, offset - length);
  }
  const { previous } = locate(document, paragraph);
  if (!previous) return position(paragraph, 0);
  return mergeParagraphs(document, previous.paragraph, paragraph);
}

// Delete: the character after `at` - or, at the end of a paragraph, the
// break between it and the one after.
export function deleteForward(document, at) {
  const { paragraph, offset } = at;
  const text = paragraphText(paragraph);
  if (offset < text.length) {
    deleteRange(paragraph, offset, offset + characterAfter(text, offset));
    return position(paragraph, offset);
  }
  const { next } = locate(document, paragraph);
  if (!next) return position(paragraph, offset);
  return mergeParagraphs(document, paragraph, next.paragraph);
}

// Which of two positions comes first in the document: negative if `a`
// does, positive if `b` does, 0 if they're the same place.
export function comparePositions(document, a, b) {
  if (a.paragraph === b.paragraph) return a.offset - b.offset;
  for (const { paragraph } of paragraphsOf(document)) {
    if (paragraph === a.paragraph) return -1;
    if (paragraph === b.paragraph) return 1;
  }
  throw new Error("Not positions in this document.");
}

// The two ends of a selection, in document order: [start, end].
export function orderedRange(document, anchor, focus) {
  return comparePositions(document, anchor, focus) <= 0 ? [anchor, focus] : [focus, anchor];
}

// Everything between two positions taken out - within a paragraph, or from
// one paragraph into another: the start of the first and the end of the
// last become one paragraph, in the first one's style, and every paragraph
// in between is gone. The position is where the selection started.
export function deleteBetween(document, anchor, focus) {
  const [start, end] = orderedRange(document, anchor, focus);
  if (start.paragraph === end.paragraph) {
    deleteRange(start.paragraph, start.offset, end.offset);
    return position(start.paragraph, start.offset);
  }
  deleteRange(start.paragraph, start.offset, paragraphLength(start.paragraph));
  deleteRange(end.paragraph, 0, end.offset);
  const all = paragraphsOf(document);
  const from = all.findIndex((each) => each.paragraph === start.paragraph);
  const to = all.findIndex((each) => each.paragraph === end.paragraph);
  for (const { section, paragraph } of all.slice(from + 1, to)) {
    section.paragraphs.splice(section.paragraphs.indexOf(paragraph), 1);
  }
  return mergeParagraphs(document, start.paragraph, end.paragraph);
}

// The word at `offset` - letters, digits and what joins them - as [start,
// end]: what a double click selects. Between words, the space between them;
// at a word's edge, the word.
export function wordAt(paragraph, offset) {
  const text = paragraphText(paragraph);
  if (text.length === 0) return [0, 0];
  const isWord = (character) => /[\p{L}\p{N}_'’]/u.test(character);
  let probe = Math.min(offset, text.length - 1);
  if (!isWord(text[probe]) && probe > 0 && isWord(text[probe - 1])) probe -= 1;
  const kind = isWord(text[probe]);
  const same = (index) => index >= 0 && index < text.length && isWord(text[index]) === kind && (kind || /\s/.test(text[index]) === /\s/.test(text[probe]));
  let start = probe;
  let end = probe + 1;
  while (same(start - 1)) start--;
  while (same(end)) end++;
  return [start, end];
}

// Enter: the paragraph split in two at `at`. Both keep its style - except
// that pressing Enter at the very end of a paragraph whose style names a
// `nextStyle` starts a paragraph in that style instead (a heading followed
// by body text), as in Word. A side left with no text keeps an empty span
// formatted as the text at the split, so typing there goes on in it.
export function splitParagraph(document, at) {
  const { paragraph, offset } = at;
  const { section, index } = locate(document, paragraph);
  const length = paragraphLength(paragraph);
  const style = paragraph.style;
  const definition = document.styles && document.styles.paragraph && document.styles.paragraph[style];
  const nextStyle = offset === length && definition && definition.nextStyle ? definition.nextStyle : style;
  const formatting = formatOf(spanAt(paragraph, offset).span || {});

  const head = [];
  const tail = [];
  let start = 0;
  for (const span of paragraph.spans) {
    const end = start + span.text.length;
    if (end <= offset) head.push(span);
    else if (start >= offset) tail.push(span);
    else {
      tail.push(observable({ ...formatOf(span), text: span.text.slice(offset - start) }));
      span.text = span.text.slice(0, offset - start);
      head.push(span);
    }
    start = end;
  }
  if (tail.length === 0) tail.push(observable({ ...formatting, text: "" }));
  if (head.length === 0) head.push(observable({ ...formatting, text: "" }));

  paragraph.spans.splice(0, paragraph.spans.length, ...head);
  const created = observable({ style: nextStyle, spans: observable(tail) });
  section.paragraphs.splice(index + 1, 0, created);
  return position(created, 0);
}

// `second`'s text appended to `first`, `second` gone. The position is where
// they meet.
function mergeParagraphs(document, first, second) {
  const offset = paragraphLength(first);
  const { section, index } = locate(document, second);
  // An empty span only held formatting for typing - text brings its own.
  // With no text at all, the first paragraph's formatting stays.
  const all = [...first.spans, ...second.spans];
  const spans = all.filter((span) => span.text.length > 0);
  if (spans.length === 0 && all.length > 0) spans.push(all[0]);
  first.spans.splice(0, first.spans.length, ...spans);
  section.paragraphs.splice(index, 1);
  // A section with nothing left in it would still be a paper of its own.
  for (let at = document.sections.length - 1; at >= 0; at--) {
    if (document.sections[at].paragraphs.length === 0) document.sections.splice(at, 1);
  }
  return position(first, offset);
}

// The characters from `start` to `end` taken out, whatever spans they're
// in. A span left empty goes - unless the paragraph has no text left at
// all: then the span the deletion started in stays, empty, keeping its
// formatting for what's typed next.
function deleteRange(paragraph, start, end) {
  if (start >= end || paragraph.spans.length === 0) return;
  const { span: first } = spanAt(paragraph, start + 1);
  let at = 0;
  for (const span of paragraph.spans) {
    const spanStart = at;
    const spanEnd = at + span.text.length;
    at = spanEnd;
    if (spanEnd > start && spanStart < end) {
      const from = Math.max(start, spanStart) - spanStart;
      const to = Math.min(end, spanEnd) - spanStart;
      span.text = span.text.slice(0, from) + span.text.slice(to);
    }
  }
  const kept = paragraph.spans.filter((span) => span.text.length > 0);
  if (kept.length === 0) kept.push(first);
  if (kept.length !== paragraph.spans.length) paragraph.spans.splice(0, paragraph.spans.length, ...kept);
}

// The span `offset` is in, and where in it - at a boundary between two
// spans, the end of the one before.
export function spanAt(paragraph, offset) {
  let start = 0;
  const spans = paragraph.spans;
  for (let index = 0; index < spans.length; index++) {
    const span = spans[index];
    const end = start + span.text.length;
    if (offset <= end) return { span, index, local: offset - start };
    start = end;
  }
  const last = spans[spans.length - 1];
  return { span: last || null, index: spans.length - 1, local: last ? last.text.length : 0 };
}

function formatOf(span) {
  const result = {};
  if (span.style) result.style = span.style;
  if (span.font) result.font = span.font;
  return result;
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

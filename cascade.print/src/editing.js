import { observable } from "@liquefy/cascade.component";

/**
 * Editing a document's model - the edits a word processor makes as you
 * type, as plain functions on the model (see styles.js and PrintDocument.js
 * for its shape). Nothing here knows about layout: a change to the model is
 * all an edit is, and the layout follows.
 *
 * A position in the document is a place in one paragraph's text:
 *
 *   { paragraph, offset, lineEnd }
 *
 * `paragraph` is the model's paragraph itself, `offset` counts characters
 * across all its spans. A position says nothing about papers or lines, so
 * laying the document out again never makes it wrong. `lineEnd` only
 * matters where a paragraph is broken between two lines - the end of the
 * one and the start of the next are the same offset: true for the end of
 * the first (where End puts the caret), false - the default - for the start
 * of the next (where text typed there goes). See positions.js.
 *
 * Every edit returns the position after it - where the caret goes.
 */

export function position(paragraph, offset, lineEnd = false) {
  return Object.freeze({ paragraph, offset, lineEnd });
}

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
  return position(first, offset);
}

// The characters from `start` to `end` taken out, whatever spans they're
// in. A span left empty goes - unless the paragraph has no text left at
// all: then the span the deletion started in stays, empty, keeping its
// formatting for what's typed next.
function deleteRange(paragraph, start, end) {
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

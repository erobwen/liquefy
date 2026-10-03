import {
  Paragraph, Section, Document, isSection, isParagraph, isFlowEdge, isSplitMarker, isJoinMarker,
  textPosition, splitMarker, flowEnd, samePosition, paragraphText, makeSpan,
} from "../model/flows.js";
import { readingOrder } from "./markers.js";

/**
 * Editing a Ripple document at its positions (see ../model/flows.js) - what
 * RippleEditor's `editing` is (see RippleEditor.js): every function takes
 * positions, changes the tree, and returns where the caret goes.
 *
 *   rippleEditor({ ..., editing: rippleEditing(root) })
 *
 * In the text - a paragraph's, or a title's - as in any word processor:
 * typing inserts, Backspace and Delete take out a character (a surrogate
 * pair being one), Enter splits a paragraph in two (in a title: what's after
 * the caret becomes the section's first paragraph). Backspace at the start
 * of a paragraph joins it to the paragraph before it, Delete at its end the
 * one after - siblings both; anywhere else nothing.
 *
 * At the markers - the places between text:
 *
 *  - A flow's post marker (its end), Enter: a new, empty flow right after
 *    it, of its kind - a paragraph after a paragraph; a section, with no
 *    title offset, after a section - the caret in its text (a section's:
 *    its title). After a title: a new first paragraph of its section.
 *    Typing at a paragraph's pre or post marker types at its start or end.
 *  - A split marker, typing: a new flow there, of the kind of the one after
 *    it - a section (at the same title level) or a paragraph - the typed
 *    text in it (a section's: in its title).
 *  - A split marker, Enter: its list - a section - split in two there: what
 *    comes after the marker moved into a new section (with an empty title)
 *    after it; the caret at the split marker between the two.
 *  - A join marker, Backspace or Delete: the flows on either side joined, the
 *    one after into the one before: two paragraphs' text; two sections - the
 *    second's title gone, its children the first's; a section, then a
 *    paragraph - the paragraph the section's last child; a paragraph, then
 *    a section - the section unwrapped, its title gone, its children after
 *    the paragraph, in the section the paragraph is in. The caret at the
 *    split marker the join makes - where the two met - or, for two
 *    paragraphs, where their text met.
 *  - A join marker, typing: that join, then typing at where it left the
 *    caret.
 *
 * Whatever else - Enter at a pre marker, Backspace at a split marker, ... -
 * leaves everything as it is.
 */
export function rippleEditing(root) {
  return {
    insertText: (at, text) => insertText(root, at, text),
    deleteBackward: (at) => deleteBackward(root, at),
    deleteForward: (at) => deleteForward(root, at),
    splitParagraph: (at) => pressEnter(root, at),
    deleteBetween: (anchor, focus) => deleteBetween(root, anchor, focus),
    wordAt,
    paragraphAt,
  };
}

const isText = (at) => !!at && "paragraph" in at;

function insertText(root, at, text) {
  const lines = text.split("\n");
  if (lines.length > 1) {
    let after = insertText(root, at, lines[0]);
    for (const line of lines.slice(1)) after = insertText(root, pressEnter(root, after), line);
    return after;
  }
  if (isText(at)) {
    insertInto(at.paragraph, at.offset, text);
    return textPosition(at.paragraph, at.offset + text.length);
  }
  if (isJoinMarker(at)) {
    const after = join(at.list, at.index);
    return after ? insertText(root, after, text) : at;
  }
  if (isSplitMarker(at)) {
    const next = at.list.children[at.index];
    if (!next) return at;
    const flow = flowLike(next, next.titleOffset || 0);
    at.list.children.splice(at.index, 0, flow);
    const paragraph = isSection(flow) ? flow.title : flow;
    insertInto(paragraph, 0, text);
    return textPosition(paragraph, text.length);
  }
  if (isFlowEdge(at) && isParagraph(at.flow)) {
    const offset = at.edge === "start" ? 0 : paragraphText(at.flow).length;
    insertInto(at.flow, offset, text);
    return textPosition(at.flow, offset + text.length);
  }
  return at;
}

function pressEnter(root, at) {
  if (isText(at)) {
    const place = locate(root, at.paragraph);
    if (!place) return at;
    const rest = new Paragraph(cutAfter(at.paragraph, at.offset));
    if (place.titleOf) place.titleOf.children.splice(0, 0, rest);
    else place.list.children.splice(place.index + 1, 0, rest);
    return textPosition(rest, 0);
  }
  if (isFlowEdge(at) && at.edge === "end") {
    const place = locate(root, at.flow);
    if (!place) return at;
    if (place.titleOf) {
      const first = new Paragraph();
      place.titleOf.children.splice(0, 0, first);
      return textPosition(first, 0);
    }
    const flow = flowLike(at.flow, 0);
    place.list.children.splice(place.index + 1, 0, flow);
    return textPosition(isSection(flow) ? flow.title : flow, 0);
  }
  if (isSplitMarker(at) && isSection(at.list)) {
    const parent = at.list;
    const place = locate(root, parent);
    if (!place || place.titleOf) return at;
    const moved = parent.children.splice(at.index);
    const second = flowLike(parent, parent.titleOffset, moved);
    place.list.children.splice(place.index + 1, 0, second);
    return splitMarker(place.list, place.index + 1);
  }
  return at;
}

function deleteBackward(root, at) {
  if (isText(at)) {
    const { paragraph, offset } = at;
    if (offset > 0) {
      const from = offset - characterBefore(paragraphText(paragraph), offset);
      deleteRange(paragraph, from, offset);
      return textPosition(paragraph, from);
    }
    const place = locate(root, paragraph);
    if (place && place.list && isParagraph(place.list.children[place.index - 1])) return join(place.list, place.index);
    return at;
  }
  if (isJoinMarker(at)) return join(at.list, at.index) || at;
  return at;
}

function deleteForward(root, at) {
  if (isText(at)) {
    const { paragraph, offset } = at;
    const text = paragraphText(paragraph);
    if (offset < text.length) {
      deleteRange(paragraph, offset, offset + characterAfter(text, offset));
      return textPosition(paragraph, offset);
    }
    const place = locate(root, paragraph);
    if (place && place.list && isParagraph(place.list.children[place.index + 1])) return join(place.list, place.index + 1);
    return at;
  }
  if (isJoinMarker(at)) return join(at.list, at.index) || at;
  return at;
}

// A selection taken out: within a paragraph, its text; across paragraphs
// side by side in one list, the end of the first, the start of the last and
// every flow between, the two joined. Anything else, as it is, for now. The
// caret at the selection's start.
function deleteBetween(root, anchor, focus) {
  const [start, end] = inReadingOrder(root, anchor, focus);
  if (!isText(start) || !isText(end)) return start;
  if (start.paragraph === end.paragraph) {
    deleteRange(start.paragraph, start.offset, end.offset);
    return start;
  }
  const first = locate(root, start.paragraph);
  const last = locate(root, end.paragraph);
  if (!first || !last || !first.list || first.list !== last.list) return start;
  deleteRange(start.paragraph, start.offset, paragraphText(start.paragraph).length);
  deleteRange(end.paragraph, 0, end.offset);
  first.list.children.splice(first.index + 1, last.index - first.index - 1);
  join(first.list, first.index + 1);
  return start;
}

// Double and triple click: the word, the paragraph, around a position - at a
// marker, the marker.
function wordAt(at) {
  if (!isText(at)) return [at, at];
  const text = paragraphText(at.paragraph);
  const isWord = (character) => /[\p{L}\p{N}_]/u.test(character);
  let from = at.offset;
  let to = at.offset;
  while (from > 0 && isWord(text[from - 1])) from--;
  while (to < text.length && isWord(text[to])) to++;
  return [textPosition(at.paragraph, from), textPosition(at.paragraph, to)];
}

function paragraphAt(at) {
  if (!isText(at)) return [at, at];
  return [textPosition(at.paragraph, 0), textPosition(at.paragraph, paragraphText(at.paragraph).length)];
}

// The flows on either side of gap `index` in `list` joined, the one after
// into the one before (see the class doc). Where the caret goes - or null,
// if they can't be: at a section's title and its first child.
function join(list, index) {
  if (index < 1) return null;
  const before = list.children[index - 1];
  const after = list.children[index];
  if (!before || !after) return null;
  if (isParagraph(before) && isParagraph(after)) {
    const length = paragraphText(before).length;
    list.children.splice(index, 1);
    before.spans.push(...after.spans.splice(0));
    return textPosition(before, length);
  }
  if (isSection(before) && isSection(after)) {
    const count = before.children.length;
    list.children.splice(index, 1);
    const moved = after.children.splice(0);
    before.children.push(...moved);
    return moved.length > 0 ? splitMarker(before, count) : flowEnd(before);
  }
  if (isSection(before) && isParagraph(after)) {
    const count = before.children.length;
    list.children.splice(index, 1);
    before.children.push(after);
    return splitMarker(before, count);
  }
  // A paragraph, then a section: the section unwrapped.
  const moved = after.children.splice(0);
  list.children.splice(index, 1, ...moved);
  return moved.length > 0 ? splitMarker(list, index) : flowEnd(before);
}

// A new, empty flow of `flow`'s kind - a section at `titleOffset`, holding
// `children`; a document on the same paper.
function flowLike(flow, titleOffset, children = []) {
  if (flow instanceof Document) return new Document({ title: "", paper: flow.paper, margins: flow.margins, titleOffset }, children);
  if (isSection(flow)) return new Section("", children, titleOffset);
  return new Paragraph();
}

// Where a flow is: { list, index } - a child of a section, or of the
// sequence - or { titleOf } - a section's title. Null if it's nowhere.
function locate(root, flow) {
  const visit = (list) => {
    for (let index = 0; index < list.children.length; index++) {
      const child = list.children[index];
      if (child === flow) return { list, index };
      if (isSection(child)) {
        if (child.title === flow) return { titleOf: child };
        const found = visit(child);
        if (found) return found;
      }
    }
    return null;
  };
  return visit(root);
}

// The two positions, the one first in reading order first.
function inReadingOrder(root, a, b) {
  const items = readingOrder(root, { joinMarkers: "all" });
  const order = (at) => {
    const index = items.findIndex((item) => isText(at) ? item.block === at.paragraph : !!item.marker && samePosition(item.marker, at));
    return [index, isText(at) ? at.offset : 0];
  };
  const [ia, oa] = order(a);
  const [ib, ob] = order(b);
  return ia < ib || (ia === ib && oa <= ob) ? [a, b] : [b, a];
}

// The text of a paragraph's spans, changed in place - typing goes into the
// span before the caret, so it takes that span's style.
function insertInto(paragraph, offset, text) {
  if (text === "") return;
  let start = 0;
  for (const span of paragraph.spans) {
    const end = start + span.text.length;
    if (offset <= end) {
      span.text = span.text.slice(0, offset - start) + text + span.text.slice(offset - start);
      return;
    }
    start = end;
  }
  paragraph.spans.push(makeSpan(text));
}

function deleteRange(paragraph, from, to) {
  let start = 0;
  for (const span of paragraph.spans) {
    const length = span.text.length;
    const a = Math.max(0, Math.min(length, from - start));
    const b = Math.max(0, Math.min(length, to - start));
    if (a < b) span.text = span.text.slice(0, a) + span.text.slice(b);
    start += length;
  }
  dropEmptySpans(paragraph);
}

// A paragraph's text from `offset` on taken out of it: as spans, styled as
// they were.
function cutAfter(paragraph, offset) {
  const after = [];
  let start = 0;
  for (const span of paragraph.spans) {
    const length = span.text.length;
    const cut = Math.max(0, Math.min(length, offset - start));
    if (cut < length) {
      after.push({ text: span.text.slice(cut), bold: span.bold, italic: span.italic });
      span.text = span.text.slice(0, cut);
    }
    start += length;
  }
  dropEmptySpans(paragraph);
  return after;
}

function dropEmptySpans(paragraph) {
  for (let index = paragraph.spans.length - 1; index >= 0; index--) {
    if (paragraph.spans[index].text === "") paragraph.spans.splice(index, 1);
  }
}

const isLowSurrogate = (code) => code >= 0xdc00 && code <= 0xdfff;
const isHighSurrogate = (code) => code >= 0xd800 && code <= 0xdbff;

function characterBefore(text, offset) {
  return offset >= 2 && isLowSurrogate(text.charCodeAt(offset - 1)) && isHighSurrogate(text.charCodeAt(offset - 2)) ? 2 : 1;
}

function characterAfter(text, offset) {
  return isHighSurrogate(text.charCodeAt(offset)) && isLowSurrogate(text.charCodeAt(offset + 1)) ? 2 : 1;
}

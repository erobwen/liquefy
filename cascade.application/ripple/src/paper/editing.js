import {
  Paragraph, Section, Document, isSection, isParagraph, isFlowEdge,
  textPosition, samePosition, paragraphText, makeSpan,
} from "../model/flows.js";
import { readingOrder } from "./markers.js";

/**
 * Editing a Ripple document at its positions (see ../model/flows.js) - what
 * RippleEditor's `editing` is (see RippleEditor.js): every function takes
 * positions, changes the tree, and returns where the caret goes.
 *
 *   rippleEditor({ ..., editing: rippleEditing(root, { newSectionsBeside: () => true }) })
 *
 * `newSectionsBeside()`, asked each time it matters: whether a section made
 * from a blank paragraph - Enter on it, or Enter at a paragraph's start with
 * a blank one before it - is split off the section it's in right away, its
 * title on that section's level, beside it (besideParent()) - by default;
 * or, false, kept in it. `demoteWithChildren()`, likewise: whether a
 * section demoted into the one before it goes whole, its sections in it too
 * (moveInto()) - or, by default, flattened, its sections after it there
 * (mergeInto()): what promoting it again undoes exactly.
 *
 * In the text - a paragraph's, or a title's - as in any word processor:
 * typing inserts, Backspace and Delete take out a character (a surrogate
 * pair being one), Enter splits a paragraph in two (in a title: what's after
 * the caret becomes the section's first paragraph) - but at the end of one,
 * with an empty one next in reading order, its placeholder showing, Enter
 * only moves the caret there: to fill in what's already waiting, not make
 * more of it. Backspace at the start
 * of a paragraph joins it to the paragraph before it, Delete at its end the
 * one after - siblings both; anywhere else nothing.
 *
 * A section's title counts as the paragraph before its first child:
 * Backspace at the start of the first paragraph joins it into the title,
 * Delete at the end of the title the first paragraph into it.
 *
 * Every new section - however it's made - holds an empty paragraph if
 * nothing else, so it shows both placeholders, "Title" and "Text" (see
 * ../layout); the caret, unless said otherwise below, at the start of its
 * title. And no section is ever left only a title: one a split or a
 * removal empties gets an empty paragraph too - which a section merged into
 * it, coming back, takes the place of, so the round trips stay exact.
 *
 * The structure, from the text - three keys, each undoing another:
 *
 *  - Enter on an empty paragraph: a section in its place, holding the
 *    paragraphs after it in its list, up to the next section; the caret at
 *    the start of its (empty) title (sectionFrom()).
 *  - Or: Enter at the start of a paragraph, an empty one before it - as
 *    Enter at its start leaves: the paragraph promoted, the title of a
 *    section in their place, the empty one gone, holding the paragraphs
 *    after it up to the next section; the caret at the start of its title
 *    (promote()). Backspace there makes it a paragraph again.
 *  - Enter at the start of a title - empty or not: its section split off
 *    the section it's in, as its second half - what came after it moved
 *    into it - and after that section, a level up; right in a document, a
 *    document of its own. The caret stays (splitOff()).
 *  - Backspace at the start of a title, or at a section's pre marker: the
 *    section merged with what's before it - after a section, into it,
 *    flattened: the section with its title and leading paragraphs its last
 *    child, the rest of what it held after it - undoing a split (exactly,
 *    when what the split moved into it began with a section: paragraphs it
 *    moved in can't be told from the section's own, and stay in it); after
 *    a paragraph or its parent's title, unwrapped in place, its title a
 *    paragraph first - or, empty, gone - undoing a section made on Enter
 *    (mergeBack()).
 *
 * So from the end of a paragraph, Enter, Enter, Enter and Backspace,
 * Backspace leave everything as it was.
 *
 * Tab and Shift+Tab, as indenting goes: Shift+Tab anywhere in a title
 * promotes its section - out, the same as Enter at its start - and Tab
 * demotes it - in: into the section before it, as its last child, flattened
 * as Backspace does - Shift+Tab undone, exactly when what Shift+Tab moved
 * into it began with a section. With no section right before it, it can go
 * no further down: Tab makes it paragraphs - its title one, unless empty,
 * and what it held - the reverse of Shift+Tab in a paragraph, which makes it
 * a section's title, the section holding the paragraphs after it up to the
 * next section. Tab in a paragraph: nothing. The caret stays where it is
 * (pressTab()) - but Tab with an empty title or paragraph next, its
 * placeholder waiting, only moves the caret there. The same moves,
 * for a panel's buttons: promoteSection(), demoteSection(), and whether
 * they can be done, canPromote(), canDemote() - and promoteParagraph(), and
 * for a leaf section, makeParagraphs() (canMakeParagraphs()); for a
 * paragraph, moveOut() (canMoveOut()): it and all after it in its section,
 * after the section.
 *
 * At a flow's post marker (its end), Enter: a new, empty flow right after
 * it, of its kind - a paragraph after a paragraph; a section, with no title
 * offset, after a section - the caret in its text (a section's: its
 * title). Typing at a paragraph's pre or post marker types at its start or
 * end - at a section's pre marker (there, always, before a title's number,
 * in a document numbering its titles), Enter and typing act as at its
 * title's start; Backspace at a pre marker is as at the start of the text it
 * opens;
 * Backspace at a post marker takes the flow out - a paragraph, a section and
 * all in it - the caret at the end of the text before it (removeFlow()).
 *
 * Whatever else leaves everything as it is.
 */
export function rippleEditing(root, { newSectionsBeside = () => true, demoteWithChildren = () => false } = {}) {
  const options = { newSectionsBeside, demoteWithChildren };
  return {
    insertText: (at, text) => insertText(root, at, text, options),
    deleteBackward: (at) => deleteBackward(root, at),
    deleteForward: (at) => deleteForward(root, at),
    splitParagraph: (at) => pressEnter(root, at, options),
    tab: (at, { shift = false } = {}) => pressTab(root, at, shift, options),
    // For a section's structure, outside the text - a panel's buttons:
    canPromote: (section) => canPromote(root, section),
    canDemote: (section) => canDemote(root, section),
    // Whether demoting it moves it into a section - to a title level of its
    // own still - not, with none before it, making it paragraphs.
    canDemoteIntoSection: (section) => canDemoteIntoSection(root, section),
    promoteSection: (section) => !!splitOff(root, section),
    demoteSection: (section) => !!demote(root, section, undefined, options),
    // A leaf section - none inside it - made paragraphs again, in its place
    // (flatten()): its title one, unless empty, and what it held.
    canMakeParagraphs: (section) => canMakeParagraphs(root, section),
    makeParagraphs: (section) => {
      if (!canMakeParagraphs(root, section)) return false;
      const { list, index } = locate(root, section);
      flatten(list, index, textPosition(section.title, 0));
      return true;
    },
    // A paragraph, and all after it in its section, moved out of it: after
    // the section, a level up (moveOut()).
    canMoveOut: (paragraph) => canMoveOut(root, paragraph),
    moveOut: (paragraph) => moveOut(root, paragraph),
    // A paragraph made a section's title - as Shift+Tab in it (promote()).
    promoteParagraph: (paragraph) => {
      const place = locate(root, paragraph);
      if (!place || !place.list || !isSection(place.list)) return false;
      promote(place.list, place.index);
      return true;
    },
    deleteBetween: (anchor, focus) => deleteBetween(root, anchor, focus),
    wordAt,
    paragraphAt,
  };
}

const isText = (at) => !!at && "paragraph" in at;

function insertText(root, at, text, options = {}) {
  const lines = text.split("\n");
  if (lines.length > 1) {
    let after = insertText(root, at, lines[0]);
    for (const line of lines.slice(1)) after = insertText(root, pressEnter(root, after, options), line, options);
    return after;
  }
  if (isText(at)) {
    insertInto(at.paragraph, at.offset, text);
    return textPosition(at.paragraph, at.offset + text.length);
  }
  // At a section's pre marker: typing at its title's start.
  if (isFlowEdge(at) && at.edge === "start" && isSection(at.flow)) return insertText(root, textPosition(at.flow.title, 0), text);
  if (isFlowEdge(at) && isParagraph(at.flow)) {
    const offset = at.edge === "start" ? 0 : paragraphText(at.flow).length;
    insertInto(at.flow, offset, text);
    return textPosition(at.flow, offset + text.length);
  }
  return at;
}

function pressEnter(root, at, options = {}) {
  if (isText(at)) {
    const place = locate(root, at.paragraph);
    if (!place) return at;
    if (place.titleOf && at.offset === 0) return splitOff(root, place.titleOf) || at;
    if (place.list && isSection(place.list) && paragraphText(at.paragraph) === "") {
      const made = sectionFrom(place.list, place.index);
      besideParent(root, place.list, made.paragraph, options);
      return made;
    }
    if (place.list && isSection(place.list) && at.offset === 0 && isEmptyParagraph(place.list.children[place.index - 1])) {
      promote(place.list, place.index, true);
      besideParent(root, place.list, at.paragraph, options);
      return at;
    }
    // At the end, with an empty one next - its placeholder showing: there,
    // nothing new made.
    if (at.offset === paragraphText(at.paragraph).length) {
      const next = paragraphAfter(root, at.paragraph);
      if (next && paragraphText(next) === "") return textPosition(next, 0);
    }
    const rest = new Paragraph(cutAfter(at.paragraph, at.offset));
    if (place.titleOf) place.titleOf.children.splice(0, 0, rest);
    else place.list.children.splice(place.index + 1, 0, rest);
    return textPosition(rest, 0);
  }
  // At a section's pre marker - before its title's number, in a document
  // numbering its titles: as at its title's start, the caret staying.
  if (isFlowEdge(at) && at.edge === "start" && isSection(at.flow)) {
    splitOff(root, at.flow);
    return at;
  }
  if (isFlowEdge(at) && at.edge === "end") {
    const place = locate(root, at.flow);
    if (!place) return at;
    if (place.titleOf) return at;
    const flow = flowLike(at.flow, 0);
    place.list.children.splice(place.index + 1, 0, flow);
    return textPosition(isSection(flow) ? flow.title : flow, 0);
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
    if (place && place.titleOf) return mergeBack(root, place.titleOf) || at;
    if (place && place.list) return joinParagraphs(place.list, place.index) || at;
    return at;
  }
  // At a pre marker: as at the start of the text it opens.
  if (isFlowEdge(at) && at.edge === "start") {
    if (isSection(at.flow)) return mergeBack(root, at.flow) || at;
    return deleteBackward(root, textPosition(at.flow, 0));
  }
  // At a post marker: the flow gone.
  if (isFlowEdge(at) && at.edge === "end") return removeFlow(root, at.flow) || at;
  return at;
}

// Backspace at a flow's post marker: the flow - a paragraph, a section and
// all in it, a document, if there's another - taken out; the section it was
// in, left empty, given an empty paragraph. The caret at the end of the
// text before it - or, first of all, at the start of what's first now. Null
// if it can't be: a title, the only document.
function removeFlow(root, flow) {
  const place = locate(root, flow);
  if (!place || !place.list) return null;
  const { list, index } = place;
  if (!isSection(list) && list.children.length < 2) return null;
  const blocks = readingOrder(root).filter((item) => item.block && !item.exit).map((item) => item.block);
  const before = blocks[blocks.indexOf(isSection(flow) ? flow.title : flow) - 1] || null;
  list.children.splice(index, 1);
  if (isSection(list)) fillIfEmpty(list);
  if (before) return textPosition(before, paragraphText(before).length);
  const first = readingOrder(root).find((item) => item.block && !item.exit);
  return first ? textPosition(first.block, 0) : null;
}

// A section just made from a blank paragraph - by Enter on it, or near it -
// with `newSectionsBeside()` on, split off the section it's in right away
// (splitOff()): its title on that section's level, beside it, not under it.
// Not right in a document: a document of its own it would be, on a paper of
// its own - it stays in.
function besideParent(root, parent, title, { newSectionsBeside } = {}) {
  if (!newSectionsBeside || !newSectionsBeside() || parent instanceof Document) return;
  const made = locate(root, title);
  if (made && made.titleOf) splitOff(root, made.titleOf);
}

// Enter on an empty paragraph: a section in its place - its title empty, to
// write - holding the paragraphs after it in its list, up to the next
// section (an empty paragraph, if there are none). The caret at the start of
// its title.
function sectionFrom(list, index) {
  let end = index + 1;
  while (isParagraph(list.children[end])) end++;
  const section = newSection(0, list.children.slice(index + 1, end));
  list.children.splice(index, end - index, section);
  return textPosition(section.title, 0);
}

// The paragraph at `index` in `list` promoted: a section's title, the
// section in its place, holding the paragraphs after it, up to the next
// section (an empty paragraph, if there are none). With `dropBefore`, the
// empty paragraph before it gone too - Enter at the start of a paragraph
// with an empty one before it, left there by Enter at its start just
// before. Shift+Tab anywhere in it: without. The paragraph, the same, the title
// now - a position in it is where it was.
function promote(list, index, dropBefore = false) {
  const paragraph = list.children[index];
  let end = index + 1;
  while (isParagraph(list.children[end])) end++;
  const held = list.children.slice(index + 1, end);
  const section = new Section(paragraph, held.length > 0 ? held : [new Paragraph()]);
  const from = dropBefore ? index - 1 : index;
  list.children.splice(from, end - from, section);
}

const isEmptyParagraph = (flow) => isParagraph(flow) && paragraphText(flow) === "";

// Tab and Shift+Tab - structural commands, as indenting is; text has no use
// for them. Shift+Tab, out - promoting: anywhere in a title, its section
// split off the section it's in, as Enter at its start - what came after
// it in there moved into it (splitOff()); anywhere in a paragraph, the
// paragraph a section's title (promote()). Tab, in - demoting: anywhere in
// a title, its section into the section before it, Shift+Tab undone; or,
// with none right before it, made paragraphs (demote()). Tab in a
// paragraph: nothing. The caret where it was. But Tab with an empty one
// next in reading order - its placeholder showing, waiting: only the caret
// moved there, as from one field to the next.
function pressTab(root, at, shift, options = {}) {
  if (!isText(at)) return at;
  const place = locate(root, at.paragraph);
  if (!place) return at;
  if (!shift) {
    const next = paragraphAfter(root, at.paragraph);
    if (next && paragraphText(next) === "") return textPosition(next, 0);
    if (place.titleOf) return demote(root, place.titleOf, at, options) || at;
  } else if (place.titleOf) splitOff(root, place.titleOf);
  else if (place.list && isSection(place.list)) promote(place.list, place.index);
  return at;
}

// Enter at the start of a title: its section split off the section it's
// in, as the second half of it - what came after it there moved into it,
// after what it holds, and it after that section, a level up. A section
// right in a document becomes a document of its own, after it. The caret
// where it was. Null if there's nothing to split off.
function splitOff(root, section) {
  const place = locate(root, section);
  if (!place || !place.list || !isSection(place.list)) return null;
  const parent = place.list;
  const outer = locate(root, parent);
  if (!outer || !outer.list) return null;
  const tail = parent.children.splice(place.index).slice(1);
  // What comes in takes the place of a lone empty paragraph.
  if (tail.length > 0 && holdsOnlyAnEmptyParagraph(section)) section.children.splice(0);
  section.children.push(...tail);
  // Neither half left empty.
  fillIfEmpty(parent);
  fillIfEmpty(section);
  outer.list.children.splice(outer.index + 1, 0, isSection(outer.list) ? section : asDocument(section, parent));
  return textPosition(section.title, 0);
}

// A section with nothing in it given an empty paragraph - its "Text"
// placeholder: no section is ever only a title.
function fillIfEmpty(section) {
  if (section.children.length === 0) section.children.push(new Paragraph());
}

// Whether a section holds nothing but an empty paragraph - as one made, or
// left by a split, does.
const holdsOnlyAnEmptyParagraph = (section) => section.children.length === 1 && isEmptyParagraph(section.children[0]);

// Backspace at the start of a title: its section merged with what's before
// it. After a section: into it, flattened - itself, its title and the
// paragraphs it starts with, as that section's last child, and all it held
// from its first section on after it, as that section's children too: what
// splitOff() did, undone (a document becoming a section again). After a
// paragraph, or first in its section (its title before it): unwrapped,
// what it held in its place, its title before it as a paragraph - or, an
// empty one, gone: what sectionFrom() did, undone. The caret where its
// title was - or, its title gone, at what came first in it, or else the end
// of what's before. Null if there's nothing before it.
function mergeBack(root, section) {
  const place = locate(root, section);
  if (!place || !place.list) return null;
  const { list, index } = place;
  const before = flowBefore(list, index);
  if (!before) return null;
  if (isSection(before)) {
    mergeInto(list, index, before);
    return textPosition(section.title, 0);
  }
  const title = section.title;
  if (paragraphText(title) !== "") {
    // Its title a paragraph - a lone empty one, a placeholder, not needed.
    const held = holdsOnlyAnEmptyParagraph(section) ? [] : section.children.splice(0);
    list.children.splice(index, 1, title, ...held);
    return textPosition(title, 0);
  }
  const held = section.children.splice(0);
  list.children.splice(index, 1, ...held);
  const first = held[0];
  if (first) return textPosition(isSection(first) ? first.title : first, 0);
  return textPosition(before, paragraphText(before).length);
}

// The section at `index` in `list` merged into `before`, the section
// before it - flattened: itself, title kept, holding the paragraphs it
// starts with, `before`'s last child; what it held from its first section
// on after it, `before`'s children too (a document becoming a section).
// Into a section holding only an empty paragraph - as a split leaves one: in
// its place. What splitOff() did, undone.
function mergeInto(list, index, before) {
  const section = list.children[index];
  if (holdsOnlyAnEmptyParagraph(before)) before.children.splice(0);
  let end = 0;
  while (isParagraph(section.children[end])) end++;
  const rest = section.children.splice(end);
  // Nothing left in it: its empty paragraph again.
  fillIfEmpty(section);
  list.children.splice(index, 1);
  before.children.push(section instanceof Document ? asSection(section) : section, ...rest);
}

// The section at `index` in `list` moved into `before`, the section before
// it, whole - all it holds, its sections too: `before`'s last child. Into a
// section holding only an empty paragraph: in its place. Demoting it, with
// `demoteWithChildren()` on - not flattened, as mergeInto() does; so not
// quite what promoting it again undoes.
function moveInto(list, index, before) {
  const section = list.children[index];
  if (holdsOnlyAnEmptyParagraph(before)) before.children.splice(0);
  list.children.splice(index, 1);
  before.children.push(section instanceof Document ? asSection(section) : section);
}

// Promoting a section - up a level in the document's structure: split off
// the section it's in (splitOff()). Whether it can be: it's in a section.
function canPromote(root, section) {
  const place = locate(root, section);
  return !!place && !!place.list && isSection(place.list);
}

// Demoting a section - down a level: into the section before it, as its
// last child (mergeInto()) - promoting undone. With no section right before
// it - a paragraph, or its parent's title - it can go no further down: it
// becomes paragraphs (flatten()). Whether it can be: it's in a section, or
// a document after another.
function canDemote(root, section) {
  const place = locate(root, section);
  if (!place || !place.list) return false;
  return isSection(place.list) || canDemoteIntoSection(root, section);
}

// Whether a paragraph can be moved out of its section: it's body text in a
// section that's in another - not right in a document, with nothing around
// it to move out to.
function canMoveOut(root, paragraph) {
  const place = locate(root, paragraph);
  if (!place || !place.list || !isSection(place.list)) return false;
  const outer = locate(root, place.list);
  return !!outer && !!outer.list && isSection(outer.list);
}

// A paragraph, and all that comes after it in its section, moved out of it:
// right after the section, in the section it's in - a level up. The section
// left empty given an empty paragraph. The section, a paragraph after it now,
// gets its exit title (see ../model/flows.js). Whether it was moved.
function moveOut(root, paragraph) {
  if (!canMoveOut(root, paragraph)) return false;
  const { list: section, index } = locate(root, paragraph);
  const outer = locate(root, section);
  const moved = section.children.splice(index);
  fillIfEmpty(section);
  outer.list.children.splice(outer.index + 1, 0, ...moved);
  return true;
}

// Whether a section can be made paragraphs again: a leaf - no section in
// it - in a section (not a document).
function canMakeParagraphs(root, section) {
  const place = locate(root, section);
  return !!place && !!place.list && isSection(place.list) && !section.children.some(isSection);
}

function canDemoteIntoSection(root, section) {
  const place = locate(root, section);
  return !!place && !!place.list && place.index > 0 && isSection(place.list.children[place.index - 1]);
}

// Where the caret goes - where it was, `at`, if that's still there - or
// null if it can't be demoted.
function demote(root, section, at = textPosition(section.title, 0), { demoteWithChildren } = {}) {
  if (!canDemote(root, section)) return null;
  const { list, index } = locate(root, section);
  if (index > 0 && isSection(list.children[index - 1])) {
    const before = list.children[index - 1];
    if (demoteWithChildren && demoteWithChildren()) moveInto(list, index, before);
    else mergeInto(list, index, before);
    return at;
  }
  return flatten(list, index, at);
}

// A section that can go no further down made paragraphs, in its place: its
// title, a paragraph now - unless empty - and what it held after it - but a
// lone empty paragraph, a placeholder, gone. A title and its text: two
// paragraphs; one of them: one; neither: one, empty. Promoting a paragraph
// (Shift+Tab in it) undone. The caret where it was - or, its title gone, at the
// start of what's first now.
function flatten(list, index, at) {
  const section = list.children[index];
  const held = holdsOnlyAnEmptyParagraph(section) ? [] : section.children.splice(0);
  const title = paragraphText(section.title) === "" ? [] : [section.title];
  const flows = [...title, ...held];
  if (flows.length === 0) flows.push(new Paragraph());
  list.children.splice(index, 1, ...flows);
  if (title.length > 0) return at;
  const first = flows[0];
  return textPosition(isSection(first) ? first.title : first, 0);
}

// A section as a document, on `like`'s paper - and a document as a section
// - the same title, the same children.
function asDocument(section, like) {
  return new Document({ title: section.title, paper: like.paper, margins: like.margins, titleOffset: section.titleOffset }, section.children.splice(0));
}

function asSection(document) {
  return new Section(document.title, document.children.splice(0), document.titleOffset);
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
    if (place && place.list) return joinParagraphs(place.list, place.index + 1) || at;
    // At a title's end: its section's first paragraph, as the paragraph after.
    if (place && place.titleOf) return joinParagraphs(place.titleOf, 0) || at;
    return at;
  }
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
  joinParagraphs(first.list, first.index + 1);
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

// The paragraph at `index` in `list` joined into the paragraph before it -
// before a section's first child, its title. Where their text met - or
// null, if it and what's before it aren't both paragraphs.
function joinParagraphs(list, index) {
  const before = flowBefore(list, index);
  const after = list.children[index];
  if (!isParagraph(before) || !isParagraph(after)) return null;
  const length = paragraphText(before).length;
  list.children.splice(index, 1);
  before.spans.push(...after.spans.splice(0));
  return textPosition(before, length);
}

// What's before child `index` of `list`: the child before it - or, before a
// section's first child, its title, as a paragraph before it would be.
function flowBefore(list, index) {
  if (index > 0) return list.children[index - 1];
  return isSection(list) ? list.title : null;
}

// A new, empty flow of `flow`'s kind - a section at `titleOffset`, holding
// `children`; a document on the same paper. A new section holds an empty
// paragraph if nothing else: a title and a text, both to write.
function flowLike(flow, titleOffset, children = []) {
  if (isSection(flow)) return newSection(titleOffset, children, flow instanceof Document ? flow : null);
  return new Paragraph();
}

function newSection(titleOffset = 0, children = [], document = null) {
  const content = children.length > 0 ? children : [new Paragraph()];
  if (document) return new Document({ title: "", paper: document.paper, margins: document.margins, titleOffset }, content);
  return new Section("", content, titleOffset);
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

// The paragraph after `paragraph` in reading order - a title, or body text;
// never an exit title, no text of the document's. Null after the last.
function paragraphAfter(root, paragraph) {
  const blocks = readingOrder(root).filter((item) => item.block && !item.exit).map((item) => item.block);
  const index = blocks.indexOf(paragraph);
  return index >= 0 ? blocks[index + 1] || null : null;
}

// The two positions, the one first in reading order first.
function inReadingOrder(root, a, b) {
  const items = readingOrder(root);
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

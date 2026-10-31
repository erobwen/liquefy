import {
  Paragraph, Section, Document, isSection, isParagraph, isFlowEdge,
  textPosition, flowStart, flowEnd, samePosition, paragraphText, makeSpan, hasExitTitle, titleLevel,
} from "../model/flows.js";
import { FrameAnchor, anchorCharacter } from "../model/frames.js";
import { InnerSequence, isFresh, anchorLadder, anchoredSequences, anchorOf, dotPosition, isDot } from "../model/sequences.js";
import { PageLayout, pageSettingKeys } from "../model/pageLayout.js";
import { readingOrder } from "./markers.js";

/**
 * Editing a Tabula document at its positions (see ../model/flows.js) - what
 * TabulaEditor's `editing` is (see TabulaEditor.js): every function takes
 * positions, changes the tree, and returns where the caret goes.
 *
 *   tabulaEditor({ ..., editing: tabulaEditing(root, { newSectionsBeside: () => true }) })
 *
 * `newSectionsBeside()`, asked each time it matters: whether a section made
 * from a blank paragraph - Enter on it, or Enter at a paragraph's start with
 * a blank one before it - skips going down (by default), or starts there
 * (see placeNewSection(), and the ladder below). `depressedTitles()`:
 * whether a section is ever depressed on the way - set further down than
 * its place, by a title offset - or, false, the ladder's depressed rungs
 * left out, going down as beside (lowestRung()). `refuse()`: told when what
 * was asked for can't be done - a flash, say. `demoteWithChildren()`, likewise: whether a
 * section demoted into the one before it goes whole, its sections in it too
 * (mergeInto(), whole) - or, by default, flattened, its sections after it there
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
 *    the start of its (empty) title (sectionOnLine()).
 *  - Or: Enter at the start of a paragraph, an empty one before it - as
 *    Enter at its start leaves: the paragraph promoted, the title of a
 *    section in their place, the empty one gone, holding the paragraphs
 *    after it up to the next section; the caret at the start of its title
 *    (sectionOnLine()). Backspace there makes it a paragraph again.
 *  - Either way, the new section is put on the lowest rung of a ladder
 *    (placeNewSection()): going down - with sections after it, at their
 *    level but depressed (a title offset), else in the section it's in, a
 *    level down, depressed too - always depressed first - unless `newSectionsBeside()` skips that rung: with
 *    sections after it, one of them; else beside the section it's in.
 *  - Enter at the start of a title - empty or not: its section a rung up
 *    (stepUp()) - depressed, set at its own level; at its own level, split
 *    off the section it's in, as its second half - what came after it moved
 *    into it - and after that section, a level up (splitOff()). Never out
 *    of the document's top: a document has one title on top, its own -
 *    what's right in it can go no further up: Enter there puts an empty
 *    line before it instead (lineBefore()) - room for a paragraph after the
 *    document's title, say - and Backspace takes it away again. Shift+Tab
 *    there, and Enter at the document's own title or its end, are refused
 *    (`refuse()`). The caret stays.
 *
 *    So the Enters after a paragraph: a paragraph; a section, going down;
 *    across, at the level of what's around it; out, splitting the section
 *    it's in - and on, as far as the document's top.
 *  - Backspace at the start of a title, or at a section's pre marker: its
 *    section a rung down (stepDown()) - every Enter undone, rung by rung,
 *    by the same setting: at its own level before a section whose lowest
 *    rung is depressed, depressed; otherwise merged with what's before it
 *    (and beside, on down past the rung it skips) - after a section, into it,
 *    flattened: the section with its title and leading paragraphs its last
 *    child, the rest of what it held after it - undoing a split (exactly,
 *    when what the split moved into it began with a section: paragraphs it
 *    moved in can't be told from the section's own, and stay in it); after
 *    a paragraph or its parent's title, unwrapped in place, its title a
 *    paragraph first - or, empty, gone - undoing a section made on Enter
 *    (mergeBack()).
 *
 * So from the end of a paragraph, any number of Enters and as many
 * Backspaces leave everything as it was - going down or beside - each
 * Backspace undoing the Enter before it. (One Backspace may undo the first
 * two at once: a section made from a blank paragraph, holding what came
 * after it, unwrapped, the blank paragraph goes with it.)
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
 * Delete at a section's pre marker takes the section out, all of it, the
 * other way: the caret at the start of what came after it - a section's
 * pre marker, a paragraph's text - or, with nothing after it, in an empty
 * paragraph put in its place (deleteSection()). Not a document: refused.
 *
 * Pages of their own - inner sequences (see ../model/sequences.js) - and
 * book mode: no hard page breaks in the flow; where its pages start is the
 * structure's to say. Ctrl+Enter (pageBreak()):
 *
 *  - In the text: pages of their own, after the paragraph the caret is in -
 *    empty, a page break - the caret to its creation dot (see
 *    ../model/sequences.js's dotPosition()), for something to be created
 *    there. Again, while nothing's in it yet: anchored a step further out -
 *    after the section the paragraph is in, then the one around that, up
 *    to the document's end - a ladder, as Enter's. Ctrl+Backspace, a step
 *    back in - and, anchored to the paragraph, gone (unanchor()).
 *  - At a creation dot: its pages, whatever's in them, a step further out
 *    - Ctrl+Backspace, a step back in: after the last flow in what they're
 *    anchored to; anchored to a paragraph, empty, gone. Delete or Backspace
 *    there, an empty one gone (removeBreak()) - the caret back in the text.
 *  - At a chapter's start - a section right in the document: book mode, its
 *    chapters each starting a page of their own. In book mode already: pages
 *    of their own before the chapter. Ctrl+Backspace there: those gone, or,
 *    with none, book mode.
 *  - At the very start of a title written - the document's: pages before it,
 *    a cover, say. Ctrl+Backspace there, gone.
 *
 * Only what's still a place - nothing chosen in it - is moved or taken away
 * so: pages with something in them are taken out as what's in them is.
 *
 * Something else than text, inserted - "insert this here", the position
 * deciding what that makes (insert(at, content)): in the text, a frame
 * anchor (see ../model/frames.js) holding it, the caret after it - one
 * character, as far as the text goes. At a marker typing goes into, the
 * same there; at any other, refused, for now.
 *
 * Whatever else leaves everything as it is.
 */
export function tabulaEditing(root, { newSectionsBeside = () => true, depressedTitles = () => true, exitTitles = () => true, keepEmptyLine = () => false, demoteWithChildren = () => false, refuse = () => {} } = {}) {
  // The empty lines left behind by sections made on them (sectionOnLine())
  // - there while the section is being made, Enter after Enter,
  // gone once the caret moves on (settle()).
  const leftBehind = new Set();
  const options = { newSectionsBeside, depressedTitles, exitTitles, keepEmptyLine, demoteWithChildren, refuse, leftBehind };
  // Every change, kept from making what isn't allowed (see guarded()) -
  // where it stays as it was: the caret, or false.
  const at = (change) => guarded(root, options, change, (position) => position);
  const done = (change) => guarded(root, options, change, () => false);
  return {
    insertText: (position, text) => text.includes("\n")
      ? at((position) => insertText(root, position, text, options))(position)
      : insertText(root, position, text, options),
    deleteBackward: at((position) => deleteBackward(root, position, options)),
    deleteForward: at((position) => deleteForward(root, position, options)),
    splitParagraph: at((position) => pressEnter(root, position, options)),
    tab: (position, { shift = false } = {}) => at((position) => pressTab(root, position, shift, options))(position),
    insert: (position, content) => at((position) => insertContent(root, position, content, options))(position),
    pageBreak: at((position) => pageBreak(root, position, options)),
    unanchor: at((position) => unanchor(root, position, options)),
    removeBreak: at((position) => removeBreak(root, position, options)),
    // The flow the caret's pages of their own - still a place, nothing in it,
    // or those of the creation dot it's at - are anchored to, as Ctrl+Enter
    // climbs: what to show them anchored to.
    anchoredAt: (position) => anchoredAt(root, position),
    // Where the caret goes back into the text from a creation dot - the end
    // of what its pages are anchored to.
    textBeside: (position) => textBeside(root, position),
    // For a section's structure, outside the text - a panel's buttons:
    canPromote: (section) => canPromote(root, section),
    canDemote: (section) => canDemote(root, section),
    // Whether demoting it moves it into a section - to a title level of its
    // own still - not, with none before it, making it paragraphs.
    canDemoteIntoSection: (section) => canDemoteIntoSection(root, section),
    promoteSection: done((section) => !!splitOff(root, section)),
    demoteSection: done((section) => !!demote(root, section, undefined, options)),
    // A leaf section - none inside it - made paragraphs again, in its place
    // (flatten()): its title one, unless empty, and what it held.
    canMakeParagraphs: (section) => canMakeParagraphs(root, section),
    makeParagraphs: done((section) => {
      if (!canMakeParagraphs(root, section)) return false;
      const { list, index } = locate(root, section);
      flatten(list, index, textPosition(section.title, 0));
      return true;
    }),
    // A paragraph, and all after it in its section, moved out of it: after
    // the section, a level up (moveOut()).
    // Never with no exit titles allowed: the section, a paragraph after it
    // then, would have one.
    canMoveOut: (paragraph) => on(exitTitles, true) && canMoveOut(root, paragraph),
    moveOut: done((paragraph) => moveOut(root, paragraph)),
    // A paragraph made a section's title - as Shift+Tab in it (promote()).
    promoteParagraph: done((paragraph) => {
      const place = locate(root, paragraph);
      if (!place || !place.list || !isSection(place.list)) return false;
      promote(place.list, place.index);
      return true;
    }),
    deleteBetween: (anchor, focus) => guarded(root, options, () => deleteBetween(root, anchor, focus), () => focus)(),
    // The caret moved on - not by an edit, but going somewhere (an arrow, a
    // click) - to `at` (null: nowhere): see settle().
    settle: (at) => settle(root, at, leftBehind),
    wordAt,
    paragraphAt,
  };
}

const isText = (at) => !!at && "paragraph" in at;

/**
 * What's allowed in a document - its two fundamental settings: exit titles
 * (`exitTitles()`) and depressed titles (`depressedTitles()`), both allowed
 * unless said otherwise. The rules themselves take no path that makes
 * either, where they can help it - a depressed rung left out (lowestRung()),
 * an empty line put inside a section rather than after it (lineBefore()) -
 * and every change is checked besides: one that gives either to a section
 * that hadn't it is undone, all of it, before anything is shown, and refused
 * (`refuse()`: a flash where it was asked for) - whatever it was, by key or
 * by button, and however it got there. What's there already stays: a
 * document opened with some is edited as it is, only never given more.
 */
function guarded(root, options, change, otherwise) {
  return (...parameters) => keepingInserts(root, () => {
    const exits = on(options.exitTitles, true);
    const depressed = depressing(options);
    if (exits && depressed) return change(...parameters);
    const before = marked(root);
    const saved = snapshot(root, options.leftBehind);
    const result = change(...parameters);
    const after = marked(root);
    const gained = (kind) => [...after[kind]].some((section) => !before[kind].has(section));
    if ((!exits && gained("exits")) || (!depressed && gained("depressed"))) {
      restore(saved, options.leftBehind);
      return refused(otherwise(...parameters), options);
    }
    return result;
  });
}

// A change that takes away a flow with pages of their own anchored to it
// (see ../model/sequences.js) - a section made in a paragraph's place, a
// paragraph joined to the one before: its pages anchored to what took its
// place - a flow new there - or else the flow before it, or the section it
// was in; to what has pages there already, after theirs. Gone with what
// they're anchored to, only when that's taken out as a whole.
function keepingInserts(root, change) {
  const flowsBefore = new Set(allFlows(root));
  const anchored = root.children.flatMap((document) => anchoredSequences(document).map((each) => {
    const place = locate(root, each.flow);
    return { ...each, list: place && place.list ? place.list : null, index: place ? place.index : -1 };
  }));
  const result = change();
  const flowsAfter = new Set(allFlows(root));
  for (const { flow, side, sequence, list, index } of anchored) {
    if (flowsAfter.has(flow) || !list || !flowsAfter.has(list) && !(list instanceof Document)) continue;
    const there = list.children[index];
    const target = there && !flowsBefore.has(there) ? there : list.children[index - 1] || list;
    const onto = isSection(target) || side === "after" ? side : "after";
    if (!target[onto]) target[onto] = sequence;
    else target[onto].items.push(...sequence.items);
  }
  return result;
}

// Every flow under `root` - titles too.
function allFlows(root) {
  const result = [];
  const visit = (flow) => {
    result.push(flow);
    if (flow.title) result.push(flow.title);
    if (flow.children) flow.children.forEach(visit);
  };
  root.children.forEach(visit);
  return result;
}

// The sections with an exit title, and the depressed ones - a change may
// keep them, or take them away, but give none to a section that hadn't one:
// a section taken out, leaving a paragraph after the one before it, is
// refused, though the exit title it had goes with it.
function marked(root) {
  const result = { exits: new Set(), depressed: new Set() };
  const visit = (section, level) => section.children.forEach((child, index) => {
    if (hasExitTitle(child, section.children[index + 1], level)) result.exits.add(child);
    if (!isSection(child)) return;
    if (child.titleOffset > 0) result.depressed.add(child);
    visit(child, titleLevel(child, level));
  });
  for (const document of root.children) visit(document, titleLevel(document));
  return result;
}

// The documents' structure and text as they are - every list's flows and
// title offset, every paragraph's spans - for restore() to put back.
function snapshot(root, leftBehind) {
  const lists = [];
  const texts = [];
  const visit = (flow) => {
    if (isParagraph(flow)) {
      texts.push([flow, flow.spans.map((span) => [span, span.text])]);
      return;
    }
    if (flow.title) visit(flow.title);
    lists.push([flow, [...flow.children], flow.titleOffset]);
    flow.children.forEach(visit);
  };
  visit(root);
  return { lists, texts, leftBehind: leftBehind ? [...leftBehind] : [] };
}

function restore({ lists, texts, leftBehind: lines }, leftBehind) {
  for (const [flow, children, titleOffset] of lists) {
    if (flow.children.length !== children.length || flow.children.some((child, index) => child !== children[index])) {
      flow.children.splice(0, flow.children.length, ...children);
    }
    if (typeof(titleOffset) === "number" && flow.titleOffset !== titleOffset) flow.titleOffset = titleOffset;
  }
  for (const [paragraph, spans] of texts) {
    if (paragraph.spans.length === spans.length && spans.every(([span, text], index) => paragraph.spans[index] === span && span.text === text)) continue;
    for (const [span, text] of spans) if (span.text !== text) span.text = text;
    paragraph.spans.splice(0, paragraph.spans.length, ...spans.map(([span]) => span));
  }
  if (leftBehind) {
    leftBehind.clear();
    for (const line of lines) leftBehind.add(line);
  }
}

function insertText(root, at, text, options = {}) {
  text = text.split(anchorCharacter).join("");
  const lines = text.split("\n");
  if (lines.length > 1) {
    let after = insertText(root, at, lines[0]);
    for (const line of lines.slice(1)) after = insertText(root, pressEnter(root, after, options), line, options);
    return after;
  }
  // At a section's pre marker: typing at its title's start - at a
  // paragraph's markers, at its start or end.
  const place = textAt(at);
  if (!place) return at;
  insertInto(place.paragraph, place.offset, text);
  return textPosition(place.paragraph, place.offset + text.length);
}

// Content inserted at a position (see above): a frame anchor holding it,
// in the text there.
function insertContent(root, at, content, options) {
  const place = textAt(at);
  if (!place) return refused(at, options);
  insertSpan(place.paragraph, place.offset, makeSpan({ anchor: new FrameAnchor({ content }) }));
  return textPosition(place.paragraph, place.offset + 1);
}

// The place in the text typing at a position goes to - null at a marker
// typing goes nowhere from.
function textAt(at) {
  if (isText(at)) return at;
  if (isFlowEdge(at) && at.edge === "start" && isSection(at.flow)) return textPosition(at.flow.title, 0);
  if (isFlowEdge(at) && isParagraph(at.flow)) return textPosition(at.flow, at.edge === "start" ? 0 : paragraphText(at.flow).length);
  return null;
}

function pressEnter(root, at, options = {}) {
  if (isText(at)) {
    const place = locate(root, at.paragraph);
    if (!place) return at;
    if (place.titleOf && at.offset === 0) return enterAtTitle(root, place.titleOf, at, options);
    // On an empty line - or at the start of a paragraph, an empty line
    // before it: a section, made on that line.
    if (place.list && isSection(place.list)) {
      const line = isEmptyParagraph(at.paragraph) ? place.index
        : at.offset === 0 && isEmptyParagraph(place.list.children[place.index - 1]) ? place.index - 1
        : -1;
      if (line >= 0) {
        const section = sectionOnLine(place.list, line, line < place.index, options);
        placeNewSection(root, place.list, section, options);
        return line < place.index ? at : textPosition(section.title, 0);
      }
    }
    // At the end, with an empty one next - its placeholder showing: there,
    // nothing new made.
    if (at.offset === paragraphText(at.paragraph).length) {
      const waiting = waitingAfter(root, at.paragraph);
      if (waiting) return waiting;
    }
    const splitting = at.offset < paragraphText(at.paragraph).length;
    const rest = new Paragraph(cutAfter(at.paragraph, at.offset));
    // Pages of their own after it: after its end, where that's gone.
    if (splitting && at.paragraph.after) {
      rest.after = at.paragraph.after;
      at.paragraph.after = null;
    }
    if (place.titleOf) place.titleOf.children.splice(0, 0, rest);
    else place.list.children.splice(place.index + 1, 0, rest);
    return textPosition(rest, 0);
  }
  // At a section's pre marker - before its title's number, in a document
  // numbering its titles: as at its title's start, the caret staying.
  if (isFlowEdge(at) && at.edge === "start" && isSection(at.flow)) return enterAtTitle(root, at.flow, at, options);
  if (isFlowEdge(at) && at.edge === "end") {
    const place = locate(root, at.flow);
    if (!place) return at;
    if (place.titleOf) return at;
    // After a document: another one - a second title on top. Not in a
    // structured text: another document is made beside it instead.
    if (at.flow instanceof Document) return refused(at, options);
    const flow = flowLike(at.flow, 0);
    place.list.children.splice(place.index + 1, 0, flow);
    return textPosition(isSection(flow) ? flow.title : flow, 0);
  }
  return at;
}

function deleteBackward(root, at, options = {}) {
  if (isText(at)) {
    const { paragraph, offset } = at;
    if (offset > 0) {
      const from = offset - characterBefore(paragraphText(paragraph), offset);
      deleteRange(paragraph, from, offset);
      return textPosition(paragraph, from);
    }
    const place = locate(root, paragraph);
    if (place && place.titleOf) return stepDown(root, place.titleOf, options) || at;
    if (place && place.list) return joinParagraphs(place.list, place.index) || at;
    return at;
  }
  // At a pre marker: as at the start of the text it opens.
  if (isFlowEdge(at) && at.edge === "start") {
    if (isSection(at.flow)) return stepDown(root, at.flow, options) || at;
    return deleteBackward(root, textPosition(at.flow, 0), options);
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

// Ctrl+Enter (see above): book mode, at a chapter's start - or, in it, pages
// of their own before the chapter; anywhere else, pages of their own after
// the paragraph - or, there already, still a place, a step further out. Not
// before a document's title: what goes before a document - a cover - is
// created before it, among the file's documents.
function pageBreak(root, at, options) {
  if (isDot(at)) return climb(root, at, options);
  const chapter = chapterStartingAt(root, at);
  if (chapter) {
    const { document, section } = chapter;
    if (!document.bookMode) {
      document.bookMode = true;
      return at;
    }
    if (section.before) return refused(at, options);
    section.before = new InnerSequence();
    return dotPosition(section.before, 0);
  }
  const ladder = ladderAt(root, at);
  if (!ladder) return refused(at, options);
  const fresh = ladder.findIndex((flow) => isFresh(flow.after));
  if (fresh >= 0) {
    const out = ladder[fresh + 1];
    if (!out || out.after) return refused(at, options);
    out.after = ladder[fresh].after;
    ladder[fresh].after = null;
    return dotPosition(out.after, 0);
  }
  const free = ladder.find((flow) => !flow.after);
  if (!free) return refused(at, options);
  free.after = new InnerSequence();
  return dotPosition(free.after, 0);
}

// Where pages of their own are anchored, in `root` - { flow, side } - or
// null.
function anchorIn(root, sequence) {
  for (const document of root.children) {
    const found = anchorOf(document, sequence);
    if (found) return found;
  }
  return null;
}

// Back in the text from a creation dot: the end of what its pages are
// anchored after - a paragraph's text, a section's end - or the start of
// what they're before.
function textBeside(root, at) {
  const anchor = isDot(at) ? anchorIn(root, at.flow) : null;
  if (!anchor) return at;
  if (anchor.side === "before") return flowStart(anchor.flow);
  return isSection(anchor.flow) ? flowEnd(anchor.flow) : textPosition(anchor.flow, paragraphText(anchor.flow).length);
}

// Ctrl+Enter at a creation dot: its pages anchored a step further out -
// after the section around what they're after - the caret staying with
// them. At the document: nowhere further, for now.
function climb(root, at, options) {
  const anchor = anchorIn(root, at.flow);
  if (!anchor || anchor.side !== "after") return refused(at, options);
  const ladder = anchorLadder(root, anchor.flow);
  const out = ladder[ladder.indexOf(anchor.flow) + 1];
  if (!out || out.after) return refused(at, options);
  out.after = at.flow;
  anchor.flow.after = null;
  return at;
}

// Ctrl+Backspace at a creation dot: its pages a step back in - after the
// last flow in what they're after; after a paragraph, or before a flow,
// empty, gone.
function descend(root, at, options) {
  const anchor = anchorIn(root, at.flow);
  if (!anchor) return refused(at, options);
  const { flow, side } = anchor;
  if (side === "after" && isSection(flow)) {
    const last = flow.children[flow.children.length - 1];
    if (!last || last.after) return refused(at, options);
    last.after = at.flow;
    flow.after = null;
    return at;
  }
  return removeBreak(root, at, options);
}

// Delete or Backspace at a creation dot: its pages, empty - a page break -
// gone, the caret back in the text beside where they were. With something
// in them, refused.
function removeBreak(root, at, options) {
  if (!isDot(at)) return at;
  const anchor = anchorIn(root, at.flow);
  if (!anchor || at.flow.items.length > 0) return refused(at, options);
  const back = textBeside(root, at);
  anchor.flow[anchor.side] = null;
  return back;
}

// Ctrl+Backspace (see above): Ctrl+Enter undone - pages still a place a step
// back in, or gone; at a chapter's start, those before it gone, or book
// mode; at a title's start, those before it - from a file made when they
// could be put there.
function unanchor(root, at, options) {
  if (isDot(at)) return descend(root, at, options);
  const chapter = chapterStartingAt(root, at);
  if (chapter) {
    const { document, section } = chapter;
    if (section.before) {
      if (!isFresh(section.before)) return refused(at, options);
      section.before = null;
      return at;
    }
    if (!document.bookMode) return refused(at, options);
    document.bookMode = false;
    return at;
  }
  const titled = titleStartingAt(root, at);
  if (titled && titled.before) {
    if (!isFresh(titled.before)) return refused(at, options);
    titled.before = null;
    return at;
  }
  const ladder = ladderAt(root, at);
  const fresh = ladder ? ladder.findIndex((flow) => isFresh(flow.after)) : -1;
  if (fresh < 0) return refused(at, options);
  const inward = ladder[fresh - 1];
  if (inward && !inward.after) inward.after = ladder[fresh].after;
  ladder[fresh].after = null;
  return at;
}

// The flows pages of their own can be anchored after, from where the caret
// is outward: its paragraph - or a marker's flow - then every section it's
// in, the document last.
function ladderAt(root, at) {
  const flow = isFlowEdge(at) ? at.flow : at && at.paragraph;
  return flow ? anchorLadder(root, flow) : null;
}

function anchoredAt(root, at) {
  if (isDot(at)) {
    const anchor = anchorIn(root, at.flow);
    return anchor ? anchor.flow : null;
  }
  const ladder = at ? ladderAt(root, at) : null;
  return ladder ? ladder.find((flow) => isFresh(flow.after)) || null : null;
}

// The chapter - a section right in a document - whose start `at` is: its
// title's start, or its pre marker. With its document; or null.
function chapterStartingAt(root, at) {
  if (!at) return null;
  for (const document of root.children) {
    for (const section of document.children) {
      if (!isSection(section)) continue;
      const atStart = isFlowEdge(at) ? at.edge === "start" && at.flow === section : at.paragraph === section.title && at.offset === 0;
      if (atStart) return { document, section };
    }
  }
  return null;
}

// The document whose written title starts at `at` - or null.
function titleStartingAt(root, at) {
  if (!isText(at) || at.offset !== 0) return null;
  return root.children.find((document) => at.paragraph === document.title && paragraphText(document.title) !== "") || null;
}

// A section taken out from its start, forward (see above): the caret at
// the start of what came after it in its list - or in an empty paragraph,
// in its place, with nothing after it. Null for a document - nothing a
// section is in.
function deleteSection(root, section) {
  const place = locate(root, section);
  if (!place || !place.list || !isSection(place.list)) return null;
  const { list, index } = place;
  list.children.splice(index, 1);
  const next = list.children[index];
  if (next) return isSection(next) ? flowStart(next) : textPosition(next, 0);
  const empty = new Paragraph();
  list.children.splice(index, 0, empty);
  return textPosition(empty, 0);
}

// A section just made from a blank paragraph - by Enter on it, or near it -
// put on the lowest rung of the ladder Enter climbs (see stepUp()):
//
//  - Going down (`newSectionsBeside()` off): with sections after it, at
//    their level, but set a level further down - depressed, a title offset
//    of 1, or theirs if they're depressed already; with none, where it is:
//    a section in the one the paragraph was in, a level down - depressed
//    too, its title a level further down still, so the next Enter sets it
//    at its own level before it goes across.
//  - Beside (`newSectionsBeside()` on - the default): the rung going down
//    skipped. With sections after it, one of them, as they look; with
//    none, split off the section it's in right away (splitOff()), beside
//    it. Not right in a document: a document has one title on top, its
//    own - it stays in.
function placeNewSection(root, parent, section, options = {}) {
  const next = sectionAfter(root, section);
  if (next || goingDown(options)) {
    section.titleOffset = lowestRung(next, options);
    return;
  }
  // Beside the section it's in - splitOff() refuses at the top, where it
  // stays in.
  splitOff(root, section);
}

// A setting, asked when it matters: `option` a function, or missing.
const on = (option, otherwise = false) => option ? !!option() : otherwise;
const goingDown = (options) => !on(options.newSectionsBeside);
const keepsEmptyLine = (options) => on(options.keepEmptyLine);
const depressing = (options) => on(options.depressedTitles, true);

// The section right after `section`, in the same list - or null.
function sectionAfter(root, section) {
  const place = locate(root, section);
  const next = place && place.list ? place.list.children[place.index + 1] : null;
  return isSection(next) ? next : null;
}

// The title offset of the lowest rung before `next`, a section - or with
// none after it (`next` null): going down, always depressed - a level
// further down than what's after it, or as far as that is already; beside,
// as what's after it is. With no depressed titles (`depressedTitles()`
// false), none: no rung is.
function lowestRung(next, options) {
  if (!depressing(options)) return 0;
  const after = next ? next.titleOffset : 0;
  return goingDown(options) ? Math.max(1, after) : after;
}

// Enter at the start of a title: its section a rung up - depressed (a
// title offset), set at its own level (no offset); at its own level, split
// off the section it's in (splitOff()), a level up - at its own level
// there too: the section it was split off from ends where it should, no
// exit title made for a section that only looks deeper. A section right in
// a document can go no further up: there's one title on top, its
// document's. So the Enters after a paragraph go down, across and out: the
// first makes a paragraph, the next a section on the lowest rung
// (placeNewSection()), each one after that a rung up. Whether it went up.
function enterAtTitle(root, section, at, options) {
  return stepUp(root, section) ? at : lineBefore(root, section, at, options);
}

function stepUp(root, section) {
  if (section.titleOffset > 0) {
    section.titleOffset = 0;
    return true;
  }
  return !!splitOff(root, section);
}

// Backspace at the start of a title: its section a rung down - stepUp()
// undone, rung by rung. What's right before it tells which way it came up:
// a section - the one it was split off from (splitOff() puts it right
// after it) - and it's merged back into it, at that section's level again
// (mergeBack()); a paragraph or its parent's title - made right here, from
// a blank paragraph - and it's depressed, before a section whose lowest
// rung is (lowestRung()), or else unwrapped (mergeBack()). Where the caret
// goes - null if it can't go down.
function stepDown(root, section, options = {}) {
  // Empty lines right before it go first, one Backspace each - the caret
  // staying at the title's start - before the section itself goes down (a
  // line Enter put there at the top, lineBefore(), undone so). But not the
  // one a section being made left behind (`leftBehind`, see settle()):
  // there, the section collapses onto it.
  const place = locate(root, section);
  if (!place || !place.list) return null;
  const end = endBefore(place.list, place.index);
  const line = end ? end.list.children[end.index] : null;
  const keepsTitle = !!end && end.list !== place.list && end.list.children.length === 1;
  if (isEmptyParagraph(line) && !keepsTitle && !(options.leftBehind && options.leftBehind.has(line))) {
    end.list.children.splice(end.index, 1);
    return textPosition(section.title, 0);
  }
  const afterSection = isSection(flowBefore(place.list, place.index));
  if (section.titleOffset === 0 && !afterSection) {
    const next = sectionAfter(root, section);
    const rung = lowestRung(next, options);
    if (rung > 0) {
      section.titleOffset = rung;
      return textPosition(section.title, 0);
    }
  }
  const merged = mergeBack(root, section);
  // Beside, a section never stops in a section with nothing after it - a
  // level down: that's the rung going down, skipped (placeNewSection()), a
  // section made from a blank paragraph there put beside it at once. So
  // merged into one, there, it goes on down - unwrapped: Enter's two moves
  // undone by one Backspace, too. Not right in a document, where a section
  // made does stop.
  if (merged && afterSection && !goingDown(options)) {
    const now = locate(root, section);
    if (now && !(now.list instanceof Document) && !sectionAfter(root, section)) return mergeBack(root, section) || merged;
  }
  return merged;
}

// The caret gone on, to `at`, from making a section: the title it has is
// the one wanted. The empty lines its making left behind (`leftBehind`) go
// - still empty, right before a section - so a paragraph before a title
// doesn't end in one; collapsing the section makes one again (mergeBack()).
// One the caret is on stays: it's a line to write on now.
function settle(root, at, leftBehind) {
  for (const line of leftBehind) {
    leftBehind.delete(line);
    if (paragraphText(line) !== "") continue;
    if (at && ((isText(at) && at.paragraph === line) || (isFlowEdge(at) && at.flow === line))) continue;
    const place = locate(root, line);
    if (!place || !place.list || !isSection(place.list.children[place.index + 1])) continue;
    place.list.children.splice(place.index, 1);
  }
}

// Enter at the start of a title whose section can go no further up - right
// in its document, at the top - where the ladder ends: an empty line before
// it instead, one more for every Enter - room for what comes before it, a
// paragraph after the document's title, say, when its first flow is a
// section. The caret stays at the title's start. Backspace there takes them
// away again, one by one (stepDown()). The document's own title: refused.
//
// After a section, the line goes at its end - of the innermost section
// ending there - not between the two: a paragraph after a section, at its
// level, would give it an exit title (see ../model/flows.js).
function lineBefore(root, section, at, options = {}) {
  const place = locate(root, section);
  if (!place || !place.list || !isSection(place.list)) return refused(at, options);
  const end = endBefore(place.list, place.index);
  const line = new Paragraph();
  if (end && end.list !== place.list) end.list.children.push(line);
  else place.list.children.splice(place.index, 0, line);
  return at;
}

// What's right before the flow at `index` in `list`, in reading order -
// the last flow of the innermost section ending there, a section before
// it; or the flow before it. `{ list, index }`; null with nothing before it
// in its list (its parent's title before it).
function endBefore(list, index) {
  if (index === 0) return null;
  let container = list;
  let at = index - 1;
  while (isSection(container.children[at]) && container.children[at].children.length > 0) {
    container = container.children[at];
    at = container.children.length - 1;
  }
  return { list: container, index: at };
}

// What can't be done - told (`refuse()`: a flash, say), nothing done, the
// caret where it was.
function refused(at, { refuse } = {}) {
  if (refuse) refuse();
  return at;
}

// A section made on the empty line at `line` in `list` - Enter on it, or
// at the start of the paragraph after it (`titled`): that paragraph its
// title, or else a new, empty one, to write. It holds the paragraphs after
// that, up to the next section (an empty one, if there are none), and takes
// the line's place - or, with `keepEmptyLine()`, comes after it, the line
// left behind while the section is being made (see settle()); not after a
// section, though: a paragraph after a section would give it an exit title
// for as long as it's there. Collapsed again (mergeBack()), the section
// leaves the line there again, either way. The section.
function sectionOnLine(list, line, titled, options = {}) {
  const keep = keepsEmptyLine(options) && !isSection(list.children[line - 1]);
  if (keep) options.leftBehind.add(list.children[line]);
  const first = titled ? line + 2 : line + 1;
  const end = runEnd(list, first);
  const held = list.children.slice(first, end);
  const section = titled ? new Section(list.children[line + 1], held.length > 0 ? held : [placeholder()]) : newSection(0, held);
  const from = keep ? line + 1 : line;
  list.children.splice(from, end - from, section);
  return section;
}

// The paragraph at `index` in `list` promoted - Shift+Tab in it: a
// section's title, the section in its place, holding the paragraphs after
// it, up to the next section (an empty paragraph, if there are none). The
// paragraph, the same, the title now - a position in it is where it was.
function promote(list, index) {
  const end = runEnd(list, index + 1);
  const held = list.children.slice(index + 1, end);
  list.children.splice(index, end - index, new Section(list.children[index], held.length > 0 ? held : [placeholder()]));
}

// Where the paragraphs from `from` on in `list` end - at the next
// section, or the list's end.
function runEnd(list, from) {
  let end = from;
  while (isParagraph(list.children[end])) end++;
  return end;
}

// An empty paragraph next in reading order - its placeholder showing,
// waiting: the caret there, for Enter at a paragraph's end and Tab - what's
// waiting filled in, not more made. Or null.
function waitingAfter(root, paragraph) {
  const next = paragraphAfter(root, paragraph);
  return isEmptyParagraph(next) ? textPosition(next, 0) : null;
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
    const waiting = waitingAfter(root, at.paragraph);
    if (waiting) return waiting;
    if (place.titleOf) return demote(root, place.titleOf, at, options) || at;
  } else if (place.titleOf) {
    if (!splitOff(root, place.titleOf)) return refused(at, options);
  } else if (place.list && isSection(place.list)) promote(place.list, place.index);
  return at;
}

// A section split off the section it's in, as the second half of it - what
// came after it there moved into it, after what it holds, and it after
// that section, a level up. Not one right in a document: a document has
// one title on top, its own - split off, it would be a document of its
// own, and another document is made beside it, not out of it. The caret
// where it was. Null if it can't be split off.
function splitOff(root, section) {
  if (!canPromote(root, section)) return null;
  const place = locate(root, section);
  const parent = place.list;
  const outer = locate(root, parent);
  const tail = parent.children.splice(place.index).slice(1);
  // What comes in takes the place of a lone empty paragraph.
  if (tail.length > 0 && holdsOnlyAPlaceholder(section)) section.children.splice(0);
  section.children.push(...tail);
  // Neither half left empty - the half it was split off, emptied, given a
  // placeholder only the split put there: merged back, it goes again
  // (mergeInto()).
  if (parent.children.length === 0) {
    const filler = placeholder();
    splitFillers.add(filler);
    parent.children.push(filler);
  }
  fillIfEmpty(section);
  outer.list.children.splice(outer.index + 1, 0, section);
  return textPosition(section.title, 0);
}

// A section with nothing in it given an empty paragraph - its "Text"
// placeholder: no section is ever only a title.
function fillIfEmpty(section) {
  if (section.children.length === 0) section.children.push(placeholder());
}

// Whether a section holds nothing but an empty paragraph - as one made, or
// left by a split, does.
const holdsOnlyAnEmptyParagraph = (section) => section.children.length === 1 && isEmptyParagraph(section.children[0]);

// The empty paragraphs put in a section only so it isn't only a title -
// its "Text" placeholder, when nothing else is there (newSection(),
// fillIfEmpty(), promote()). Not an empty line the user made, or one left
// behind (sectionOnLine()): what's split off with what came after it takes
// the place of a placeholder, never of a line; what's merged back only of
// the one its split left (splitFillers, below) - the round trips stay exact. (Unwrapped or flattened, a section's lone
// empty paragraph is dropped either way: no line is lost that anything
// stood on.) Still empty, they're still placeholders.
const placeholders = new WeakSet();

function placeholder() {
  const paragraph = new Paragraph();
  placeholders.add(paragraph);
  return paragraph;
}

const holdsOnlyAPlaceholder = (section) => holdsOnlyAnEmptyParagraph(section) && placeholders.has(section.children[0]);

// The placeholders a split put in the section it emptied (splitOff()) - the
// only ones a section merged back takes the place of. Any other a section
// holds - made with it, or left behind when a section was made on it - it
// keeps, what's merged in coming after it.
const splitFillers = new WeakSet();

const holdsOnlyASplitFiller = (section) => holdsOnlyAnEmptyParagraph(section) && splitFillers.has(section.children[0]);

// Backspace at the start of a title: its section merged with what's before
// it. After a section: into it, flattened - itself, its title and the
// paragraphs it starts with, as that section's last child, and all it held
// from its first section on after it, as that section's children too: what
// splitOff() did, undone (a document becoming a section again). After a
// paragraph, or first in its section (its title before it): unwrapped,
// what it held in its place, its title before it as a paragraph, an empty
// line before that, the caret at its start - or, an empty title, gone: what
// sectionOnLine() did, undone, the caret at what came first in it, or else
// the end of what's before. Null if there's nothing before it.
function mergeBack(root, section) {
  const place = locate(root, section);
  if (!place || !place.list) return null;
  const { list, index } = place;
  const before = flowBefore(list, index);
  if (!before) return null;
  if (isSection(before)) {
    mergeInto(list, index, before);
    // Back at the level it was split off from - where it had no offset
    // (stepUp() splits only what has none).
    section.titleOffset = 0;
    return textPosition(section.title, 0);
  }
  const title = section.title;
  if (paragraphText(title) !== "") {
    // Its title a paragraph - a lone empty one, a placeholder, not needed -
    // an empty line before it, the caret at its start: as it was before
    // Enter there, the empty line before it, made it a title (sectionOnLine()). An empty line there already - a paragraph, not
    // its parent's title - does.
    const held = holdsOnlyAnEmptyParagraph(section) ? [] : section.children.splice(0);
    const blank = index > 0 && isEmptyParagraph(before) ? null : new Paragraph();
    list.children.splice(index, 1, ...(blank ? [blank] : []), title, ...held);
    return textPosition(title, 0);
  }
  // Holding only its empty paragraph, after an empty line - the one it was
  // made on, left behind: that's all there was, and the line is still there.
  // The caret on the line it was made on - as the Enter that made it found
  // it. That line gone (settle()), made again: its lone empty paragraph is
  // it, or a new one before what it held.
  const afterLine = index > 0 && isEmptyParagraph(before);
  const onlyItsOwn = holdsOnlyAnEmptyParagraph(section);
  const held = section.children.splice(0);
  if (afterLine) {
    list.children.splice(index, 1, ...(onlyItsOwn ? [] : held));
    return textPosition(before, 0);
  }
  const line = onlyItsOwn ? held[0] : new Paragraph();
  list.children.splice(index, 1, line, ...(onlyItsOwn ? [] : held));
  return textPosition(line, 0);
}

// The section at `index` in `list` merged into `before`, the section
// before it - flattened: itself, title kept, holding the paragraphs it
// starts with, `before`'s last child; what it held from its first section
// on after it, `before`'s children too (a document becoming a section).
// Into a section holding only an empty paragraph - as a split leaves one: in
// its place. What splitOff() did, undone.
//
// `whole`: moved whole instead - all it holds, its sections too - demoting
// it with `demoteWithChildren()` on; so not quite what promoting it again
// undoes.
function mergeInto(list, index, before, whole = false) {
  const section = list.children[index];
  if (holdsOnlyASplitFiller(before)) before.children.splice(0);
  // Flattened: what it holds from its first section on, after it.
  const rest = whole ? [] : section.children.splice(runEnd(section, 0));
  // Nothing left in it: its empty paragraph again.
  fillIfEmpty(section);
  list.children.splice(index, 1);
  before.children.push(section instanceof Document ? asSection(section) : section, ...rest);
}

// Promoting a section - up a level in the document's structure: split off
// the section it's in (splitOff()). Whether it can be: it's in a section
// that's in another - not right in a document, on top.
function canPromote(root, section) {
  return inNestedSection(root, section);
}

// Whether `flow` is in a section that's in another - not right in a
// document: there's somewhere for it to go out to.
function inNestedSection(root, flow) {
  const place = locate(root, flow);
  if (!place || !place.list || !isSection(place.list)) return false;
  const outer = locate(root, place.list);
  return !!outer && !!outer.list && isSection(outer.list);
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
  return isParagraph(paragraph) && inNestedSection(root, paragraph);
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
  if (!canDemoteIntoSection(root, section)) return flatten(list, index, at);
  mergeInto(list, index, list.children[index - 1], on(demoteWithChildren));
  return at;
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

// A document as a section - the same title, the same children: one merged
// into the document before it (a document of a file made before a
// document's top was kept to its own title).
function asSection(document) {
  return new Section(document.title, document.children.splice(0), document.titleOffset);
}

function deleteForward(root, at, options = {}) {
  if (isFlowEdge(at) && at.edge === "start" && isSection(at.flow)) return deleteSection(root, at.flow) || refused(at, options);
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
// `children`; a document on the same paper - its own page settings, if
// it has any, the same. A new section holds an empty
// paragraph if nothing else: a title and a text, both to write.
function flowLike(flow, titleOffset, children = []) {
  if (isSection(flow)) return newSection(titleOffset, children, flow instanceof Document ? flow : null);
  return new Paragraph();
}

function newSection(titleOffset = 0, children = [], document = null) {
  const content = children.length > 0 ? children : [placeholder()];
  if (document) {
    const own = document.pageLayout;
    const pageLayout = new PageLayout(Object.fromEntries(pageSettingKeys.map((key) => [key, own[key]])));
    return new Document({ title: "", pageLayout, titleOffset }, content);
  }
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
// span before the caret, so it takes that span's style. Never into a frame
// anchor's: right after one, into the span after it; with none there, or
// right before one starting the paragraph, a span of its own, styled as
// the anchor.
function insertInto(paragraph, offset, text) {
  if (text === "") return;
  const spans = paragraph.spans;
  let start = 0;
  for (let index = 0; index < spans.length; index++) {
    const span = spans[index];
    const end = start + span.text.length;
    if (offset <= end) {
      if (!span.anchor) {
        span.text = span.text.slice(0, offset - start) + text + span.text.slice(offset - start);
        return;
      }
      if (offset === end && index + 1 < spans.length) {
        start = end;
        continue;
      }
      spans.splice(offset === start ? index : index + 1, 0, makeSpan({ text, bold: span.bold, italic: span.italic }));
      return;
    }
    start = end;
  }
  spans.push(makeSpan(text));
}

// A span put in at `offset` - the one there split in two around it.
function insertSpan(paragraph, offset, inserted) {
  const spans = paragraph.spans;
  let start = 0;
  for (let index = 0; index < spans.length; index++) {
    const span = spans[index];
    const end = start + span.text.length;
    if (offset <= start) {
      spans.splice(index, 0, inserted);
      return;
    }
    if (offset < end) {
      const rest = makeSpan({ text: span.text.slice(offset - start), bold: span.bold, italic: span.italic });
      span.text = span.text.slice(0, offset - start);
      spans.splice(index + 1, 0, inserted, rest);
      return;
    }
    start = end;
  }
  spans.push(inserted);
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
      after.push({ text: span.text.slice(cut), bold: span.bold, italic: span.italic, anchor: span.anchor });
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

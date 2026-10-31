import { callback } from "@liquefy/cascade.component";
import { div, text } from "@liquefy/cascade.dom";
import { button, checkbox, iconButton, row } from "@liquefy/cascade.ui";
import { mm } from "../../print/index.js";
import { Paragraph, Document, isSection, paragraphText, titleLevel, focusedFlow } from "../../model/flows.js";
import { anchorAt, frameKind, placements } from "../../model/frames.js";
import { isDot, anchorOf } from "../../model/sequences.js";
import { elementEntry, inOneGo } from "../../paper/pageElementMenu.js";
import { ownPageSettings } from "../../shell/pageSettingsMenu.js";
import { titlePlaceholder } from "../../layout/DocumentLayout.js";
import { menuHeading as heading, menuNote as note } from "../../shell/contextMenus.js";

/**
 * A structured text's context menus (see ../../shell/contextMenus.js) - the
 * classic app's cards and settings (../../Tabula.js), all of them, as the
 * path from the document down to the flow the caret is in:
 *
 *  - the document - what goes for all of it: writing it, or laying out its
 *    pages (the editor's mode); its paper, its margins, laying them out,
 *    numbered, its paragraphs indented, clearing it - and the way to how
 *    it's edited: the settings dialog's page for it (see settingsPage.js);
 *  - every section the caret is in, on the way down;
 *  - the flow the caret is in - a section: where it is in the structure,
 *    how its title looks; a paragraph: making it a title, moving it out;
 *  - the frame the caret is at, if it's at one (see ../../model/frames.js):
 *    where it goes, how wide it is, and what its kind offers;
 *  - at a creation dot, the pages of their own it's in (see
 *    ../../model/sequences.js): whether the text runs on past them, and
 *    what the keys do there.
 *
 * Laying out the pages, no caret: the document, and the page element
 * selected, if one is - its size, the edges it's measured from, what its
 * kind offers.
 *
 * `editor` is the StructuredTextEditor showing it: its `model` (the
 * document), `editing` (see ../../paper/editing.js), `caret`, `settings`
 * (see settings.js) and `pageCount()`.
 */
export function contextPath(editor) {
  const document = editor.model;
  const focus = editor.caret ? focusedFlow(editor.unobservable.root, editor.caret) : null;
  const path = [{
    key: "document",
    icon: "article",
    title: paragraphText(document.title) || "Structured text",
    details: () => [note(contentsOf(document)), note(wordsIn(document) + " words")],
    build: () => documentMenu(editor),
  }];
  if (editor.mode === "page") {
    if (editor.selectedElement) path.push(elementEntry(editor, editor.selectedElement));
    return path;
  }
  if (isDot(editor.caret)) {
    path.push(sequenceEntry(editor, editor.caret.flow));
    return path;
  }
  if (!focus) return path;
  // On the way down: the sections the caret is in - for when the whole
  // path is shown. The document is the first of them, already there.
  for (const [index, section] of focus.around.entries()) {
    if (index === 0) continue;
    // Keyed by how deep: collapsed, until opened (see
    // ../../shell/contextMenus.js).
    // Titled as it is - telling one from the next, collapsed.
    path.push({ ...flowEntry(editor, section, focus.around.slice(0, index)), key: "around" + index, title: paragraphText(section.title) || titlePlaceholder });
  }
  path.push(flowEntry(editor, focus.flow, focus.around));
  const anchor = anchorAt(editor.caret);
  if (anchor) path.push(frameEntry(editor, anchor));
  return path;
}

// Pages of their own, the caret at one of their creation dots: empty, a
// page break; the text after them on a fresh page - or, after a paragraph,
// running on.
function sequenceEntry(editor, sequence) {
  const anchor = anchorOf(editor.model, sequence);
  const count = sequence.items.length;
  const afterParagraph = anchor && anchor.side === "after" && !isSection(anchor.flow);
  return {
    key: "sequence",
    icon: count === 0 ? "insert_page_break" : "auto_stories",
    title: count === 0 ? "Page break" : "Pages of their own",
    details: () => [note(count === 0
      ? "Nothing here yet - Enter, Tab or Space to create something. Ctrl+Enter anchors it a step further out, Ctrl+Backspace a step back in; Delete takes it away."
      : count + (count === 1 ? " thing" : " things") + " here, on pages of their own. Ctrl+Enter anchors them a step further out, Ctrl+Backspace a step back in.")],
    build: () => [
      afterParagraph
        ? checkbox({
          key: "runOn",
          label: "Let the text run on",
          checked: sequence.runOn,
          onChange: callback("runOn", (checked) => { sequence.runOn = checked; }),
        })
        : null,
      note(afterParagraph && sequence.runOn
        ? "The text goes on filling the page the paragraph ends on - these pages after that page."
        : "The text after them starts on a fresh page."),
    ],
  };
}

function flowEntry(editor, flow, around) {
  const section = isSection(flow);
  return {
    key: "flow",
    icon: flow instanceof Document ? "article" : section ? "segment" : "notes",
    title: flow instanceof Document ? "Document" : section ? "Section" : "Paragraph",
    details: () => flowDetails(flow, around),
    build: () => section
      ? [...structureControls(editor, flow, around), ...(editor.settings.depressedTitles ? appearanceControls(flow, around) : [])]
      : paragraphControls(editor, flow),
  };
}

// --- A frame -----------------------------------------------------------------

// The frame the caret is at: where it goes - in the line, on a line of its
// own, at the left or the right with the text around it - how wide it is,
// at most the text area's width, and what its kind has to offer: choosing
// a picture, a table's rows and columns.
function frameEntry(editor, anchor) {
  const type = anchor.content && anchor.content.documentType;
  const kind = frameKind(anchor);
  const { paper, pageLayout: { margins } } = editor.model;
  const widest = paper.width - margins.left - margins.right;
  const step = mm(10);
  const width = Math.min(anchor.width, widest);
  const setWidth = (value) => { anchor.width = Math.max(step, Math.min(widest, value)); };
  const choices = placements;
  return {
    key: "frame",
    icon: type ? type.icon : "help",
    title: type ? type.label : "Frame",
    details: () => [note("In a frame, anchored in the text at the caret - Backspace or Delete there takes it out.")],
    build: () => [
      heading("Placement"),
      row(
        { style: { gap: "4px", flexWrap: "wrap" } },
        choices.map(({ value, label }) => button(
          { key: "placement" + value, variant: anchor.placement === value ? "filled" : undefined },
          label,
          callback("placement" + value, () => { anchor.placement = value; }),
        )),
      ),
      note(placementNotes[anchor.placement] || ""),
      anchor.placement === "page" ? null : heading("Size"),
      anchor.placement === "page" ? null : row(
        { style: { alignItems: "center", gap: "6px" } },
        div({ style: { flex: "1" } }, text("Width")),
        iconButton({ icon: "remove", title: "Narrower", disabled: width <= step, onClick: callback("narrower", () => setWidth(width - step)) }),
        div({ style: { minWidth: "48px", textAlign: "center" } }, text(Math.round(width / 1000) + " mm")),
        iconButton({ icon: "add", title: "Wider", disabled: width >= widest, onClick: callback("wider", () => setWidth(width + step)) }),
      ),
      anchor.placement === "page" ? null : note("Its height follows - what's in it keeps its proportions."),
      kind && kind.controls ? [heading(type.label), ...kind.controls(anchor.content.model)] : null,
    ],
  };
}

const placementNotes = {
  inline: "In the line, as a word - the line as tall as it is.",
  block: "On a line of its own, centred - the text above and below it.",
  left: "At the left, its top at the line it's in - the text flowing around it on the right.",
  right: "At the right, its top at the line it's in - the text flowing around it on the left.",
};

// --- The document ----------------------------------------------------------

// The document: its page settings - the file's, or its own too (see
// ../../shell/pageSettingsMenu.js); its page layout - what's drawn on its
// pages, laid out in the page layout mode; its page numbers, as they fall
// or started anew; and what goes for all of it.
function documentMenu(editor) {
  const document = editor.model;
  const pages = editor.pageCount();
  return [
    ...ownPageSettings({
      key: "pageSettings",
      layout: document.pageLayout,
      shown: editor.pageSettingsShown,
      show: (shown) => { editor.pageSettingsShown = shown; },
      inherited: (key) => editor.inherit(key),
    }),
    heading("Page layout"),
    row(
      { key: "mode", style: { gap: "4px", alignItems: "center" } },
      [{ value: "write", label: "Write" }, { value: "page", label: "Page layout" }].map(({ value, label }) => button(
        { key: "mode" + value, variant: editor.mode === value ? "filled" : undefined },
        label,
        callback("mode" + value, () => editor.setMode(value)),
      )),
      div({ style: { opacity: 0.7, fontSize: "13px", marginLeft: "4px" } }, text(pages + (pages === 1 ? " page" : " pages"))),
    ),
    editor.mode === "page"
      ? note("The first page, every page between, the last: what's drawn on them - the text showing through. Double click inside the margins to write again.")
      : null,
    checkbox({
      key: "startsNumbering",
      label: "Start new page numbering",
      checked: document.startsNumbering,
      onChange: callback("startsNumbering", (checked) => { document.startsNumbering = checked; }),
    }),
    note(document.startsNumbering
      ? "Its first page is page 1 - whatever comes before it."
      : "Its pages numbered on from what comes before it - from the start of the file."),
    heading("Whole document"),
    ...wholeDocument(editor, document),
  ];
}

// What goes for the whole document: its titles numbered, a book, its
// paragraphs indented.
function wholeDocument(editor, document) {
  const duplex = editor.pageFormat().duplex;
  return [
    checkbox({
      key: "numberTitles",
      label: "Number titles",
      checked: document.numberTitles,
      onChange: callback("numberTitles", (checked) => { document.numberTitles = checked; }),
    }),
    note("Every title but the document's own numbered by where it is - 2.1, and on. The numbers aren't text: they follow the structure."),
    // A book: its chapters each on a page of its own.
    checkbox({
      key: "bookMode",
      label: duplex ? "A book: chapters start on a right-hand page" : "A book: chapters start on a new page",
      checked: document.bookMode,
      onChange: callback("bookMode", (checked) => { document.bookMode = checked; }),
    }),
    note("Or Ctrl+Enter at a chapter's start - Ctrl+Backspace there undoes it. Ctrl+Enter in the text: pages of their own after it - again, a step further out."),
    checkbox({
      key: "indentParagraphs",
      label: "Indent paragraphs instead of spacing them",
      checked: document.indentParagraphs,
      onChange: callback("indentParagraphs", (checked) => { document.indentParagraphs = checked; }),
    }),
    row(
      { style: { gap: "6px", alignItems: "center" } },
      button({}, "Clear", callback("clear", () => clear(document))),
      div({ style: { flex: "1" } }),
      iconButton({ icon: "settings", title: "Editing settings - how structured text is edited", onClick: callback("editingSettings", () => openSettings(editor)) }),
    ),
  ];
}

// The settings dialog, on structured text's page (see
// ../../shell/TabulaApp.js) - from the app the editor is in.
function openSettings(editor) {
  const open = editor.inherit("openSettings");
  if (open) open("structuredText");
}

// Everything gone but the document itself: no title, one empty paragraph -
// its placeholders, "Title" and "Text", showing.
function clear(document) {
  inOneGo(() => {
    document.title.spans.splice(0);
    document.children.splice(0, document.children.length, new Paragraph());
  });
}

// A change to the document from a menu - in one go, laid out once.
// --- The flow the caret is in -------------------------------------------------

// What's good to know about a flow, but needn't take room all the time:
// what it's in, a section's title and what it holds, how many words.
function flowDetails(flow, around) {
  const titleOf = (section) => paragraphText(section.title) || titlePlaceholder;
  const section = isSection(flow);
  return [
    around.length > 0 ? note("In " + around.map(titleOf).join(" › ")) : null,
    section ? div({}, text("“" + titleOf(flow) + "”")) : null,
    section ? note(contentsOf(flow)) : null,
    note(wordsIn(flow) + " words"),
  ];
}

// A paragraph's: making it a title - the title of a section holding the
// paragraphs after it, up to the next section (as Shift+Tab in it) - and,
// in a section in another, moving it out: it, and all after it, after the
// section.
function paragraphControls(editor, paragraph) {
  const { editing } = editor.unobservable;
  const movable = editing.canMoveOut(paragraph);
  return [
    button({ key: "makeTitle" }, "Make into title", callback("makeTitle", () => inOneGo(() => editing.promoteParagraph(paragraph)))),
    movable ? button({ key: "moveOut" }, "Move out of section", callback("moveOut", () => inOneGo(() => editing.moveOut(paragraph)))) : null,
    movable ? note("It, and all after it in the section, moved to after the section.") : null,
  ];
}

// A section's place in the document's structure - its title level, 1 the
// document's own - and moving it there: - promotes it (Shift+Tab in its
// title), up a level, out of the section it's in; + demotes it (Tab), into
// the section before it - only that: "Make into paragraph" is there for
// the rest. The document changes.
function structureControls(editor, section, around) {
  const { editing } = editor.unobservable;
  return [
    heading("Structure"),
    row(
      { style: { alignItems: "center", gap: "6px" } },
      div({ style: { flex: "1" } }, text("Title level")),
      iconButton({
        icon: "remove", title: "Promote: up a level - a lower number - out of the section it's in (Shift+Tab)",
        disabled: !editing.canPromote(section), onClick: callback("promote", () => inOneGo(() => editing.promoteSection(section))),
      }),
      div({ style: { minWidth: "16px", textAlign: "center" } }, text(String(around.length + 1))),
      iconButton({
        icon: "add", title: "Demote: down a level - a higher number - into the section before (Tab)",
        disabled: !editing.canDemoteIntoSection(section), onClick: callback("demote", () => inOneGo(() => editing.demoteSection(section))),
      }),
    ),
    editing.canMakeParagraphs(section)
      ? button({ key: "makeParagraph" }, "Make into paragraph", callback("makeParagraph", () => inOneGo(() => editing.makeParagraphs(section))))
      : null,
    note("Where the section is in the document - moving it changes what's in what."),
  ];
}

// How a section's title looks - its title offset (see
// ../../model/flows.js), setting it smaller than its place makes it (a
// "bridgehead"): only how it looks, the structure as it is.
function appearanceControls(section, around) {
  let level = 0;
  for (const each of [...around, section]) level = titleLevel(each, level);
  return [
    heading("Appearance"),
    row(
      { style: { alignItems: "center", gap: "6px" } },
      div({ style: { flex: "1" } }, text("Adjust appearance")),
      iconButton({ icon: "remove", title: "Adjust less - closer to its level", disabled: section.titleOffset === 0, onClick: callback("lessOffset", () => { section.titleOffset = Math.max(0, section.titleOffset - 1); }) }),
      div({ style: { minWidth: "16px", textAlign: "center" } }, text(String(section.titleOffset))),
      iconButton({ icon: "add", title: "Adjust more - set smaller than its level", onClick: callback("moreOffset", () => { section.titleOffset = section.titleOffset + 1; }) }),
    ),
    note("Shown as title level " + level + ". Only how it looks - a bridgehead - the structure stays as it is."),
  ];
}

// The words in a flow - a section's title and all in it.
function wordsIn(flow) {
  const count = (paragraph) => (paragraphText(paragraph).match(/\S+/g) || []).length;
  if (!isSection(flow)) return count(flow);
  return count(flow.title) + flow.children.reduce((sum, child) => sum + wordsIn(child), 0);
}

// What a section holds, in so many words.
function contentsOf(section) {
  const sections = section.children.filter(isSection).length;
  const paragraphs = section.children.length - sections;
  const plural = (n, word) => n + " " + word + (n === 1 ? "" : "s");
  return plural(paragraphs, "paragraph") + ", " + plural(sections, "section");
}

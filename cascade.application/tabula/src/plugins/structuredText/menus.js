import { callback, postponeInvalidations, continueInvalidations } from "@liquefy/cascade.component";
import { div, text, input } from "@liquefy/cascade.dom";
import { button, checkbox, iconButton, row } from "@liquefy/cascade.ui";
import { paperSizes, margins, mm, inch } from "../../print/index.js";
import { Paragraph, Document, isSection, paragraphText, titleLevel, focusedFlow } from "../../model/flows.js";
import { anchorAt, frameKind, placements } from "../../model/frames.js";
import { isBook, isWholePage } from "../../model/book.js";
import { elementRect, pageKinds } from "../../model/pageLayout.js";
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
 *    where it goes, how wide it is, and what its kind offers.
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
  // The whole page: only for a page of a book's own, the frame all that's on it.
  const caret = editor.caret;
  const wholePage = caret && "paragraph" in caret && isWholePage(editor.model, caret.paragraph) && caret.paragraph.spans.length === 1;
  const choices = placements.filter(({ value }) => value !== "page" || wholePage || anchor.placement === "page");
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
  page: "The whole page, edge to edge - a picture cropped to fill it. Tab makes it an empty page again.",
  inline: "In the line, as a word - the line as tall as it is.",
  block: "On a line of its own, centred - the text above and below it.",
  left: "At the left, its top at the line it's in - the text flowing around it on the right.",
  right: "At the right, its top at the line it's in - the text flowing around it on the left.",
};

// --- The page layout -----------------------------------------------------------

// The margins, each in millimetres from its own edge - typed, or dragged on
// the papers.
function marginControls(document) {
  const layout = document.pageLayout;
  return [
    heading("Margins"),
    div(
      { key: "margins", style: { display: "grid", gridTemplateColumns: "auto 1fr auto 1fr", gap: "6px 8px", alignItems: "center", fontSize: "14px" } },
      ["top", "bottom", "left", "right"].map((side) => [
        div({ key: "label" + side }, text(sideName(side, layout.duplex))),
        input({
          key: "margin" + side,
          type: "number", min: 0, step: 1,
          value: String(layout.margins[side] / 1000),
          onchange: callback("margin" + side, (event) => {
            const value = Number(event.target.value);
            if (Number.isFinite(value) && value >= 0) layout.margins = Object.freeze({ ...layout.margins, [side]: Math.round(value * 1000) });
          }),
          style: { width: "100%", boxSizing: "border-box", font: "inherit", padding: "2px 4px" },
        }),
      ]),
    ),
    note(layout.duplex
      ? "In millimetres, each from its own edge - inner by the binding, outer away from it, mirrored on facing pages. Or drag the dashed lines."
      : "In millimetres, each from its own edge - the same on every page. Or drag the dashed lines."),
  ];
}

// Printed on both sides, left and right are inner and outer.
const sideName = (side, duplex) => ({ left: duplex ? "Inner" : "Left", right: duplex ? "Outer" : "Right", top: "Top", bottom: "Bottom" })[side];

// The page element selected: its size, the edges it's measured from - the
// ones nearest it, as it's placed, or the others, as chosen - what its
// kind has to offer, and taking it out.
function elementEntry(editor, { element, kind }) {
  const type = element.content && element.content.documentType;
  const frame = type ? type.frame : null;
  const paper = editor.model.paper;
  const page = pageKinds.find((each) => each.name === kind);
  const duplex = editor.model.pageLayout.duplex;
  // Measured from another edge, it stays where it is.
  const measureFrom = (horizontal, vertical) => {
    const rect = elementRect(element, paper);
    inOneGo(() => {
      element.horizontal = horizontal;
      element.x = horizontal === "left" ? rect.x : paper.width - rect.x - rect.width;
      element.vertical = vertical;
      element.y = vertical === "top" ? rect.top : paper.height - rect.top - rect.height;
    });
  };
  const size = (label, key) => row(
    { key, style: { alignItems: "center", gap: "6px" } },
    div({ style: { flex: "1" } }, text(label)),
    input({
      key: key + "Input", type: "number", min: 1, step: 1,
      value: String(Math.round(element[key] / 100) / 10),
      onchange: callback(key, (event) => {
        const value = Number(event.target.value);
        if (Number.isFinite(value) && value > 0) element[key] = Math.round(value * 1000);
      }),
      style: { width: "72px", font: "inherit", padding: "2px 4px" },
    }),
    div({ style: { fontSize: "13px", opacity: 0.7 } }, text("mm")),
  );
  const choice = (key, values, current, choose) => row(
    { key, style: { gap: "4px" } },
    values.map(({ value, label }) => button({ key: key + value, variant: current === value ? "filled" : undefined }, label, callback(key + value, () => choose(value)))),
  );
  return {
    key: "element",
    icon: type ? type.icon : "help",
    title: type ? type.label : "Element",
    details: () => [note("On the " + page.label.toLowerCase() + ". Drag it to move it, its corner to resize it - Delete takes it out.")],
    build: () => [
      heading("Size"),
      size("Width", "width"),
      size("Height", "height"),
      heading("Measured from"),
      choice("horizontal", [{ value: "left", label: sideName("left", duplex) + " edge" }, { value: "right", label: sideName("right", duplex) + " edge" }], element.horizontal, (value) => measureFrom(value, element.vertical)),
      choice("vertical", [{ value: "top", label: "Top edge" }, { value: "bottom", label: "Bottom edge" }], element.vertical, (value) => measureFrom(element.horizontal, value)),
      note("Where it stays, on paper of another size - the nearest edges, as it's placed."),
      frame && frame.controls ? [heading(type.label), ...frame.controls(element.content.model)] : null,
      button({ key: "remove" }, "Remove", callback("remove", () => {
        const list = editor.model.pageLayout[kind];
        const index = list.indexOf(element);
        if (index >= 0) list.splice(index, 1);
        editor.selectElement(null);
      })),
    ],
  };
}

// --- The document ----------------------------------------------------------

// The document's margins on each paper: 25 mm on A4, an inch on Letter.
const paperMargins = { A4: margins(mm(25)), letter: margins(inch(1)) };

function documentMenu(editor) {
  const document = editor.model;
  const pages = editor.pageCount();
  return [
    row(
      { key: "mode", style: { gap: "4px" } },
      [{ value: "write", label: "Write" }, { value: "page", label: "Page layout" }].map(({ value, label }) => button(
        { key: "mode" + value, variant: editor.mode === value ? "filled" : undefined },
        label,
        callback("mode" + value, () => editor.setMode(value)),
      )),
    ),
    editor.mode === "page"
      ? note("The first page, every page between, the last: what's drawn on them, and the margins - the text showing through. Double click inside the margins to write again.")
      : null,
    heading("Paper"),
    row(
      { style: { gap: "6px", alignItems: "center" } },
      button({ variant: sameSize(document.paper, paperSizes.A4) ? "filled" : undefined }, "A4", callback("A4", () => setPaper(document, "A4"))),
      button({ variant: sameSize(document.paper, paperSizes.letter) ? "filled" : undefined }, "Letter", callback("letter", () => setPaper(document, "letter"))),
      div({ style: { opacity: 0.7, fontSize: "13px", marginLeft: "4px" } }, text(pages + (pages === 1 ? " page" : " pages"))),
    ),
    row(
      { key: "sides", style: { gap: "6px", alignItems: "center" } },
      button({ key: "single", variant: document.pageLayout.duplex ? undefined : "filled" }, "Single-sided", callback("single", () => { document.pageLayout.duplex = false; })),
      button({ key: "double", variant: document.pageLayout.duplex ? "filled" : undefined }, "Double-sided", callback("double", () => { document.pageLayout.duplex = true; })),
    ),
    note(document.pageLayout.duplex
      ? "Printed on both sides, like a book: the pages face each other, mirrored - the shade is where they're bound."
      : "Printed on one side, like a letter."),
    ...(editor.mode === "page" ? marginControls(document) : []),
    heading("Whole document"),
    checkbox({
      key: "numberTitles",
      label: "Number titles",
      checked: document.numberTitles,
      onChange: callback("numberTitles", (checked) => { document.numberTitles = checked; }),
    }),
    note("Every title but the document's own numbered by where it is - 2.1, and on. The numbers aren't text: they follow the structure."),
    // A book: once it has pages before its body (see ../../model/book.js).
    isBook(document)
      ? [
        checkbox({
          key: "chapters",
          label: document.pageLayout.duplex ? "Chapters start on a right-hand page" : "Chapters start on a new page",
          checked: document.chaptersOnNewPage,
          onChange: callback("chapters", (checked) => { document.chaptersOnNewPage = checked; }),
        }),
        note("A book: pages before its text - Ctrl+Enter there adds one, Backspace at a page's start takes it away."),
      ]
      : note("Ctrl+Enter after the title: a title page - a book."),
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

const sameSize = (paper, size) => paper.width === size.width && paper.height === size.height;

// Paper and margins together - one change to the layout, not two.
function setPaper(document, name) {
  inOneGo(() => {
    document.paper = paperSizes[name];
    document.pageLayout.margins = paperMargins[name];
  });
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
function inOneGo(change) {
  postponeInvalidations();
  try {
    change();
  } finally {
    continueInvalidations();
  }
}

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

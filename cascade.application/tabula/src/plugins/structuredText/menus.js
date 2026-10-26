import { callback, postponeInvalidations, continueInvalidations } from "@liquefy/cascade.component";
import { div, text } from "@liquefy/cascade.dom";
import { button, checkbox, iconButton, row } from "@liquefy/cascade.ui";
import { paperSizes, margins, mm, inch } from "../../print/index.js";
import { Paragraph, Document, isSection, paragraphText, titleLevel, focusedFlow } from "../../model/flows.js";
import { titlePlaceholder } from "../../layout/DocumentLayout.js";
import { markerTypes } from "../../paper/markers.js";
import { infoButton } from "../../InfoButton.js";
import { menuHeading as heading, menuNote as note } from "../../shell/contextMenus.js";

/**
 * A structured text's context menus (see ../../shell/contextMenus.js) - the
 * classic app's cards and settings (../../Tabula.js), all of them, as the
 * path from the document down to the flow the caret is in:
 *
 *  - the document - what goes for all of it: its paper, its titles
 *    numbered, its paragraphs indented, how it's edited (the experimental
 *    settings behind a cogwheel), clearing it;
 *  - every section the caret is in, on the way down;
 *  - the flow the caret is in - a section: where it is in the structure,
 *    how its title looks; a paragraph: making it a title, moving it out.
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
  if (!focus) return path;
  // On the way down: the sections the caret is in - for when the whole
  // path is shown. The document is the first of them, already there.
  for (const [index, section] of focus.around.entries()) {
    if (index === 0) continue;
    path.push(flowEntry(editor, section, focus.around.slice(0, index)));
  }
  path.push(flowEntry(editor, focus.flow, focus.around));
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
      ? [...structureControls(editor, flow, around), ...appearanceControls(flow, around)]
      : paragraphControls(editor, flow),
  };
}

// --- The document ----------------------------------------------------------

// The document's margins on each paper: 25 mm on A4, an inch on Letter.
const paperMargins = { A4: margins(mm(25)), letter: margins(inch(1)) };

function documentMenu(editor) {
  const document = editor.model;
  const settings = editor.settings;
  const pages = editor.pageCount();
  return [
    heading("Paper"),
    row(
      { style: { gap: "6px", alignItems: "center" } },
      button({ variant: sameSize(document.paper, paperSizes.A4) ? "filled" : undefined }, "A4", callback("A4", () => setPaper(document, "A4"))),
      button({ variant: sameSize(document.paper, paperSizes.letter) ? "filled" : undefined }, "Letter", callback("letter", () => setPaper(document, "letter"))),
      div({ style: { opacity: 0.7, fontSize: "13px", marginLeft: "4px" } }, text(pages + (pages === 1 ? " page" : " pages"))),
    ),
    heading("Whole document"),
    checkbox({
      key: "numberTitles",
      label: "Number titles",
      checked: document.numberTitles,
      onChange: callback("numberTitles", (checked) => { document.numberTitles = checked; }),
    }),
    note("Every title but the document's own numbered by where it is - 2.1, and on. The numbers aren't text: they follow the structure."),
    checkbox({
      key: "indentParagraphs",
      label: "Indent paragraphs instead of spacing them",
      checked: document.indentParagraphs,
      onChange: callback("indentParagraphs", (checked) => { document.indentParagraphs = checked; }),
    }),
    heading("Editing"),
    checkbox({
      key: "newSectionsBeside",
      label: "New sections beside their parent",
      checked: settings.newSectionsBeside,
      onChange: callback("newSectionsBeside", (checked) => { settings.newSectionsBeside = checked; }),
    }),
    row(
      { style: { gap: "6px", alignItems: "center" } },
      button({}, "Clear", callback("clear", () => clear(document))),
      div({ style: { flex: "1" } }),
      infoButton({ key: "experimental", icon: "settings", title: "Experimental - where the caret goes, and what's shown", details: experimentalSettings(settings) }),
    ),
  ];
}

// For experimenting: which places the caret goes to besides the text,
// sections' ends below their last line or beside it - and what's shown.
function experimentalSettings(settings) {
  return [
    heading("Caret goes to"),
    markerTypes.map(({ type, label }) => checkbox({
      key: type,
      label,
      checked: settings.markerTypes[type] !== false,
      onChange: (checked) => { settings.markerTypes = Object.freeze({ ...settings.markerTypes, [type]: checked }); },
    })),
    checkbox({
      key: "sectionEndsBelow",
      label: "Section ends below their last line",
      checked: settings.sectionEnds === "below",
      onChange: (checked) => { settings.sectionEnds = checked ? "below" : "beside"; },
    }),
    heading("Show"),
    checkbox({
      key: "focusOutline",
      label: "Outline around what the caret is in",
      checked: settings.showFocusOutline,
      onChange: (checked) => { settings.showFocusOutline = checked; },
    }),
    checkbox({ key: "allAreas", label: "Every marker's area", checked: settings.showAllAreas, onChange: (checked) => { settings.showAllAreas = checked; } }),
  ];
}

const sameSize = (paper, size) => paper.width === size.width && paper.height === size.height;

// Paper and margins together - one change to the layout, not two.
function setPaper(document, name) {
  inOneGo(() => {
    document.paper = paperSizes[name];
    document.margins = paperMargins[name];
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
  const settings = editor.settings;
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
    // Demoting (+, Tab) takes its sub-sections along - or leaves them after
    // it, in the section it goes into. Promoting always takes them along.
    section.children.some(isSection)
      ? checkbox({
        key: "includeSubSections",
        label: "Include sub-sections",
        checked: settings.demoteWithChildren,
        onChange: callback("includeSubSections", (checked) => { settings.demoteWithChildren = checked; }),
      })
      : null,
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

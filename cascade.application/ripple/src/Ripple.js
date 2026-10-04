import { Component, callback, repeat, retractRepeater, postponeInvalidations, continueInvalidations } from "@liquefy/cascade.component";
import { div, text } from "@liquefy/cascade.dom";
import { button, card, checkbox, iconButton, fitContainerStyle, overlayFrame, colorSchemeScope, row } from "@liquefy/cascade.ui";
import { PaperSequence, paperSizes, margins, mm, inch } from "./print/index.js";
import { domMeasurer, printPaperSequence } from "./print/dom.js";
import { rippleEditor } from "./paper/RippleEditor.js";
import { paperBackdrop } from "./paper/RipplePaperView.js";
import { rippleEditing } from "./paper/editing.js";
import { markerTypes } from "./paper/markers.js";
import { sequence as sequenceOf, Paragraph, Document, isSection, paragraphText, titleLevel, focusedFlow } from "./model/flows.js";
import { testDocument } from "./model/testDocument.js";
import { SequenceLayout, titlePlaceholder } from "./layout/DocumentLayout.js";
import { infoButton } from "./InfoButton.js";

// The document's margins on each paper: 25 mm on A4, an inch on Letter.
const paperMargins = { A4: margins(mm(25)), letter: margins(inch(1)) };

const zoomSteps = [0.5, 0.75, 1, 1.25, 1.5, 2];

/**
 * Ripple - a word processor, on Cascade and cascade.print, whose document is
 * a tree of flows: sections in sections, each with a title, and paragraphs
 * of text (see ./model). It shows a document, on paper, with a caret that
 * moves through every place in it - in the text, and the markers beside
 * its flows at every level - and edits it there (see ./paper/editing.js).
 *
 * Two roots, side by side:
 *  - The layout: the documents rendered onto a PaperSequence, a component
 *    for every flow of them (see ./layout) - and, placed from what's laid
 *    out, the markers beside the flows (see ./paper/markers.js). Not part of
 *    the app's own render - it has a target of its own - so the app owns
 *    it: created in initialization, laid out in a repeater of its own from
 *    establishment on, disposed with the app.
 *  - The view: the app's build - the paper sequence with Ripple's editor
 *    (./paper), editing the document through rippleEditing(): typing,
 *    Backspace, Delete, Enter and Tab, in the text and at the markers. No
 *    bar on top, so a page standing up gets all the height there is: the
 *    document's settings in a card on the left, what the caret is in - and
 *    what there is to set about it - in a card on the right.
 */
export class Ripple extends Component {
  initialState() {
    // For experimenting with where a caret should be able to go:
    // markerTypes - which kinds of marker it goes to ({ type: false } for
    // one it doesn't - by default the starts, the caret going from the text
    // before a flow straight into it, and a paragraph's end, not needed for
    // writing; there to come back, for styling and the like), and
    // showAllAreas - every marker's area drawn at once. And caret: where the
    // editor's caret is (its onCaret), for the flow panel on the right.
    return {
      zoom: 1,
      caret: null,
      // Sections' ends beside their last line, or below it (see
      // ./paper/markers.js).
      sectionEnds: "below",
      showAllAreas: false,
      markerTypes: { paragraphStart: false, paragraphEnd: false, titleStart: false, sectionStart: false },
    };
  }

  setMarkerType(type, on) {
    this.markerTypes = { ...this.markerTypes, [type]: on };
  }

  initialUnobservables() {
    const document = testDocument();
    const root = sequenceOf(document);
    const measurer = domMeasurer();
    return {
      document,
      root,
      editing: rippleEditing(root),
      measurer,
      sequence: new PaperSequence(),
      layout: new SequenceLayout({ sequence: root, measurer }).establish(),
      layoutRoot: null,
    };
  }

  onEstablish() {
    super.onEstablish();
    const u = this.unobservable;
    // A root of its own: independent of whatever happens to be running when
    // the app is established.
    u.layoutRoot = repeat(() => u.layout.renderOnto(u.sequence), { independent: true });
  }

  onDispose() {
    const u = this.unobservable;
    if (u.layoutRoot) retractRepeater(u.layoutRoot);
    u.layout.dispose();
    u.measurer.dispose();
    super.onDispose();
  }

  // Everything gone but one empty section - the document itself, on its
  // paper: no title, one empty paragraph; its placeholders, "Title" and
  // "Text", showing. In one go.
  clearDocument() {
    const { document, root } = this.unobservable;
    postponeInvalidations();
    root.children.splice(1);
    document.title.spans.splice(0);
    document.children.splice(0, document.children.length, new Paragraph());
    continueInvalidations();
  }

  // Paper and margins together - one change to the layout, not two.
  setPaper(name) {
    const document = this.unobservable.document;
    postponeInvalidations();
    document.paper = paperSizes[name];
    document.margins = paperMargins[name];
    continueInvalidations();
  }

  zoomBy(steps) {
    const index = zoomSteps.indexOf(this.zoom) + steps;
    this.zoom = zoomSteps[Math.max(0, Math.min(zoomSteps.length - 1, index))];
  }

  build() {
    const { root, sequence, measurer } = this.unobservable;
    return overlayFrame(
      { style: { ...fitContainerStyle } },
      colorSchemeScope(
        { style: { ...fitContainerStyle } },
        div(
          { style: { ...fitContainerStyle, position: "relative" } },
          // The papers, on grey, all of the window - scrolling at its right
          // edge - room kept on either side for the cards floating over it,
          // so a paper is centred between them.
          div(
            { style: { ...fitContainerStyle, overflow: "auto", background: paperBackdrop } },
            rippleEditor({
              key: "editor", sequence, root, measurer, editing: this.unobservable.editing, zoom: this.zoom,
              showAllAreas: this.showAllAreas, markerTypes: this.markerTypes, sectionEnds: this.sectionEnds,
              onCaret: callback("caret", (at) => { this.caret = at; }),
              // All of the window, so a click anywhere off the papers is its.
              style: { padding: "0 " + (panelWidth + 2 * panelInset) + "px", minHeight: "100%", boxSizing: "border-box" },
            }),
          ),
          this.settingsPanel(),
          // On the right, one under the other: what the caret is in, and the
          // whole document it's in.
          div({ style: rightColumnStyle }, this.flowPanel(), this.documentPanel()),
          this.zoomPanel(),
        ),
      ),
    );
  }

  // The left side: the document - its paper, clearing and printing it - and
  // a cogwheel opening the settings, for experimenting (see settings()).
  settingsPanel() {
    const { document, sequence } = this.unobservable;
    const paper = document.paper;
    const pageCount = sequence.pages.length;
    return card(
      { style: { ...panelStyle, left: panelInset + "px" } },
      row(
        { style: { alignItems: "center", marginBottom: "4px" } },
        div({ style: { flex: "1", fontWeight: "bold", fontSize: "18px" } }, text("Ripple")),
        infoButton({ key: "settings", icon: "settings", title: "Settings", details: this.settings() }),
      ),
      heading("Paper"),
      row(
        { style: { gap: "6px" } },
        button({ variant: paper === paperSizes.A4 ? "filled" : undefined }, "A4", () => this.setPaper("A4")),
        button({ variant: paper === paperSizes.letter ? "filled" : undefined }, "Letter", () => this.setPaper("letter")),
      ),
      div({ style: { opacity: 0.7 } }, text(pageCount + (pageCount === 1 ? " page" : " pages"))),
      heading("Document"),
      row(
        { style: { gap: "6px" } },
        button({}, "Clear", () => this.clearDocument()),
        button({ variant: "filled" }, "Print", () => printPaperSequence(sequence, { title: "Ripple" })),
      ),
    );
  }

  // Behind the cogwheel: for experimenting - which places the caret can go
  // to besides the text (a checkbox for every kind of marker), sections'
  // ends below their last line or beside it, and every marker's area at
  // once.
  settings() {
    return [
      heading("Caret goes to"),
      markerTypes.map(({ type, label }) => checkbox({
        key: type,
        label,
        checked: this.markerTypes[type] !== false,
        onChange: (checked) => this.setMarkerType(type, checked),
      })),
      checkbox({
        key: "sectionEndsBelow",
        label: "Section ends below their last line",
        checked: this.sectionEnds === "below",
        onChange: (checked) => { this.sectionEnds = checked ? "below" : "beside"; },
      }),
      heading("Show"),
      checkbox({ key: "allAreas", label: "Every marker's area", checked: this.showAllAreas, onChange: (checked) => { this.showAllAreas = checked; } }),
    ];
  }

  // Zoom, in a card of its own, in the lower right corner.
  zoomPanel() {
    return card(
      { style: zoomPanelStyle },
      iconButton({ icon: "zoom_out", title: "Zoom out", onClick: () => this.zoomBy(-1) }),
      div({ style: { minWidth: "48px", textAlign: "center" } }, text(Math.round(this.zoom * 100) + "%")),
      iconButton({ icon: "zoom_in", title: "Zoom in", onClick: () => this.zoomBy(1) }),
    );
  }

  // The right side: the flow the caret is in - what it is, what it's in,
  // and what there is to set about it: a section's title offset, for now.
  flowPanel() {
    const focus = this.focusedFlow();
    if (!focus) {
      return card({ style: cardStyle }, heading("Flow"), note("Click in the document to see what's there."));
    }
    const { flow, around } = focus;
    const section = isSection(flow);
    return card(
      { style: cardStyle },
      row(
        { style: { alignItems: "center" } },
        div({ style: { flex: "1" } }, heading(flow instanceof Document ? "Document" : section ? "Section" : "Paragraph")),
        infoButton({ key: "info", title: "About it", details: this.flowDetails(flow, around) }),
      ),
      section ? this.structureControls(flow, around) : null,
      section ? this.appearanceControls(flow, around) : null,
      section ? null : this.paragraphControls(flow),
    );
  }

  // The wider context: the document the caret is in - its root - and what
  // goes for all of it: whether its titles are numbered. Nothing without a
  // caret.
  documentPanel() {
    const focus = this.focusedFlow();
    if (!focus) return null;
    const document = focus.around[0] || focus.flow;
    return card(
      { style: cardStyle },
      heading("Whole document"),
      checkbox({
        key: "numberTitles",
        label: "Number titles",
        checked: document.numberTitles,
        onChange: (checked) => { document.numberTitles = checked; },
      }),
      note("Every title but the document's own numbered by where it is - 2.1, and on. The numbers aren't text: they follow the structure."),
    );
  }

  // What's good to know about a flow, but needn't take room all the time -
  // behind the info button: what it's in, a section's title and what it
  // holds, how many words.
  flowDetails(flow, around) {
    const titleOf = (section) => paragraphText(section.title) || titlePlaceholder;
    const section = isSection(flow);
    return [
      around.length > 0 ? note("In " + around.map(titleOf).join(" › ")) : null,
      section ? div({}, text("“" + titleOf(flow) + "”")) : null,
      section ? note(contentsOf(flow)) : null,
      note(wordsIn(flow) + " words"),
    ];
  }

  // A change to the document from the panel - in one go, laid out once.
  inOneGo(change) {
    postponeInvalidations();
    try {
      change();
    } finally {
      continueInvalidations();
    }
  }

  // A paragraph's: making it a title - the title of a section holding the
  // paragraphs after it, up to the next section (as Tab in it) - and, in a
  // section in another, moving it out: it, and all after it, after the
  // section.
  paragraphControls(paragraph) {
    const editing = this.unobservable.editing;
    return [
      button({ key: "makeTitle" }, "Make into title", () => this.inOneGo(() => editing.promoteParagraph(paragraph))),
      editing.canMoveOut(paragraph)
        ? button({ key: "moveOut" }, "Move out of section", () => this.inOneGo(() => editing.moveOut(paragraph)))
        : null,
      editing.canMoveOut(paragraph) ? note("It, and all after it in the section, moved to after the section.") : null,
    ];
  }

  // A section's place in the document's structure - its title level, 1 the
  // document's own - and moving it there, the number going down or up as on
  // the appearance's: - promotes it (Tab in its title), up a level, out of
  // the section it's in; + demotes it (Shift+Tab), down a level, into the
  // section before it - or, with none, to paragraphs.
  // A leaf - no section in it - can be made paragraphs right away. The
  // document changes.
  structureControls(section, around) {
    const editing = this.unobservable.editing;
    return [
      heading("Structure"),
      row(
        { style: { alignItems: "center", gap: "6px" } },
        div({ style: { flex: "1" } }, text("Title level")),
        iconButton({
          icon: "remove", title: "Promote: up a level - a lower number - out of the section it's in (Tab)",
          disabled: !editing.canPromote(section), onClick: () => this.inOneGo(() => editing.promoteSection(section)),
        }),
        div({ style: { minWidth: "16px", textAlign: "center" } }, text(String(around.length + 1))),
        iconButton({
          icon: "add", title: "Demote: down a level - a higher number - into the section before, or, with none, to paragraphs (Shift+Tab)",
          disabled: !editing.canDemote(section), onClick: () => this.inOneGo(() => editing.demoteSection(section)),
        }),
      ),
      editing.canMakeParagraphs(section)
        ? button({}, "Make into paragraph", () => this.inOneGo(() => editing.makeParagraphs(section)))
        : null,
      note("Where the section is in the document - moving it changes what's in what."),
    ];
  }

  // How a section's title looks - adjusting its appearance (its title offset,
  // see ./model/flows.js), setting it smaller than its place makes it (a
  // "bridgehead"): only how it looks, the document's structure as it is.
  appearanceControls(section, around) {
    let level = 0;
    for (const each of [...around, section]) level = titleLevel(each, level);
    return [
      heading("Appearance"),
      row(
        { style: { alignItems: "center", gap: "6px" } },
        div({ style: { flex: "1" } }, text("Adjust appearance")),
        iconButton({ icon: "remove", title: "Adjust less - closer to its level", disabled: section.titleOffset === 0, onClick: () => { section.titleOffset = Math.max(0, section.titleOffset - 1); } }),
        div({ style: { minWidth: "16px", textAlign: "center" } }, text(String(section.titleOffset))),
        iconButton({ icon: "add", title: "Adjust more - set smaller than its level", onClick: () => { section.titleOffset = section.titleOffset + 1; } }),
      ),
      note("Shown as title level " + level + ". Only how it looks - a bridgehead - the structure stays as it is."),
    ];
  }

  // The flow the caret is in (see ./model/flows.js's focusedFlow()).
  focusedFlow() {
    return focusedFlow(this.unobservable.root, this.caret);
  }
}

// The cards, floating over the papers, a little in from the window's edges -
// the right one from the scroll bar too (as wide as one usually is, where
// it takes room at all).
const panelWidth = 220;
const panelInset = 12;
const scrollBarWidth = 16;
const cardStyle = {
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  flex: "none",
  boxShadow: "0 4px 16px rgba(0, 0, 0, 0.18)",
  pointerEvents: "auto",
};
const panelStyle = {
  ...cardStyle,
  position: "absolute",
  top: panelInset + "px",
  width: panelWidth + "px",
  maxHeight: "calc(100% - " + 2 * panelInset + "px)",
  overflowY: "auto",
};
// Zoom, in the lower right corner - clear of the scroll bars.
const zoomPanelStyle = {
  ...cardStyle,
  position: "absolute",
  right: panelInset + scrollBarWidth + "px",
  bottom: panelInset + scrollBarWidth + "px",
  flexDirection: "row",
  alignItems: "center",
  padding: "6px 10px",
};
// The right side's cards, one under the other - the column taking clicks
// only where a card is.
const rightColumnStyle = {
  position: "absolute",
  top: panelInset + "px",
  right: panelInset + scrollBarWidth + "px",
  width: panelWidth + "px",
  display: "flex",
  flexDirection: "column",
  gap: panelInset + "px",
  pointerEvents: "none",
};

const heading = (label) => div({ style: { fontWeight: "bold", fontSize: "13px", margin: "4px 0 0" } }, text(label));
const note = (words) => div({ style: { opacity: 0.7, fontSize: "12px" } }, text(words));

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

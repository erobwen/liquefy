import { Component, callback, repeat, retractRepeater, postponeInvalidations, continueInvalidations } from "@liquefy/cascade.component";
import { div, text } from "@liquefy/cascade.dom";
import { button, card, checkbox, iconButton, fillerStyle, fitContainerStyle, overlayFrame, colorSchemeScope, row } from "@liquefy/cascade.ui";
import { PaperSequence, paperSizes, margins, mm, inch } from "./print/index.js";
import { domMeasurer, printPaperSequence } from "./print/dom.js";
import { rippleEditor } from "./paper/RippleEditor.js";
import { rippleEditing } from "./paper/editing.js";
import { markerTypes } from "./paper/markers.js";
import { sequence as sequenceOf, Paragraph, Document, isSection, isFlowEdge, paragraphText, titleLevel, sectionsAround } from "./model/flows.js";
import { testDocument } from "./model/testDocument.js";
import { SequenceLayout, titlePlaceholder } from "./layout/DocumentLayout.js";

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
        row(
          { style: { ...fitContainerStyle, gap: "12px", padding: "12px" } },
          this.settingsPanel(),
          div(
            { style: { ...fillerStyle, overflow: "auto", borderRadius: "8px" } },
            rippleEditor({
              key: "editor", sequence, root, measurer, editing: this.unobservable.editing, zoom: this.zoom,
              showAllAreas: this.showAllAreas, markerTypes: this.markerTypes,
              onCaret: callback("caret", (at) => { this.caret = at; }),
            }),
          ),
          this.flowPanel(),
        ),
      ),
    );
  }

  // The left side: the document - its paper, zoom, clearing and printing it
  // - and, for experimenting, which places the caret can go to besides the
  // text (a checkbox for every kind of marker), and every marker's area at
  // once.
  settingsPanel() {
    const { document, sequence } = this.unobservable;
    const paper = document.paper;
    const pageCount = sequence.pages.length;
    return card(
      { style: panelStyle },
      div({ style: { fontWeight: "bold", fontSize: "18px", marginBottom: "4px" } }, text("Ripple")),
      heading("Paper"),
      row(
        { style: { gap: "6px" } },
        button({ variant: paper === paperSizes.A4 ? "filled" : undefined }, "A4", () => this.setPaper("A4")),
        button({ variant: paper === paperSizes.letter ? "filled" : undefined }, "Letter", () => this.setPaper("letter")),
      ),
      div({ style: { opacity: 0.7 } }, text(pageCount + (pageCount === 1 ? " page" : " pages"))),
      heading("Zoom"),
      row(
        { style: { alignItems: "center", gap: "6px" } },
        iconButton({ icon: "zoom_out", title: "Zoom out", onClick: () => this.zoomBy(-1) }),
        div({ style: { minWidth: "48px", textAlign: "center" } }, text(Math.round(this.zoom * 100) + "%")),
        iconButton({ icon: "zoom_in", title: "Zoom in", onClick: () => this.zoomBy(1) }),
      ),
      heading("Document"),
      row(
        { style: { gap: "6px" } },
        button({}, "Clear", () => this.clearDocument()),
        button({ variant: "filled" }, "Print", () => printPaperSequence(sequence, { title: "Ripple" })),
      ),
      heading("Caret goes to"),
      markerTypes.map(({ type, label }) => checkbox({
        key: type,
        label,
        checked: this.markerTypes[type] !== false,
        onChange: (checked) => this.setMarkerType(type, checked),
      })),
      heading("Show"),
      checkbox({ key: "allAreas", label: "Every marker's area", checked: this.showAllAreas, onChange: (checked) => { this.showAllAreas = checked; } }),
    );
  }

  // The right side: the flow the caret is in - what it is, what it's in,
  // and what there is to set about it: a section's title offset, for now.
  flowPanel() {
    const focus = this.focusedFlow();
    if (!focus) {
      return card({ style: panelStyle }, heading("Flow"), div({ style: { opacity: 0.7 } }, text("Click in the document to see what's there.")));
    }
    const { flow, around } = focus;
    const titleOf = (section) => paragraphText(section.title) || titlePlaceholder;
    const section = isSection(flow);
    let level = 0;
    for (const each of section ? [...around, flow] : around) level = titleLevel(each, level);
    return card(
      { style: panelStyle },
      heading(flow instanceof Document ? "Document" : section ? "Section" : "Paragraph"),
      around.length > 0 ? div({ style: { opacity: 0.7 } }, text("In " + around.map(titleOf).join(" › "))) : null,
      section ? div({}, text("“" + titleOf(flow) + "”")) : null,
      section ? div({}, text("Title level " + level)) : null,
      section ? row(
        { style: { alignItems: "center", gap: "6px" } },
        div({ style: { flex: "1" } }, text("Title offset")),
        iconButton({ icon: "remove", title: "Less offset", onClick: () => { flow.titleOffset = Math.max(0, flow.titleOffset - 1); } }),
        div({ style: { minWidth: "16px", textAlign: "center" } }, text(String(flow.titleOffset))),
        iconButton({ icon: "add", title: "More offset", onClick: () => { flow.titleOffset = flow.titleOffset + 1; } }),
      ) : null,
      section ? div({ style: { opacity: 0.7 } }, text(contentsOf(flow))) : null,
      div({ style: { opacity: 0.7 } }, text(wordsIn(flow) + " words")),
    );
  }

  // The flow the caret is in - a title standing for its section - and the
  // sections it's in: { flow, around }. Null with no caret, or one at what
  // isn't there any more.
  focusedFlow() {
    const at = this.caret;
    if (!at) return null;
    const flow = isFlowEdge(at) ? at.flow : at.paragraph;
    const around = sectionsAround(this.unobservable.root, flow);
    if (!around) return null;
    const last = around[around.length - 1];
    if (last && last.title === flow) return { flow: last, around: around.slice(0, -1) };
    return { flow, around };
  }
}

const panelStyle = { flex: "none", width: "220px", display: "flex", flexDirection: "column", gap: "6px", overflowY: "auto" };

const heading = (label) => div({ style: { fontWeight: "bold", fontSize: "13px", margin: "4px 0 0" } }, text(label));

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

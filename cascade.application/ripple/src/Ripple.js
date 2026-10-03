import { Component, repeat, retractRepeater, postponeInvalidations, continueInvalidations } from "@liquefy/cascade.component";
import { div, text } from "@liquefy/cascade.dom";
import { button, card, checkbox, controlPanel, iconButton, filler, fillerStyle, fitContainerStyle, overlayFrame, colorSchemeScope, column, row } from "@liquefy/cascade.ui";
import { PaperSequence, paperSizes, margins, mm, inch } from "./print/index.js";
import { domMeasurer, printPaperSequence } from "./print/dom.js";
import { rippleEditor } from "./paper/RippleEditor.js";
import { markerTypes } from "./paper/markers.js";
import { sequence as sequenceOf } from "./model/flows.js";
import { testDocument } from "./model/testDocument.js";
import { SequenceLayout } from "./layout/DocumentLayout.js";

// The document's margins on each paper: 25 mm on A4, an inch on Letter.
const paperMargins = { A4: margins(mm(25)), letter: margins(inch(1)) };

const zoomSteps = [0.5, 0.75, 1, 1.25, 1.5, 2];

// Which gaps are two places (see ./paper/markers.js's splitGaps).
const splitGapChoices = [
  { value: "beforeSections", label: "Before sections" },
  { value: "all", label: "Every gap" },
  { value: "none", label: "None" },
];

/**
 * Ripple - a word processor, on Cascade and cascade.print, whose document is
 * a tree of flows: sections in sections, each with a title, and paragraphs
 * of text (see ./model). For now it shows a document, on paper, with a caret
 * that moves through every place in it - in the text, and the gaps between
 * its flows at every level - editing comes next.
 *
 * Two roots, side by side:
 *  - The layout: the documents rendered onto a PaperSequence, a component
 *    for every flow of them (see ./layout) - and, placed from what's laid
 *    out, the gaps between the flows (see ./paper/markers.js). Not part of the app's own render - it
 *    has a target of its own - so the app owns it: created in
 *    initialization, laid out in a repeater of its own from establishment
 *    on, disposed with the app.
 *  - The view: the app's build, showing the paper sequence with
 *    Ripple's editor (./paper) - with no edits of the model's given to it
 *    yet, a caret only: click, the arrows, Home and End, Shift to select.
 */
export class Ripple extends Component {
  initialState() {
    // For experimenting with where a caret should be able to go:
    // markerTypes - which kinds of marker it goes to ({ type: false } for
    // one it doesn't), showAllAreas - every marker's area drawn at once, and
    // markersBeside - flows' starts and ends beside them, or between them,
    // and splitGaps - which gaps are two places, one above the other (see
    // splitGapChoices).
    return { zoom: 1, showAllAreas: false, markerTypes: {}, markersBeside: true, splitGaps: "beforeSections" };
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
    const { document, root, sequence, measurer } = this.unobservable;
    const paper = document.paper;
    const pageCount = sequence.pages.length;
    return overlayFrame(
      { style: { ...fitContainerStyle } },
      colorSchemeScope(
        { style: { ...fitContainerStyle } },
        column(
          { style: { ...fitContainerStyle, gap: "12px", padding: "12px" } },
          controlPanel(
            div({ style: { fontWeight: "bold", fontSize: "18px", marginRight: "8px" } }, text("Ripple")),
            filler(),
            button({ variant: paper === paperSizes.A4 ? "filled" : undefined }, "A4", () => this.setPaper("A4")),
            button({ variant: paper === paperSizes.letter ? "filled" : undefined }, "Letter", () => this.setPaper("letter")),
            filler(),
            iconButton({ icon: "zoom_out", title: "Zoom out", onClick: () => this.zoomBy(-1) }),
            div({ style: { minWidth: "48px", textAlign: "center" } }, text(Math.round(this.zoom * 100) + "%")),
            iconButton({ icon: "zoom_in", title: "Zoom in", onClick: () => this.zoomBy(1) }),
            filler(),
            div({ style: { opacity: 0.7 } }, text(pageCount + (pageCount === 1 ? " page" : " pages"))),
            button({ variant: "filled" }, "Print", () => printPaperSequence(sequence, { title: "Ripple" })),
          ),
          row(
            { style: { ...fillerStyle, gap: "12px" } },
            this.caretPanel(),
            div(
              { style: { ...fillerStyle, overflow: "auto", borderRadius: "8px" } },
              rippleEditor({
                key: "editor", sequence, root, measurer, zoom: this.zoom,
                showAllAreas: this.showAllAreas, markerTypes: this.markerTypes,
                markersBeside: this.markersBeside, splitGaps: this.splitGaps,
              }),
            ),
          ),
        ),
      ),
    );
  }

  // The side panel: which places the caret can go to, besides the text -
  // a checkbox for every kind of marker - and every marker's area at once.
  caretPanel() {
    const heading = (label) => div({ style: { fontWeight: "bold", fontSize: "13px", margin: "4px 0" } }, text(label));
    return card(
      { style: { flex: "none", width: "220px", display: "flex", flexDirection: "column", gap: "6px", overflowY: "auto" } },
      heading("Caret goes to"),
      markerTypes.map(({ type, label }) => checkbox({
        key: type,
        label,
        checked: this.markerTypes[type] !== false,
        onChange: (checked) => this.setMarkerType(type, checked),
      })),
      heading("Starts and ends"),
      checkbox({ key: "beside", label: "Beside their flows", checked: this.markersBeside, onChange: (checked) => { this.markersBeside = checked; } }),
      heading("Gaps"),
      text("Two places, one above the other:"),
      splitGapChoices.map(({ value, label }) => button(
        { key: "split-" + value, variant: this.splitGaps === value ? "filled" : undefined },
        label,
        () => { this.splitGaps = value; },
      )),
      heading("Show"),
      checkbox({ key: "allAreas", label: "Every marker's area", checked: this.showAllAreas, onChange: (checked) => { this.showAllAreas = checked; } }),
    );
  }
}

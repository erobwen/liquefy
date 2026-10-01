import { Component, repeat, retractRepeater, postponeInvalidations, continueInvalidations } from "@liquefy/cascade.component";
import { div, text } from "@liquefy/cascade.dom";
import { button, controlPanel, iconButton, filler, fillerStyle, fitContainerStyle, overlayFrame, colorSchemeScope, column } from "@liquefy/cascade.ui";
import { PaperSequence, paperSizes, margins, mm, inch } from "@liquefy/cascade.print";
import { domMeasurer, paperEditor, printPaperSequence } from "@liquefy/cascade.print/dom";
import { sequence as sequenceOf } from "./model/parts.js";
import { testDocument } from "./model/testDocument.js";
import { SequenceLayout } from "./layout/DocumentLayout.js";

// The document's margins on each paper: 25 mm on A4, an inch on Letter.
const paperMargins = { A4: margins(mm(25)), letter: margins(inch(1)) };

const zoomSteps = [0.5, 0.75, 1, 1.25, 1.5, 2];

/**
 * Ripple - a word processor, on Cascade and cascade.print, whose document is
 * a tree of parts: sections in sections, each with a title, and paragraphs
 * of text (see ./model). For now it shows a document, on paper, with a caret
 * that moves through every place in it - in the text, and the gaps between
 * its parts at every level - editing comes next.
 *
 * Two roots, side by side:
 *  - The layout: the documents rendered onto a PaperSequence, a component
 *    for every part of them and a gap marker between (see ./layout). Not part of the app's own render - it
 *    has a target of its own - so the app owns it: created in
 *    initialization, laid out in a repeater of its own from establishment
 *    on, disposed with the app.
 *  - The view: the app's build, showing the paper sequence with
 *    cascade.print's paperEditor() - with no edits of the model's given to
 *    it yet, a caret only: click, the arrows, Home and End, Shift to select.
 */
export class Ripple extends Component {
  initialState() {
    return { zoom: 1 };
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
    const { document, sequence, measurer } = this.unobservable;
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
          div(
            { style: { ...fillerStyle, overflow: "auto", borderRadius: "8px" } },
            paperEditor({ key: "editor", sequence, measurer, zoom: this.zoom }),
          ),
        ),
      ),
    );
  }
}

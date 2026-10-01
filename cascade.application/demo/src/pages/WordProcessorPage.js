import { Component, repeat, retractRepeater, postponeInvalidations, continueInvalidations } from "@liquefy/cascade.component";
import { div, text } from "@liquefy/cascade.dom";
import { button, controlPanel, iconButton, filler, fillerStyle } from "@liquefy/cascade.ui";
import { PrintDocument, PaperSequence, paperSizes, margins, mm, inch } from "@liquefy/cascade.print";
import { domMeasurer, paperSequenceView, printPaperSequence } from "@liquefy/cascade.print/dom";
import { pageActions } from "../components/pageActions.js";
import { fullPage } from "../components/layout.js";
import { sampleDocument } from "./wordProcessor/sampleDocument.js";
import source from "./WordProcessorPage.js?raw";

// What this page's information button shows (see ../components/pageActions.js).
const information = {
  summary: "A document laid out onto papers by cascade.print:",
  points: [
    "The document is a model - paragraphs with paragraph styles, spans with character styles - laid out onto a paper sequence: a render target with no DOM in it, in micrometers.",
    "Each paragraph is broken into lines (measured by the browser), then its lines are placed on the papers - two repeaters, so a paragraph that only moves is never broken again.",
    "Switch between A4 and Letter: every paragraph gets a new width and is laid out again. Zoom: nothing is laid out again, it's only drawn at another scale.",
    "Print sends the papers to the browser's print dialog - one sheet per paper, at its real size.",
  ],
};

// The section's margins on each paper: 25 mm on A4, an inch on Letter.
const paperMargins = { A4: margins(mm(25)), letter: margins(inch(1)) };

const zoomSteps = [0.5, 0.75, 1, 1.25, 1.5, 2];

/**
 * Word Processor - the beginnings of one: a document laid out onto papers,
 * shown, and printed. Read-only for now.
 *
 * Two roots, side by side:
 *  - The layout: a PrintDocument rendered onto a PaperSequence (see
 *    cascade.print). Not part of this page's own render - it has a target
 *    of its own - so the page owns it: created in initialization, laid out
 *    in a repeater of its own from establishment on, disposed with the page
 *    (see cascade.component/README.md on components created directly).
 *  - The view: this page's build, showing the paper sequence with
 *    paperSequenceView() - each paper reading only its own lines.
 */
export class WordProcessorPage extends Component {
  initialState() {
    return { zoom: 1 };
  }

  initialUnobservables() {
    const document = sampleDocument();
    return {
      document,
      sequence: new PaperSequence(),
      layout: new PrintDocument({ document, measurer: domMeasurer() }).establish(),
      layoutRoot: null,
    };
  }

  onEstablish() {
    super.onEstablish();
    const u = this.unobservable;
    // A root of its own: independent of whatever happens to be running when
    // this page is established.
    u.layoutRoot = repeat(() => u.layout.renderOnto(u.sequence), { independent: true });
  }

  onDispose() {
    const u = this.unobservable;
    if (u.layoutRoot) retractRepeater(u.layoutRoot);
    u.layout.dispose();
    super.onDispose();
  }

  // Paper and margins together - one change to the layout, not two.
  setPaper(name) {
    const section = this.unobservable.document.sections[0];
    postponeInvalidations();
    section.paper = paperSizes[name];
    section.margins = paperMargins[name];
    continueInvalidations();
  }

  zoomBy(steps) {
    const index = zoomSteps.indexOf(this.zoom) + steps;
    this.zoom = zoomSteps[Math.max(0, Math.min(zoomSteps.length - 1, index))];
  }

  build() {
    const { document, sequence } = this.unobservable;
    const paper = document.sections[0].paper;
    const pageCount = sequence.pages.length;
    return fullPage(
      pageActions({ information, source, fileName: "src/pages/WordProcessorPage.js" }),
      controlPanel(
        button({ variant: paper === paperSizes.A4 ? "filled" : undefined }, "A4", () => this.setPaper("A4")),
        button({ variant: paper === paperSizes.letter ? "filled" : undefined }, "Letter", () => this.setPaper("letter")),
        filler(),
        iconButton({ icon: "zoom_out", title: "Zoom out", onClick: () => this.zoomBy(-1) }),
        div({ style: { minWidth: "48px", textAlign: "center" } }, text(Math.round(this.zoom * 100) + "%")),
        iconButton({ icon: "zoom_in", title: "Zoom in", onClick: () => this.zoomBy(1) }),
        filler(),
        div({ style: { opacity: 0.7 } }, text(pageCount + (pageCount === 1 ? " page" : " pages"))),
        button({ variant: "filled" }, "Print", () => printPaperSequence(sequence, { title: "Temporal Signals on Paper" })),
      ),
      div(
        { style: { ...fillerStyle, overflow: "auto", borderRadius: "8px" } },
        paperSequenceView({ sequence, zoom: this.zoom }),
      ),
    );
  }
}

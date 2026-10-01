import { Component, callback, repeat, retractRepeater, postponeInvalidations, continueInvalidations } from "@liquefy/cascade.component";
import { div, text } from "@liquefy/cascade.dom";
import { button, controlPanel, iconButton, filler, fillerStyle, fitContainerStyle, overlayFrame, colorSchemeScope, column } from "@liquefy/cascade.ui";
import { PaperSequence, paperSizes, margins, mm, inch } from "@liquefy/cascade.print";
import { domMeasurer, paperEditor, printPaperSequence } from "@liquefy/cascade.print/dom";
import { sampleDocument } from "./model/sampleDocument.js";
import { WordDocument } from "./model/WordDocument.js";
import { wordEditing } from "./model/wordEditing.js";
import { FormatToolbar, applyFormat } from "./model/FormatToolbar.js";

// The section's margins on each paper: 25 mm on A4, an inch on Letter.
const paperMargins = { A4: margins(mm(25)), letter: margins(inch(1)) };

const zoomSteps = [0.5, 0.75, 1, 1.25, 1.5, 2];

/**
 * Ripple - a word processor, on Cascade and cascade.print. For now the
 * Cascade demo's Word Processor page as an app of its own - with a document
 * model of its own (./model), to grow from here.
 *
 * Two roots, side by side:
 *  - The layout: a WordDocument rendered onto a PaperSequence (see
 *    cascade.print). Not part of the app's own render - it has a target of
 *    its own - so the app owns it: created in initialization, laid out in a
 *    repeater of its own from establishment on, disposed with the app.
 *  - The editor: the app's build, showing the paper sequence with
 *    cascade.print's paperEditor() and editing the model at its caret,
 *    through the model's own edits (wordEditing()).
 */
export class Ripple extends Component {
  initialState() {
    return { zoom: 1 };
  }

  initialUnobservables() {
    const document = sampleDocument();
    const measurer = domMeasurer();
    return {
      document,
      measurer,
      editing: wordEditing(document),
      sequence: new PaperSequence(),
      layout: new WordDocument({ document, measurer }).establish(),
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
    const { document, sequence, measurer, editing } = this.unobservable;
    const paper = document.sections[0].paper;
    const pageCount = sequence.pages.length;
    // Keyed: built again, it's the editor already there - the one the
    // toolbar formats with.
    const editor = paperEditor({
      key: "editor",
      sequence,
      measurer,
      editing,
      zoom: this.zoom,
      shortcuts: { b: "Bold", i: "Italic" },
      onShortcut: callback("shortcut", (name) => applyFormat(editor, document, name.toLowerCase())),
    });
    // The overlay frame: where the style menu's list opens.
    return overlayFrame(
      { style: { ...fitContainerStyle } },
      colorSchemeScope(
        { style: { ...fitContainerStyle } },
        column(
          { style: { ...fitContainerStyle, gap: "12px", padding: "12px" } },
          controlPanel(
            div({ style: { fontWeight: "bold", fontSize: "18px", marginRight: "8px" } }, text("Ripple")),
            new FormatToolbar({ editor, document }),
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
          div({ style: { ...fillerStyle, overflow: "auto", borderRadius: "8px" } }, editor),
        ),
      ),
    );
  }
}

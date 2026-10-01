import { Component, callback, repeat, retractRepeater, postponeInvalidations, continueInvalidations } from "@liquefy/cascade.component";
import { div, text } from "@liquefy/cascade.dom";
import { button, controlPanel, iconButton, filler, fillerStyle } from "@liquefy/cascade.ui";
import { PaperSequence, paperSizes, margins, mm, inch } from "@liquefy/cascade.print";
import { domMeasurer, paperEditor, printPaperSequence } from "@liquefy/cascade.print/dom";
import { pageActions } from "../components/pageActions.js";
import { fullPage } from "../components/layout.js";
import { sampleDocument } from "./wordProcessor/sampleDocument.js";
import { WordDocument } from "./wordProcessor/WordDocument.js";
import { wordEditing } from "./wordProcessor/wordEditing.js";
import { FormatToolbar, applyFormat } from "./wordProcessor/FormatToolbar.js";
import source from "./WordProcessorPage.js?raw";

// What this page's information button shows (see ../components/pageActions.js).
const information = {
  summary: "A document laid out onto papers by cascade.print - click anywhere in the text and type:",
  points: [
    "The document is a model - paragraphs with paragraph styles, spans with character styles - laid out onto a paper sequence: a render target with no DOM in it, in micrometers.",
    "Each paragraph is broken into lines (measured by the browser), then its lines are placed on the papers - two repeaters, so a paragraph that only moves is never broken again.",
    "Switch between A4 and Letter: every paragraph gets a new width and is laid out again. Zoom: nothing is laid out again, it's only drawn at another scale.",
    "Click to drop the caret, then type, Backspace, Delete, Enter, and move with the arrows, Home and End (Ctrl/Cmd for the whole document). Select by dragging, Shift+click, double or triple click, Shift with the moving keys, or Ctrl/Cmd+A - typing replaces the selection, Backspace and Delete delete it. Each edit changes the model; the paragraph is broken into lines again, and the caret is drawn where the new layout puts it.",
    "Format with the toolbar: the style menu sets the style of the paragraphs the selection touches, the alignment buttons their alignment, and the indent button turns their first line indent on and off. Bold and italic (Ctrl/Cmd+B, +I) format the selection - or, with nothing selected, the word the caret is in.",
    "Print sends the papers to the browser's print dialog - one sheet per paper, at its real size.",
  ],
};

// The section's margins on each paper: 25 mm on A4, an inch on Letter.
const paperMargins = { A4: margins(mm(25)), letter: margins(inch(1)) };

const zoomSteps = [0.5, 0.75, 1, 1.25, 1.5, 2];

/**
 * Word Processor - the beginnings of one: a document laid out onto papers,
 * shown, edited at a caret, and printed.
 *
 * The model - Word's, with its styles, edits and formatting - is this
 * demo's own, in ./wordProcessor; cascade.print knows nothing of it, and
 * lays out, shows, edits and prints any model given the same few hooks.
 *
 * Two roots, side by side:
 *  - The layout: a WordDocument rendered onto a PaperSequence (see
 *    cascade.print). Not part of this page's own render - it has a target
 *    of its own - so the page owns it: created in initialization, laid out
 *    in a repeater of its own from establishment on, disposed with the page
 *    (see cascade.component/README.md on components created directly).
 *  - The editor: this page's build, showing the paper sequence with
 *    cascade.print's paperEditor() - each paper reading only its own lines -
 *    and editing the model at its caret, through the model's own edits
 *    (wordEditing()).
 */
export class WordProcessorPage extends Component {
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
    return fullPage(
      pageActions({ information, source, fileName: "src/pages/WordProcessorPage.js" }),
      controlPanel(
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
        button({ variant: "filled" }, "Print", () => printPaperSequence(sequence, { title: "Temporal Signals on Paper" })),
      ),
      div(
        { style: { ...fillerStyle, overflow: "auto", borderRadius: "8px" } },
        editor,
      ),
    );
  }
}

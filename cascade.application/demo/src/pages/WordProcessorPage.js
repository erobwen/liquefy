import { Component, repeat, retractRepeater, postponeInvalidations, continueInvalidations } from "@liquefy/cascade.component";
import { div, text } from "@liquefy/cascade.dom";
import { button, controlPanel, iconButton, dropdown, filler, fillerStyle, themeColor } from "@liquefy/cascade.ui";
import { PrintDocument, PaperSequence, paperSizes, margins, mm, inch, resolveParagraphStyle } from "@liquefy/cascade.print";
import { domMeasurer, documentEditor, printPaperSequence } from "@liquefy/cascade.print/dom";
import { pageActions } from "../components/pageActions.js";
import { fullPage } from "../components/layout.js";
import { sampleDocument } from "./wordProcessor/sampleDocument.js";
import source from "./WordProcessorPage.js?raw";

// What this page's information button shows (see ../components/pageActions.js).
const information = {
  summary: "A document laid out onto papers by cascade.print - click anywhere in the text and type:",
  points: [
    "The document is a model - paragraphs with paragraph styles, spans with character styles - laid out onto a paper sequence: a render target with no DOM in it, in micrometers.",
    "Each paragraph is broken into lines (measured by the browser), then its lines are placed on the papers - two repeaters, so a paragraph that only moves is never broken again.",
    "Switch between A4 and Letter: every paragraph gets a new width and is laid out again. Zoom: nothing is laid out again, it's only drawn at another scale.",
    "Click to drop the caret, then type, Backspace, Delete, Enter, and move with the arrows, Home and End (Ctrl/Cmd for the whole document). Select by dragging, Shift+click, double or triple click, Shift with the moving keys, or Ctrl/Cmd+A - typing replaces the selection, Backspace and Delete delete it. Each edit changes the model; the paragraph is broken into lines again, and the caret is drawn where the new layout puts it.",
    "Format with the toolbar: the style menu sets the style of the paragraphs the selection touches, the alignment buttons their alignment. Bold and italic (Ctrl/Cmd+B, +I) format the selection - or, with nothing selected, the word the caret is in.",
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
 * Two roots, side by side:
 *  - The layout: a PrintDocument rendered onto a PaperSequence (see
 *    cascade.print). Not part of this page's own render - it has a target
 *    of its own - so the page owns it: created in initialization, laid out
 *    in a repeater of its own from establishment on, disposed with the page
 *    (see cascade.component/README.md on components created directly).
 *  - The editor: this page's build, showing the paper sequence with
 *    documentEditor() - each paper reading only its own lines - and editing
 *    the model at its caret.
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
      sequence: new PaperSequence(),
      layout: new PrintDocument({ document, measurer }).establish(),
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
    const { document, sequence, measurer } = this.unobservable;
    const paper = document.sections[0].paper;
    const pageCount = sequence.pages.length;
    // Keyed: built again, it's the editor already there - the one the
    // toolbar formats with.
    const editor = documentEditor({ key: "editor", document, sequence, measurer, zoom: this.zoom });
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

// The paragraph styles in the style menu, by name in the sample document's
// stylesheet - every one of them.
const paragraphStyles = [
  { style: "Title", label: "Title" },
  { style: "Subtitle", label: "Subtitle" },
  { style: "Heading1", label: "Heading 1" },
  { style: "Heading2", label: "Heading 2" },
  { style: "Normal", label: "Normal" },
  { style: "Body", label: "Body text" },
  { style: "Quote", label: "Quote" },
];

// How a style looks, for its entry in the style menu: its font - the size
// scaled down to fit in a menu, larger styles still larger.
function stylePreview(stylesheet, style) {
  const { font } = resolveParagraphStyle(stylesheet, style);
  return {
    fontFamily: font.family,
    fontWeight: font.weight,
    fontStyle: font.italic ? "italic" : "normal",
    fontSize: Math.round(Math.min(22, 9 + font.size * 0.55)) + "px",
  };
}

const alignments = [
  { align: "left", icon: "format_align_left", title: "Align left" },
  { align: "center", icon: "format_align_center", title: "Center" },
  { align: "right", icon: "format_align_right", title: "Align right" },
];

// Formatting buttons - showing what's on at the caret, and setting it
// there (see cascade.print's DocumentEditor.format()). A component of its
// own: it follows every move of the caret, the page around it doesn't.
class FormatToolbar extends Component {
  setProperties({ editor, document }) {
    this.editor = editor;
    this.document = document;
  }

  build() {
    const editor = this.editor;
    const current = editor.currentFormat();
    const disabled = !current;
    const on = { background: themeColor.accentLight, color: themeColor.accentDark };
    const toggle = (kind, icon, title, active) => iconButton({
      icon, title, disabled, style: active ? on : {}, onClick: () => editor.format(kind),
    });
    return [
      dropdown({
        options: paragraphStyles.map(({ style, label }) => ({ value: style, label, style: stylePreview(this.document.styles, style) })),
        value: current ? current.style : null,
        placeholder: "Style",
        title: "Paragraph style",
        disabled,
        onSelect: (style) => editor.format("style", style),
        style: { minWidth: "128px" },
      }),
      separator(),
      toggle("bold", "format_bold", "Bold (Ctrl+B)", current && current.bold),
      toggle("italic", "format_italic", "Italic (Ctrl+I)", current && current.italic),
      separator(),
      ...alignments.map(({ align, icon, title }) => iconButton({
        icon, title, disabled, style: current && current.align === align ? on : {}, onClick: () => editor.format("align", align),
      })),
    ];
  }
}

function separator() {
  return div({ style: { width: "1px", alignSelf: "stretch", margin: "4px 2px", background: themeColor.border } });
}

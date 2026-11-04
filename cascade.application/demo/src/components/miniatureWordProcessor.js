import { Component, callback, repeat, retractRepeater } from "@liquefy/cascade.component";
import { div } from "@liquefy/cascade.dom";
import { themeColor } from "@liquefy/cascade.ui";
import { PaperSequence } from "@liquefy/cascade.print";
import { domMeasurer, paperEditor } from "@liquefy/cascade.print/dom";
import { miniatureDocument } from "../pages/wordProcessor/sampleDocument.js";
import { WordDocument } from "../pages/wordProcessor/WordDocument.js";
import { wordEditing } from "../pages/wordProcessor/wordEditing.js";
import { FormatToolbar, applyFormat } from "../pages/wordProcessor/FormatToolbar.js";

/**
 * The Word Processor page, in miniature - for the Showcase: one small
 * paper, nearly full, and the format toolbar over it. The same model,
 * layout and editor as the full page (see ../pages/WordProcessorPage.js),
 * owned the same way: the layout is a root of its own, onto a paper
 * sequence with no DOM in it - created in initialization, laid out from
 * establishment on, disposed with this.
 *
 * `zoom`: how large the paper is drawn - nothing is laid out again for it.
 * The papers scroll in a window `height` pixels high.
 */
export class MiniatureWordProcessor extends Component {
  setProperties({ zoom = 1, height = 600, style }) {
    this.zoom = zoom;
    this.height = height;
    this.style = style || {};
  }

  initialUnobservables() {
    const document = miniatureDocument();
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
    u.layoutRoot = repeat(() => u.layout.renderOnto(u.sequence), { independent: true });
  }

  onDispose() {
    const u = this.unobservable;
    if (u.layoutRoot) retractRepeater(u.layoutRoot);
    u.layout.dispose();
    u.measurer.dispose();
    super.onDispose();
  }

  build() {
    const { document, sequence, measurer, editing } = this.unobservable;
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
    return div(
      { style: { borderRadius: "20px", overflow: "hidden", color: themeColor.text, background: themeColor.surface, border: "1px solid " + themeColor.border, boxShadow: "0 30px 60px -30px rgba(0, 0, 0, 0.45)", ...this.style } },
      div(
        { style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "2px", padding: "8px 12px", borderBottom: "1px solid " + themeColor.border } },
        new FormatToolbar({ editor, document }),
      ),
      div({ style: { height: this.height + "px", overflow: "auto" } }, editor),
    );
  }
}

import { Component, repeat, retractRepeater } from "@liquefy/cascade.component";
import { div } from "@liquefy/cascade.dom";
import { PaperSequence } from "../../print/index.js";
import { domMeasurer } from "../../print/dom.js";
import { tabulaEditor } from "../../paper/TabulaEditor.js";
import { tabulaEditing } from "../../paper/editing.js";
import { sequence as sequenceOf } from "../../model/flows.js";
import { SequenceLayout } from "../../layout/DocumentLayout.js";
import { removeButton } from "../../shell/removeButton.js";

const markerTypes = Object.freeze({ paragraphStart: false, paragraphEnd: false, titleStart: false, sectionStart: false });

// Around the papers, and between them (see ../../paper/TabulaPaperView.js).
const paperInset = 8;

/**
 * StructuredTextEditor - a structured text (a Document, see ../../model)
 * on its papers, with Tabula's editor: what the classic Tabula app is (see
 * ../../Tabula.js), for one document handed to it, without its cards - at
 * its own height, in the app's column of documents, at the app's `zoom`.
 * With `onRemove`, a remove button at the top left corner of its first
 * paper (see ../../shell/documents.js).
 *
 * As in the classic app, the layout is a root of its own: the document
 * rendered onto a PaperSequence, created in initialization, laid out in a
 * repeater of its own from establishment on, disposed with the editor. A
 * different document is a different editor (keyed by whoever shows it).
 */
export class StructuredTextEditor extends Component {
  setProperties({ model, zoom = 1, onRemove }) {
    this.model = model;
    this.zoom = zoom;
    this.onRemove = onRemove || null;
  }

  initialUnobservables() {
    const root = sequenceOf(this.model);
    const measurer = domMeasurer();
    return {
      root,
      measurer,
      // Sections made from a blank paragraph beside their parent, and
      // demoted whole - the classic app's defaults (see ../../paper/editing.js).
      editing: tabulaEditing(root, { newSectionsBeside: () => true, demoteWithChildren: () => true }),
      sequence: new PaperSequence(),
      layout: new SequenceLayout({ sequence: root, measurer }).establish(),
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
    const { root, sequence, measurer, editing } = this.unobservable;
    const corner = `calc(${paperInset}mm * ${this.zoom})`;
    return div(
      { style: { position: "relative" } },
      tabulaEditor({
        sequence, root, measurer, editing, zoom: this.zoom,
        // The classic app's defaults: no outline around what the caret is
        // in, and the caret going to the ends of sections only.
        showFocusOutline: false, markerTypes,
      }),
      this.onRemove ? removeButton(this.onRemove, { left: corner, top: corner }) : null,
    );
  }
}

export const structuredTextEditor = (...parameters) => new StructuredTextEditor(...parameters);

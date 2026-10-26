import { Component, repeat, retractRepeater, callback, frozen } from "@liquefy/cascade.component";
import { div } from "@liquefy/cascade.dom";
import { PaperSequence } from "../../print/index.js";
import { domMeasurer } from "../../print/dom.js";
import { tabulaEditor } from "../../paper/TabulaEditor.js";
import { tabulaEditing } from "../../paper/editing.js";
import { sequence as sequenceOf } from "../../model/flows.js";
import { SequenceLayout } from "../../layout/DocumentLayout.js";
import { removeButton } from "../../shell/removeButton.js";
import { takeFocus, releaseFocus } from "../../shell/contextMenus.js";
import { structuredTextSettings } from "./settings.js";
import { contextPath } from "./menus.js";

// Around the papers, and between them (see ../../paper/TabulaPaperView.js).
const paperInset = 8;

/**
 * StructuredTextEditor - a structured text (a Document, see ../../model)
 * on its papers, with Tabula's editor: what the classic Tabula app is (see
 * ../../Tabula.js), for one document handed to it - at its own height, in
 * the app's column of documents, at the app's `zoom`. With `onRemove`, a
 * remove button at the top left corner of its first paper (see
 * ../../shell/documents.js).
 *
 * Its cards are context menus now (see menus.js): placed with its caret,
 * the editor takes the focus (see ../../shell/contextMenus.js), and the
 * layout shows the document's menu and the menu of the flow the caret is
 * in. How it's edited - which markers the caret goes to, and the like - is
 * Tabula's settings for structured text (see settings.js), found through
 * the service locator.
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

  initialState() {
    // Where the caret is (the editor's onCaret) - for the context menus.
    // flash: where the last refused key was flashed - and how many there
    // have been, so each one flashes anew (see refused()).
    return { caret: null, flash: null };
  }

  initialUnobservables() {
    const root = sequenceOf(this.model);
    const measurer = domMeasurer();
    const u = {
      root,
      measurer,
      // The settings - found by the build, where the service locators are.
      settings: null,
      sequence: new PaperSequence(),
      layout: new SequenceLayout({ sequence: root, measurer }).establish(),
      layoutRoot: null,
    };
    // Asked when it matters - from the component's own unobservables, where
    // the build puts the settings, not from `u`: what this returns isn't
    // kept as it is.
    u.editing = tabulaEditing(root, {
      newSectionsBeside: () => this.unobservable.settings.newSectionsBeside,
      demoteWithChildren: () => this.unobservable.settings.demoteWithChildren,
      refuse: () => this.refused(),
    });
    return u;
  }

  get settings() {
    return this.unobservable.settings;
  }

  pageCount() {
    return this.unobservable.sequence.pages.length;
  }

  // See ../../shell/contextMenus.js.
  contextPath() {
    return contextPath(this);
  }

  // The caret placed, or moved: this editor has the focus.
  caretMoved(at) {
    this.caret = at;
    if (at) takeFocus(this);
  }

  onEstablish() {
    super.onEstablish();
    const u = this.unobservable;
    u.layoutRoot = repeat(() => u.layout.renderOnto(u.sequence), { independent: true });
    if (typeof(document) !== "undefined") addFlashKeyframes(document);
  }

  // A key refused - Enter, say, at the start of a title right under the
  // document's (see ../../paper/editing.js): a flash where the caret is -
  // where the editor keeps its input, for input methods to open there.
  refused() {
    const input = typeof(document) !== "undefined" ? document.activeElement : null;
    const rect = input && input.getBoundingClientRect ? input.getBoundingClientRect() : null;
    const count = this.flash ? this.flash.count + 1 : 1;
    this.flash = frozen({ x: rect ? rect.left : 0, y: rect ? (rect.top + rect.bottom) / 2 : 0, count, shown: !!rect });
  }

  onDispose() {
    const u = this.unobservable;
    releaseFocus(this);
    if (u.layoutRoot) retractRepeater(u.layoutRoot);
    u.layout.dispose();
    u.measurer.dispose();
    super.onDispose();
  }

  build() {
    const { root, sequence, measurer, editing } = this.unobservable;
    const settings = structuredTextSettings();
    this.unobservable.settings = settings;
    const corner = `calc(${paperInset}mm * ${this.zoom})`;
    return div(
      { style: { position: "relative" } },
      tabulaEditor({
        sequence, root, measurer, editing, zoom: this.zoom,
        showFocusOutline: settings.showFocusOutline, showAllAreas: settings.showAllAreas,
        markerTypes: settings.markerTypes, sectionEnds: settings.sectionEnds,
        onCaret: callback("caret", (at) => this.caretMoved(at)),
      }),
      this.onRemove ? removeButton(this.onRemove, { left: corner, top: corner }) : null,
      // A new one every time - keyed by the count - so it flashes again.
      this.flash && this.flash.shown
        ? div({ key: "flash" + this.flash.count, style: { ...flashStyle, left: this.flash.x + "px", top: this.flash.y + "px" } })
        : null,
    );
  }
}

// A red ring, widening and fading, centred on the caret.
const flashStyle = {
  position: "fixed", width: "28px", height: "28px", marginLeft: "-14px", marginTop: "-14px", boxSizing: "border-box",
  borderRadius: "50%", border: "3px solid rgba(229, 57, 53, 0.85)", pointerEvents: "none",
  animation: "tabula-refused 450ms ease-out forwards",
};

function addFlashKeyframes(doc) {
  if (!doc || !doc.head || doc.getElementById("tabula-refused-keyframes")) return;
  const style = doc.createElement("style");
  style.id = "tabula-refused-keyframes";
  style.textContent = "@keyframes tabula-refused {"
    + " from { transform: scale(0.3); opacity: 1; }"
    + " to { transform: scale(1.6); opacity: 0; } }";
  doc.head.appendChild(style);
}

export const structuredTextEditor = (...parameters) => new StructuredTextEditor(...parameters);

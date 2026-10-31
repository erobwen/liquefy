import { Component, repeat, retractRepeater, callback, frozen } from "@liquefy/cascade.component";
import { div } from "@liquefy/cascade.dom";
import { overlay } from "@liquefy/cascade.ui";
import { PaperSequence } from "../../print/index.js";
import { domMeasurer } from "../../print/dom.js";
import { tabulaEditor } from "../../paper/TabulaEditor.js";
import { pageLayoutEditor, newElement } from "../../paper/PageLayoutEditor.js";
import { tabulaEditing } from "../../paper/editing.js";
import { sequence as sequenceOf } from "../../model/flows.js";
import { SequenceLayout } from "../../layout/DocumentLayout.js";
import { removeButton } from "../../shell/removeButton.js";
import { takeFocus, releaseFocus } from "../../shell/contextMenus.js";
import { structuredTextSettings } from "./settings.js";
import { insertView } from "../../shell/InsertView.js";
import { anchorOf, hintFor, anchoredSequences, dotPosition, isDot } from "../../model/sequences.js";
import { clamp } from "../../shell/clamp.js";
import { surfaceInset } from "../../shell/spacing.js";
import { pageLayoutProvider, formatIn } from "../../model/pageLayout.js";
import { contextPath } from "./menus.js";


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
 * Two modes (`mode`): "write" - the text, edited - and "page" - its page
 * layout (see ../../model/pageLayout.js, ../../paper/PageLayoutEditor.js):
 * its margins, and what's drawn on its pages, the text showing through.
 * Laying out the pages is modal: the papers stay where they are, and over
 * the whole paper view - the overlay frame the app gives it there (see
 * ../../shell/TabulaApp.js), under the menus - the page layout: its three
 * papers, the view dimmed around them. Escape, or a double click inside
 * the margins, back to writing.
 * Chosen in the document's menu; a double click in a paper's margins goes
 * to the page layout, one inside them back to the text. What's created
 * goes where the mode says: at the caret, writing; on a page, laying out
 * the pages.
 *
 * As in the classic app, the layout is a root of its own: the document
 * rendered onto a PaperSequence, created in initialization, laid out in a
 * repeater of its own from establishment on, disposed with the editor. A
 * different document is a different editor (keyed by whoever shows it).
 * Among pages of their own in another document, it's laid out there,
 * with that one (see ../../layout/DocumentLayout.js's InsertLayout):
 * `paperSequence`, given - its papers, shown and edited, no layout of its
 * own.
 */
export class StructuredTextEditor extends Component {
  setProperties({ model, zoom = 1, onRemove, paperSequence }) {
    this.model = model;
    this.zoom = zoom;
    this.onRemove = onRemove || null;
    this.paperSequence = paperSequence || null;
  }

  initialState() {
    // Where the caret is (the editor's onCaret) - for the context menus.
    // flash: where the last refused key was flashed - and how many there
    // have been, so each one flashes anew (see refused()). mode: "write" or
    // "page" (see above). selectedElement: in the page layout, the element
    // selected - { element, kind }, kind the page it's on (see
    // ../../model/pageLayout.js). pageSettingsShown: its page settings'
    // controls shown, none of its own yet (see
    // ../../shell/pageSettingsMenu.js).
    // dotMenu: the creation menu of the dot the caret is at, open - {
    // highlighted }, the item the keyboard is at - or null.
    return { caret: null, flash: null, mode: "write", selectedElement: null, pageSettingsShown: false, dotMenu: null };
  }

  initialUnobservables() {
    const root = sequenceOf(this.model);
    const measurer = domMeasurer();
    const u = {
      root,
      measurer,
      // The settings - found by the build, where the service locators are.
      settings: null,
      sequence: this.paperSequence || new PaperSequence(),
      layout: this.paperSequence ? null : new SequenceLayout({ sequence: root, measurer }).establish(),
      layoutRoot: null,
      // Where the TabulaEditor puts itself - for edits from outside it.
      controller: {},
      // What it's in, as its build found it - for what it provides.
      depth: 0,
      paperZoom: 1,
    };
    // Asked when it matters - from the component's own unobservables, where
    // the build puts the settings, not from `u`: what this returns isn't
    // kept as it is.
    u.editing = tabulaEditing(root, {
      newSectionsBeside: () => this.unobservable.settings.newSectionsBeside,
      depressedTitles: () => this.unobservable.settings.depressedTitles,
      exitTitles: () => this.unobservable.settings.exitTitles,
      keepEmptyLine: () => this.unobservable.settings.keepEmptyLine,
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

  // One level deeper, for pages of their own in it (see
  // ../../shell/clamp.js).
  // And what its papers are drawn at, all told - its zoom, in whatever
  // zoom it's drawn at itself. And its page settings - those it has of its
  // own - and its page layout, to what's in it, as its layout provides them
  // to theirs (see ../../layout/DocumentLayout.js).
  provide() {
    const editor = this;
    const model = this.model;
    const provided = pageLayoutProvider(() => model.pageLayout);
    Object.defineProperty(provided, "groupDepth", { enumerable: true, get: () => editor.unobservable.depth + 1 });
    Object.defineProperty(provided, "paperZoom", { enumerable: true, get: () => editor.zoom * editor.unobservable.paperZoom });
    return provided;
  }

  // Its paper, as its page settings make it - those of what it's in, but for
  // its own (see ../../model/pageLayout.js): its first page's.
  pageFormat() {
    return formatIn(this, this.model.pageLayout);
  }

  // See ../../shell/contextMenus.js.
  contextPath() {
    return contextPath(this);
  }

  // Where what's created goes (see ../../shell/contextMenus.js): on a page,
  // laying out the pages; in the text, writing, with a caret.
  insertPlace() {
    if (this.mode === "page") return "page";
    return this.caret ? "text" : null;
  }

  // Something created, put where the caret is: "insert this here" - the
  // caret's place deciding what that makes (see ../../paper/editing.js's
  // insert()). False with no caret. Laying out the pages: in the middle of
  // the page the element selected is on - the first, with none - selected.
  insert(content) {
    if (this.mode === "page") {
      const kind = this.selectedElement ? this.selectedElement.kind : "first";
      const paper = this.pageFormat();
      // Measured from its margins, wherever they come from.
      const element = newElement(content, paper, { x: paper.width / 2, y: paper.height / 2 }, { verso: kind === "middle" && !!paper.duplex, from: "margins" });
      this.model.pageLayout[kind].push(element);
      this.selectElement({ element, kind });
      return true;
    }
    const { controller, editing } = this.unobservable;
    return !!controller.editor && controller.editor.editAtCaret((at) => editing.insert(at, content));
  }

  // Pages of their own, between the papers (see ../../model/sequences.js):
  // what's in them, as the app shows documents - what's still a place
  // saying what it usually is, where it's anchored. The last item taken out,
  // gone from where it's anchored.
  // Their creation dots places for the caret: the one it's at, and its
  // menu, shown there - one clicked, the caret to it, its menu open.
  insertView(insert) {
    const { sequence } = insert;
    const anchor = anchorOf(this.model, sequence);
    const caret = isDot(this.caret) && this.caret.flow === sequence ? this.caret.index : null;
    const id = sequence.causality.id;
    return insertView({
      key: "insert" + id,
      sequence,
      format: insert.format,
      items: insert.items,
      before: insert.before,
      pad: insert.pad,
      hint: anchor ? hintFor(this.model, anchor.flow, anchor.side) : "",
      caret,
      menu: caret !== null ? this.dotMenu : null,
      onDot: callback("dot" + id, (index) => {
        const { controller } = this.unobservable;
        if (controller.editor) controller.editor.placeCaret(dotPosition(sequence, index));
        this.dotMenu = frozen({ highlighted: 0 });
      }),
      onCloseMenu: callback("closeMenu" + id, () => { this.dotMenu = null; }),
    });
  }

  // A key at a creation dot (see ../../paper/TabulaEditor.js's onDotKey):
  // Enter, Tab or Space, its creation menu open - the arrows, and Tab, going
  // through it, Enter or Space creating what's at, there, the caret to the
  // dot after it; Escape closing it. Closed: Escape, back to the text;
  // Delete or Backspace, an empty one - a page break - gone. True, taken.
  dotKey({ key, shift, primary }, at) {
    const views = this.inherit("documentViews");
    const types = views ? views.types() : [];
    const { controller, editing } = this.unobservable;
    const editor = controller.editor;
    const menu = this.dotMenu;
    if (menu) {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1, Tab: shift ? -1 : 1 }[key];
      if (step && types.length > 0) {
        this.dotMenu = frozen({ highlighted: (menu.highlighted + step + types.length) % types.length });
      } else if ((key === "Enter" || key === " ") && types[menu.highlighted]) {
        const sequence = at.flow;
        sequence.items.splice(at.index, 0, views.create(types[menu.highlighted]));
        this.dotMenu = null;
        if (editor) editor.placeCaret(dotPosition(sequence, at.index + 1));
      } else if (key === "Escape") {
        this.dotMenu = null;
      }
      return true;
    }
    if ((key === "Enter" && !primary) || key === "Tab" || key === " ") {
      this.dotMenu = frozen({ highlighted: 0 });
      return true;
    }
    if (key === "Escape") {
      if (editor) editor.placeCaret(editing.textBeside(at));
      return true;
    }
    if ((key === "Delete" || key === "Backspace") && !primary) {
      if (editor) editor.edit((position) => editing.removeBreak(position));
      return true;
    }
    return false;
  }

  // Writing, or laying out the pages: the caret, or the selected element,
  // left behind - this editor with the focus, its menus showing.
  setMode(mode) {
    if (mode === this.mode) return;
    this.mode = mode;
    this.caret = null;
    this.selectedElement = null;
    takeFocus(this);
  }

  selectElement(selection) {
    this.selectedElement = selection ? frozen(selection) : null;
    takeFocus(this);
  }

  // The caret placed, or moved: this editor has the focus.
  caretMoved(at) {
    this.caret = at;
    // A dot's menu goes with the caret.
    this.dotMenu = null;
    if (at) takeFocus(this);
  }

  onEstablish() {
    super.onEstablish();
    const u = this.unobservable;
    if (u.layout) u.layoutRoot = repeat(() => u.layout.renderOnto(u.sequence), { independent: true });
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
    if (u.layout) u.layout.dispose();
    u.measurer.dispose();
    super.onDispose();
  }

  build() {
    const { root, sequence, measurer, editing, controller } = this.unobservable;
    const settings = structuredTextSettings();
    this.unobservable.settings = settings;
    // Its first paper's top left corner - the papers drawn inset (see
    // ../../shell/spacing.js).
    const zoomed = (millimetres) => `calc(${millimetres}mm * ${this.zoom})`;
    const corner = { left: zoomed(surfaceInset.horizontal), top: zoomed(surfaceInset.vertical) };
    // A clamp along its papers, where it has pages of their own: which pages
    // belong to it (see ../../shell/clamp.js). Without - a leaf - none, even
    // among another's pages: the clamp of those says it's theirs.
    const depth = this.inherit("groupDepth") || 0;
    this.unobservable.depth = depth;
    this.unobservable.paperZoom = this.inherit("paperZoom") || 1;
    const clamped = anchoredSequences(this.model).length > 0;
    return div(
      { style: { position: "relative" } },
      tabulaEditor({
        key: "text",
        sequence, root, measurer, editing, controller, zoom: this.zoom,
        showFocusOutline: settings.showFocusOutline, showAllAreas: settings.showAllAreas,
        ...sectionEnds(settings),
        onCaret: callback("caret", (at) => this.caretMoved(at)),
        onMarginDoubleClick: callback("pages", () => this.setMode("page")),
        renderInsert: callback("insert", (insert) => this.insertView(insert)),
        onDotKey: callback("dotKey", (command, at) => this.dotKey(command, at)),
      }),
      this.mode === "page"
        ? overlay(
          { key: "pageLayout", showing: true },
          div(
            { style: pageLayoutCoverStyle },
            pageLayoutEditor({
              key: "pages",
              document: this.model, sequence, zoom: this.zoom,
              paperFormat: this.pageFormat(),
              elementsFrom: "margins",
              // Its margins moved there only if they're its own.
              setMargins: typeof(this.model.pageLayout.margins) !== "undefined"
                ? callback("setMargins", (margins) => { this.model.pageLayout.margins = margins; })
                : null,
              selected: this.selectedElement,
              onSelect: callback("selectElement", (selection) => this.selectElement(selection)),
              onWrite: callback("write", () => this.setMode("write")),
              takeDragged: callback("takeDragged", () => {
                const menus = this.inherit("contextMenus");
                return menus ? menus.takeDragged() : null;
              }),
            }),
          ),
        )
        : null,
      clamped ? clamp({ depth, paperWidth: this.pageFormat().width, inset: surfaceInset.vertical * 1000, zoom: this.zoom }) : null,
      this.onRemove ? removeButton(this.onRemove, corner) : null,
      // A new one every time - keyed by the count - so it flashes again.
      this.flash && this.flash.shown
        ? div({ key: "flash" + this.flash.count, style: { ...flashStyle, left: this.flash.x + "px", top: this.flash.y + "px" } })
        : null,
    );
  }
}

// Over the paper view, laying out the pages: the view dimmed, the page
// layout's papers on it, scrolling on their own.
const pageLayoutCoverStyle = {
  position: "absolute", top: 0, left: 0, width: "100%", height: "100%", overflow: "auto",
  background: "rgba(48, 52, 58, 0.5)", pointerEvents: "auto",
};

// Where a section's end is, for the caret (see settings.js), as the editor
// has it (see ../../paper/markers.js): "below" a bar under its last line;
// "bottomRight" beside it, at the right edge; "none" not at all - no
// section end among the markers the caret goes to.
function sectionEnds(settings) {
  const where = settings.sectionEnds;
  return {
    sectionEnds: where === "below" ? "below" : "beside",
    markerTypes: where === "none" ? { ...settings.markerTypes, sectionEnd: false } : settings.markerTypes,
  };
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

import { Component, callback, frozen } from "@liquefy/cascade.component";
import { div } from "@liquefy/cascade.dom";
import { checkbox } from "@liquefy/cascade.ui";
import { pageLayoutEditor, newElement } from "../../paper/PageLayoutEditor.js";
import { elementEntry } from "../../paper/pageElementMenu.js";
import { removeButton } from "../../shell/removeButton.js";
import { takeFocus, releaseFocus, menuNote as note } from "../../shell/contextMenus.js";
import { ownPageSettings } from "../../shell/pageSettingsMenu.js";
import { surfaceInset, surfacePadding } from "../../shell/spacing.js";
import { formatIn } from "../../model/pageLayout.js";

/**
 * PageEditor - a page of its own (see index.js), edited as a structured
 * text's page layout is (see ../../paper/PageLayoutEditor.js), but on its
 * own, in the column of documents: its one paper, what's on it pressed to
 * select it, dragged to move it, by its corner resized - and anything from
 * the creation menu put on it (`insertPlace()` "page"), in its middle, or
 * dragged onto it, where it's dropped.
 *
 * Laid out with the rest of the file (`paperSequence`, where it's laid out
 * - see ../../shell/documents.js): on the paper its page settings make,
 * numbered as it falls. Its menu: its page settings, the file's or its
 * own - and, for the element selected, its own (see
 * ../../paper/pageElementMenu.js).
 */
export class PageEditor extends Component {
  setProperties({ model, zoom = 1, onRemove, paperSequence }) {
    this.model = model;
    this.zoom = zoom;
    this.onRemove = onRemove || null;
    this.paperSequence = paperSequence || null;
  }

  initialState() {
    // pageSettingsShown: its page settings' controls shown, none of its
    // own yet (see ../../shell/pageSettingsMenu.js).
    return { selectedElement: null, pageSettingsShown: false };
  }

  // Its paper: as it's laid out - or, not laid out, as its page settings
  // make it (see ../../model/pageLayout.js).
  format() {
    return (this.paperSequence && this.paperSequence.pages[0]) || formatIn(this, this.model.pageLayout);
  }

  pageFormat() {
    return this.format();
  }

  // Its page number - as it falls, among pages of their own.
  pageNumber() {
    const pages = this.paperSequence;
    return pages ? { page: pages.numberOf(0), pages: pages.lastNumberOf(0) } : { page: 1, pages: 1 };
  }

  selectElement(selection) {
    this.selectedElement = selection ? frozen(selection) : null;
    takeFocus(this);
  }

  // See ../../shell/contextMenus.js.
  insertPlace() {
    return "page";
  }

  insert(content) {
    const format = this.format();
    const element = newElement(content, format, { x: format.width / 2, y: format.height / 2 }, { verso: format.side === "verso" });
    this.model.pageLayout.first.push(element);
    this.selectElement({ element, kind: "first" });
    return true;
  }

  contextPath() {
    const path = [{
      key: "document",
      icon: "note",
      title: "Page",
      details: () => [note("A page of its own - pictures, shapes and page numbers on it, where you put them.")],
      build: () => this.menu(),
    }];
    if (this.selectedElement) path.push(elementEntry(this, this.selectedElement, "the page"));
    return path;
  }

  // Its page settings - the file's, or its own too (see
  // ../../shell/pageSettingsMenu.js) - and its page numbers.
  menu() {
    const { model } = this;
    return [
      ...ownPageSettings({
        key: "pageSettings",
        layout: model.pageLayout,
        shown: this.pageSettingsShown,
        show: (shown) => { this.pageSettingsShown = shown; },
        inherited: (key) => this.inherit(key),
      }),
      note("What's on it stays as far from the edges nearest it as it is."),
      checkbox({
        key: "startsNumbering",
        label: "Start new page numbering",
        checked: model.startsNumbering,
        onChange: callback("startsNumbering", (checked) => { model.startsNumbering = checked; }),
      }),
      placing(),
    ];
  }

  onDispose() {
    releaseFocus(this);
    super.onDispose();
  }

  build() {
    const zoomed = (millimetres) => `calc(${millimetres}mm * ${this.zoom})`;
    return div(
      { style: { position: "relative" } },
      pageLayoutEditor({
        key: "page",
        document: this.model,
        zoom: this.zoom,
        kinds: ["first"],
        margins: false,
        paperFormat: this.format(),
        page: this.pageNumber(),
        selected: this.selectedElement,
        onSelect: callback("select", (selection) => this.selectElement(selection)),
        takeDragged: callback("takeDragged", () => {
          const menus = this.inherit("contextMenus");
          return menus ? menus.takeDragged() : null;
        }),
        style: { padding: surfacePadding, gap: 0 },
      }),
      this.onRemove ? removeButton(this.onRemove, { left: zoomed(surfaceInset.horizontal), top: zoomed(surfaceInset.vertical) }) : null,
    );
  }
}

export const pageEditor = (...parameters) => new PageEditor(...parameters);

const placing = () => note("Create pictures, shapes and page numbers on it from the creation menu - or drag them onto it.");

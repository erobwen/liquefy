import { Component, callback, frozen } from "@liquefy/cascade.component";
import { div } from "@liquefy/cascade.dom";
import { button, checkbox, row } from "@liquefy/cascade.ui";
import { paperSizes } from "../../print/index.js";
import { pageLayoutEditor, newElement } from "../../paper/PageLayoutEditor.js";
import { elementEntry } from "../../paper/pageElementMenu.js";
import { removeButton } from "../../shell/removeButton.js";
import { takeFocus, releaseFocus, menuHeading as heading, menuNote as note } from "../../shell/contextMenus.js";
import { surfaceInset, surfacePadding } from "../../shell/spacing.js";
import { pageFormat } from "./model.js";

/**
 * PageEditor - a page of its own (see index.js), edited as a structured
 * text's page layout is (see ../../paper/PageLayoutEditor.js), but on its
 * own, in the column of documents: its one paper, what's on it pressed to
 * select it, dragged to move it, by its corner resized - and anything from
 * the creation menu put on it (`insertPlace()` "page"), in its middle, or
 * dragged onto it, where it's dropped.
 *
 * Its menu: its paper - A4 or Letter, upright or on its side; among pages
 * of their own in another document (`paperSequence`, where it's laid out -
 * see ../../shell/documents.js), that one's, and nothing to choose - and,
 * for the element selected, its own (see ../../paper/pageElementMenu.js).
 */
export class PageEditor extends Component {
  setProperties({ model, zoom = 1, onRemove, paperSequence }) {
    this.model = model;
    this.zoom = zoom;
    this.onRemove = onRemove || null;
    this.paperSequence = paperSequence || null;
  }

  initialState() {
    return { selectedElement: null };
  }

  // Its paper: as it's laid out, among pages of their own - its own, on its
  // own.
  format() {
    return (this.paperSequence && this.paperSequence.pages[0]) || pageFormat(this.model);
  }

  // Its page number - as it falls, among pages of their own.
  pageNumber() {
    const pages = this.paperSequence;
    return pages ? { page: pages.numberOf(0), pages: pages.lastNumber() } : { page: 1, pages: 1 };
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

  menu() {
    const { model } = this;
    // Among pages of their own in another document: on its paper - or its
    // own, as chosen.
    const own = this.paperSequence
      ? [checkbox({ key: "ownPaper", label: "Its own paper", checked: model.ownPaper, onChange: callback("ownPaper", (checked) => { model.ownPaper = checked; }) })]
      : [];
    if (this.paperSequence && !model.ownPaper) {
      return [heading("Paper"), ...own, note("On the paper of the document it's in - its size, its sides."), placing()];
    }
    const { width, height } = model.paper;
    const landscape = width > height;
    const short = Math.min(width, height);
    const long = Math.max(width, height);
    const setPaper = (paper, sideways) => {
      const across = Math.min(paper.width, paper.height);
      const down = Math.max(paper.width, paper.height);
      model.paper = Object.freeze(sideways ? { width: down, height: across } : { width: across, height: down });
    };
    const isSize = (size) => short === Math.min(size.width, size.height) && long === Math.max(size.width, size.height);
    const choice = (key, label, chosen, choose) => button({ key, variant: chosen ? "filled" : undefined }, label, callback(key, choose));
    return [
      heading("Paper"),
      ...own,
      row(
        { key: "size", style: { gap: "6px" } },
        choice("A4", "A4", isSize(paperSizes.A4), () => setPaper(paperSizes.A4, landscape)),
        choice("letter", "Letter", isSize(paperSizes.letter), () => setPaper(paperSizes.letter, landscape)),
      ),
      row(
        { key: "orientation", style: { gap: "6px" } },
        choice("portrait", "Portrait", !landscape, () => setPaper(model.paper, false)),
        choice("landscape", "Landscape", landscape, () => setPaper(model.paper, true)),
      ),
      note("What's on it stays as far from the edges nearest it as it is."),
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

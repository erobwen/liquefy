import { Component, callback, frozen } from "@liquefy/cascade.component";
import { div, text, DOMNodeComponent } from "@liquefy/cascade.dom";
import { button, card } from "@liquefy/cascade.ui";
import { cssMm, paperStyle, paperShadow } from "../../print/dom.js";
import { pt } from "../../print/index.js";
import { paperBackdrop } from "../../paper/TabulaPaperView.js";
import { removeButton } from "../../shell/removeButton.js";
import { takeFocus, releaseFocus, menuNote as note } from "../../shell/contextMenus.js";
import { pageSizes, drawPage, choosePdf } from "./pdfjs.js";

/**
 * PdfView - a PDF, as Tabula shows its documents: on paper, its pages one
 * under the other on the paper grey, each on a paper of its own size - the
 * PDF's own, whatever it is - at the app's `zoom`, as a structured text's
 * papers are; on the web, its pages as wide as the card they're in.
 *
 *   pdfView({ model, zoom, onRemove, target })
 *
 * `model`: `{ name, data }` - the file's name, its bytes in base64. With no
 * data yet, a card for choosing one. Its pages are drawn by PDF.js (see
 * pdfjs.js) onto canvases of their own (PdfCanvas), sharp at the zoom
 * they're shown at.
 *
 * A click on it takes the focus (see ../../shell/contextMenus.js): its
 * menu - what it is, how many pages, another file in its place.
 */
export class PdfView extends Component {
  setProperties({ model, zoom = 1, onRemove, target = "paper" }) {
    this.model = model;
    this.zoom = zoom;
    this.onRemove = onRemove || null;
    this.target = target;
  }

  initialState() {
    // pages: the sizes of its pages in points, once read - for the data
    // they were read from (`readFrom`). error: why it couldn't be read.
    return { pages: null, readFrom: null, error: null };
  }

  onEstablish() {
    super.onEstablish();
    this.read();
  }

  onDispose() {
    releaseFocus(this);
    super.onDispose();
  }

  // Its pages' sizes, read from its data - again whenever that's another.
  async read() {
    const data = this.model.data;
    if (!data || data === this.readFrom) return;
    try {
      const pages = await pageSizes(this.model);
      if (this.model.data !== data) return;
      this.pages = frozen(pages);
      this.readFrom = data;
      this.error = null;
    } catch (error) {
      this.error = "Couldn't read it: " + error.message;
    }
  }

  async choose() {
    try {
      const file = await choosePdf();
      if (!file) return;
      this.model.name = file.name;
      this.model.data = file.data;
      this.pages = null;
      await this.read();
    } catch (error) {
      this.error = "Couldn't open it: " + error.message;
    }
  }

  // See ../../shell/contextMenus.js.
  contextPath() {
    const { model } = this;
    const count = this.pages ? this.pages.length : null;
    return [{
      key: "document",
      icon: "picture_as_pdf",
      title: model.name || "PDF",
      details: () => [note("A PDF - its pages as they are, kept in the file it's saved in.")],
      build: () => [
        count !== null ? note(count + (count === 1 ? " page" : " pages")) : null,
        button({ key: "choose" }, model.data ? "Another PDF…" : "Choose a PDF…", callback("choose", () => this.choose())),
      ],
    }];
  }

  build() {
    const { model } = this;
    const focus = callback("focus", () => takeFocus(this));
    if (!model.data) return this.chooser(focus);
    const pages = this.pages;
    if (this.target === "web") {
      return div(
        { onmousedown: focus, style: { display: "flex", flexDirection: "column", gap: "16px" } },
        this.error ? note(this.error) : null,
        (pages || []).map((size, index) => new PdfCanvas({
          key: "page" + (index + 1), model, number: index + 1, scale: 1.5,
          style: { width: "100%", height: "auto", boxShadow: paperShadow },
        })),
      );
    }
    const corner = `calc(8mm * ${this.zoom})`;
    return div(
      { style: { position: "relative" }, onmousedown: focus },
      div(
        { style: { ...columnStyle, zoom: this.zoom } },
        this.error ? note(this.error) : null,
        (pages || []).map((size, index) => {
          const format = { width: pt(size.width), height: pt(size.height) };
          return div(
            { key: "paper" + (index + 1), "data-pdf-page": index + 1, style: { ...paperStyle(format), boxShadow: paperShadow } },
            new PdfCanvas({ key: "canvas" + (index + 1), model, number: index + 1, scale: this.zoom, style: { display: "block", width: cssMm(format.width), height: cssMm(format.height) } }),
          );
        }),
      ),
      this.onRemove ? removeButton(this.onRemove, { left: corner, top: corner }) : null,
    );
  }

  // No PDF yet: a card, on the paper grey, for choosing one.
  chooser(focus) {
    return div(
      { onmousedown: focus, style: { ...columnStyle, position: "relative" } },
      card(
        { style: { position: "relative", width: "340px", display: "flex", flexDirection: "column", gap: "8px" } },
        this.onRemove ? removeButton(this.onRemove) : null,
        div({ style: { fontWeight: "bold" } }, text("PDF")),
        note("A PDF document, its pages shown as they are - kept in the file this is saved in."),
        this.error ? note(this.error) : null,
        button({ key: "choose", variant: "filled" }, "Choose a PDF…", callback("choose", () => this.choose())),
      ),
    );
  }
}

export const pdfView = (...parameters) => new PdfView(...parameters);

const columnStyle = {
  display: "flex", flexDirection: "column", alignItems: "center", gap: "8mm", padding: "8mm",
  background: paperBackdrop, boxSizing: "border-box", width: "fit-content", minWidth: "100%",
};

/**
 * One page of a PDF, drawn onto a canvas of its own: page `number` (from 1)
 * of `model`'s PDF, `scale` the zoom it's shown at - drawn as sharp as the
 * screen shows it there, again whenever either changes. Its element is its
 * own (a DOMNodeComponent), the canvas drawn on directly.
 */
export class PdfCanvas extends DOMNodeComponent {
  setProperties({ model, number, scale = 1, style }) {
    this.model = model;
    this.number = number;
    this.scale = scale;
    this.style = frozen(style || {});
  }

  ensureNode() {
    const u = this.unobservable;
    let canvas = u.node;
    if (!canvas) {
      canvas = document.createElement("canvas");
      this.assignDebugId(canvas);
    }
    u.node = canvas;
    Object.assign(canvas.style, this.style);
    // Points to CSS pixels, at the zoom, on this screen.
    const scale = this.scale * (96 / 72) * (globalThis.devicePixelRatio || 1);
    const data = this.model.data;
    if (u.drawn !== data + "|" + this.number + "|" + scale) {
      u.drawn = data + "|" + this.number + "|" + scale;
      drawPage(this.model, this.number, canvas, scale).catch(() => {});
    }
    return canvas;
  }
}

import { Component, callback, frozen } from "@liquefy/cascade.component";
import { div, span, text } from "@liquefy/cascade.dom";
import { cssMm, paperStyle, runStyle, paperShadow } from "../print/dom.js";
import { mm } from "../print/index.js";
import { pageKinds, elementRect, placeElement, PageElement, isVerso } from "../model/pageLayout.js";
import { formatOfPage } from "../print/index.js";
import { gutterShade } from "./TabulaPaperView.js";
import { frameKind } from "../model/frames.js";
import { frameView } from "./FrameView.js";
import { pageElementView } from "./PageElementView.js";

/**
 * PageLayoutEditor - a document's page layout, edited (see
 * ../model/pageLayout.js): three papers, one under the other - its first
 * page, its middle pages, its last - each as the layout draws it, and on
 * each, faintly, the text that's on that page now (`sequence`, the
 * document laid out, read only): what the layout does to the text, seen
 * together - nothing to select, nothing to edit.
 *
 *   pageLayoutEditor({ document, sequence, zoom, selected, onSelect, onWrite, takeDragged })
 *
 *  - The margins, a dashed blue line each, all the way across: dragged,
 *    the margin follows - the same on every page, the text flowing anew.
 *  - The elements: pressed, selected (`onSelect({ element, kind })`, or
 *    null, pressed beside them) - dragged, moved; by their corner handle,
 *    resized - measured, as they go, from the edges nearest them
 *    (placeElement()). The one selected (`selected`) shows what it's
 *    measured from: a blue line across, to the edge it's measured from, and
 *    one down, to the other.
 *  - Something dropped on a paper - dragged from the creation menu -
 *    becomes an element there, where it's dropped: `takeDragged()` gives
 *    what's being dragged (see ../shell/contextMenus.js).
 *  - A double click inside the margins, or Escape: back to writing
 *    (`onWrite()`).
 *  - Delete or Backspace: the element selected taken out.
 *
 * Printed on both sides (the page layout's `duplex`), each paper is the
 * side its page is - the first a right-hand page, the middle ones shown as
 * the second, a left-hand one, the last as it falls - mirrored as it's
 * printed: its inner margin, and everything measured from the inner side,
 * by the binding, its shade there.
 *
 * Drawn on nothing: on whatever it's shown over (see
 * ../plugins/structuredText/StructuredTextEditor.js - a modal over the
 * paper view).
 */
export class PageLayoutEditor extends Component {
  setProperties({ document, sequence, zoom = 1, selected = null, onSelect, onWrite, takeDragged }) {
    this.document = document;
    this.sequence = sequence;
    this.zoom = zoom;
    this.selected = frozen(selected);
    this.onSelect = onSelect || (() => {});
    this.onWrite = onWrite || (() => {});
    this.takeDragged = takeDragged || (() => null);
  }

  initialUnobservables() {
    return { endDrag: null, removeEscape: null };
  }

  // Escape, wherever the keyboard is: back to writing.
  onEstablish() {
    super.onEstablish();
    if (typeof(document) === "undefined") return;
    const escape = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      this.onWrite();
    };
    document.addEventListener("keydown", escape);
    this.unobservable.removeEscape = () => document.removeEventListener("keydown", escape);
  }

  onDispose() {
    const u = this.unobservable;
    if (u.endDrag) u.endDrag();
    if (u.removeEscape) u.removeEscape();
    super.onDispose();
  }

  // The paper: the document's, its margins the page layout's - printed on
  // both sides, page `index` (from 0) as that side of a sheet has it (see
  // ../print/Section.js's formatOfPage()).
  format(index = 0) {
    const { paper, pageLayout } = this.document;
    const sides = pageLayout.duplex ? { duplex: true, side: "recto" } : {};
    return formatOfPage({ width: paper.width, height: paper.height, margins: pageLayout.margins, ...sides }, index, 0);
  }

  // Which page each paper stands for, as a side: the first; the middle, the
  // second; the last, as it falls - the third, at least.
  pageIndex(kind) {
    if (kind === "first") return 0;
    if (kind === "middle") return 1;
    return Math.max(this.sequence.pages.length - 1, 2);
  }

  // Which page of the text each paper shows: the first; the middle - the
  // second, with a third after it; the last - with more than one.
  textPage(kind) {
    const count = this.sequence.pages.length;
    if (kind === "first") return 0;
    if (kind === "middle") return count > 2 ? 1 : null;
    return count > 1 ? count - 1 : null;
  }

  build() {
    const count = this.sequence.pages.length;
    return div(
      {
        tabindex: 0,
        onkeydown: callback("key", (event) => this.key(event)),
        style: {
          display: "flex", flexDirection: "column", alignItems: "center", gap: "3mm", padding: "6mm 8mm 8mm",
          boxSizing: "border-box", width: "fit-content", minWidth: "100%", zoom: this.zoom, outline: "none",
        },
      },
      pageKinds.map(({ name, label }) => div(
        { key: "page" + name, style: { display: "flex", flexDirection: "column", gap: "2mm" } },
        div({ style: labelStyle }, text(label + (this.textPage(name) === null ? " - none yet" : name === "middle" ? " - " + Math.max(0, count - 2) + " now" : ""))),
        new LayoutPaper({
          key: "paper" + name,
          kind: name,
          editor: this,
          format: this.format(this.pageIndex(name)),
          verso: isVerso(this.document.pageLayout, this.pageIndex(name)),
          textPage: this.textPage(name),
          pages: Math.max(count, 1),
          selected: this.selected && this.selected.kind === name ? this.selected.element : null,
        }),
      )),
    );
  }

  key(event) {
    if ((event.key === "Delete" || event.key === "Backspace") && this.selected) {
      event.preventDefault();
      this.remove(this.selected.element, this.selected.kind);
    }
  }

  remove(element, kind) {
    const list = this.document.pageLayout[kind];
    const index = list.indexOf(element);
    if (index >= 0) list.splice(index, 1);
    this.onSelect(null);
  }

  // A point on screen, on a paper's element: in µm from its top left corner.
  pointOn(paper, event) {
    const rect = paper.getBoundingClientRect();
    const { width, height } = this.format();
    return { x: (event.clientX - rect.left) / rect.width * width, y: (event.clientY - rect.top) / rect.height * height };
  }

  // Following the mouse, held down: `move(point)` with each move - points on
  // `paper` - until it's let go.
  follow(event, paper, move) {
    const u = this.unobservable;
    if (u.endDrag) u.endDrag();
    const doc = event.currentTarget.ownerDocument;
    const onMove = (moved) => move(this.pointOn(paper, moved));
    const end = () => {
      doc.removeEventListener("mousemove", onMove);
      doc.removeEventListener("mouseup", end);
      u.endDrag = null;
    };
    doc.addEventListener("mousemove", onMove);
    doc.addEventListener("mouseup", end);
    u.endDrag = end;
  }

  // An element pressed: selected - and moved, or by its handle resized, as
  // the mouse goes - on a left-hand page, as it's shown there: mirrored.
  pressElement(event, element, kind, verso = false) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.closest("[tabindex]").focus();
    this.onSelect({ element, kind });
    const paper = event.currentTarget.closest("[data-layout-page]");
    const format = this.format();
    const start = this.pointOn(paper, event);
    const from = elementRect(element, format, verso);
    const resizing = !!event.target.closest("[data-handle]");
    this.follow(event, paper, (point) => {
      const dx = point.x - start.x;
      const dy = point.y - start.y;
      const rect = resizing
        ? { ...from, width: Math.max(mm(2), from.width + dx), height: Math.max(mm(2), from.height + dy) }
        : { ...from, x: from.x + dx, top: from.top + dy };
      placeElement(element, rect, format, verso);
    });
  }

  // A margin's line pressed: the margin follows the mouse - leaving the text
  // at least 20 mm each way. On a left-hand page, the one on the left is the
  // outer margin - the page layout's right one - and the other way round.
  pressMargin(event, side, verso = false) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const paper = event.currentTarget.closest("[data-layout-page]");
    const layout = this.document.pageLayout;
    const { width, height } = this.format();
    this.follow(event, paper, (point) => {
      // As this paper shows them.
      const { margins } = this.format(verso ? 1 : 0);
      const room = mm(20);
      const value = {
        top: Math.min(point.y, height - margins.bottom - room),
        bottom: Math.min(height - point.y, height - margins.top - room),
        left: Math.min(point.x, width - margins.right - room),
        right: Math.min(width - point.x, width - margins.left - room),
      }[side];
      const rounded = Math.max(0, Math.round(value / 500) * 500);
      const which = verso && side === "left" ? "right" : verso && side === "right" ? "left" : side;
      if (rounded !== layout.margins[which]) layout.margins = Object.freeze({ ...layout.margins, [which]: rounded });
    });
  }

  // Something dragged from the creation menu, dropped on a paper: an
  // element there, centred where it's dropped - selected.
  drop(event, kind, verso = false) {
    event.preventDefault();
    const content = this.takeDragged();
    if (!content) return;
    const paper = event.currentTarget;
    const element = newElement(content, this.format(), this.pointOn(paper, event), { verso });
    this.document.pageLayout[kind].push(element);
    this.onSelect({ element, kind });
  }

  // A double click inside the margins: back to the text.
  doubleClick(event, verso = false) {
    const paper = event.currentTarget;
    const { x, y } = this.pointOn(paper, event);
    const { width, height, margins } = this.format(verso ? 1 : 0);
    if (x > margins.left && x < width - margins.right && y > margins.top && y < height - margins.bottom) this.onWrite();
  }
}

export const pageLayoutEditor = (...parameters) => new PageLayoutEditor(...parameters);

// A new element holding `content`, centred at `center` on a paper of
// `{ width, height }` - 50 mm wide, as tall as its kind's proportions make
// it - on the paper, all of it, however near an edge it's put - measured
// from the edges nearest it (on a left-hand page, `verso`, as it's shown
// there, mirrored). Moved, it can go over the edge: a bleed.
export function newElement(content, paper, center, { width = mm(50), verso = false } = {}) {
  const kind = frameKind({ content });
  const ratio = (kind && kind.aspectRatio && kind.aspectRatio(content.model)) || 4 / 3;
  const height = Math.round(width / ratio);
  const element = new PageElement({ content, width, height });
  const within = (value, room) => Math.max(0, Math.min(room, value));
  placeElement(element, { x: within(center.x - width / 2, paper.width - width), top: within(center.y - height / 2, paper.height - height), width, height }, paper, verso);
  return element;
}

// One of the three papers: its elements, the text of the page it stands
// for, faintly, its margins - and, for the element selected, what it's
// measured from.
class LayoutPaper extends Component {
  setProperties({ kind, editor, format, verso = false, textPage, pages, selected }) {
    this.kind = kind;
    this.verso = !!verso;
    this.editor = editor;
    this.format = frozen(format);
    this.textPage = textPage;
    this.pages = pages;
    this.selected = selected;
  }

  build() {
    const { kind, editor, format, selected, verso } = this;
    const layout = editor.document.pageLayout;
    // Which page it stands for, for a page number: the first, the second,
    // the last.
    const page = { page: kind === "first" ? 1 : kind === "middle" ? 2 : this.pages, pages: this.pages };
    return div(
      {
        "data-layout-page": kind,
        onmousedown: callback("deselect", (event) => { if (event.button === 0) editor.onSelect(null); }),
        ondblclick: callback("doubleClick", (event) => editor.doubleClick(event, verso)),
        ondragover: callback("dragOver", (event) => event.preventDefault()),
        ondrop: callback("drop", (event) => editor.drop(event, kind, verso)),
        style: { ...paperStyle(format), boxShadow: paperShadow },
      },
      this.text(),
      layout[kind].map((element) => pageElementView({
        key: "element" + element.causality.id,
        element,
        rect: elementRect(element, format, verso),
        page,
        selected: element === selected,
        onPress: callback("press" + element.causality.id, (event) => editor.pressElement(event, element, kind, verso)),
      })),
      ["top", "right", "bottom", "left"].map((side) => marginLine(side, format, callback("margin" + side, (event) => editor.pressMargin(event, side, verso)))),
      selected ? referenceLines(elementRect(selected, format, verso), selected, format, verso) : null,
      gutterShade(format.side),
    );
  }

  // The text on the page it stands for - shown, faintly, under the rest.
  text() {
    if (this.textPage === null) return null;
    const runs = [];
    for (const line of this.editor.sequence.linesOf(this.textPage)) {
      for (const run of line.runs) if (!run.frame) runs.push(span({ style: runStyle(line, run) }, text(run.text)));
      for (const frame of line.frames || []) runs.push(frameView({ key: "frame" + frame.source.causality.id, frame }));
    }
    return div({ key: "text", style: { position: "absolute", inset: 0, opacity: 0.4, pointerEvents: "none", userSelect: "none" } }, runs);
  }
}

// A margin: a dashed line across the paper, where the text area ends - with
// room either side of it to take hold of.
function marginLine(side, format, onPress) {
  const across = side === "top" || side === "bottom";
  const at = { top: format.margins.top, bottom: format.height - format.margins.bottom, left: format.margins.left, right: format.width - format.margins.right }[side];
  const grip = 6;
  return div(
    {
      key: "margin" + side,
      "data-margin": side,
      title: side[0].toUpperCase() + side.slice(1) + " margin: " + (format.margins[side] / 1000) + " mm - drag it",
      onmousedown: onPress,
      style: across
        ? { position: "absolute", left: 0, right: 0, top: `calc(${cssMm(at)} - ${grip}px)`, height: grip * 2 + "px", cursor: "row-resize" }
        : { position: "absolute", top: 0, bottom: 0, left: `calc(${cssMm(at)} - ${grip}px)`, width: grip * 2 + "px", cursor: "col-resize" },
    },
    div({ style: across
      ? { position: "absolute", left: 0, right: 0, top: grip + "px", borderTop: "1px dashed rgba(66, 133, 244, 0.7)" }
      : { position: "absolute", top: 0, bottom: 0, left: grip + "px", borderLeft: "1px dashed rgba(66, 133, 244, 0.7)" } }),
  );
}

// What an element is measured from: a line across, from its side to the
// paper's edge it's measured from, and one down - each saying how far. On a
// left-hand page, the inner side - "left" - is on the right.
function referenceLines(rect, element, format, verso = false) {
  const middleY = rect.top + rect.height / 2;
  const middleX = rect.x + rect.width / 2;
  const onLeft = (element.horizontal === "left") !== verso;
  const across = onLeft ? { from: 0, to: rect.x } : { from: rect.x + rect.width, to: format.width };
  const down = element.vertical === "top" ? { from: 0, to: rect.top } : { from: rect.top + rect.height, to: format.height };
  return [
    div({ key: "across", "data-reference": "horizontal", style: { ...referenceStyle, left: cssMm(across.from), width: cssMm(across.to - across.from), top: cssMm(middleY), height: 0, borderTop: "1.5px solid #4285f4" } },
      distance(element.x, { left: "50%", top: "2px", transform: "translateX(-50%)" })),
    div({ key: "down", "data-reference": "vertical", style: { ...referenceStyle, top: cssMm(down.from), height: cssMm(down.to - down.from), left: cssMm(middleX), width: 0, borderLeft: "1.5px solid #4285f4" } },
      distance(element.y, { top: "50%", left: "4px", transform: "translateY(-50%)" })),
  ];
}

const distance = (micrometers, place) => span(
  { style: { position: "absolute", ...place, fontFamily: "sans-serif", fontSize: "9px", color: "#1a73e8", background: "rgba(255, 255, 255, 0.85)", padding: "0 2px", whiteSpace: "nowrap" } },
  text(Math.round(micrometers / 100) / 10 + " mm"),
);

const referenceStyle = { position: "absolute", pointerEvents: "none" };
const labelStyle = { fontFamily: "sans-serif", fontSize: "12px", color: "white", marginTop: "2mm", textShadow: "0 1px 2px rgba(0, 0, 0, 0.4)" };

import { Component, frozen } from "@liquefy/cascade.component";
import { div, span, text } from "@liquefy/cascade.dom";
import { cssMm, paperStyle, runStyle, paperShadow, placeholderColor } from "../print/dom.js";
import { frameView } from "./FrameView.js";
import { pageElementView, pagesInDocuments } from "./PageElementView.js";
import { pageElements } from "../model/pageLayout.js";
import { surfacePadding, paperGap } from "../shell/spacing.js";

/**
 * TabulaPaperView - Tabula's papers on screen: cascade.print's
 * PaperSequenceView, with Tabula's caret - in the text, or at a flow's start
 * or end beside it (see markers.js) - and the areas the markers stand for.
 *
 * A paper sequence on screen: its papers, white with a slight shadow, one
 * under the other on a grey background, each with the text laid out on it.
 *
 *   tabulaPaperView({ sequence, zoom: 1.25, caret, selection })
 *
 * Drawn at real size - a paper's millimeters are CSS millimeters - and
 * scaled by `zoom` (CSS zoom, so the room it takes up scales too, and so do
 * scroll bars around it).
 *
 * `caret`, if given, is drawn on its paper, blinking - a vertical bar,
 * { page, x, top, height } in µm, or, at a section's end below its last
 * line, a horizontal one, { page, x, width, y, marker: true } (see
 * positions.js's caretAt()) - with
 * `blink`, a count to change whenever the caret moves, so it restarts its
 * blink shown.
 * A paper printed on both sides - its format's `side`, see
 * ../print/Section.js's formatOfPage() - shows where it's bound: a shade
 * along its inner edge (gutterShade()), on the left of a right-hand page,
 * the right of a left-hand one. On screen only: nothing printed.
 * Between the papers, pages of their own (inner sequences, see
 * ../model/sequences.js) - where the paper sequence says they go, each made
 * by `renderInsert(insert)`, given.
 * Under everything else, what its page layout draws on each paper (see
 * ../model/pageLayout.js) - a paper's format says which, its `pageLayout`.
 * `areas`, if given, are drawn under everything but that - under the
 * selection, under the text: rectangles, [{ page, x, top, width, height }]
 * in µm - what a marker stands for (see markers.js) - each a faint, light blue,
 * see-through box with a slightly stronger 1px edge.
 * `outlines`, if given, are drawn the same, but with no fill - an edge
 * only: the flow the caret is in.
 * `offsetMarks`, if given, each a title's box - a section with a title
 * offset - get an arrow pointing right, just left of it.
 * `frame`, if given, is the frame anchor the caret is at (see
 * ../model/frames.js): its frame outlined.
 * `selection`, if given, is highlighted under the text: { rects, focused } -
 * rects as positions.js's selectionRects() gives them; blue while the editor
 * has the keyboard, grey while it doesn't.
 *
 * Each paper is a component of its own, reading only its own lines
 * (PaperSequence.linesOf()), and its text is drawn apart from its caret: a
 * change on one paper draws that paper's text again, not the others', and
 * the caret moving draws only the caret. A paper's runs are matched by
 * position, run for run, so what's drawn again is mostly text and positions
 * changing in place.
 *
 * Every paper's element has `data-page` - its index - for finding which
 * paper a click is on.
 */
export class TabulaPaperView extends Component {
  setProperties({ sequence, zoom = 1, caret = null, selection = null, areas = null, outlines = null, offsetMarks = null, frame = null, renderInsert = null, style }) {
    this.sequence = sequence;
    this.renderInsert = renderInsert;
    this.frame = frame;
    this.zoom = zoom;
    this.caret = frozen(caret);
    this.selection = frozen(selection);
    this.areas = frozen(areas || []);
    this.outlines = frozen(outlines || []);
    this.offsetMarks = frozen(offsetMarks || []);
    this.style = frozen(style || {});
  }

  onShow() {
    addCaretKeyframes(document);
  }

  build() {
    const { sequence, caret, selection, areas, outlines, offsetMarks } = this;
    const highlight = selection && selection.focused ? selectedColor : unfocusedSelectedColor;
    const pages = pagesInDocuments(sequence.pages);
    return div(
      {
        style: {
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: paperGap + "mm",
          padding: surfacePadding,
          background: paperBackdrop,
          boxSizing: "border-box",
          width: "fit-content",
          minWidth: "100%",
          zoom: this.zoom,
          ...this.style,
        },
      },
      sequence.pages.map((format, index) => [
        this.inserts(index, true),
        new PaperView({
          key: "paper" + index,
          sequence,
          index,
          format,
          caret: caret && caret.page === index ? caret : null,
          highlights: selection ? selection.rects.filter((rect) => rect.page === index) : [],
          highlight,
          areas: areas.filter((rect) => rect.page === index),
          outlines: outlines.filter((rect) => rect.page === index),
          offsetMarks: offsetMarks.filter((rect) => rect.page === index),
          frame: this.frame,
          // Which page of its document's page layout it is - and its number,
          // as the paper sequence counts (see ../print/PaperSequence.js).
          page: { ...pages[index], number: sequence.numberOf(index), last: sequence.lastNumberOf(index) },
        }),
        this.inserts(index, false),
      ]),
    );
  }

  // Pages of their own between the papers (see ../print/PaperSequence.js's
  // `inserts`): before paper `index`, or after it - each as `renderInsert`
  // makes it, from what the paper sequence says.
  inserts(index, before) {
    if (!this.renderInsert) return null;
    return this.sequence.inserts
      .filter((insert) => insert.page === index && insert.before === before)
      .map((insert) => this.renderInsert(insert));
  }
}

// Where a paper printed on both sides is bound (see above): a shade along
// its inner edge, from dark at the edge to nothing - none on a paper printed
// on one side.
export function gutterShade(side) {
  if (side !== "recto" && side !== "verso") return null;
  const left = side === "recto";
  return div({
    key: "gutter",
    "data-gutter": side,
    style: {
      position: "absolute", top: 0, bottom: 0, width: gutterWidth + "px", pointerEvents: "none",
      [left ? "left" : "right"]: 0,
      background: `linear-gradient(to ${left ? "right" : "left"}, rgba(60, 64, 67, 0.32), rgba(60, 64, 67, 0))`,
    },
  });
}

const gutterWidth = 16;

// The grey the papers lie on - for whatever goes around them to match.
export const paperBackdrop = "#d9dce1";

export function tabulaPaperView(...parameters) {
  return new TabulaPaperView(...parameters);
}

class PaperView extends Component {
  setProperties({ sequence, index, format, caret, highlights, highlight, areas, outlines, offsetMarks, frame, page }) {
    this.sequence = sequence;
    this.page = frozen(page);
    this.frame = frame || null;
    this.index = index;
    this.format = frozen(format);
    this.caret = frozen(caret);
    this.highlights = frozen(highlights);
    this.highlight = highlight;
    this.areas = frozen(areas || []);
    this.outlines = frozen(outlines || []);
    this.offsetMarks = frozen(offsetMarks || []);
  }

  // What its page layout draws on it - this page of its document's,
  // numbered as it's numbered.
  elements() {
    const { index, count, number, last } = this.page;
    return pageElements(this.format.pageLayout, index, count, this.format).map(({ element, rect }) => pageElementView({
      key: "element" + element.causality.id, element, rect, page: { page: number, pages: last },
    }));
  }

  build() {
    const caret = this.caret;
    return div(
      { "data-page": this.index, style: { ...paperStyle(this.format), boxShadow: paperShadow } },
      // Under the text: drawn first - the areas lowest, then the selection.
      // Keyed, as the text after them is: how many there are comes and goes
      // with the caret and the selection. Lowest of all, the page layout's.
      this.elements(),
      this.areas.map((rect, index) => div({ key: "area" + index, "data-area": "", style: areaStyle(rect) })),
      this.outlines.map((rect, index) => div({ key: "outline" + index, "data-outline": "", style: outlineStyle(rect) })),
      this.offsetMarks.map((rect, index) => div({ key: "offset" + index, "data-offset": "", style: offsetMarkStyle(rect) }, text("→"))),
      this.highlights.map((rect, index) => div({ key: "highlight" + index, "data-selection": "", style: highlightStyle(rect, this.highlight) })),
      new PaperText({ key: "text", sequence: this.sequence, index: this.index, frame: this.frame }),
      caret ? div({ key: "caret", "data-caret": "", style: caretStyle(caret) }) : null,
      gutterShade(this.format.side),
    );
  }
}

// The text on one paper: its runs, in a row - and its frames (see
// FrameView.js), keyed by their anchors, `frame` the one the caret is at.
class PaperText extends Component {
  setProperties({ sequence, index, frame }) {
    this.sequence = sequence;
    this.index = index;
    this.frame = frame;
  }

  build() {
    const runs = [];
    const frames = [];
    for (const line of this.sequence.linesOf(this.index)) {
      for (const run of line.runs) if (!run.frame) runs.push(span({ style: runStyle(line, run) }, text(run.text)));
      for (const frame of line.frames || []) {
        frames.push(frameView({ key: "frame" + frame.source.causality.id, frame, selected: frame.source === this.frame }));
      }
    }
    return [...runs, ...frames];
  }
}

// A marker's area: a faint, see-through light blue, its edge a little
// stronger.
function areaStyle(rect) {
  return {
    position: "absolute",
    left: cssMm(rect.x),
    top: cssMm(rect.top),
    width: cssMm(rect.width),
    height: cssMm(rect.height),
    boxSizing: "border-box",
    background: "rgba(66, 133, 244, 0.07)",
    border: "1px solid " + placeholderColor,
    pointerEvents: "none",
  };
}

// What the caret is in, outlined: as a marker's area, but no fill - its
// edge only, a little stronger.
function outlineStyle(rect) {
  return { ...areaStyle(rect), background: "none", border: "1px solid rgba(66, 133, 244, 0.5)" };
}

// A title set further down than its place makes it (its section's title
// offset): an arrow pointing right, just left of its box, level with it.
function offsetMarkStyle(rect) {
  const width = 5000;
  return {
    position: "absolute",
    left: cssMm(rect.x - width - 1000),
    top: cssMm(rect.top),
    width: cssMm(width),
    height: cssMm(rect.height),
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    fontFamily: "sans-serif",
    fontSize: "11pt",
    color: "rgba(66, 133, 244, 0.85)",
    pointerEvents: "none",
  };
}

const selectedColor = "#b4d5fe";
const unfocusedSelectedColor = "#dadada";

function highlightStyle(rect, color) {
  return {
    position: "absolute",
    left: cssMm(rect.x),
    top: cssMm(rect.top),
    width: cssMm(rect.width),
    height: cssMm(rect.height),
    background: color,
    pointerEvents: "none",
  };
}

function caretStyle(caret) {
  // At a section's end below its last line: a horizontal bar across the
  // text area.
  const shape = caret.marker
    ? { left: cssMm(caret.x), top: cssMm(caret.y), width: cssMm(caret.width), height: "0", borderTop: "1.5px solid black", marginTop: "-0.75px" }
    : { left: cssMm(caret.x), top: cssMm(caret.top), height: cssMm(caret.height), width: "0", borderLeft: "1.5px solid black", marginLeft: "-0.75px" };
  return {
    position: "absolute",
    ...shape,
    pointerEvents: "none",
    // Two names for the same blink, taking turns: a new name restarts the
    // animation - shown, at the start of its cycle.
    animation: (caret.blink % 2 ? "cascade-print-caret-a" : "cascade-print-caret-b") + " 1.06s step-end infinite",
  };
}

// The blink, once per document.
function addCaretKeyframes(doc) {
  if (!doc || doc.getElementById("cascade-print-caret-keyframes")) return;
  const style = doc.createElement("style");
  style.id = "cascade-print-caret-keyframes";
  style.textContent = ["a", "b"].map((name) => "@keyframes cascade-print-caret-" + name + " { 0% { opacity: 1; } 50% { opacity: 0; } }").join("\n");
  doc.head.appendChild(style);
}

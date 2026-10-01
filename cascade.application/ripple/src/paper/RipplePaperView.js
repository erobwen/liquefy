import { Component, frozen } from "@liquefy/cascade.component";
import { div, span, text } from "@liquefy/cascade.dom";
import { cssMm, paperStyle, runStyle, paperShadow } from "@liquefy/cascade.print/dom";

/**
 * RipplePaperView - Ripple's papers on screen: cascade.print's
 * PaperSequenceView, with Ripple's caret - which at a gap between parts (see
 * markers.js) is a horizontal bar across the text area.
 *
 * A paper sequence on screen: its papers, white with a slight shadow, one
 * under the other on a grey background, each with the text laid out on it.
 *
 *   ripplePaperView({ sequence, zoom: 1.25, caret, selection })
 *
 * Drawn at real size - a paper's millimeters are CSS millimeters - and
 * scaled by `zoom` (CSS zoom, so the room it takes up scales too, and so do
 * scroll bars around it).
 *
 * `caret`, if given, is drawn on its paper, blinking - in the text a
 * vertical bar, { page, x, top, height }, at a gap a horizontal one, { page,
 * x, width, y, gap: true }, in µm (see positions.js's caretAt()) - with
 * `blink`, a count to change whenever the caret moves, so it restarts its
 * blink shown.
 * `areas`, if given, are drawn under everything else - under the
 * selection, under the text: rectangles, [{ page, x, top, width, height }]
 * in µm - what a gap stands for (see markers.js) - each a faint, light blue,
 * see-through box with a slightly stronger 1px edge.
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
export class RipplePaperView extends Component {
  setProperties({ sequence, zoom = 1, caret = null, selection = null, areas = null, style }) {
    this.sequence = sequence;
    this.zoom = zoom;
    this.caret = frozen(caret);
    this.selection = frozen(selection);
    this.areas = frozen(areas || []);
    this.style = frozen(style || {});
  }

  onShow() {
    addCaretKeyframes(document);
  }

  build() {
    const { sequence, caret, selection, areas } = this;
    const highlight = selection && selection.focused ? selectedColor : unfocusedSelectedColor;
    return div(
      {
        style: {
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "8mm",
          padding: "8mm",
          background: "#d9dce1",
          boxSizing: "border-box",
          width: "fit-content",
          minWidth: "100%",
          zoom: this.zoom,
          ...this.style,
        },
      },
      sequence.pages.map((format, index) => new PaperView({
        key: "paper" + index,
        sequence,
        index,
        format,
        caret: caret && caret.page === index ? caret : null,
        highlights: selection ? selection.rects.filter((rect) => rect.page === index) : [],
        highlight,
        areas: areas.filter((rect) => rect.page === index),
      })),
    );
  }
}

export function ripplePaperView(...parameters) {
  return new RipplePaperView(...parameters);
}

class PaperView extends Component {
  setProperties({ sequence, index, format, caret, highlights, highlight, areas }) {
    this.sequence = sequence;
    this.index = index;
    this.format = frozen(format);
    this.caret = frozen(caret);
    this.highlights = frozen(highlights);
    this.highlight = highlight;
    this.areas = frozen(areas || []);
  }

  build() {
    const caret = this.caret;
    return div(
      { "data-page": this.index, style: { ...paperStyle(this.format), boxShadow: paperShadow } },
      // Under the text: drawn first - the areas lowest, then the selection.
      // Keyed, as the text after them is: how many there are comes and goes
      // with the caret and the selection.
      this.areas.map((rect, index) => div({ key: "area" + index, "data-area": "", style: areaStyle(rect) })),
      this.highlights.map((rect, index) => div({ key: "highlight" + index, "data-selection": "", style: highlightStyle(rect, this.highlight) })),
      new PaperText({ key: "text", sequence: this.sequence, index: this.index }),
      caret ? div({ key: "caret", "data-caret": "", style: caretStyle(caret) }) : null,
    );
  }
}

// The text on one paper: its runs, in a row.
class PaperText extends Component {
  setProperties({ sequence, index }) {
    this.sequence = sequence;
    this.index = index;
  }

  build() {
    const runs = [];
    for (const line of this.sequence.linesOf(this.index)) {
      for (const run of line.runs) runs.push(span({ style: runStyle(line, run) }, text(run.text)));
    }
    return runs;
  }
}

// A gap's area: a faint, see-through light blue, its edge a little
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
    border: "1px solid rgba(66, 133, 244, 0.35)",
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
  // A gap's: a horizontal bar across the text area, at its height.
  const shape = caret.gap
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

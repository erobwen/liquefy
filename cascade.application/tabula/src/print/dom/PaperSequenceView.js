import { Component, frozen } from "@liquefy/cascade.component";
import { div, span, text } from "@liquefy/cascade.dom";
import { cssMm, paperStyle, runStyle } from "./paperStyles.js";

export const paperShadow = "0 1px 3px rgba(0, 0, 0, 0.25), 0 4px 14px rgba(0, 0, 0, 0.12)";

/**
 * PaperSequenceView - a paper sequence on screen: its papers, white with a
 * slight shadow, one under the other on a grey background, each with the
 * text laid out on it.
 *
 *   paperSequenceView({ sequence, zoom: 1.25, caret, selection })
 *
 * Drawn at real size - a paper's millimeters are CSS millimeters - and
 * scaled by `zoom` (CSS zoom, so the room it takes up scales too, and so do
 * scroll bars around it).
 *
 * `caret`, if given, is drawn on its paper, blinking: { page, x, top,
 * height } in µm (see positions.js's caretAt()), and `blink` - a count to
 * change whenever the caret moves, so it restarts its blink shown.
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
export class PaperSequenceView extends Component {
  setProperties({ sequence, zoom = 1, caret = null, selection = null, style }) {
    this.sequence = sequence;
    this.zoom = zoom;
    this.caret = frozen(caret);
    this.selection = frozen(selection);
    this.style = frozen(style || {});
  }

  onShow() {
    addCaretKeyframes(document);
  }

  build() {
    const { sequence, caret, selection } = this;
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
      })),
    );
  }
}

export function paperSequenceView(...parameters) {
  return new PaperSequenceView(...parameters);
}

class PaperView extends Component {
  setProperties({ sequence, index, format, caret, highlights, highlight }) {
    this.sequence = sequence;
    this.index = index;
    this.format = frozen(format);
    this.caret = frozen(caret);
    this.highlights = frozen(highlights);
    this.highlight = highlight;
  }

  build() {
    const caret = this.caret;
    return div(
      { "data-page": this.index, style: { ...paperStyle(this.format), boxShadow: paperShadow } },
      // Under the text: drawn first. Keyed, as the text after them is: how
      // many there are comes and goes with the selection.
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
  return {
    position: "absolute",
    left: cssMm(caret.x),
    top: cssMm(caret.top),
    height: cssMm(caret.height),
    width: "0",
    borderLeft: "1.5px solid black",
    marginLeft: "-0.75px",
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

import { Component, frozen } from "@liquefy/cascade.component";
import { div, span, text } from "@liquefy/cascade.dom";
import { paperStyle, runStyle } from "./paperStyles.js";

export const paperShadow = "0 1px 3px rgba(0, 0, 0, 0.25), 0 4px 14px rgba(0, 0, 0, 0.12)";

/**
 * PaperSequenceView - a paper sequence on screen: its papers, white with a
 * slight shadow, one under the other on a grey background, each with the
 * text laid out on it.
 *
 *   paperSequenceView({ sequence, zoom: 1.25 })
 *
 * Drawn at real size - a paper's millimeters are CSS millimeters - and
 * scaled by `zoom` (CSS zoom, so the room it takes up scales too, and so do
 * scroll bars around it).
 *
 * Each paper is a component of its own, reading only its own lines
 * (PaperSequence.linesOf()): a change on one paper draws that paper again,
 * not the others. A paper's runs are matched by position, run for run, so
 * what's drawn again is mostly text and positions changing in place.
 */
export class PaperSequenceView extends Component {
  setProperties({ sequence, zoom = 1, style }) {
    this.sequence = sequence;
    this.zoom = zoom;
    this.style = frozen(style || {});
  }

  build() {
    const sequence = this.sequence;
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
      sequence.pages.map((format, index) => new PaperView({ key: "paper" + index, sequence, index, format })),
    );
  }
}

export function paperSequenceView(...parameters) {
  return new PaperSequenceView(...parameters);
}

class PaperView extends Component {
  setProperties({ sequence, index, format }) {
    this.sequence = sequence;
    this.index = index;
    this.format = frozen(format);
  }

  build() {
    const runs = [];
    for (const line of this.sequence.linesOf(this.index)) {
      for (const run of line.runs) runs.push(span({ style: runStyle(line, run) }, text(run.text)));
    }
    return div({ style: { ...paperStyle(this.format), boxShadow: paperShadow } }, runs);
  }
}

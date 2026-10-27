import { Component, frozen } from "@liquefy/cascade.component";
import { div, span, text } from "@liquefy/cascade.dom";
import { cssMm } from "../print/dom.js";
import { frameKind } from "../model/frames.js";

/**
 * A frame on a paper (see ../model/frames.js): where its line placed it -
 * `frame`, { x, top, width, height, source } in µm on the paper, `source`
 * its anchor - showing its content as its kind does (`frame.view(model)`,
 * see ../shell/documents.js), filling it. Content of a kind no plugin in use
 * knows: a grey box, saying so.
 *
 * Shown, not touched: a click on it goes to the paper under it, the caret
 * to the text nearest it.
 */
export class FrameView extends Component {
  setProperties({ frame, selected = false }) {
    this.frame = frozen(frame);
    this.selected = !!selected;
  }

  build() {
    const { x, top, width, height, source } = this.frame;
    const kind = frameKind(source);
    return div(
      {
        "data-frame": "",
        style: {
          position: "absolute", left: cssMm(x), top: cssMm(top), width: cssMm(width), height: cssMm(height),
          overflow: "hidden", pointerEvents: "none", boxSizing: "border-box",
          outline: this.selected ? "2px solid rgba(66, 133, 244, 0.8)" : "none", outlineOffset: "1px",
        },
      },
      kind ? kind.view(source.content.model) : unknownContent(source.content),
    );
  }
}

export const frameView = (...parameters) => new FrameView(...parameters);

function unknownContent(content) {
  return div(
    { style: { width: "100%", height: "100%", background: "#eceff1", color: "#5f6368", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "4px", fontFamily: "sans-serif", fontSize: "10pt", textAlign: "center" } },
    span({ class: "material-symbols-outlined" }, text("help")),
    text("No plugin in use shows “" + (content ? content.name : "nothing") + "”"),
  );
}

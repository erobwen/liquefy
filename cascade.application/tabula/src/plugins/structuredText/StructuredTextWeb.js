import { Component } from "@liquefy/cascade.component";
import { div, span, text, b, i } from "@liquefy/cascade.dom";
import { isSection, titleLevel, titleNumber } from "../../model/flows.js";
import { titlePlaceholder, textPlaceholder } from "../../layout/DocumentLayout.js";
import { frameKind, frameSize } from "../../model/frames.js";
import { cssMm } from "../../print/dom.js";

/**
 * StructuredTextWeb - a structured text in the web mode: not on paper but
 * as a web page is, text as long as it takes - headings by title level, as
 * on paper (see ../../layout/typography.js), set for the screen. Only the
 * text: the card it's in is the web layout's (see ../../shell/layouts.js).
 * Read only, for now: the caret and editing are the paper editor's
 * (StructuredTextEditor).
 *
 *   structuredTextWeb({ model })
 */
export class StructuredTextWeb extends Component {
  setProperties({ model }) {
    this.model = model;
  }

  build() {
    const document = this.model;
    return div(
      { style: textStyle },
      heading(document.title, titleLevel(document), null),
      flows(document, [], titleLevel(document), document.indentParagraphs),
    );
  }
}

// The flows in a section, one after the other: a section as its heading and
// what's in it; a paragraph as itself - indented, rather than spaced
// apart, if the document says so, but for the first of a run.
function flows(section, around, level, indent) {
  return section.children.map((flow, index) => {
    if (isSection(flow)) {
      const inside = [...around, section];
      const flowLevel = titleLevel(flow, level);
      return div(
        heading(flow.title, flowLevel, titleNumber(flow, inside)),
        flows(flow, inside, flowLevel, indent),
      );
    }
    const indented = indent && index > 0 && !isSection(section.children[index - 1]);
    return paragraph(flow, indented);
  });
}

function heading(title, level, number) {
  const style = headingStyles[Math.min(level, headingStyles.length) - 1];
  const empty = title.spans.every((each) => each.text === "");
  return div(
    { style: { ...style, ...(empty ? placeholderStyle : {}) } },
    number ? span({ style: { marginRight: "0.6em" } }, text(number)) : null,
    empty ? text(titlePlaceholder) : spans(title),
  );
}

function paragraph(flow, indented) {
  const empty = flow.spans.every((each) => each.text === "");
  return div(
    { style: { ...bodyStyle, ...(indented ? { textIndent: "1.6em", marginTop: "-0.55em" } : {}), ...(empty ? placeholderStyle : {}) } },
    empty ? text(textPlaceholder) : spans(flow),
  );
}

// Its spans - a frame anchor's its frame (see ../../model/frames.js), as
// the web places a box: floated left or right, a block of its own, or in
// the line - never wider than the text.
function spans(paragraph) {
  return paragraph.spans.map((each) => {
    if (each.anchor) return frame(each.anchor);
    if (each.bold && each.italic) return b(i(text(each.text)));
    if (each.bold) return b(text(each.text));
    if (each.italic) return i(text(each.text));
    return text(each.text);
  });
}

function frame(anchor) {
  const { width, height } = frameSize(anchor);
  const kind = frameKind(anchor);
  const placed = {
    inline: { display: "inline-block", verticalAlign: "baseline" },
    block: { display: "block", margin: "0.5em auto" },
    left: { float: "left", margin: "0.3em 1em 0.5em 0" },
    right: { float: "right", margin: "0.3em 0 0.5em 1em" },
  }[anchor.placement] || {};
  return span(
    { style: { ...placed, width: cssMm(width), maxWidth: "100%", aspectRatio: width + " / " + height, overflow: "hidden", textIndent: 0 } },
    kind ? kind.view(anchor.content.model) : null,
  );
}

const sans = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
// A line no longer than reads well, however wide the card.
const textStyle = { maxWidth: "46em", color: "#1f1f1f" };
const bodyStyle = { fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "18px", lineHeight: 1.6, margin: "0 0 0.7em" };
const headingStyles = [
  { fontFamily: sans, fontSize: "36px", fontWeight: 700, lineHeight: 1.2, textAlign: "center", margin: "0 0 0.8em" },
  { fontFamily: sans, fontSize: "26px", fontWeight: 700, lineHeight: 1.25, margin: "1.2em 0 0.4em" },
  { fontFamily: sans, fontSize: "20px", fontWeight: 700, lineHeight: 1.3, margin: "1.1em 0 0.3em" },
  { fontFamily: sans, fontSize: "18px", fontWeight: 700, fontStyle: "italic", lineHeight: 1.35, margin: "1em 0 0.25em" },
  { fontFamily: sans, fontSize: "18px", fontWeight: 400, fontStyle: "italic", lineHeight: 1.4, margin: "0.9em 0 0.2em" },
  { fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "18px", fontWeight: 400, fontStyle: "italic", lineHeight: 1.45, margin: "0.8em 0 0.2em" },
];
const placeholderStyle = { opacity: 0.35 };

export const structuredTextWeb = (...parameters) => new StructuredTextWeb(...parameters);

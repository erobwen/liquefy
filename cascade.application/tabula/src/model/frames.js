import { observable } from "@liquefy/cascade.component";
import { mm } from "../print/index.js";
import { isFlowEdge } from "./flows.js";

/**
 * Frames - something that isn't text, in the text: an image, a table - in
 * the end anything at all, a whole document as a side note in another.
 *
 * Where it is in the text is a frame anchor: a span of its own in a
 * paragraph, one character long - U+FFFC, the object replacement character -
 * so it's one offset, with a place before it and one after, deleted with a
 * Backspace as any character is, carried along by every split and join of
 * the paragraph. The span holds the anchor: `{ text: "\uFFFC", anchor }`
 * (see flows.js's makeSpan()).
 *
 * The anchor holds the frame - a rectangle of a fixed aspect ratio - and
 * what's in it:
 *
 *  - `content`: a document (see ../shell/documents.js) - a HydratedDocument,
 *    its `documentType` saying what it is, and how it's shown in a frame
 *    (the type's `frame`, see frameTypes() there) - or, if no plugin in use
 *    knows its kind, an Unhydrated one (`name`, `json`), kept as it is.
 *  - `placement`: where the frame goes, laid out (see
 *    ../print/lineBreaking.js) - "inline": in the line, as a word; "block":
 *    on a line of its own; "left", "right": at that side, the text flowing
 *    around it; "page": the whole paper, edge to edge - a page of a book's
 *    own made a picture (see book.js's isWholePage()), its anchor all the
 *    text there is on it.
 *  - `width`, in µm - its height from its content's aspect ratio (see
 *    frameSize()).
 *
 * Its content says how it's shown - so whatever the anchor is in, whatever
 * shows it, a frame is the same thing everywhere.
 */
export const anchorCharacter = "\uFFFC";

export const placements = Object.freeze([
  { value: "inline", label: "In line", icon: "format_align_left" },
  { value: "block", label: "Own line", icon: "horizontal_rule" },
  { value: "left", label: "Left", icon: "format_image_left" },
  { value: "right", label: "Right", icon: "format_image_right" },
  { value: "page", label: "Full page", icon: "crop_free" },
]);

// The anchor a paragraph is all of, its frame the whole page - or null.
export function pageFrameOf(paragraph) {
  const spans = paragraph.spans;
  return spans.length === 1 && spans[0].anchor && spans[0].anchor.placement === "page" ? spans[0].anchor : null;
}

export class FrameAnchor {
  constructor({ content, placement = "block", width = mm(80) }) {
    this.content = content;
    this.placement = placement;
    this.width = width;
    return observable(this);
  }

  // Saved: { type: "frame", name: "anchor", properties } - what's in it a
  // document, dehydrated by its own kind (see ../shell/hydration.js).
  dehydrate() {
    return { type: "frame", name: "anchor", properties: { placement: this.placement, width: this.width, content: this.content } };
  }
}

// What's shown in a frame, by its kind (its document type's `frame`) -
// null for a kind no plugin in use knows.
export const frameKind = (anchor) => anchor.content && anchor.content.documentType ? anchor.content.documentType.frame || null : null;

// The frame's size, at most `maxWidth` wide: its width, and its height from
// its content's aspect ratio (width / height) - 4:3 for content that doesn't
// say.
export function frameSize(anchor, maxWidth = Infinity) {
  const kind = frameKind(anchor);
  const ratio = (kind && kind.aspectRatio && kind.aspectRatio(anchor.content.model)) || 4 / 3;
  const width = Math.max(mm(5), Math.min(anchor.width, maxWidth));
  return { width, height: Math.round(width / ratio) };
}

// A frame's content as a DOM node of its own, for printing - as its kind
// prints it (`frame.printNode(model)`), or, of a kind that doesn't, or that
// no plugin in use knows, a light grey box.
export function frameNode(anchor) {
  const kind = frameKind(anchor);
  if (kind && kind.printNode) return kind.printNode(anchor.content.model);
  const box = globalThis.document.createElement("div");
  Object.assign(box.style, { width: "100%", height: "100%", background: "#eceff1" });
  return box;
}

// The anchor right at a position - the one just before it, or else just
// after it - or null: the frame the caret is at.
export function anchorAt(at) {
  if (!at || isFlowEdge(at)) return null;
  let start = 0;
  let after = null;
  for (const span of at.paragraph.spans) {
    const end = start + span.text.length;
    if (span.anchor && end === at.offset) return span.anchor;
    if (span.anchor && start === at.offset) after = span.anchor;
    start = end;
  }
  return after;
}

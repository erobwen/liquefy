import { div } from "@liquefy/cascade.dom";
import { cssMm } from "../print/dom.js";

/**
 * A clamp - a thin bracket along the left of papers that belong together: a
 * document's, its pages of their own among them, those pages' own (see
 * InsertView.js). One inside another, level by level (`depth`, from the
 * outermost, 0): the outer ones further out from the papers, the inner ones
 * closer - so what's in what can be told at a glance, and which document
 * pages of their own belong to, two documents one after the other.
 *
 *   clamp({ depth, paperWidth, inset, zoom })
 *
 * Placed in a box of its own (position relative) the papers are centred
 * in, `paperWidth` wide (µm): along their left, from `inset` (µm) below the
 * box's top to as far above its bottom - at `zoom`, what the box is drawn
 * at, where it's not zoomed itself.
 */
const deepest = 3;

// Where a clamp's line is, across its box (CSS): what's placed on it -
// the creation dots of pages of their own (see InsertView.js) - placed there.
export function clampLeft({ depth = 0, paperWidth, zoom = 1 }) {
  const away = 3000 + (deepest - Math.min(depth, deepest)) * 2500;
  return `calc(50% - ${cssMm((paperWidth / 2 + away) * zoom)})`;
}

export function clamp({ depth = 0, paperWidth, inset = 0, zoom = 1 }) {
  return div({
    "data-clamp": depth,
    style: {
      position: "absolute",
      left: clampLeft({ depth, paperWidth, zoom }),
      top: cssMm(inset * zoom),
      bottom: cssMm(inset * zoom),
      width: cssMm(1500 * zoom),
      boxSizing: "border-box",
      border: "1.5px solid rgba(66, 133, 244, 0.45)",
      borderRight: "none",
      borderRadius: "2px 0 0 2px",
      pointerEvents: "none",
      // Over what's in the box - an item's own backdrop, drawn after it.
      zIndex: 1,
    },
  });
}

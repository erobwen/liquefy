import { Component } from "@liquefy/cascade.component";
import { div } from "@liquefy/cascade.dom";
import { overlay } from "./Overlay.js";
import { zStack, wrapper, fitContainerStyle, zStackElementStyle } from "./Layout.js";

/**
 * Popover - ported from flow.ui/basic/src/popover.js: content shown next to
 * something on the page (an information button, say), over everything
 * else, closed by clicking anywhere outside it.
 *
 *  - anchor: where it points, as a rectangle in viewport coordinates -
 *    typically what was clicked, measured in the click handler:
 *    `event.currentTarget.getBoundingClientRect()`.
 *  - showing, close: whether it's shown, and what a click outside it calls.
 *  - style, children: the popover's own content (usually a card or an
 *    alert), and extra style for the box it's placed in.
 *
 * Flow measured the popover's own size to place it; here it's placed by
 * which quarter of the window its anchor is in instead - below the anchor
 * when that's in the upper half, above it otherwise, and aligned to the
 * anchor's left or right edge, whichever is further from the window's
 * edge - so it never needs measuring, and so never needs a second pass.
 * Shown through overlay() - the nearest OverlayFrame shows it.
 */
export function popover(...parameters) {
  return new Popover(...parameters);
}

const GAP = 6;

export class Popover extends Component {
  setProperties({ anchor, showing, close, style, children }) {
    this.anchor = anchor || null;
    this.showing = !!showing;
    this.close = close || null;
    this.style = style || null;
    this.popoverChildren = children || [];
  }

  placement() {
    const anchor = this.anchor || { left: 0, top: 0, right: 0, bottom: 0 };
    const view = document.defaultView;
    const width = view ? view.innerWidth : 1024;
    const height = view ? view.innerHeight : 768;
    const placement = {};
    if ((anchor.top + anchor.bottom) / 2 < height / 2) placement.top = anchor.bottom + GAP + "px";
    else placement.bottom = height - anchor.top + GAP + "px";
    if ((anchor.left + anchor.right) / 2 < width / 2) placement.left = anchor.left + "px";
    else placement.right = width - anchor.right + "px";
    return placement;
  }

  build() {
    return overlay(
      { key: "overlay", showing: this.showing },
      zStack(
        { key: "layer", style: { ...fitContainerStyle, pointerEvents: "none" } },
        div({
          key: "outside",
          onmousedown: () => this.close && this.close(),
          style: { ...zStackElementStyle, pointerEvents: "auto" },
        }),
        wrapper(
          { key: "content", style: { position: "fixed", pointerEvents: "auto", maxWidth: "min(800px, 90vw)", ...this.placement(), ...this.style } },
          this.popoverChildren,
        ),
      ),
    );
  }
}

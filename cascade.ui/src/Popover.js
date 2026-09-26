import { Component, frozen, callback } from "@liquefy/cascade.component";
import { div } from "@liquefy/cascade.dom";
import { overlay } from "./Overlay.js";
import { zStack, wrapper, fitContainerStyle, zStackElementStyle } from "./Layout.js";

/**
 * Popover - ported from flow.ui/basic/src/popover.js: content shown next to
 * something on the page (an information button, say), over everything
 * else, closed by clicking anywhere outside it.
 *
 *  - anchor: what it points to - an element (typically what was clicked:
 *    `event.currentTarget`), or a rectangle in viewport coordinates. An
 *    element it follows: while it's shown, a resize of the window, or a
 *    scroll, places it again, where the element now is - watched in the
 *    frames after, for as long as it keeps moving, so whatever lays out
 *    again on the same resize has done so, however late (a toolbar moving
 *    the button it was opened from, say). A rectangle stays put.
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
    this.anchor = frozen(anchor || null);
    this.showing = !!showing;
    this.close = close || null;
    this.style = frozen(style || null);
    this.popoverChildren = frozen(children || []);
  }

  // `moved`: counts the frames after a resize or a scroll, while it's
  // shown and anchored to an element - so it's built, and placed, again
  // (see follow()).
  initializeState() {
    return { moved: 0 };
  }

  initialUnobservables() {
    return { following: null };
  }

  // Where the anchor is now - or, for an element no longer in the page (a
  // theme switch replacing the button, say), where it last was.
  anchorRect() {
    const anchor = this.anchor;
    if (!anchor) return { left: 0, top: 0, right: 0, bottom: 0 };
    if (typeof(anchor.getBoundingClientRect) !== "function") return anchor;
    const u = this.unobservable;
    if (anchor.isConnected || !u.lastAnchorRect) u.lastAnchorRect = anchor.getBoundingClientRect();
    return u.lastAnchorRect;
  }

  // Following an element: while shown, on a resize or a scroll, place again
  // - in the frames after, whenever the element has moved.
  follow() {
    const u = this.unobservable;
    if (u.following) return;
    const view = document.defaultView;
    const later = view.requestAnimationFrame ? (action) => view.requestAnimationFrame(action) : (action) => setTimeout(action, 0);
    // Watched frame by frame, until it has held still for a few: what moves
    // it may lay out again later than the next frame - a bounds provider's
    // ResizeObserver, say, which runs after animation frames.
    const sameRect = (a, b) => a && b && a.left === b.left && a.top === b.top && a.right === b.right && a.bottom === b.bottom;
    let watching = false;
    let stillFrames = 0;
    const watch = () => {
      if (!u.following) { watching = false; return; }
      const anchor = this.anchor;
      const rect = anchor && anchor.isConnected && typeof(anchor.getBoundingClientRect) === "function" ? anchor.getBoundingClientRect() : null;
      // Placed again if the element has moved - or the window has changed
      // size: a placement from its right or bottom edge moves along with it.
      const viewportChanged = u.placedViewport !== view.innerWidth + "x" + view.innerHeight;
      if ((rect && !sameRect(rect, u.lastAnchorRect)) || viewportChanged) {
        stillFrames = 0;
        this.moved = this.moved + 1;
      } else stillFrames++;
      if (stillFrames < 3) later(watch);
      else watching = false;
    };
    const moved = () => {
      stillFrames = 0;
      if (watching) return;
      watching = true;
      later(watch);
    };
    view.addEventListener("resize", moved);
    document.addEventListener("scroll", moved, true);
    u.following = () => {
      view.removeEventListener("resize", moved);
      document.removeEventListener("scroll", moved, true);
    };
  }

  unfollow() {
    const u = this.unobservable;
    if (!u.following) return;
    u.following();
    u.following = null;
  }

  onHide() {
    this.unfollow();
  }

  onDispose() {
    super.onDispose();
    this.unfollow();
  }

  placement() {
    const anchor = this.anchorRect();
    const view = document.defaultView;
    const width = view ? view.innerWidth : 1024;
    const height = view ? view.innerHeight : 768;
    this.unobservable.placedViewport = width + "x" + height;
    const placement = {};
    if ((anchor.top + anchor.bottom) / 2 < height / 2) placement.top = anchor.bottom + GAP + "px";
    else placement.bottom = height - anchor.top + GAP + "px";
    if ((anchor.left + anchor.right) / 2 < width / 2) placement.left = anchor.left + "px";
    else placement.right = width - anchor.right + "px";
    return placement;
  }

  build() {
    this.moved; // Placed again when its anchor element has moved - see follow().
    const followsElement = this.anchor !== null && typeof(this.anchor.getBoundingClientRect) === "function";
    if (this.showing && followsElement) this.follow();
    else this.unfollow();
    return overlay(
      { key: "overlay", showing: this.showing },
      zStack(
        { key: "layer", style: { ...fitContainerStyle, pointerEvents: "none" } },
        div({
          key: "outside",
          onmousedown: callback("outside", () => this.close && this.close()),
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

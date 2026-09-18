import { Component } from "@liquefy/cascade.component";

/**
 * Overlay - the other half of overlay.js's port (see OverlayFrame.js).
 * Renders nothing at its own position; its whole job is to hand its
 * single child to the nearest enclosing OverlayFrame (found via
 * `this.inherit("overlayFrame")`) whenever `this.showing` is true, and
 * take it back whenever it's false (or this component is retracted
 * outright - see onRetract()).
 *
 * Deliberately named `showing`, not flow's own `isVisible` - flow's
 * `isVisible` is a much more general, base-Component concept (computed
 * from the render tree itself - whether a component is actually being
 * rendered at all at its own position right now, propagated down from
 * the root via renderParent - see flow.core's own reactiveRender()) that
 * cascade's direct-render model has no equivalent for yet. `showing` here
 * is Overlay's own, narrower concept: set this to true/false directly
 * (or via the properties bag - `overlay(content, {showing: true})`) to
 * control it, not flow's generic `.show(value)` helper (which just
 * conditionally includes a component in a build() result at all -
 * ported separately, unchanged, onto Component itself).
 */
export function overlay(...parameters) {
  return new Overlay(...parameters);
}

export class Overlay extends Component {
  setProperties({ children, showing }) {
    if (children && children.length > 1) {
      throw new Error("Overlay accepts at most a single child.");
    }
    this.overlayChild = children && children.length > 0 ? children[0] : null;
    this.showing = !!showing;
  }

  initialUnobservables() {
    return { visibleOnFrame: null };
  }

  render() {
    const u = this.unobservable;
    if (this.showing) {
      const overlayFrame = this.inherit("overlayFrame");
      if (overlayFrame && u.visibleOnFrame !== overlayFrame) {
        if (u.visibleOnFrame) u.visibleOnFrame.hideOverlay(this);
        u.visibleOnFrame = overlayFrame;
        overlayFrame.showOverlay(this, this.overlayChild);
      }
    } else if (u.visibleOnFrame) {
      u.visibleOnFrame.hideOverlay(this);
      u.visibleOnFrame = null;
    }
  }

  // If this component simply stops being rendered altogether (rather
  // than being shown with show(false) first), render() never runs again
  // to notice and hide itself - see Component.onRetract()'s own doc on
  // exactly this shape (the demo's HamburgerButton/Menu already rely on
  // it for their own real DOM element).
  onRetract() {
    const u = this.unobservable;
    if (u.visibleOnFrame) {
      u.visibleOnFrame.hideOverlay(this);
      u.visibleOnFrame = null;
    }
  }
}

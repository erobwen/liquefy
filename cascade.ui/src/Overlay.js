import { Component, withoutRecording } from "@liquefy/cascade.component";

/**
 * Overlay - the other half of overlay.js's port (see OverlayFrame.js).
 * Builds nothing at its own position; its whole job is to hand its
 * single child to the nearest enclosing OverlayFrame (found via
 * `this.inherit("overlayFrame")`) whenever `this.showing` is true, and
 * take it back whenever it's false (or this component stops being shown
 * altogether - see onHide()).
 *
 * Deliberately named `showing`, not flow's own `isVisible`: whether a
 * component is shown at all is cascade's onShow()/onHide() (see
 * Component), which Overlay uses itself - an Overlay that stops being
 * shown takes its content back. `showing` is Overlay's own, narrower
 * concept: set it to true/false directly (or via the properties bag -
 * `overlay(content, {showing: true})`) to control it, not the generic
 * `.showIf(value)` helper (which just conditionally includes a component
 * in a build() result at all).
 *
 * One overlay per frame: shown on a frame already showing another
 * Overlay's content, this one evicts it (see OverlayFrame's class doc).
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
    return { visibleOnFrame: null, shownChild: null, shownContext: null };
  }

  // Build-only (like PortalSource - see cascade.dom's Portal.js): a build only runs
  // while something is showing this component, so building is where the
  // content is handed to the frame - again whenever showing changes.
  // Builds nothing where it stands.
  build() {
    this.update();
    return null;
  }

  // Shown again (see Component.onShow()): an up-to-date build doesn't
  // rerun, so hand the content over here. Read without recording - this
  // runs inside whoever is rendering.
  onShow() {
    withoutRecording(() => this.update());
  }

  // No longer shown - its page switched away from, say: take the content
  // back, whatever `showing` says.
  onHide() {
    const u = this.unobservable;
    if (u.visibleOnFrame) {
      u.visibleOnFrame.hideOverlay(this);
      u.visibleOnFrame = null;
    }
  }

  update() {
    const u = this.unobservable;
    if (this.showing) {
      const overlayFrame = this.inherit("overlayFrame");
      if (!overlayFrame && !u.warnedMissing) {
        u.warnedMissing = true;
        console.warn("overlay(): no overlayFrame() around it - what it shows isn't shown.");
      }
      // What its content is shown with: the context this Overlay passes on
      // - so a dialog inherits from where it's opened (see OverlayFrame).
      const context = u.childContext;
      if (overlayFrame && u.visibleOnFrame !== overlayFrame) {
        if (u.visibleOnFrame) u.visibleOnFrame.hideOverlay(this);
        u.visibleOnFrame = overlayFrame;
        u.shownChild = this.overlayChild;
        u.shownContext = context;
        overlayFrame.showOverlay(this, this.overlayChild, context);
      } else if (overlayFrame && (u.shownChild !== this.overlayChild || u.shownContext !== context)) {
        // Shown already, with other content: a modal window becoming full
        // screen, say - hand the frame the new content. Or placed
        // elsewhere: the content follows.
        u.shownChild = this.overlayChild;
        u.shownContext = context;
        overlayFrame.showOverlay(this, this.overlayChild, context);
      }
    } else {
      this.onHide();
    }
  }
}

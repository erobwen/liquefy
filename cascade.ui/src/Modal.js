import { Component, frozen, observable, accessInitialValues, withoutRecording } from "@liquefy/cascade.component";
import { div } from "@liquefy/cascade.dom";

/**
 * Modals - ready-made pieces for what an overlay() shows, each usable on
 * its own:
 *
 *  - modalBackdrop({ close, style }): the dimmed layer behind a modal,
 *    covering the frame; a click on it calls `close`.
 *  - modal({ fullScreen, width, height, style }, content): places its
 *    content in the frame - a window of the given size, centered, or
 *    (`fullScreen`) filling the whole frame. The content fills it. What's
 *    inside can tell which: modal() provides `modalPresentation`
 *    ("window" or "fullScreen") - a themed dialog() goes full screen by
 *    itself, back arrow and all.
 *  - modalAssembly({ close, fullScreenBelow, width, height, backdrop }, content):
 *    both - a backdrop (unless `backdrop: false`) and a modal - and full
 *    screen, without a backdrop, while the frame is narrower than
 *    `fullScreenBelow` (a phone's screen): it reads the frame's size where
 *    it's shown (see OverlayFrame - a layer is a measured element).
 *
 * The ready-to-go way to show a dialog modally, then:
 *
 *   overlay({ showing: this.open },
 *     modalAssembly({ close, fullScreenBelow: 600, width: 360 },
 *       dialog({ title: "Settings", close }, ...)))
 *
 * And for anything else - an animated entrance, a sheet sliding up from
 * below - overlay() takes any content at all, a backdrop of its own
 * included.
 */
export function modalBackdrop(...parameters) {
  return new ModalBackdrop(...parameters);
}

export function modal(...parameters) {
  return new Modal(...parameters);
}

export function modalAssembly(...parameters) {
  return new ModalAssembly(...parameters);
}

// The dimmed layer behind a modal - where a click closes it.
export const modalBackdropColor = "rgba(0, 0, 0, 0.4)";

const coverFrame = { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", boxSizing: "border-box" };

export class ModalBackdrop extends Component {
  setProperties({ close, style }) {
    this.close = close || null;
    this.style = frozen(style || null);
  }

  build() {
    return div({
      onclick: this.close,
      style: { ...coverFrame, pointerEvents: "auto", background: modalBackdropColor, ...this.style },
    });
  }
}

export class Modal extends Component {
  setProperties({ fullScreen, width, height, style, children }) {
    this.fullScreen = !!fullScreen;
    this.width = typeof(width) === "number" ? width + "px" : (width || null);
    this.height = typeof(height) === "number" ? height + "px" : (height || null);
    this.style = frozen(style || null);
    this.modalChildren = frozen(children || []);
  }

  // What's inside can tell how it's presented - not a size, a mode, the
  // same for everything in it. An object of its own, rewritten at the
  // baseline when it changes, as everything a context holds (see
  // cascade.component's RenderContext.js).
  provide() {
    const u = this.unobservable;
    if (!u.provided) u.provided = observable({ modalPresentation: this.presentation() });
    return u.provided;
  }

  presentation() {
    return this.fullScreen ? "fullScreen" : "window";
  }

  build() {
    const presentation = this.presentation();
    const provided = this.provide();
    if (withoutRecording(() => provided.modalPresentation) !== presentation) {
      accessInitialValues(() => { provided.modalPresentation = presentation; });
    }
    // The content fills whatever it's in: the frame, or the window.
    const box = { display: "flex", flexDirection: "column", boxSizing: "border-box", pointerEvents: "auto" };
    if (this.fullScreen) {
      return div({ style: { ...coverFrame, ...box, ...this.style } }, this.modalChildren);
    }
    return div(
      { style: { ...coverFrame, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" } },
      div(
        { style: { ...box, width: this.width || "auto", height: this.height || "auto", maxWidth: "100%", maxHeight: "100%", ...this.style } },
        this.modalChildren,
      ),
    );
  }
}

export class ModalAssembly extends Component {
  setProperties({ close, fullScreen, fullScreenBelow, width, height, backdrop, style, children }) {
    this.close = close || null;
    this.fullScreen = typeof(fullScreen) === "boolean" ? fullScreen : null;
    this.fullScreenBelow = typeof(fullScreenBelow) === "number" ? fullScreenBelow : null;
    this.width = width;
    this.height = height;
    this.backdrop = backdrop !== false;
    this.style = frozen(style || null);
    this.modalChildren = frozen(children || []);
  }

  // Full screen: as told - or below `fullScreenBelow`, by the width of the
  // frame it's shown in (a measured layer - see OverlayFrame).
  isFullScreen() {
    if (this.fullScreen !== null) return this.fullScreen;
    if (this.fullScreenBelow === null) return false;
    const width = this.fromTarget("width");
    return typeof(width) === "number" && width < this.fullScreenBelow;
  }

  build() {
    const fullScreen = this.isFullScreen();
    return [
      // Keyed: left out while full screen, and kept.
      modalBackdrop({ key: "backdrop", close: this.close }).showIf(this.backdrop && !fullScreen),
      modal({ fullScreen, width: this.width, height: this.height, style: this.style }, this.modalChildren),
    ];
  }
}

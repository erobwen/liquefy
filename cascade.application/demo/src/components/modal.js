import { div } from "@liquefy/cascade.dom";
import { centerMiddle, zStack, wrapper, fitContainerStyle, zStackElementStyle } from "@liquefy/cascade.ui";

// Showing a dialog (cascade.ui's themed dialog()) modally - shared by the
// demo's pages. Pass the result to overlay().

// The modal-window presentation: a full-frame backdrop (click to close)
// with the dialog centered on top of it. It holds no state of its own
// (unlike `dialog`, nested inside it, which may) - its keys are only there
// to keep its elements across rebuilds, and are in the calling build's
// scope, so one per build.
export function modalPresentation(dialog, close) {
  return zStack(
    { key: "modalPresentation", style: { ...fitContainerStyle, pointerEvents: "none" } },
    div({
      key: "backdrop",
      onclick: () => close(),
      style: { ...zStackElementStyle, pointerEvents: "auto", background: "rgba(0, 0, 0, 0.4)" },
    }),
    centerMiddle(dialog, { key: "centered", style: { ...zStackElementStyle, pointerEvents: "none" } }),
  );
}

// The full-screen presentation: the dialog (made fullScreen - see
// cascade.ui's dialog()) filling the whole app, as a phone app's screen
// does - no backdrop, nothing around it.
export function fullScreenPresentation(dialog) {
  return wrapper(
    { key: "fullScreenPresentation", style: { ...fitContainerStyle, position: "absolute", top: 0, left: 0, pointerEvents: "auto" } },
    dialog,
  );
}

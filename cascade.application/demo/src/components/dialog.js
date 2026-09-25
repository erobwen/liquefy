import { Component } from "@liquefy/cascade.component";
import { div, text, button as htmlButton } from "@liquefy/cascade.dom";
import { row, column, centerMiddle, zStack, fitContainerStyle, fillerStyle, zStackElementStyle } from "@liquefy/cascade.ui";

// Dialog pieces shared by the demo's pages (first written for
// HybridModalDialog.js) - until cascade.ui has a themed dialog widget.

// The modal-window presentation: a full-frame backdrop (click to close)
// with the dialog centered on top of it. Unkeyed - it holds no state of
// its own (unlike `dialog`, nested inside it, which does) and reconciles
// positionally like any other unkeyed build()-composed content; only
// `dialog`'s own key is what needs to survive across rebuilds.
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

// Dialog chrome - title bar (with close button) around whatever content
// it's given. Holds no state of its own (isFullScreen-style chrome
// variants aren't needed here), so it doesn't strictly need a stable key
// itself - but `dialog` above is keyed anyway, both because it wraps
// `content` (which does hold state) and to keep its own real DOM element
// stable across the docked/modal transition rather than being torn down
// and recreated.
export class DialogChrome extends Component {
  setProperties({ title, close, style, children }) {
    this.title = title || null;
    this.close = close;
    this.style = style || null;
    this.dialogChildren = children || [];
  }

  build() {
    return column(
      {
        key: "dialog",
        style: {
          background: "white", borderRadius: "8px", boxSizing: "border-box", overflow: "hidden",
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.3)", pointerEvents: "auto", ...this.style,
        },
      },
      row(
        {
          key: "titleBar", style: {
            padding: "10px 16px", background: "#2c3e50", color: "white", flex: "none",
            alignItems: "center", justifyContent: "space-between",
          },
        },
        // text(): a lone string starting lowercase (a file name, say)
        // would be taken for an implicit key.
        div({ key: "title" }, text({ key: "titleText", text: this.title || "" })),
        // Plain HTML, not a themed widget: dialog chrome, styled for the
        // dark title bar (the widget contract has no icon button yet).
        htmlButton({
          key: "close",
          onclick: () => this.close(),
          style: { background: "none", border: "none", color: "white", cursor: "pointer", fontSize: "16px", lineHeight: 1 },
        }, "✕"),
      ),
      column({ key: "body", style: { ...fillerStyle, overflow: "auto" } }, this.dialogChildren),
    );
  }
}

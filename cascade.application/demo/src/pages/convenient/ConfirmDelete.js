import { Component, callback } from "@liquefy/cascade.component";
import { div, p, text } from "@liquefy/cascade.dom";
import {
  button, dialog, overlay, row, column, centerMiddle, zStack, fitContainerStyle, zStackElementStyle,
} from "@liquefy/cascade.ui";

// A button that asks first - in a modal dialog, over everything else.
// overlay() shows its content on the app's overlay frame (an overlayFrame()
// at the app's root) while `showing` - built right here, next to the
// button, wherever that is in the app.
export class ConfirmDelete extends Component {
  initializeState() {
    return { asking: false, deleted: 0 };
  }

  build() {
    const close = callback("close", () => { this.asking = false; });
    const confirm = callback("confirm", () => { this.deleted++; this.asking = false; });
    return [
      row(
        { key: "controls", style: { alignItems: "center", gap: "12px" } },
        button({ key: "delete" }, text({ key: "deleteText", text: "Delete everything" }), callback("ask", () => { this.asking = true; })),
        text({ key: "count", text: "Deleted " + this.deleted + (this.deleted === 1 ? " time" : " times") }),
      ),
      overlay(
        { key: "modal", showing: this.asking },
        zStack(
          { key: "layer", style: { ...fitContainerStyle, pointerEvents: "none" } },
          // A click beside the dialog closes it.
          div({ key: "backdrop", onclick: close, style: { ...zStackElementStyle, pointerEvents: "auto", background: "rgba(0, 0, 0, 0.4)" } }),
          centerMiddle(
            { key: "centered", style: { ...zStackElementStyle, pointerEvents: "none" } },
            dialog(
              { key: "dialog", title: "Are you sure?", close, style: { width: "340px" } },
              column(
                { key: "body", style: { padding: "16px", gap: "16px" } },
                p({ key: "question", style: { margin: 0 } }, text({ key: "questionText", text: "Everything will be gone - well, in this example." })),
                row(
                  { key: "answers", style: { gap: "8px", justifyContent: "flex-end" } },
                  button({ key: "cancel" }, text({ key: "cancelText", text: "Cancel" }), close),
                  button({ key: "confirm", variant: "filled" }, text({ key: "confirmText", text: "Delete" }), confirm),
                ),
              ),
            ),
          ),
        ),
      ),
    ];
  }
}

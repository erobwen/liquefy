import { Component, callback } from "@liquefy/cascade.component";
import { div, p, text } from "@liquefy/cascade.dom";
import {
  button, dialog, overlay, row, column, centerMiddle, zStack, fitContainerStyle,
} from "@liquefy/cascade.ui";

// A button that asks first - in a modal dialog, over everything else.
// overlay() shows its content on the app's overlay frame (an overlayFrame()
// at the app's root) while `showing` - built right here, next to the
// button, wherever that is in the app.
export class ConfirmDelete extends Component {
  initialState() {
    return { asking: false, deleted: 0 };
  }

  build() {
    const close = callback("close", () => { this.asking = false; });
    const confirm = callback("confirm", () => { this.deleted++; this.asking = false; });
    return [
      row(
        { style: { alignItems: "center", gap: "12px" } },
        button(text("Delete everything"), callback("ask", () => { this.asking = true; })),
        text("Deleted " + this.deleted + (this.deleted === 1 ? " time" : " times")),
      ),
      overlay(
        { showing: this.asking },
        zStack(
          { style: { ...fitContainerStyle, pointerEvents: "none" } },
          // A click beside the dialog closes it.
          div({ onclick: close, style: { pointerEvents: "auto", background: "rgba(0, 0, 0, 0.4)" } }),
          centerMiddle(
            { style: { pointerEvents: "none" } },
            dialog(
              { title: "Are you sure?", close, style: { width: "340px" } },
              column(
                { style: { padding: "16px", gap: "16px" } },
                p({ style: { margin: 0 } }, text("Everything will be gone - well, in this example.")),
                row(
                  { style: { gap: "8px", justifyContent: "flex-end" } },
                  button(text("Cancel"), close),
                  button({ variant: "filled" }, text("Delete"), confirm),
                ),
              ),
            ),
          ),
        ),
      ),
    ];
  }
}

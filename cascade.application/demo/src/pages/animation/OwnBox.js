import { Component, callback } from "@liquefy/cascade.component";
import { div, text, animationContainer } from "@liquefy/cascade.dom";
import { button, row } from "@liquefy/cascade.ui";

const steps = [
  ["Welcome", ["Three short steps."]],
  ["Your details", ["Name", "Address", "Phone", "E-mail"]],
  ["Done", ["That's all.", "Thank you."]],
];
const line = { padding: "6px 10px", borderRadius: "4px", background: "#eaeded" };

// The container's own box. Here the container *is* the dialog - centered
// in the room around it, by that room. As a step needs more or less of it,
// the dialog grows and shrinks to its new size, from its middle - rather
// than snapping to it - and what stays in it stays where it is meanwhile.
export class OwnBox extends Component {
  initialState() {
    return { step: 0 };
  }

  build() {
    const [title, lines] = steps[this.step];
    return div(
      { style: { display: "flex", alignItems: "center", justifyContent: "center", height: "300px" } },
      animationContainer(
        {
          style: {
            display: "flex", flexDirection: "column", gap: "8px", width: "240px", padding: "16px",
            borderRadius: "12px", background: "white", boxShadow: "0 4px 16px rgba(0, 0, 0, 0.25)",
          },
        },
        div({ key: "title", style: { fontWeight: "bold" } }, text(title)),
        lines.map((each) => div({ key: each, style: line }, text(each))),
        row(
          { key: "buttons", style: { gap: "8px", justifyContent: "flex-end" } },
          button({ disabled: this.step === 0 }, text("Back"), callback("back", () => { this.step--; })),
          button({ disabled: this.step === steps.length - 1 }, text("Next"), callback("next", () => { this.step++; })),
        ),
      ),
    );
  }
}

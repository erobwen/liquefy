import { Component, callback } from "@liquefy/cascade.component";
import { div, text, animationContainer } from "@liquefy/cascade.dom";
import { button, column, controlPanel } from "@liquefy/cascade.ui";

const chip = { padding: "6px 14px", borderRadius: "16px", background: "#d6eaf8", color: "#1b4f72" };

// Moving within a parent. Each item has a key - that's what makes it the
// same item, in a new place, rather than another one. Click fast: an item
// already on its way just curves off towards its new place.
export class Reorder extends Component {
  initialState() {
    return { items: ["One", "Two", "Three", "Four", "Five", "Six", "Seven"] };
  }

  build() {
    return column(
      { style: { gap: "12px", overflow: "visible" } },
      controlPanel(
        button(text("Shuffle"), callback("shuffle", () => { this.items = [...this.items].sort(() => Math.random() - 0.5); })),
        button(text("Reverse"), callback("reverse", () => { this.items = [...this.items].reverse(); })),
      ),
      animationContainer(
        { style: { display: "flex", flexWrap: "wrap", gap: "8px" } },
        this.items.map((name) => div({ key: name, style: chip }, text(name))),
      ),
    );
  }
}

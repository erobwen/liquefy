import { Component, callback } from "@liquefy/cascade.component";
import { div, text, flipAnimationContainer } from "@liquefy/cascade.dom";
import { button, row, column, controlPanel } from "@liquefy/cascade.ui";

const fruit = ["Apple", "Banana", "Cherry", "Date", "Elderberry", "Fig", "Grape"];

// A plain list - it knows nothing about animation. Its items move, so
// each has a key: that's what keeps a fruit the same fruit as it moves.
class FruitList extends Component {
  setProperties({ items }) {
    this.items = items;
  }

  build() {
    return row(
      { style: { gap: "8px", flexWrap: "wrap", overflow: "visible" } },
      this.items.map((name) => div(
        { key: name, style: { padding: "6px 12px", borderRadius: "16px", background: "#d6eaf8", color: "#1b4f72" } },
        text(name),
      )),
    );
  }
}

// Animated - by the one line around it.
export class ShuffleList extends Component {
  initialState() {
    return { items: fruit.slice(0, 5) };
  }

  build() {
    const shuffled = () => [...this.items].sort(() => Math.random() - 0.5);
    const missing = fruit.filter((name) => !this.items.includes(name));
    return column(
      { style: { gap: "12px", overflow: "visible" } },
      controlPanel(
        button(text("Shuffle"), callback("shuffle", () => { this.items = shuffled(); })),
        button({ disabled: missing.length === 0 }, text("Add"), callback("add", () => { this.items = [missing[0], ...this.items]; })),
        button({ disabled: this.items.length === 0 }, text("Remove"), callback("remove", () => { this.items = this.items.slice(1); })),
      ),
      flipAnimationContainer(new FruitList({ items: this.items })),
    );
  }
}

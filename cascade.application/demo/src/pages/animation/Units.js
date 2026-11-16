import { Component, callback } from "@liquefy/cascade.component";
import { div, text, animationContainer } from "@liquefy/cascade.dom";
import { button, column, controlPanel } from "@liquefy/cascade.ui";

const tile = { display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", borderRadius: "8px", background: "#fdebd0", color: "#784212" };

// A component with a life of its own: counting changes nothing but itself.
class Counter extends Component {
  setProperties({ name }) {
    this.name = name;
  }

  initialState() {
    return { count: 0 };
  }

  build() {
    return div(
      { style: tile },
      text(this.name + ": " + this.count),
      button(text("+1"), callback("count", () => { this.count++; })),
    );
  }
}

// One stable function - not a new one every build.
const isCounter = (component) => component instanceof Counter;

// Units. The container sees every element in it, and places each one. What
// `isUnit` answers true for it takes as one piece instead: placed, and
// animated, whole - and what happens inside is that component's own
// business, as fast as anywhere else: counting doesn't run the container.
export class Units extends Component {
  initialState() {
    return { names: ["Apples", "Pears", "Plums", "Figs"] };
  }

  build() {
    return column(
      { style: { gap: "12px", overflow: "visible" } },
      controlPanel(button(text("Shuffle"), callback("shuffle", () => { this.names = [...this.names].sort(() => Math.random() - 0.5); }))),
      animationContainer(
        { isUnit: isCounter, style: { display: "flex", flexWrap: "wrap", gap: "8px" } },
        this.names.map((name) => new Counter({ key: name, name })),
      ),
    );
  }
}

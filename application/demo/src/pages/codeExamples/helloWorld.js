import { Component } from "@liquefy/flow.core";
import { DOMRenderContext, div, h1, b } from "@liquefy/flow.dom";
import { button } from "@liquefy/ui-material"

// A simple Hello World component
class Hello extends Component {

  recieve({to}) {
    this.to = to;
  }

  initialize() {
    this.count = 1;
  }

  render() {
    const { to, count } = this;
    return div(
      h1(`Hello ${to}`),
      b("counter: " + count),
      button("Click me!", () => this.count++),       
      {
        style: {padding: "20px", boxSizing: "border-box"}
      }
    );
  }
}

// Create an instance, and set as content of a render context.
new DOMRenderContext(document.getElementById("root")).render(
  new Hello({to: "World"})
)

import { DOMFlowTarget, div, Component } from "@liquefy/flow";

// Declare a component
class HelloWorld extends Component {
  build() {
    return div("Hello World");
  }
}

// Create an instance, and set as content of a flow target.
new DOMFlowTarget(document.getElementById("root")).setContent(
  new HelloWorld()
)

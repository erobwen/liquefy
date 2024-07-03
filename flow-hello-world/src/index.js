import { Component } from "@liquefy/flow.core";
import { DOMFlowTarget, div } from "@liquefy/flow.DOM";

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

import { Component } from "@liquefy/flow.core";
import { DOMFlowTarget, div } from "@liquefy/flow.DOM";
import { span } from "../../flow.DOM/src";

// Declare a component
class HelloWorld extends Component {
  build() {
    return div(
      "Hello World", 
      "Foo", 
      1, 
      span("XAasdf"),
      div("Next")
    );
  }
}



// Create an instance, and set as content of a flow target.
new DOMFlowTarget(document.getElementById("root")).setContent(
  new HelloWorld()
)

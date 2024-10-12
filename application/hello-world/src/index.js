import { Component } from "@liquefy/flow.core";
import { DOMRenderContext, div, h1, span, b, ul, li } from "@liquefy/flow.DOM";

// Declare a component
class HelloWorld extends Component {
  build() {
    return div(
      "Hello World", 
      "Foo",
      h1("Header"),
      b(["bold"]),
      ul(
        li("One"),
        li("Two"),
        li("Three")
      ),
      1, 
      span("Bold", {style: {fontWeight: "bold"}}),
      div("Next", {style: {borderWidth: "1px", borderStyle: "solid"}}),
      "some other text", 
      {style: {padding: "20px", boxSizing: "border-box"}}
    );
  }
}



// Create an instance, and set as content of a flow target.
new DOMRenderContext(document.getElementById("root")).setContent(
  new HelloWorld()
)

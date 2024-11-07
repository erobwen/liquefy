import { Component, callback } from "@liquefy/flow.core";
import { DOMRenderContext, div, h1, h2, span, b, ul, li, br } from "@liquefy/flow.DOM";
import { button } from "@liquefy/basic-ui"


class HelloWorld extends Component {
  setState() {
    this.count = 0;
    window.helloWorld = this; 
    console.log("Try direct manipulate the counter using 'helloWorld.counter = 42' from this global variable and see what happens.")
  }

  build() {
    return div(
      h1("Hello World"),
      b("Welcome to Flow, the Javascript centered front end framework!"),
      h2("Main features:"),
      ul(
        li("Built in state management with auto-observation (similar to MobX)"),
        li("Performs minimal updates to the DOM on any change"),
        li("Very unrestrictive, easy to learn and use")
      ),
      div("Programmatic styling allows for programmatic adaptive and responsive design.", {style: {fontWeight: "bold", color: "blue", borderWidth: "1px", padding: "10px", borderStyle: "solid"}}),
      br(),
      div("Everything is programmatic and reactive to change!"),
      div(`Count: ${this.count}`, {style: { fontSize: "16px", padding: "10px"}}),
      button("Click me", () => {this.count++; console.log("Click!")}),
      br(),
      (this.count < 10) && div("Note: This component is bound to window.helloWorld. You can try to direct manipulate helloWorld.count to see what happens."),
      {style: {padding: "20px", boxSizing: "border-box"}}
    );
  }
}



// Create an instance, and set as content of a flow target.
new DOMRenderContext(document.getElementById("root")).setContent(
  new HelloWorld()
)

import { Component, callback } from "@liquefy/flow.core";
import { DOMRenderContext, div, h1, h2, span, b, ul, li, br } from "@liquefy/flow.DOM";
import { button } from "@liquefy/ui-material"

const foo = model({x: 234})


class Hello extends Component {
  receive(properties) {
    Object.assign(this, { to: "Developer" }, properties);
  }

  initialize() {
    this.count = 8;
    
    console.log("Try direct manipulate the counter using 'hello.count = 42' from this global variable and see what happens.")
    window.hello = this;
    
    this.ensure(() => { // Reactive auto-observation on this.count!
      this.squared = this.count * this.count
    })
  }

  terminate() { // If needed
    delete window.hello
  }

  render() {
    return div(
      h1(`Hello ${this.to}`),
      b("Welcome to Flow, the Javascript centered front end framework!"),
      
      h2("Technical features:"),
      ul(
        li("Built in state management with auto-observation (similar to MobX)"),
        li("Performs minimal updates to the DOM on any change"),
        li("Very unrestrictive, easy to learn and use"),
        li("DOM transition animations"),
        li("Single reactive render function for each component."),
        li("Resident components with custom lifecycle."),
        li("Portals, populated in component render time for instant DOM population"),
        li("Property inheritance between components")
      ),
      div("Programmatic styling allows for programmatic adaptive and responsive design.", {style: {fontWeight: "bold", color: "blue", borderWidth: "1px", padding: "10px", borderStyle: "solid"}}),
      br(),
      div("Everything is programmatic and reactive to change!"),
      div(`Count: ${this.count}`, {style: { fontSize: "16px", fontSize:`${Math.max(8, this.count)}px`, padding: "10px"}}),
      button("Click me!", () => this.count++),
      br(),

      (this.count < 10) && div("Note: This component is bound to window.hello. You can try to direct manipulate hello.count to see what happens."),
      
      div(`Squared: ${this.squared}`),

      {style: {padding: "20px", boxSizing: "border-box"}}
    );
  }
}



// Create an instance, and set as content of a flow target.
new DOMRenderContext(document.getElementById("root")).render(
  new Hello({to: "World"})
)

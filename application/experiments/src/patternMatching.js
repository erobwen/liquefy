import { observable, Component } from "../flow/Flow";
import { DOMRenderContext } from "../flow.DOM/DOMRenderContext.js";
import { button } from "../components/basic/BasicWidgets";
import { column, row } from "../components/basic/Layout";
import { text } from "../../../flow.DOM/src/HTMLBuilding.js";

const log = console.log;

/**
 * Flow definitions
 */

// A very simple model
const model = observable({value: ""});

// A very simple view component
export class PatternMatching extends Component {
  initialize() {
    this.state = 1;
  }

  render() {
    const _readState = this.state; 

    return column(
      button("Change State", {onClick: () => {this.state++}}),
      text(" foo "), 
      row(
        text(" a "), 
        text(" b "), 
        {key: "keyed"}
      ),
      row(
        text(" bar "),
        text(" fum ")
      )
    );
  }
}

/**
 * This is what you would typically do in index.js to start this app. 
 */
 export function startPatternMatching() {
  const application = new PatternMatching({model});  
  new DOMRenderContext(document.getElementById("root")).render(application)
}

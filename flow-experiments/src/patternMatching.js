import { observable, Component } from "../flow/Flow";
import { DOMFlowTarget } from "../flow.DOM/DOMFlowTarget.js";
import { button, text } from "../components/basic/BasicWidgets";
import { column, row } from "../components/basic/Layout";

const log = console.log;

/**
 * Flow definitions
 */

// A very simple model
const model = observable({value: ""});

// A very simple view component
export class PatternMatching extends Component {
  setState() {
    this.state = 1;
  }

  build() {
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
  new DOMFlowTarget(document.getElementById("flow-root")).setContent(application)
}

import { observable, Component } from "@liquefy/flow.core";
import { text, DOMFlowTarget } from "@liquefy/flow.DOM";
import { centerMiddle, column, fitContainerStyle } from "@liquefy/basic-ui";
import { textInput } from "@liquefy/modern-ui";

const log = console.log;

/**
 * Minimalistic component used for experiments. 
 */
class InputTest extends Component {
  setState() {
    this.text = "Some text"; 
  }

  build() {
    return centerMiddle(
      textInput("Test Input", this, "text", {style: {width: "100px"}}),
      {style: {...fitContainerStyle, fontSize: "40px", padding: "20px"}}
    );
  }
}

/**
 * This is what you would typically do in index.js to start this app. 
 */
export function startInputTest() {
  const test = new InputTest()  
  new DOMFlowTarget(document.getElementById("root")).setContent(test)
}

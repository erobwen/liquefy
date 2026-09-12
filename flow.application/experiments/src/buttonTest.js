import { text } from "../components/basic/BasicWidgets";
import { centerMiddle, column, fitContainerStyle } from "../components/basic/Layout";
import { modernButton } from "../components/modern/ModernButton";
import { DOMRenderTarget } from "../flow.DOM/DOMRenderTarget";
import { Component } from "../flow/Flow";

const log = console.log;

/**
 * Minimalistic component used for experiments. 
 */
class ButtonTest extends Component {
  initialize() {
    this.pressed = false; 
  }

  build() {
    return centerMiddle(
      modernButton("test", "Test", ()=> { this.pressed = !this.pressed}, {pressed: this.pressed, style: {width: "100px"}}),
      {style: {...fitContainerStyle, fontSize: "40px", padding: "20px"}}
    );
  }
}

/**
 * This is what you would typically do in index.js to start this app. 
 */
export function buttonTest() {
  const test = new ButtonTest()  
  new DOMRenderTarget(document.getElementById("root")).setContent(test)
}

import { Component } from "@liquefy/flow.core";
import { text, DOMFlowTarget } from "@liquefy/flow.DOM";
import { centerMiddle, column, fitContainerStyle } from "@liquefy/basic-ui";
import { modernButton } from "@liquefy/modern-ui";

import { button, textInputField } from "@liquefy/themed-ui";
import { setModernUIAsTheme } from "@liquefy/modern-ui";
import { setBasicUIAsTheme, checkboxInputField } from "@liquefy/basic-ui";

const log = console.log;

/**
 * Minimalistic component used for experiments. 
 */
class ThemeTest extends Component {
  setState() {
    this.modernTheme = false;
    this.ensure(() => {
      if (this.modernTheme) {
        setModernUIAsTheme()
      } else {
        setBasicUIAsTheme();
      }
    }) 
  }

  build() {
    console.log("building!")
    // return div("Some Text");
    return centerMiddle(
      column(
        checkboxInputField("Modern Theme", this, "modernTheme"),
        button("test", "Test", ()=> { this.pressed = !this.pressed}, {pressed: this.pressed, style: {width: "100px"}}),
      ),
      {style: {...fitContainerStyle, padding: "20px"}}
    );
  }
}

/**
 * This is what you would typically do in index.js to start this app. 
 */
export function themeTest() {
  const test = new ThemeTest()  
  new DOMFlowTarget(document.getElementById("root")).setContent(test)
}

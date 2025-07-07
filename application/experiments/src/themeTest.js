import { Component } from "@liquefy/flow.core";
import { text, DOMRenderContext } from "@liquefy/flow.DOM";
import { centerMiddle, column, fitContainerStyle } from "@liquefy/basic-ui";

import { button } from "@liquefy/themed-ui";
import { materialTheme } from "@liquefy/ui-material";
import { checkboxInput } from "@liquefy/basic-ui";
import { applicationMenuFrame, fillerStyle, layoutBorderStyle } from "@liquefy/basic-ui";
import { basicTheme } from "@liquefy/basic-ui";
import { assignGlobalTheme } from "@liquefy/themed-ui";


const log = console.log;

/**
 * Minimalistic component used for experiments. 
 */
class ThemeTest extends Component {
  initialize() {
    this.pressed = true; 
    this.useMaterialTheme = false;
    this.ensureAtRenderTime(() => {
      this.button = button("Test1", ()=> { this.pressed = !this.pressed}, {pressed: this.pressed, style: {width: "100px"}});
    });
    this.ensure(() => {
      assignGlobalTheme(this.useMaterialTheme ? materialTheme : basicTheme)
    }) 
  }

  render() {
    return applicationMenuFrame({
      appplicationMenu: column(
        checkboxInput("Modern Theme", this, "modernTheme"),
        text("First"), 
        text("Second"), 
        text("Third"), 
        // button("test1", "Test1", ()=> { this.pressed = !this.pressed}, {pressed: this.pressed, style: {width: "100px"}}),
        {style: {width: "200px"}
      }),
      topPanelContent: [text("by Robert Renbris")],
      applicationContent: centerMiddle(
        // button("test2", "Test2", ()=> { this.pressed = !this.pressed}, {pressed: this.pressed, style: {width: "100px"}}),
        this.button,
        text("Content!"), 
        {style: {...fillerStyle, ...layoutBorderStyle}}
      ),
      bounds: this.bounds
    })

    console.log("building!")
    // return div("Some Text");
    return centerMiddle(
      column(
        checkboxInput("Modern Theme", this, "modernTheme"),
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
  new DOMRenderContext(document.getElementById("root")).render(test)
}

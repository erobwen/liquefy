import { Component } from "../flow/Flow";
import { DOMRenderTarget } from "../flow.DOM/DOMRenderTarget.js";
import { centerMiddle, column, fillerStyle, layoutBorderStyle } from "../components/basic/Layout";
import { applicationMenuFrame } from "../components/basic/ApplicationMenuFrame";
import { text } from "../../../flow.DOM/src/HTMLBuilding.js";

const log = console.log;


/**
 * Demo
 */

export class SimpleApplicationMenu extends Component {
  build() {
    // return text("Foo");
    return applicationMenuFrame({
      appplicationMenu: column(text("First"), text("Second"), text("Third"), {style: {width: "200px"}}),
      applicationContent: centerMiddle(text("Content!"), {style: {...fillerStyle, ...layoutBorderStyle}}),
      topPanelContent: [text("by Robert Renbris")],
      bounds: this.bounds
    })
  }
}

/**
 * This is what you would typically do in index.js to start this app. 
 */
export function startSimpleApplicationMenu() {
  new DOMRenderTarget(document.getElementById("root")).setContent(
    new SimpleApplicationMenu()
  );
}

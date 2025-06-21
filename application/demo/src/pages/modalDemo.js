import { Component } from "@liquefy/flow.core";
import { toProperties } from "@liquefy/flow.core";
import { DOMRenderContext, text, div } from "@liquefy/flow.DOM";
import { fillerStyle, panel } from "@liquefy/basic-ui";
import { centerMiddle, centerMiddleStyle, column, columnStyle, fitContainerStyle, row, zStack, zStackElementStyle } from "@liquefy/basic-ui";
import { overflowVisibleStyle, modal } from "@liquefy/basic-ui";
import { overlay } from "@liquefy/basic-ui";
import { button } from "@liquefy/themed-ui";



/**
 * Modal example
 */
export class ModalExample extends Component {
  // Lifecycle function build is run reactivley on any change, either in the model or in the view model. It reads data from anywhere in the model or view model, and the system automatically infers all dependencies.
  receive({bounds}) {
    this.bounds = bounds; 
    // Object.assign(this, properties)
    this.name = "Hybrid Modal Dialogs";
  }

  render() {
    const {width, height }  = this.bounds;
    const dialogIsModal = width < 800;

    const dialogContent = text("Dialog content!");

    return row("row",
      panel("base-panel",
        column("base-column",
          text("A hybrid modal dialog, that is only modal when there is not enough space."),
          // row(
            button("Open Dialog", ()=> {this.showDialog = true;}),
            {style: overflowVisibleStyle}
          // ), 
          // modernButton({style: {width: "100px", height: "100px", backgroundColor: color}}),
        ),
        {style: fillerStyle}
      ),
      div("dialog-panel",
        panel(
          column("column",
            button("Close", () => this.showDialog = false), 
            dialogContent.show(this.showDialog && !dialogIsModal),
          ),
        ).show(this.showDialog && !dialogIsModal),
        {style: fillerStyle}
      ).show(!dialogIsModal),
      modal("modal", 
        dialogContent.show(this.showDialog && dialogIsModal), 
        {close: () => { this.showDialog = false}}
      ).show(this.showDialog && dialogIsModal),
      { style: fitContainerStyle }
    );
  }
}
  



/**
 * Start the demo
 */
  
export function startModalDemo() {
  const root = new ModalStandaloneExample();
  new DOMRenderContext(document.getElementById("root")).render(root);
}

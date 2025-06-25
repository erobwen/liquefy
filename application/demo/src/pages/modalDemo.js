import { Component } from "@liquefy/flow.core";
import { toProperties } from "@liquefy/flow.core";
import { DOMRenderContext, text, div } from "@liquefy/flow.DOM";
import { alert, cardShadow3, dialogue, fillerStyle, panel } from "@liquefy/basic-ui";
import { centerMiddle, centerMiddleStyle, column, columnStyle, fitContainerStyle, row, zStack, zStackElementStyle } from "@liquefy/basic-ui";
import { overflowVisibleStyle, modal } from "@liquefy/basic-ui";
import { overlay } from "@liquefy/basic-ui";
import { button, cardColumn } from "@liquefy/themed-ui";



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

    const contentDialogue = dialogue(
      text("A dialogue"), 
      {
        variant: "elevated",
        close: () => { this.showDialog = false},
        style: {padding: 15, height: 500, ...(dialogIsModal ? {width: 400} : {})}
      }
    )

    return row("row",
      cardColumn("selector",
        alert("info", 
          "A hybrid modal dialog, that is only modal when there is not enough space. Try resizeing the window when the dialog is open.", 
          { 
            severity: "info", style: {boxShadow: cardShadow3, ...(!dialogIsModal ? {width: width/2} : {})}
          }
        ),
        centerMiddle(
          button("Open Hybrid Modal Dialog", ()=> {this.showDialog = true;}),
          {style: {...overflowVisibleStyle, ...fillerStyle}}
        ), 
        {
          variant: "filled"
        }
      ),
      div("dialog-panel",
        contentDialogue.show(this.showDialog && !dialogIsModal),
        {style: {...fillerStyle, ...overflowVisibleStyle}}
      ).show(!dialogIsModal),
      modal("modal", 
        contentDialogue.show(this.showDialog && dialogIsModal),
        {close: () => { this.showDialog = false}}
      ).show(this.showDialog && dialogIsModal),
      { style: {...fitContainerStyle, ...overflowVisibleStyle, gap: 10}}
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

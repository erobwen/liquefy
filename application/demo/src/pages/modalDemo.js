import { callback, Component } from "@liquefy/flow.core";
import { DOMRenderContext, text, div, p, ul, li } from "@liquefy/flow.DOM";
import { button, cardColumn } from "@liquefy/themed-ui";

import {
  alert, cardShadow3, dialogue, fillerStyle,
  centerMiddle, column, fitContainerStyle, row,
  overflowVisibleStyle, modalContainer, portalContents
} from "@liquefy/basic-ui";
import { displayCodeButton, informationButton } from "../components/information";
import file from './modalDemo?raw';


/**
 * Hybrid modal example
 */
export class ModalExample extends Component {
  receive({bounds, topBarPortal}) {
    this.bounds = bounds; 
    this.topBarPortal = topBarPortal;
    this.name = "Hybrid Modal Dialogs";
  }

  initialize() {
    this.close = callback("close", () => { this.showDialog = false; });
  }

  render() {
    console.log("Rendering ModalExample");
    const { topBarPortal, bounds } = this;
    const { width }  = bounds;
    const dialogIsModal = width < 850;

    const contentDialogue = dialogue("dialogue",
      text("A dialogue"), 
      {
        variant: "elevated",
        close: this.close,
        style: {height: 500, ...(dialogIsModal ? {width: 500} : {})}
      }
    )

    return row("row",
      topPortalContents(topBarPortal),
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

      modalContainer("modal", 
        contentDialogue.show(this.showDialog && dialogIsModal),
        {
          fullScreenTreshold: 550, 
          close: () => { this.showDialog = false}
        }
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


/**
 * Top portal content
 */
const topPortalContents = (topBarPortal) =>
  portalContents("information", 
    informationButton(
      column(
        p("A demonstration of a hybrid modal dialog:"),
        ul(
          li("Note that the same dialogue content component instance is moved when dialogue transforms from modal/non modal.  "), 
          li("This means state can be easily preserved."),
        ),
        { style: {width: 800, whiteSpace: "normal"}}
      )
    ),
    displayCodeButton({code: file, fileName: "src/pages/modalDemo.js"}),
    {
      portal: topBarPortal
    }
  )
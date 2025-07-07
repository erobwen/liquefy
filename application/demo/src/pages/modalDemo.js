import { callback, Component, toProperties } from "@liquefy/flow.core";
import { DOMRenderContext, text, div, p, ul, li, img } from "@liquefy/flow.dom";
import { button, cardColumn, dialogue } from "@liquefy/themed-ui";

import {
  alert, cardShadow3, fillerStyle,
  centerMiddle, column, fitContainerStyle, row,
  overflowVisibleStyle, modalContainer, portalContents
} from "@liquefy/basic-ui";
import { displayCodeButton, informationButton } from "../components/information";
import file from './modalDemo?raw';
import dropPortrait from '../../public/drop-portrait.jpg';



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
    const { topBarPortal, bounds } = this;
    const { width }  = bounds;
    const dialogIsModal = width < 850;

    const contentDialogue = dialogue("dialogue",
      dialogueContent("dialogue-content"), 
      {
        variant: "elevated",
        close: this.close,
        style: {...(dialogIsModal ? {width: 500, height: 700} : fillerStyle)}
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

      contentDialogue.show(this.showDialog && !dialogIsModal),

      modalContainer("modal", 
        contentDialogue.show(this.showDialog && dialogIsModal),
        {
          fullScreenTreshold: 550, 
          close: () => { this.showDialog = false}
        }
      ).show(this.showDialog && dialogIsModal),
      
      { style: {...fitContainerStyle, ...overflowVisibleStyle, gap: 10, padding: 10} }
    );
  }
}
  

/**
 * Dialogue contents component
 */
export const dialogueContent = (...parameters) => new DialogueContent(...parameters);

export class DialogueContent extends Component {
  initialize() {
    this.counter = 0;
  }

  render() {
    const { counter } = this;
    return column("dialogue-content",
      centerMiddle(
        img("img", {src: dropPortrait, style: {height: "100%"}}),
        {style: fillerStyle}
      ),
      column(
        p("Counter: ", text(counter)),
        button("Increment Counter", () => { this.counter += 1; })
      ),
      {
        style: {padding: 20, gap: 20, ...fitContainerStyle}
      }
    );
  }
}


/**
 * Start as standalone (useful for reactive debugging etc.)
 */
export function startModalDemo() {
  const root = new ModalStandaloneExample();
  new DOMRenderContext(document.getElementById("root")).render(root);
}


/**
 * Top portal content
 */
const topPortalContents = (topBarPortal) =>
  portalContents("modalDemoInformation", 
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
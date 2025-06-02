import { Component } from "@liquefy/flow.core";
import { toProperties } from "@liquefy/flow.core";
import { DOMRenderContext, text, div } from "@liquefy/flow.DOM";
import { fillerStyle, panel } from "@liquefy/basic-ui";
import { centerMiddle, centerMiddleStyle, column, columnStyle, fitContainerStyle, row, zStack, zStackElementStyle } from "@liquefy/basic-ui";
import { overflowVisibleStyle } from "@liquefy/basic-ui";
import { modal, modalFrame } from "@liquefy/basic-ui";
import { button } from "@liquefy/themed-ui";


const log = console.log;
const loga = (action) => {
  log("-----------" + action + "-----------");
}


function dialog(...parameters) {
  return new Dialog(toProperties(parameters));
}

const panelStyle = {
  backgroundColor: "rgb(250, 250, 250)",
  borderStyle: "solid", 
  borderRadius: "5px",
  borderWidth: "1px",
  padding: "20px"
}

const shadeColor = "rgba(0, 0, 0, 0.4)";
const transparentColor = "rgba(0, 0, 0, 0)";

export class Dialog extends Component {
  receive({close, content, children}) {
    this.close = close; 
    this.content = content; 
    // this.children = children ? children : []; 
    this.backgroundColor = shadeColor;
  }

  render() {
    // log("Dialog.build")
    
    const background = div({
      key: "background", 
      onClick: () => { this.close(); console.log("asdf") }, 
      style: {
        ...zStackElementStyle, 
        ...overflowVisibleStyle, 
        transition: "background-color 1000ms linear", 
        pointerEvents: "auto", 
        backgroundColor: this.backgroundColor
      }});
    const domNode = background.getPrimitive().getDomNode();
    // log(domNode);

    return zStack(
      background,
      centerMiddle(
        column(
          this.content,
          button("Close", () => this.close()), 
          // ...this.children,
          {style: {...panelStyle, ...overflowVisibleStyle}, pointerEvents: "auto", animateChildrenWhenThisAppears: true}
        ),
        {style: {...zStackElementStyle, ...overflowVisibleStyle, height: "100%"}}
      ),
      {style: fitContainerStyle, ...overflowVisibleStyle}
    )
  }
}


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
      modal(
        "modal",
        dialog("dialog", 
          dialogContent.show(this.showDialog && dialogIsModal), 
          {close: () => { this.showDialog = false}}
        )
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

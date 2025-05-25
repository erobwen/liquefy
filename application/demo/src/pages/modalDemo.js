import { Component } from "@liquefy/flow.core";
import { getFlowProperties } from "@liquefy/flow.core";
import { DOMRenderContext, text, div } from "@liquefy/flow.DOM";
import { panel } from "@liquefy/basic-ui";
import { centerMiddle, centerMiddleStyle, column, columnStyle, fitContainerStyle, row, zStack, zStackElementStyle } from "@liquefy/basic-ui";
import { overflowVisibleStyle } from "@liquefy/basic-ui";
import { modal, modalFrame } from "@liquefy/basic-ui";
import { button } from "@liquefy/basic-ui";


const log = console.log;
const loga = (action) => {
  log("-----------" + action + "-----------");
}


function dialog(...parameters) {
  return new Dialog(getFlowProperties(parameters));
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
  receive({close, text, children}) {
    this.close = close; 
    this.text = text; 
    this.children = children ? children : []; 
    this.backgroundColor = shadeColor;
  }

  render() {
    // log("Dialog.build")
    const background = div({
      key: "background", 
      style: {
        ...zStackElementStyle, 
        ...overflowVisibleStyle, 
        transition: "background-color 1000ms linear", 
        backgroundColor: this.backgroundColor
      }});
    const domNode = background.getPrimitive().getDomNode();
    // log(domNode);

    return zStack(
      background,
      centerMiddle(
        column(
          text(this.text),
          button("Close", () => this.close()), 
          ...this.children,
          {style: {...panelStyle, ...overflowVisibleStyle}, animateChildrenWhenThisAppears: true}
        ),
        {style: {...zStackElementStyle, ...overflowVisibleStyle, height: "100%", pointerEvents: "auto"}}
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
  receive() {
    // Object.assign(this, properties)
    this.name = "Modal Dialogs";
  }

  render() {
    return new BasicModalExample()
  }
}
  

class BasicModalExample extends Component {
 
  initialize() {
    this.showModal = false;
  }

  render() {
    return panel("panel",
      column("column",
        text("Standard responsive modal demo."),
        // row(
          button("Open Modal", ()=> {this.showModal = true;}),
          {style: overflowVisibleStyle}
        // ), 
        // modernButton({style: {width: "100px", height: "100px", backgroundColor: color}}),
      ),
      modal(
        "modal",
        dialog("dialog", "Modal!", {close: () => { this.showModal = false}})
      ).show(this.showModal),
      { style: { ...centerMiddleStyle, width: "300px", height: "300px", margin: "10px"}}
    );
  }
}

class FlyoutModalExample extends Component {
 
  initialize() {
    this.showModal = false;
  }

  render() {
    return panel("panel",
      column("column",
        text("Standard responsive modal demo."),
        // row(
          button("Open Modal", ()=> {this.showModal = true;}),
          {style: overflowVisibleStyle}
        // ), 
        // modernButton({style: {width: "100px", height: "100px", backgroundColor: color}}),
      ),
      modal(
        "modal",
        dialog("dialog", "Modal!", {close: () => { this.showModal = false}})
      ).show(this.showModal),
      { style: { ...centerMiddleStyle, width: "300px", height: "300px", margin: "10px"}}
    );
  }
}

class PopoverModalExample extends Component {
 
  initialize() {
    this.showModal = false;
  }

  render() {
    return panel("panel",
      column("column",
        text("Standard responsive modal demo."),
        // row(
          button("Open Modal", ()=> {this.showModal = true;}),
          {style: overflowVisibleStyle}
        // ), 
        // modernButton({style: {width: "100px", height: "100px", backgroundColor: color}}),
      ),
      modal(
        "modal",
        dialog("dialog", "Modal!", {close: () => {log("CLOSE"); this.showModal = false}})
      ).show(this.showModal),
      { style: { ...centerMiddleStyle, width: "300px", height: "300px", margin: "10px"}}
    );
  }
}

class HybridModalExample extends Component {
 
  initialize() {
    this.showModal = false;
  }

  render() {
    return panel("panel",
      column("column",
        text("Standard responsive modal demo."),
        // row(
          button("Open Modal", ()=> {this.showModal = true;}),
          {style: overflowVisibleStyle}
        // ), 
        // modernButton({style: {width: "100px", height: "100px", backgroundColor: color}}),
      ),
      modal(
        "modal",
        dialog("dialog", "Modal!", {close: () => {log("CLOSE"); this.showModal = false}})
      ).show(this.showModal),
      { style: { ...centerMiddleStyle, width: "300px", height: "300px", margin: "10px"}}
    );
  }
}


export class ModalStandaloneExample extends Component {
  render() {
    return (
      modalFrame(
        new ModalExample(),
        {style: overflowVisibleStyle}
      )
    ) 
  }
}



/**
 * Start the demo
 */
  
export function startModalDemo() {
  const root = new ModalStandaloneExample();
  new DOMRenderContext(document.getElementById("root")).render(root);
}

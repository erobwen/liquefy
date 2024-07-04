import { Component } from "../flow/Flow";
import { readFlowProperties } from "../flow/flowParameters";
import { DOMFlowTarget } from "../flow.DOM/DOMFlowTarget.js";
import { panel, text } from "../components/basic/BasicWidgets";
import { centerMiddle, centerMiddleStyle, column, columnStyle, fitContainerStyle, row, zStack, zStackElementStyle } from "../components/basic/Layout";
import { div } from "../flow.DOM/BasicHtml"
;
import { adjustLightness } from "../components/themed/Color";
import { modernButton } from "../components/modern/ModernButton";
import { overflowVisibleStyle } from "@liquefy/basicUI";
import { modal, modalFrame } from "../components/basic/Modal";
import { button } from "../components/themed/Theme";


const log = console.log;
const loga = (action) => {
  log("-----------" + action + "-----------");
}


function dialog(...parameters) {
  return new Dialog(readFlowProperties(parameters));
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
  setProperties({close, text, children}) {
    this.close = close; 
    this.text = text; 
    this.children = children ? children : []; 
    this.backgroundColor = shadeColor;
  }

  onDidDisplayFirstFrame() {
    this.backgroundColor = shadeColor;
    // log("onDidDisplayFirstFrame");
    // log("onDidDisplayFirstFrame: " + this.toString() + ".visibility = " + isVisible);
  }

  build() {
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
  setProperties({}) {
    // Object.assign(this, properties)
    this.name = "Modal Example";
  }


  build() {
    const openAnimatedModalButton = button("openAnimatedButton", this.showAnimatedModal ? "Close Animated Modal" : "Open Animated Modal", ()=> {this.showAnimatedModal = !this.showAnimatedModal;}, {animate: true});
    const color = "rgb(143, 212, 190)";
    return (
      modalFrame(
        column(
          new BasicModalExample(),
          {style: overflowVisibleStyle}
        )
      )
    );
  }
}
  

class BasicModalExample extends Component {
 
  setState() {
    this.showModal = false;
  }

  build() {
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
 
  setState() {
    this.showModal = false;
  }

  build() {
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
 
  setState() {
    this.showModal = false;
  }

  build() {
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
 
  setState() {
    this.showModal = false;
  }

  build() {
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


          // modal(
          //   "animatedModal",
          //   dialog("animatedDialog", "Animated Modal!", openAnimatedModalButton.show(this.showAnimatedModal), {close: () => {log("CLOSE"); this.showAnimatedModal = false}})
          // ).show(this.showAnimatedModal),

/**
 * Start the demo
 */
  
export function startModalDemo() {
  const root = new ModalExample();
  new DOMFlowTarget(document.getElementById("root")).setContent(root);
}

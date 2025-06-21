import { Component } from "@liquefy/flow.core";
import { div, code } from "@liquefy/flow.DOM";


import { wrapper, overlay, modal, dialogue, fitContainerStyle } from "@liquefy/basic-ui";
import { numberInputField, button, cardColumn, buttonIcon } from "@liquefy/themed-ui";

export function informationButton(...parameters) {
  return new InformationButton(...parameters)
}

export class InformationButton extends Component {
  render() {
    return buttonIcon(
      {icon: "information", style: {color: "blue"}}, 
      () => { this.open = true } 
    ) 
  }
}

export function displayCodeButton(...parameters) {
  return new DisplayCodeButton(...parameters)
}

export class DisplayCodeButton extends Component {
  receive({code}) {
    this.code = code;
  }

  initialize() {
    this.open = false;
  }

  //   this.content = div(this.code)

  //   this.visibleOnFrame = null;

  //   this.ensure(() => {
  //     if (this.open && this.isVisible) {
  //       // Try to show
  //       const overlayFrame = this.inherit("overlayFrame");
  //       if (overlayFrame) {
  //         this.visibleOnFrame = overlayFrame;
  //         overlayFrame.showOverlay(this.content);
  //       }
  //     } else {
  //       // Try to hide
  //       this.visibleOnFrame.hideOverlay(this.content);
  //       this.visibleOnFrame = null;
  //     }
  //   }) 
  // }

  render() {
    return wrapper(
      buttonIcon(
        {icon: "code", style: {color: "green"}}, 
        () => { this.open = true; console.log("open please... ") } 
      ),
      modal(
        div(
          code("codeBlock", this.code, {class: "language-js hljs language-javascript"}),
          {style: {overflowX: "hide", overflowY: "auto", width: 300, height: 200}}       
        ),
        {
          close: () => { this.open = false; }
        }
      ).show(this.open)
    ) 
  }
}

  
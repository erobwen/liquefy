import { Component } from "@liquefy/flow.core";
import { div } from "@liquefy/flow.DOM";


import { overlay } from "@liquefy/basic-ui";
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

  // initialize() {
  //   this.content = div(this.code)

  //   this.visibleOnFrame = null;
  //   this.open = false;
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
    return buttonIcon(
      {icon: "code", style: {color: "green"}}, 
      () => { this.open = true } 
    ) 
  }
}
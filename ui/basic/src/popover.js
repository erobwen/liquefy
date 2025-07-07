import { Component } from "@liquefy/flow.core";
import { div } from "@liquefy/flow.dom";

import { fitContainerStyle, overflowVisibleStyle, wrapper, zStack, zStackElementStyle } from "./Layout";
import { overlay } from "./overlay";

/**
 * Popover
 */
export const popover = (...parameters) => new Popover(...parameters)

class Popover extends Component {
  receive(properties) {
    const {children, reference, close, direction="top" } = properties; 
    this.children = children;
    this.reference = reference;
    this.close = close;
    this.direction = direction;
  } 

  initialize() {
    this.ensure(() => {
      if (this.isRendered()) {
        const background = this.getChild("background");
        if (background && background.domNode) {
          background.domNode.addEventListener("mousedown", () => { this.close() }, true);
        }
      }
    })
  }

  render() {
    const { children, reference } = this;

    if (children.length !== 1) throw new Error("Modal popover expects just one single child to get dimensions.");
    const popoverDimensions = children[0].getPrimitive().dimensions();
    const referenceRect = reference.getPrimitive().reactiveBoundingClientRect(); 
    const referenceRectMiddle = referenceRect.top + referenceRect.height / 2;
    const windowHeightMiddle = window.innerHeight / 2;
    const xSpace = window.innerWidth - referenceRect.width;
    const referenceXFraction = (xSpace - referenceRect.left) / xSpace; // 1 = to the right, 0 = to the left.
    const abstractReferenceXFraction = Math.round(referenceXFraction * 3)/3;  
    const menuBottom = {
      top:() => referenceRect.top, 
      bottom:() => referenceRect.bottom + popoverDimensions.height, 
    }[referenceRectMiddle < windowHeightMiddle ? "bottom" : "top"]();
    
    const menuLeft = referenceRect.left - (popoverDimensions.width - referenceRect.width) 
      + (popoverDimensions.width - referenceRect.width) * referenceXFraction;
  
    const background = div({
      key: "background", 
      style: {
        ...overflowVisibleStyle, 
        ...zStackElementStyle, 
        transition: "background-color 1000ms linear", 
        pointerEvents: "auto", 
        backgroundColor: "rgba(0, 0, 0, 0)"
      }});
  
    return overlay(
      zStack(
        background,
        div(
          wrapper(
            children, 
            {style: {pointerEvents: "auto", position: "absolute", top: menuBottom - popoverDimensions.height, left: menuLeft}
          }),
          {style: {...overflowVisibleStyle, ...zStackElementStyle}}
        ),
        {style: fitContainerStyle, ...overflowVisibleStyle}
      )
    )
  }
}


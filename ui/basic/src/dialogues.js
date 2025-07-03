
import { toPropertiesWithChildren, Component } from "@liquefy/flow.core";

import { div, addDefaultStyle, text } from "@liquefy/flow.DOM";

import { centerMiddle, centerMiddleStyle, column, columnStyle, fitContainerStyle, row, rowStyle, zStack, zStackElementStyle } from "./Layout";
import { button, buttonIcon } from "./buttons"
import { wrapper, overflowVisibleStyle, filler, middle } from "./Layout";
import { overlay } from "./overlay";
import { cardColumn, cardShadow4 } from "./card";


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
    // console.log(popoverDimensions);
    // if (!["top", "bottom"].includes(direction)) throw new Error("This component only supports 'top' as direction so far.")
  
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
      // onClick: () => { close(); }, 
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


/**
 * Modal
 */
const shadeColor = "rgba(0, 0, 0, 0.4)";

export const modal = (...parameters) => new Modal(...parameters);

export class Modal extends Component {
  receive({fullScreenTreshold, dialogue, dialogueProperties, close, content, children, backgroundColor=shadeColor}) {
    this.fullScreenTreshold = fullScreenTreshold;
    this.close = close; 
    this.dialogue = dialogue; 
    this.dialogueProperties = dialogueProperties; 
    this.content = content; 
    this.children = children;
    this.backgroundColor = backgroundColor;
    
    const sources = (dialogue ? 1 : 0) + (content ? 1 : 0) + (children ? 1 : 0)
    if (sources > 1) {
      throw new Error("Modal can only have one way to define the dialogue!")
    }  
  }

  
  render() {
    // console.log("render modal");
    // console.log(this.inherit("bounds"));
    // console.log(this.inherit("target"));
    // console.log(this.bounds);
    // console.log(this.renderContext);
    const isFullScreen = this.renderContext.bounds.width < this.fullScreenTreshold
    // console.log(this.fullScreenTreshold)
    // console.log(this.renderContext.bounds.width)
    // console.log(isFullScreen)
    if (isFullScreen) {
      return this.renderFullScreen();
    } else {
      return this.renderWindow()
    }
  }

  renderFullScreen() {
    let dialogue; 

    if (this.dialogue) {
      const properties = {
        ...this.dialogueProperties,
        close: this.close
      }
      // console.log(properties)
      dialogue = this.dialogue("dialogue", properties); 
    } else if (this.children) {
      dialogue = this.children[0];
    } else if (this.content) {
      dialogue = this.content; 
    }

    if (dialogue) {
      dialogue.attributes = {
        ...dialogue.attributes,
        style: {
          ...(dialogue.attributes ? dialogue.attributes.style : null),
          width: "100%", 
          height: "100%",
          maxWidth: "default",
          minWidth: 0,
        }
      }
    }
    
    // console.log(dialogue);

    return overlay("overlay", 
      dialogue
      // this.children, 
      // this.content
    );
  }
    
  renderWindow() {
    const dialogue = this.dialogue ? (
      this.dialogue("dialogue", {
        ...this.dialogueProperties, 
        close: this.close
      })      
    ) : null;

    return ( 
      overlay("overlay",
        zStack("zStack",
          div("background", {
            onClick: () => { this.close() }, 
            style: {
              ...zStackElementStyle, 
              ...overflowVisibleStyle, 
              transition: "background-color 1000ms linear", 
              pointerEvents: "auto", 
              backgroundColor: this.backgroundColor
            }
          }),
          centerMiddle("centerMiddle",
            // wrapper("dialogueWrapper",              
              dialogue,
              this.content,
              this.children,
            // ),
            {style: {...zStackElementStyle}}
          ),
          {style: fitContainerStyle}
        )
      )
    )
  }
}


/**
 * Dialogue
 */
export const dialogue = (...parameters) => {
  const properties = toPropertiesWithChildren(parameters)

  const {close, children, style, title, variant="filled"} = addDefaultStyle(properties, {
    boxShadow: cardShadow4, 
    padding: 0, 
    pointerEvents: "auto"
  }); 

  return (
    cardColumn("dialogue",
      row(
        filler(title ? middle(text(title), {style: {marginLeft: 10, color: "white"}}) : null, {style: rowStyle}),
        buttonIcon({icon: "close", onClick: () => close()})
      ),
      children,
      {
        variant,
        style
      }
    )
  );
}

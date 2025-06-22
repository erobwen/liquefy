
import { toPropertiesWithChildren, Component } from "@liquefy/flow.core";

import { div, addDefaultStyle } from "@liquefy/flow.DOM";

import { centerMiddle, centerMiddleStyle, column, columnStyle, fitContainerStyle, row, zStack, zStackElementStyle } from "./Layout";
import { button } from "./BasicWidgets"
import { wrapper, overflowVisibleStyle, filler } from "./Layout";
import { overlay } from "./overlay";



export const popover = (...parameters) => {
  const properties = toPropertiesWithChildren(parameters);
  const {children, reference, close, direction="top", modal=true, ...restOfProperties } = properties;
  if (children.length !== 1) throw new Error("Modal popover expects just one single child.");
  if (!modal) throw new Error("Non modal popover not supported yet. TODO: capture mouse down events before they become a click, and remove popover.")
  // const child = children[0];
  const popoverDimensions = children[0].getPrimitive().dimensions();

  if (direction !== "top") throw new Error("This component only supports 'top' as direction so far.")

  const referenceRect = reference.getPrimitive().reactiveBoundingClientRect(); 
  const xSpace = window.innerWidth - referenceRect.width;
  const referenceXFraction = (xSpace - referenceRect.left) / xSpace; // 1 = to the right, 0 = to the left.
  const abstractReferenceXFraction = Math.round(referenceXFraction * 3)/3;  

  const menuBottom = referenceRect.top;
  const menuLeft = referenceRect.left - (popoverDimensions.width - referenceRect.width) 
    + (popoverDimensions.width - referenceRect.width) * referenceXFraction;

  const background = div({
    key: "background", 
    onClick: () => { close(); }, 
    style: {
      ...zStackElementStyle, 
      ...overflowVisibleStyle, 
      transition: "background-color 1000ms linear", 
      pointerEvents: "auto", 
      backgroundColor: "rgba(0, 0, 0, 0)"
    }});
  const domNode = background.getPrimitive().getDomNode();

  return overlay(
    zStack(
      background,
      div(
        wrapper(
          children, 
          {style: {pointerEvents: "auto", position: "absolute", top: menuBottom - popoverDimensions.height, left: menuLeft}
        }),
        {style: {...zStackElementStyle, ...overflowVisibleStyle, height: "100%"}}
      ),
      {style: fitContainerStyle, ...overflowVisibleStyle}
    ),
    restOfProperties
  )
}



const log = console.log;
const loga = (action) => {
  log("-----------" + action + "-----------");
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


export const modal = (...parameters) => new Modal(...parameters);

export class Modal extends Component {
  receive({close, content, children, backgroundColor=shadeColor}) {
    this.close = close; 
    this.content = content; 
    this.children = children;
    this.backgroundColor = backgroundColor;
  }

  render() {
    return ( 
      overlay(
        zStack("zStack",
          wrapper("background", {
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
            this.content,
            this.children,
            {style: {...zStackElementStyle, height: "100%"}}
          ),
          {style: fitContainerStyle}
        )
      )
    )
  }
}


export const dialogue = (...parameters) => {
  const properties = toPropertiesWithChildren(parameters);
  addDefaultStyle(
    properties, 
    {...panelStyle, ...overflowVisibleStyle, padding: 0, pointerEvents: "auto"}
  )
  const {close, children, style} = properties; 

  return (
    column("dialogue",
      row(
        filler(),
        button("Close", () => close())
      ),
      children,
      {
        style
      }
    )
  );
}
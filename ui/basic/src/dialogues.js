
import { toPropertiesWithChildren } from "@liquefy/flow.core";

import { div } from "@liquefy/flow.DOM";

import { wrapper, overflowVisibleStyle, fitContainerStyle, zStack } from "./Layout";
import { zStackElementStyle } from "./Layout";
import { overlay } from "./overlay";



export const popover = (...parameters) => {
  const properties = toPropertiesWithChildren(parameters);
  const {children, reference, close, direction="top", modal=true, ...restOfProperties } = properties;
  if (children.length !== 1) throw new Error("Modal popover expects just one single child.");
  if (!modal) throw new Error("Non modal popover not supported yet. TODO: capture mouse down events before they become a click, and remove popover.")
  const child = children[0];
  const popoverDimensions = child.getPrimitive().dimensions();

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
          child, 
          {style: {pointerEvents: "auto", position: "absolute", top: menuBottom - popoverDimensions.height, left: menuLeft}
        }),
        {style: {...zStackElementStyle, ...overflowVisibleStyle, height: "100%"}}
      ),
      {style: fitContainerStyle, ...overflowVisibleStyle}
    ),
    restOfProperties
  )
}
import { getFlowPropertiesIncludingChildren } from "@liquefy/flow.core";
import { addDefaultStyleToProperties, div } from "@liquefy/flow.DOM";
import { rowStyle, columnStyle } from "./Layout";


export const borderColors = [
  denseColor(0.2),
  denseColor(0.3),
  denseColor(0.4),
  denseColor(0.5),
  denseColor(0.6),
  denseColor(0.7),
  denseColor(0.8)
];


export function denseColor(value) {
  return "rgb(0, 0, 0," + value + ")"; 
}


function getColor({elevation}) {
  if (!elevation) {
    return borderColors[2];
  } else {
    if (typeof borderColors[elevation] === "undefined") throw new Error("Invalid elevation!");
    return borderColors[elevation]
  }
}


/**
 * Reusable components. Flow component definitions.
 */

export const paper = (...parameters) =>  {
  const properties = getFlowPropertiesIncludingChildren(parameters);
  return (
    div(
      addDefaultStyleToProperties(
        properties,
        {
          boxSizing: "border-box",
  
          backgroundColor: "#eeeeee", 
          borderColor: getColor(properties), 
          borderStyle: "solid", 
          borderWidth: "1px", 
  
          padding: "10px", 
  
          margin: "4px", 
        }
      )
    )
  )
}

export const paperRow = (...parameters) => {
  const properties = getFlowPropertiesIncludingChildren(parameters);
  return paper(addDefaultStyleToProperties(
    properties, 
    rowStyle
  ))
}


export const paperColumn = (...parameters) => {
  const properties = getFlowPropertiesIncludingChildren(parameters);
  return paper(addDefaultStyleToProperties(
    properties, 
    columnStyle
  ))
}
import { getFlowPropertiesIncludingChildren } from "@liquefy/flow.core";
import { addDefaultStyleToProperties, div } from "@liquefy/flow.DOM";
import { rowStyle, columnStyle } from "@liquefy/basic-ui";

export const paperShadows = [
   "",
   "0px 2px 1px -1px rgba(0, 0, 0, 0.2), 0px 1px 1px 0px rgba(0, 0, 0, 0.14), 0px 1px 3px 0px rgba(0, 0, 0, 0.12)",
   "0px 3px 1px -2px rgba(0, 0, 0, 0.2), 0px 2px 2px 0px rgba(0, 0, 0, 0.14), 0px 1px 5px 0px rgba(0, 0, 0, 0.12)",
   "0px 3px 3px -2px rgba(0, 0, 0, 0.2), 0px 3px 4px 0px rgba(0, 0, 0, 0.14), 0px 1px 8px 0px rgba(0, 0, 0, 0.12)",
   "0px 2px 4px -1px rgba(0, 0, 0, 0.2), 0px 4px 5px 0px rgba(0, 0, 0, 0.14), 0px 1px 10px 0px rgba(0, 0, 0, 0.12)",
   "0px 3px 5px -1px rgba(0, 0, 0, 0.2), 0px 5px 8px 0px rgba(0, 0, 0, 0.14), 0px 1px 14px 0px rgba(0, 0, 0, 0.12)",
   "0px 3px 5px -1px rgba(0, 0, 0, 0.2), 0px 6px 10px 0px rgba(0, 0, 0, 0.14), 0px 1px 18px 0px rgba(0, 0, 0, 0.12)"
];

export const paperShadow0 = paperShadows[0];
export const paperShadow1 = paperShadows[1];
export const paperShadow2 = paperShadows[2];
export const paperShadow3 = paperShadows[3];
export const paperShadow4 = paperShadows[4];
export const paperShadow5 = paperShadows[5];
export const paperShadow6 = paperShadows[6];

export const buttonShadow = paperShadow2


function getBoxShadow({elevation}) {
  if (!elevation) {
    return paperShadow2;
  } else {
    if (typeof paperShadows[elevation] === "undefined") throw new Error("Invalid elevation!");
    return paperShadows[elevation]
  }
}

function getSuitableMargin({elevation}) {
  if (!elevation) {
    return "4px";
  } else {
    if (typeof paperShadows[elevation] === "undefined") throw new Error("Invalid elevation!");
    return {
      0: "2px",
      1: "3px",
      2: "4px",
      3: "5px",
      4: "6px",
      5: "7px",
      6: "8px",
    }[elevation];
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
          borderColor: "#cccccc", 
          borderStyle: "solid", 
          borderWidth: "1px", 
  
          padding: "10px", 
  
          margin: getSuitableMargin(properties), 
          borderRadius: "4px",
          transition: "box-shadow 300ms cubic-bezier(0.4, 0, 0.2, 1)",
          boxShadow: getBoxShadow(properties)
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
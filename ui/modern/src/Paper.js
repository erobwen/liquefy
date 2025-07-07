import { toPropertiesWithChildren } from "@liquefy/flow.core";
import { addDefaultStyle, div } from "@liquefy/flow.dom";
import { rowStyle, columnStyle } from "@liquefy/basic-ui";

export const cardShadows = [
   "",
   "0px 2px 1px -1px rgba(0, 0, 0, 0.2), 0px 1px 1px 0px rgba(0, 0, 0, 0.14), 0px 1px 3px 0px rgba(0, 0, 0, 0.12)",
   "0px 3px 1px -2px rgba(0, 0, 0, 0.2), 0px 2px 2px 0px rgba(0, 0, 0, 0.14), 0px 1px 5px 0px rgba(0, 0, 0, 0.12)",
   "0px 3px 3px -2px rgba(0, 0, 0, 0.2), 0px 3px 4px 0px rgba(0, 0, 0, 0.14), 0px 1px 8px 0px rgba(0, 0, 0, 0.12)",
   "0px 2px 4px -1px rgba(0, 0, 0, 0.2), 0px 4px 5px 0px rgba(0, 0, 0, 0.14), 0px 1px 10px 0px rgba(0, 0, 0, 0.12)",
   "0px 3px 5px -1px rgba(0, 0, 0, 0.2), 0px 5px 8px 0px rgba(0, 0, 0, 0.14), 0px 1px 14px 0px rgba(0, 0, 0, 0.12)",
   "0px 3px 5px -1px rgba(0, 0, 0, 0.2), 0px 6px 10px 0px rgba(0, 0, 0, 0.14), 0px 1px 18px 0px rgba(0, 0, 0, 0.12)"
];

export const cardShadow0 = cardShadows[0];
export const cardShadow1 = cardShadows[1];
export const cardShadow2 = cardShadows[2];
export const cardShadow3 = cardShadows[3];
export const cardShadow4 = cardShadows[4];
export const cardShadow5 = cardShadows[5];
export const cardShadow6 = cardShadows[6];

export const buttonShadow = cardShadow2


function getBoxShadow({elevation}) {
  if (!elevation) {
    return cardShadow2;
  } else {
    if (typeof cardShadows[elevation] === "undefined") throw new Error("Invalid elevation!");
    return cardShadows[elevation]
  }
}

function getSuitableMargin({elevation}) {
  if (!elevation) {
    return "4px";
  } else {
    if (typeof cardShadows[elevation] === "undefined") throw new Error("Invalid elevation!");
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

export const card = (...parameters) =>  {
  const properties = toPropertiesWithChildren(parameters);
  return (
    div(
      addDefaultStyle(
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

export const cardRow = (...parameters) => {
  const properties = toPropertiesWithChildren(parameters);
  return card(addDefaultStyle(
    properties, 
    rowStyle
  ))
}


export const cardColumn = (...parameters) => {
  const properties = toPropertiesWithChildren(parameters);
  return card(addDefaultStyle(
    properties, 
    columnStyle
  ))
}
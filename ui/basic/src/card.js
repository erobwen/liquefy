import { toPropertiesWithChildren } from "@liquefy/flow.core";
import { addDefaultStyle, div } from "@liquefy/flow.DOM";
import { rowStyle, columnStyle } from "./Layout";

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


function getBoxShadow({elevation}) {
  if (!elevation) {
    return cardShadow2;
  } else {
    if (typeof cardShadows[elevation] === "undefined") throw new Error("Invalid elevation!");
    return cardShadows[elevation]
  }
}


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

export const card = (...parameters) =>  {
  const properties = toPropertiesWithChildren(parameters);
  const {variant="elevated"} = properties;
  return (
    div(
      addDefaultStyle(
        properties,
        getCardStyle(variant)
      )
    )
  )
}

function getCardStyle(variant) {
  if (variant === "elevated") {
    return {
      padding: 10,
      borderRadius:  2,
      // borderRadius: "var(--shape-corner)",
      backgroundColor: "rgb(var(--mdui-color-surface-container-low))",
      boxShadow: "var(--mdui-elevation-level1)",
    }
  } else if (variant === "filled") {
    return {
      padding: 10,
      borderRadius:  2,
      borderStyle: "solid",
      borderWidth: 0,
      backgroundColor: "rgb(179 168 206)",
      // backgroundColor: "rgba(179 168 206, 0.5)",
    }
  } else if (variant === "outlined") {
    return {
      padding: 10,
      borderRadius:  2,
      borderStyle: "solid",
      borderWidth: 1,
      borderColor: "rgb(var(--mdui-color-outline))"
    }
  }
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
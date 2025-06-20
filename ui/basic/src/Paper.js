import { toPropertiesWithChildren } from "@liquefy/flow.core";
import { addDefaultStyleToProperties, div } from "@liquefy/flow.DOM";
import { rowStyle, columnStyle } from "./Layout";
import { borderStyle } from "../../modern";


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
      addDefaultStyleToProperties(
        properties,
        getCardStyle(variant)
      )
    )
  )
}

function getCardStyle(variant) {
  if (variant === "elevated") {
    return {
      padding: "10px",
      borderRadius:  2,
      // borderRadius: "var(--shape-corner)",
      backgroundColor: "rgb(var(--mdui-color-surface-container-low))",
      boxShadow: "var(--mdui-elevation-level1)",
    }
  } else if (variant === "filled") {
    return {
      padding: "10px",
      borderRadius:  2,
      backgroundColor: "rgba(179 168 206, 0.5)",
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
  return card(addDefaultStyleToProperties(
    properties, 
    rowStyle
  ))
}


export const cardColumn = (...parameters) => {
  const properties = toPropertiesWithChildren(parameters);
  return card(addDefaultStyleToProperties(
    properties, 
    columnStyle
  ))
}
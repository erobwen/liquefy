import { toPropertiesWithChildren } from "@liquefy/flow.core";
import { addDefaultStyle, text } from "@liquefy/flow.DOM";
import { card, cardRow } from "./components";
import { icon } from "./components";
import { centerMiddle, filler, row } from "@liquefy/basic-ui";


const iconNames = {
  "warning": "exclamation-triangle",
  "error": "exclamation-circle",
  "info": "info", // Consider: "info-circle" did not work and gave a double glyph? Why did it work for basic-ui? 
  "success": "check-circle"
}

const backgroundColors = {
  "warning": "#fff4e5",
  "error" : "#fdeded",
  "info": "#f0f8ff",
  "success": "#edf7ed"
}

const iconColors = {
  "warning": "rgb(237, 108, 2)",
  "error" : "rgb(211, 47, 47)",
  "info": "rgb(2, 136, 209)",
  "success": "rgb(46, 125, 50)"
}

const colors = {
  "warning": "rgb(102, 60, 0)",
  "error" : "rgb(95, 33, 32)",
  "info": "rgb(1, 67, 97)",
  "success": "rgb(30, 70, 32)"
}

export function alert(...parameters) {
  const properties = toPropertiesWithChildren(parameters);
  addDefaultStyle(properties, {
    whiteSpace: "normal",
    height: "auto", 
    gap: 10
  })

  const { severity="warning", children, style } = properties;

  if (!style.backgroundColor) style.backgroundColor = backgroundColors[severity];
 
  return cardRow(
    icon({
      name: iconNames["info"], 
      style: { fontSize: 40, margin: 10, color: iconColors[severity]}
    }),
    filler(children, { style: { color: colors[severity]}}),
    { style }
  )
}

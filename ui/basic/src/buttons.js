import { button as htmlButton, addDefaultStyle, findImplicitChildrenAndOnClick, toButtonProperties, toInputProperties } from "@liquefy/flow.DOM";

import { centerMiddle } from "./Layout.js";
import { icon as iconComponent } from "./Icons.js";
import { extractExpectedProperty } from "@liquefy/flow.core/index.js";


export function button(...parameters) { 
  const properties = toButtonProperties(parameters)
  addDefaultStyle(properties, {lineHeight: 28, cursor: "pointer"}) //, display: "block"
  return htmlButton(properties);
};

export function buttonIcon(...parameters) {
  const properties = toButtonProperties(parameters)
  addDefaultStyle(properties, {width: 40, height: 40, lineHeight: 40, cursor: "pointer"}) //, display: "block"
  const { icon, ...restOfProperties } = properties;
  return centerMiddle(iconComponent({name: icon}), restOfProperties);
}

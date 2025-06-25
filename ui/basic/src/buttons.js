import { trace, callback, toProperties, getRenderContext, extractProperty } from "@liquefy/flow.core";
import { elementNode, text, div, label as htmlLabel, button as htmlButton, addDefaultStyle, findImplicitChildrenAndOnClick, toButtonProperties, toInputProperties } from "@liquefy/flow.DOM";

import { centerMiddle, filler, row } from "./Layout.js";
import { faIcon } from "./Icons.js";

const log = console.log;

export function button(...parameters) { 
  const properties = toButtonProperties(parameters)
  addDefaultStyle(properties, {lineHeight: 28, cursor: "pointer"}) //, display: "block"
  return htmlButton(properties);
};

export function buttonIcon(...parameters) {
  const properties = toButtonProperties(parameters)
  addDefaultStyle(properties, {width: 28, height: 28, lineHeight: 28, cursor: "pointer"}) //, display: "block"
  const { name, ...restOfProperties } = properties;
  return centerMiddle(faIcon({name}), properties);
}

import { getFlowProperties, getTarget } from "@liquefy/flow.core";

import { div, elementNode, extractAttributes, addDefaultStyleToProperties } from "@liquefy/flow.DOM";

// import flowImage from "../../resources/flow.svg"

const log = console.log;

export function svgImage(...parameters) {
  // return getTarget().create({type: "elementNode", tagName: "img", attributes: {style: {padding: "20px", backgroundColor: "white"}, src: flowImage}});
  const properties = getFlowProperties(parameters);
  addDefaultStyleToProperties(properties, {padding: "20px", backgroundColor: "white"});
  const attributes = extractAttributes(properties);
  attributes.src = properties.image;
  return getTarget().create({type: "elementNode", tagName: "img", attributes});
}
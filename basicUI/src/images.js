import { addDefaultStyleToProperties, readFlowProperties, getTarget } from "@liquefy/flow.core";

import { div, elemenNode, extractAttributes } from "@liquefy/flow.DOM";

// import flowImage from "../../resources/flow.svg"

const log = console.log;

export function svgImage(...parameters) {
  // return getTarget().create({type: "elementNode", tagName: "img", attributes: {style: {padding: "20px", backgroundColor: "white"}, src: flowImage}});
  const properties = readFlowProperties(parameters);
  addDefaultStyleToProperties(properties, {padding: "20px", backgroundColor: "white"});
  const attributes = extractAttributes(properties);
  attributes.src = parameters.image;
  return getTarget().create({type: "elementNode", tagName: "img", attributes});
}
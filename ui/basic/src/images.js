import { getFlowProperties, getRenderContext } from "@liquefy/flow.core";

import { div, elementNode, addDefaultStyleToProperties } from "@liquefy/flow.DOM";
import { extractProperty } from "../../../flow.core/src/flowParameters";

// import flowImage from "../../resources/flow.svg"

const log = console.log;

export function svgImage(...parameters) {
  // return getRenderContext().primitive({type: "elementNode", tagName: "img", attributes: {style: {padding: "20px", backgroundColor: "white"}, src: flowImage}});
  const properties = getFlowProperties(parameters);
  addDefaultStyleToProperties(properties, {padding: "20px", backgroundColor: "white"});
  properties.src = extractProperty(properties, "image");
  return getRenderContext().primitive({type: "elementNode", tagName: "img", ...properties});
}
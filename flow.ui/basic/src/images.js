import { toProperties, getRenderTarget } from "@liquefy/flow.core";

import { div, elementNode, addDefaultStyle } from "@liquefy/flow.dom";
import { extractProperty } from "@liquefy/flow.core";

// import flowImage from "../../resources/flow.svg"

const log = console.log;

export function svgImage(...parameters) {
  const properties = toProperties(parameters);
  addDefaultStyle(properties, {padding: "20px", backgroundColor: "white"});
  properties.src = extractProperty(properties, "image");
  return elementNode({tagName: "img", ...properties});
}
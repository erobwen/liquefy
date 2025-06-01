import { toProperties, getRenderContext } from "@liquefy/flow.core";

import { div, elementNode, addDefaultStyleToProperties } from "@liquefy/flow.DOM";
import { extractProperty } from "../../../flow.core/src/implicitProperties";

// import flowImage from "../../resources/flow.svg"

const log = console.log;

export function svgImage(...parameters) {
  const properties = toProperties(parameters);
  addDefaultStyleToProperties(properties, {padding: "20px", backgroundColor: "white"});
  properties.src = extractProperty(properties, "image");
  return elementNode({tagName: "img", ...properties});
}
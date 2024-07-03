import { div, elemenNode } from "@liquefy/flow";
import { addDefaultStyleToProperties, readFlowProperties } from "@liquefy/flow";
import { extractAttributes } from "@liquefy/flow";
import { getTarget } from "@liquefy/flow";

// import flowImage from "../../resources/flow.svg"

const log = console.log;

export function svgImage(...parameters) {
  // return getTarget().create({type: "dom.elementNode", tagName: "img", attributes: {style: {padding: "20px", backgroundColor: "white"}, src: flowImage}});
  const properties = readFlowProperties(parameters);
  addDefaultStyleToProperties(properties, {padding: "20px", backgroundColor: "white"});
  const attributes = extractAttributes(properties);
  attributes.src = parameters.image;
  return getTarget().create({type: "dom.elementNode", tagName: "img", attributes});
}
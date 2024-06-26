import { div, elemenNode } from "../flow.DOM/BasicHtml";
import flow from "../../resources/flow.svg"
import { getTarget } from "../flow/flowBuildContext";
import { addDefaultStyleToProperties, readFlowProperties } from "../flow/flowParameters";
import { extractAttributes } from "../flow.DOM/domNodeAttributes";

const log = console.log;

export function svgImage(...parameters) {
  return getTarget().create({type: "dom.elementNode", tagName: "img", attributes: {style: {padding: "20px", backgroundColor: "white"}, src: flow}});
  const properties = readFlowProperties(parameters);
  addDefaultStyleToProperties(properties, {padding: "20px", backgroundColor: "white"});
  const attributes = extractAttributes(properties);
  attributes.src = parameters.image;
  return getTarget().create({type: "dom.elementNode", tagName: "img", attributes});
}
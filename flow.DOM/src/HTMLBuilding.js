
import { getTarget } from "@liquefy/flow.core";
import { getFlowProperties, extractProperty } from "@liquefy/flow.core";
import { extractAttributes } from "./domNodeAttributes";
import { getFlowPropertiesIncludingChildren } from "../../flow.core/src";


/**
 * Element Node
 */
export function elementNode(...parameters) {
  let properties = getFlowPropertiesIncludingChildren(parameters); 
  extractAttributes(properties);
  return getTarget().create({type: "elementNode", ...properties});
}


/**
 * Text Node
 */
export function textNode(...parameters) {
  let properties = getFlowProperties(parameters);
  findImplicitSingleTextInContent(properties); 
  return getTarget().create({type: "textNode", ...properties});
}

function findImplicitSingleTextInContent(properties) {
  if (!properties.argumentsContent) return;
  if (properties.argumentsContent.length > 1) throw new Error("Expecting just one text as content");
  const argumentsContent = extractProperty(properties, "argumentsContent");
  if (argumentsContent.length !== 1) throw new Error("Expected just one implicit content")
  if (!["string", "number"].includes(typeof argumentsContent[0])) throw new Error("Expecting a string or number as content");
  if (properties.text) throw new Error("Found implicit text, but 'text' is already definded in properties given.");
  properties.text = argumentsContent[0] + "";
}


// Note: this is needed because for some reason create() breaks on a childs array.  
// export function extractLoneChild(properties) {
//   if (!properties.children) return;
//   if (properties.children.length === 0) {
//     properties.children = null;
//   } else if (properties.children.length === 1) {
//     properties.children = properties.children[0];
//   }
// }


/**
 * Default style
 */
export function addDefaultStyleToProperties(properties, defaultStyle) {
  properties.style = Object.assign({}, defaultStyle, properties.style);
  return properties;
}

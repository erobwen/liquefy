
import { getTarget } from "@liquefy/flow.core";
import { readFlowProperties, findImplicitChildren } from "@liquefy/flow.core";
import { extractAttributes, extractProperty } from "./domNodeAttributes";


/**
 * HTML tags
 */
export function span(...parameters) {
  // log("Span")
  let properties = findImplicitChildren(readFlowProperties(parameters)); 
  const attributes = extractAttributes(properties);
  return getTarget().create({type: "elementNode", tagName: "span", key: properties.key, classNameOverride: "span", attributes, children: properties.children, animate: properties.animate});
}

export function div(...parameters) {
  let properties = findImplicitChildren(readFlowProperties(parameters)); 
  // extractLoneChild(properties);
  // console.log(properties);
  const attributes = extractAttributes(properties);
  return getTarget().create({type: "elementNode", tagName: "div", key: properties.key, classNameOverride: "div", attributes, children: properties.children, animate: properties.animate});
}


/**
 * Basic HTML Node building 
 */
export function elemenNode(...parameters) {
  let properties = findImplicitChildren(readFlowProperties(parameters)); 
  const attributes = extractAttributes(properties);
  return getTarget().create({type: "elementNode", key: properties.key, attributes, children: properties.children});
}

export function textNode(...parameters) {
  let properties = readFlowProperties(parameters);
  findImplicitSingleTextInContent(properties); 
  const attributes = extractAttributes(properties);
  return getTarget().create({type: "textNode", text: properties.text, key: properties.key, attributes});
}

function findImplicitSingleTextInContent(properties) {
  if (!properties.content) return;
  if (properties.content.length > 1) throw new Error("Expecting just one text as content");
  const content = extractProperty(properties, "content");
  if (!["string", "number"].includes(typeof properties.content[0])) throw new Error("Expecting a string or number as content");
  if (properties.text) throw new Error("Found implicit text, but 'text' is already definded in properties given.");
  properties.text = content[0] + "";
}

export function styledDiv(classNameOverride, style, parameters) { 
  const properties = findImplicitChildren(readFlowProperties(parameters));
  const attributes = extractAttributes(properties);
  attributes.style = {...style, ...attributes.style}; // Inject given style (while making it possible to override)
  return getTarget().create({type: "elementNode", key: properties.key, classNameOverride, tagName: "div", attributes, ...properties }); 
}

// Note: this is needed because for some reason create() breaks on a childs array.  
export function extractLoneChild(properties) {
  if (!properties.children) return;
  if (properties.children.length === 0) {
    properties.children = null;
  } else if (properties.children.length === 1) {
    properties.children = properties.children[0];
  }
}
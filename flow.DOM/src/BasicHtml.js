
import { getTarget } from "@liquefy/flow.core";
import { readFlowProperties, findTextAndKeyInPropertiesUsingCase, findTextAndKeyInProperties, findKeyInProperties } from "@liquefy/flow.core";
import { extractAttributes, extractProperty } from "./domNodeAttributes";


/**
 * HTML tags
 */
export function span(...parameters) {
  // log("Span")
  let properties = findTextAndKeyInPropertiesUsingCase(readFlowProperties(parameters)); 
  const attributes = extractAttributes(properties);
  textToTextNode(properties);
  return getTarget().create({type: "dom.elementNode", tagName: "span", key: properties.key, classNameOverride: "span", attributes, children: properties.children, animate: properties.animate});
}

export function div(...parameters) {
  let properties = findTextAndKeyInProperties(readFlowProperties(parameters)); 
  textToTextNode(properties);
  const attributes = extractAttributes(properties);
  return getTarget().create({type: "dom.elementNode", tagName: "div", key: properties.key, classNameOverride: "div", attributes, children: properties.children, animate: properties.animate});
}


/**
 * Basic HTML Node building 
 */
export function elemenNode(...parameters) {
  let properties = findKeyInProperties(readFlowProperties(parameters)); 
  const attributes = extractAttributes(properties);
  return getTarget().create({type: "dom.elementNode", key: properties.key, attributes, children: properties.children});
}

export function textNode(...parameters) {
  let properties = findTextAndKeyInProperties(readFlowProperties(parameters)); 
  const attributes = extractAttributes(properties);
  return getTarget().create({type: "dom.textNode", text: properties.text, key: properties.key, attributes});
}

export function styledDiv(classNameOverride, style, parameters) { 
  const properties = findKeyInProperties(readFlowProperties(parameters));
  const attributes = extractAttributes(properties);
  attributes.style = {...style, ...attributes.style}; // Inject row style (while making it possible to override)
  return getTarget().create({type: "dom.elementNode", key: properties.key, classNameOverride, tagName: "div", attributes, ...properties }); 
}

export function textToTextNode(properties) {
  if (properties.text) { //textToTextNode(parameters);
    // TODO: Investigate why there is an infinite loop if we do not add array around children??
    properties.children = 
      // [
        getTarget().create({
          type: "dom.textNode",
          key: properties.key ? properties.key + ".text" : null,
          text: extractProperty(properties, "text"),
        })
      // ]
      ;
  }
}


import { extractProperty, toProperties, getRenderContext } from "@liquefy/flow.core";
import { DOMNode } from "./DOMNode";    
import { domNodeClassRegistry } from "./DOMRenderContext";
const log = console.log;


/**
 * Text Node
 */
export function textNode(...parameters) {
  const properties = getTextNodeProperties(parameters)
  return getRenderContext().primitive({type: "textNode", ...properties});
}

export const text = textNode;

// TODO: Make this correspond more to the standard parameter lists? 
export function getTextNodeProperties(parameters) {
  let properties; 
  let text; 
  if (typeof(parameters[0]) === "string" || typeof(parameters[0]) === "number") {
    text = parameters.shift() + "";
  } 
  if (typeof(parameters[0]) === "object") {
    properties = parameters.shift();
  }
  if (!properties) properties = {};
  if (properties.text && text) throw new Error("Cannot have both text as parameter and as property!");
  if (text) {
    properties.text = text; 
  }
  return properties;
}

export function toPropertiesWithImplicitSingleText(parameters) {
  let properties = toProperties(parameters);
  findImplicitSingleTextInContent(properties); 
  return properties; 
}

export function findImplicitSingleTextInContent(properties) {
  if (!properties.componentContent) return;
  if (properties.componentContent.length > 1) throw new Error("Expecting just one text as content");
  const componentContent = extractProperty(properties, "componentContent");
  if (componentContent.length !== 1) throw new Error("Expected just one implicit content")
  if (!["string", "number"].includes(typeof componentContent[0])) throw new Error("Expecting a string or number as content");
  if (properties.text) throw new Error("Found implicit text, but 'text' is already definded in properties given.");
  properties.text = componentContent[0] + "";
}


// Note: this is needed because for some reason primitive() breaks on a childs array.  
// export function extractLoneChild(properties) {
//   if (!properties.children) return;
//   if (properties.children.length === 0) {
//     properties.children = null;
//   } else if (properties.children.length === 1) {
//     properties.children = properties.children[0];
//   }
// }

export class DOMTextNode extends DOMNode {
  
  receive(properties) {
    this.text = extractProperty(properties, "text");

    const redundantProperties = Object.keys(properties);  
    if (redundantProperties.length > 0) 
      throw new Error("Unexpected keys in DOMNode properties: " + redundantProperties.join(", "));
  }
  
  createEmptyDomNode() {
    return document.createTextNode("");
  }

  ensureDomNodeAttributesSet() {
    // console.log(this.toString() + ".ensureDomNodeAttributesSet:");
    // console.log(element);
    this.domNode.nodeValue = this.text; // toString()
  }

  synchronizeDomNodeStyle(properties) {
    // for (let property of properties) {
    //   this.domNode.style[property] = "";
    // }
  }
}

domNodeClassRegistry["textNode"] = DOMTextNode;

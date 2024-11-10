import { getFlowProperties } from "@liquefy/flow.core";
import { globalContext } from "@liquefy/flow.core";
import { getCreator } from "@liquefy/flow.core";
import { getElementNodeProperties } from "@liquefy/flow.DOM";


/**
 * Theme
 */
globalContext.theme = model({
  modifiers: model({}),
  components: model({})
}); 
  
export function getGlobalTheme() {
  return globalContext.theme;
}

export function setGlobalTheme(theme) {
  globalContext.theme = globalContext.theme = model(theme);
}

export function getTheme() {
  return getCreator().inherit("theme");
} 

export function getThemedComponent(name, properties) {
  const theme = getTheme();
  if (!theme || !theme.components) {
      throw new Error("Theme contains no components!");
  } 
  const component = theme.components[name]; 
  if (!component) {
      throw new Error(`Could not get themed component: '${name}'`);
  }
  return component(properties); 
} 


/**
 * Components
 */
export const filler = (...parameters) => getThemedComponent("filler", getFlowProperties(parameters));
export const fillerStyle = (...parameters) => getThemedComponent("fillerStyle", getFlowProperties(parameters));
export const row = (...parameters) => getThemedComponent("row", getFlowProperties(parameters));
export const column = (...parameters) => getThemedComponent("column", getFlowProperties(parameters));
export const checkboxInputField = (...parameters) => getThemedComponent("checkboxInputField", getFlowProperties(parameters));
export const numberInputField = (...parameters) => getThemedComponent("numberInputField", getFlowProperties(parameters));
export const crossIcon = (...parameters) => getThemedComponent("crossIcon", getFlowProperties(parameters));
export const plusIcon = (...parameters) => getThemedComponent("plusIcon", getFlowProperties(parameters));
export const suitcaseIcon = (...parameters) => getThemedComponent("suitcaseIcon", getFlowProperties(parameters));
export const icon = (...parameters) => getThemedComponent("icon", getFlowProperties(parameters));
export const button = (...parameters) => getThemedComponent("button", getFlowProperties(parameters));
export const textInputField = (...parameters) => getThemedComponent("textInputField", getFlowProperties(parameters));
export const paper = (...parameters) => getThemedComponent("paper", getFlowProperties(parameters));
export const paperColumn = (...parameters) => getThemedComponent("paperColumn", getFlowProperties(parameters));
export const paperRow = (...parameters) => getThemedComponent("paperRow", getFlowProperties(parameters));


/**
 * Standardized properties
 */
export const getButtonProperties = (parameters, additionalAttributes) => {
  const properties = getFlowProperties(parameters);
  findImplicitChildrenAndOnClick(properties);
  getElementNodeProperties(properties, additionalAttributes);
  return properties; 
}


export function findImplicitChildrenAndOnClick(properties) {
  const componentContent = extractProperty(properties, "componentContent");
  if (!componentContent) return properties;
  
  let children = null;
  let onClick = null;
  for (let item of componentContent) {
    if (typeof item === "function") {
      if (onClick) throw new Error("Can only have one onClick function as flow content.");
      onClick = item; 
    } else {
      if (!children) children = [];
      children.push(item);
    }
  }
  if (onClick) {
    if (properties.onClick) { 
      // What about onClick in attributes?
      throw new Error("implicitly defined onClick already defined explicitly in properties.");
    }
    properties.onClick = onClick;
  }
  // if (!properties.onClick) throw new Error("Expected onClick defined as a property.");
  if (children) {
    if (properties.children) {
      throw new Error("implicitly defined children already defined explicitly in properties.");
    }
    properties.children = children;
  }
  createTextNodesFromStringChildren(properties, properties.key);
  return properties;
}

function createTextNodesFromStringChildren(properties, keyPrefix) {
  if (!properties.children) return;

  let stamp = 1;

  properties.children = properties.children.map(child => {
    if (typeof child === "undefined" || child === null || child === false) {
      return child; 
    } else if (typeof child === "string" || typeof child === "number") {
      return getRenderContext().primitive({type: "textNode", key: keyPrefix ? keyPrefix + ".text-" + stamp++ : null, text: child});
    } else if (child instanceof Component) {
      return child; 
    } else {
      throw new Error("Dont know what to do with flow component child: " + child.toString());  
    }
  }); 
}

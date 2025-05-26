import { getFlowProperties } from "@liquefy/flow.core";
import { globalContext } from "@liquefy/flow.core";
import { getCreator } from "@liquefy/flow.core";
import { getInputProperties } from "@liquefy/flow.DOM";

/**
 * Contextual Theme
 */
export function getTheme() {
  return getCreator().inherit("theme");
} 


/**
 * Global Theme Setup
 */
globalContext.theme = model({
  modifiers: {},
  components: {},
  styles: {}
}); 
  
export function assignGlobalTheme(theme) {
  // TODO: Assign other parts of theme as well. 
  Object.assign(globalContext.theme.components, theme.components);
  Object.assign(globalContext.theme.components, theme.style);
}

export function getGlobalTheme() {
  return globalContext.theme;
}


/**
 * Create Themed Components
 */
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
export const row = (...parameters) => getThemedComponent("row", getFlowProperties(parameters));
export const column = (...parameters) => getThemedComponent("column", getFlowProperties(parameters));
export const crossIcon = (...parameters) => getThemedComponent("crossIcon", getFlowProperties(parameters));
export const plusIcon = (...parameters) => getThemedComponent("plusIcon", getFlowProperties(parameters));
export const suitcaseIcon = (...parameters) => getThemedComponent("suitcaseIcon", getFlowProperties(parameters));
export const icon = (...parameters) => getThemedComponent("icon", getFlowProperties(parameters));
export const button = (...parameters) => getThemedComponent("button", getFlowProperties(parameters));
export const inputField = (...parameters) => getThemedComponent("inputField", getFlowProperties(parameters));
export const paper = (...parameters) => getThemedComponent("paper", getFlowProperties(parameters));
export const paperColumn = (...parameters) => getThemedComponent("paperColumn", getFlowProperties(parameters));
export const paperRow = (...parameters) => getThemedComponent("paperRow", getFlowProperties(parameters));
// Styles: 
export const fillerStyle = (...parameters) => getThemedComponent("fillerStyle", getFlowProperties(parameters));


/**
 * Derrived components 
 */
export function checkboxInputField(...parameters) {
  const properties = getInputProperties(parameters);
  properties.type = "checkbox";
  return inputField(properties);
}

export function numberInputField(...parameters) {
  const properties = getInputProperties(parameters);
  properties.type = "number";
  return inputField(properties);
}

export function textInputField(...parameters) {
  const properties = getInputProperties(parameters);
  properties.type = "text";
  return inputField(properties);
}
import { toProperties } from "@liquefy/flow.core";
import { globalContext } from "@liquefy/flow.core";
import { getCreator } from "@liquefy/flow.core";
import { toInputProperties, addDefaultStyle } from "@liquefy/flow.DOM";
import { toPropertiesWithChildren } from "../../flow.core/src/implicitProperties";
// import { columnStyle } from "@liquefy/basic-ui";

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
export const filler = (...parameters) => getThemedComponent("filler", toProperties(parameters));
export const row = (...parameters) => getThemedComponent("row", toProperties(parameters));
export const listItem = (...parameters) => getThemedComponent("listItem", toProperties(parameters)); 
export const column = (...parameters) => getThemedComponent("column", toProperties(parameters));
export const crossIcon = (...parameters) => getThemedComponent("crossIcon", toProperties(parameters));
export const plusIcon = (...parameters) => getThemedComponent("plusIcon", toProperties(parameters));
export const suitcaseIcon = (...parameters) => getThemedComponent("suitcaseIcon", toProperties(parameters));
export const icon = (...parameters) => getThemedComponent("icon", toProperties(parameters));
export const button = (...parameters) => getThemedComponent("button", toProperties(parameters));
export const inputField = (...parameters) => getThemedComponent("inputField", toProperties(parameters));
export const input = (...parameters) => getThemedComponent("input", toInputProperties(parameters));
export const card = (...parameters) => getThemedComponent("card", toPropertiesWithChildren(parameters));
export const cardColumn = (...parameters) => getThemedComponent("cardColumn", toPropertiesWithChildren(parameters));
export const cardRow = (...parameters) => getThemedComponent("cardRow", toPropertiesWithChildren(parameters));
// export const cardColumn = (...parameters) => getThemedComponent("card", addDefaultStyle(toProperties(parameters), columnStyle));
// Styles: 
export const fillerStyle = (...parameters) => getThemedComponent("fillerStyle", toProperties(parameters));


/**
 * Derrived components 
 */
export function checkboxInputField(...parameters) {
  const properties = toInputProperties(parameters);
  properties.type = "checkbox";
  return input(properties);
}

export function numberInputField(...parameters) {
  const properties = toInputProperties(parameters);
  properties.type = "number";
  return input(properties);
}

export function textInput(...parameters) {
  const properties = toInputProperties(parameters);
  properties.type = "text";
  return input(properties);
}
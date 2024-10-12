import { getFlowProperties } from "@liquefy/flow.core";
import { globalContext } from "@liquefy/flow.core";
import { getCreator } from "@liquefy/flow.core";


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


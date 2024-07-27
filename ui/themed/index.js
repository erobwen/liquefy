import { getFlowProperties } from "@liquefy/flow.core";
import { getThemedComponent } from "@liquefy/flow.DOM";

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

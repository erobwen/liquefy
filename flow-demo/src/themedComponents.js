import { getFlowProperties } from "../../flow.core/src";
import { getThemedComponent } from "../../flow.DOM/src/domFlowBuildContext";

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

import { getTheme } from "../../flow.core/src/flowBuildContext";
import { getFlowProperties } from "../../flow.core/src/flowParameters"


/**
 * Helper
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
 * Themed components
 */
export const button = (...parameters) => getThemedComponent("button", getFlowProperties(parameters));
export const input = (...parameters) => getThemedComponent("input", getFlowProperties(parameters));


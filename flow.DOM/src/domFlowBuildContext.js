import { getTheme } from "../../flow.core/src/flowBuildContext";
import { getFlowProperties } from "../../flow.core/src/flowParameters"


/**
 * Themed components
 */
export const button = (...parameters) => {
    const properties = getFlowProperties(parameters);
    const theme = getTheme();
    if (!theme || !theme.components || !theme.components.button) {
        throw new Error("Could not get themed component: 'button'");
    }
    return theme.components.button; 
}

export const input = (...parameters) => {
    const properties = getFlowProperties(parameters);
    const theme = getTheme();
    if (!theme || !theme.components || !theme.components.button) {
        throw new Error("Could not get themed component: 'input'");
    }
    return theme.components.button; 
}
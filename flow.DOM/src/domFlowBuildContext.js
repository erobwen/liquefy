import { getTheme } from "../../flow.core/src/flowBuildContext";


/**
 * Helper (move to themed ui)
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


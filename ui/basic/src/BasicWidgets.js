import { trace, callback, toProperties, getRenderContext, extractProperty } from "@liquefy/flow.core";
import { elementNode, text, div, label as htmlLabel, button as htmlButton, addDefaultStyle, findImplicitChildrenAndOnClick, toButtonProperties, toInputProperties } from "@liquefy/flow.DOM";


const lineHeight = "20px"; 

export let basicWidgetTheme = {
  lineHeight: "20px",
  rowGap: "10px", 
  text: {
    style: {
      margin: "5px",
      lineHeight
    }
  },
  inputField: {

  },
  fontSize: 20,
}


/**
 * Basic widgets
 */

/**
 * Label
 */
export function label(...parameters) {
  let properties = toProperties(parameters);

  // inherit("theme").text.style

  // Default style
  properties.style = Object.assign({}, basicWidgetTheme.text.style, properties.style);

  return htmlLabel(properties)
}




/**
 * Input fields
 * 
 * Properties: 
 * 
 * labeledText, getter, setter, targetObject, targetProperty
 * 
 * (either getter|setter OR targetObject|targetProperty) 
 * 
 * Shorthand content: 
 * 
 * [labelText, getter, setter]
 * 
 * OR
 * 
 * [labelText, targetObject, targetProperty]
 */


export const panel = (...parameters) => {
  const properties = toProperties(parameters);
  addDefaultStyle(properties, {
    margin: "4px", 
    borderRadius: "5px", 
    backgroundColor: "#eeeeee", 
    borderColor: "#cccccc", 
    borderStyle: "solid", 
    borderWidth: "1px", 
    padding: "10px", 
    boxSizing: "border-box"
  });
  return div(properties);
}


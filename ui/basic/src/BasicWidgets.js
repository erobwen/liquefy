import { trace, callback, toProperties, getRenderContext, extractProperty } from "@liquefy/flow.core";
import { elementNode, text, div, label as htmlLabel, button as htmlButton, addDefaultStyle, findImplicitChildrenAndOnClick, toButtonProperties, toInputProperties } from "@liquefy/flow.DOM";

import { filler, row } from "./Layout.js";

const log = console.log;

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
export function checkboxInputField(...parameters) {
  const properties = toInputProperties(parameters);
  properties.type = "checkbox";
  return inputField(properties);
}

export function numberInputField(...parameters) {
  const properties = toInputProperties(parameters);
  properties.type = "number";
  return inputField(properties);
}

export function textInput(...parameters) {
  const properties = toInputProperties(parameters);
  properties.type = "text";
  return inputField(properties);
}

export function inputField(properties) {
  const type = extractProperty(properties, "type");
  const labelText = extractProperty(properties, "labelText");
  const getter = extractProperty(properties, "getter");
  const setter = extractProperty(properties, "setter");
  const getErrors = extractProperty(properties, "getErrors");  
  const inputProperties = extractProperty(properties, "inputProperties");
  const inputStyle = extractProperty(inputProperties, "style");

  addDefaultStyle(properties, {height: 28})

  let errors;

  if (getErrors) {
    errors = getErrors();
  }

  const inputAttributes = {
    onInput: callback(properties.key + ".oninput", event => setter(type === "checkbox" ? event.target.checked : event.target.value)),
    onClick: properties.onClick,
    value: getter(),
    checked: getter(),
    type,
    style: {
      backgroundColor: errors ? "rgba(255, 240, 240, 255)" : "white",
      borderColor: "rgba(200, 200, 200, 20)", //errors ? "red" : 
      borderStyle: "solid",
      borderWidth: "1px", 
      ...(type === "number" ? { width: 40 } : {}),
      ...inputStyle
    },
    ...inputProperties
  };
  
  const children = [
    elementNode({
      key: properties.key + ".input", 
      tagName: "input",
      componentTypeName: type + "InputField", 
      attributes: inputAttributes
    })
  ]; 
  const labelChild = label(text(labelText), {style: {paddingRight: "4px", margin: "", lineHeight: 20}}); 
  if (type === "checkbox") {
    children.push(labelChild);
  } else {
    children.unshift(filler());
    children.unshift(labelChild);
  }
  addDefaultStyle(
    properties,
    {
      lineHeight: 28, 
      // alignSelf: "center", 
      alignItems: "stretch", 
      padding: 4, ...properties.style
    }
  )
  return row({
    children, 
    ...properties
  });
}


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


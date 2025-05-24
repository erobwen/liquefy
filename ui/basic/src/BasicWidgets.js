import { findImplicitTextInputFieldParameters, findImplicitNumberInputFieldParameters, findImplicitCheckboxInputFieldParameters } from "@liquefy/ui-abstract";
import { trace, Component, callback } from "@liquefy/flow.core";
import { getRenderContext } from "@liquefy/flow.core";
import { getFlowProperties, findImplicitChildrenAndOnClick, getFlowPropertiesIncludingChildren } from "@liquefy/flow.core";

import { text, div, label as htmlLabel, button as htmlButton, addDefaultStyleToProperties } from "@liquefy/flow.DOM";

import { filler, row } from "./Layout.js";
import { extractProperty } from "../../../flow.core/src/flowParameters.js";

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
  let properties = getFlowProperties(parameters);

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
  const properties = getFlowProperties(parameters);
  findImplicitCheckboxInputFieldParameters(properties);
  return inputField(properties);
}

export function numberInputField(...parameters) {
  const properties = getFlowProperties(parameters);
  findImplicitNumberInputFieldParameters(properties);
  return inputField(properties);
}

export function textInputField(...parameters) {
  const properties = getFlowProperties(parameters);
  findImplicitTextInputFieldParameters(properties);
  return inputField(properties);
}

export function inputField(properties) {
  const type = extractProperty(properties, "type");
  let labelText = extractProperty(properties, "labelText");
  let getter = extractProperty(properties, "getter");
  let setter = extractProperty(properties, "setter");
  let getErrors = extractProperty(properties, "getErrors");

  let errors;

  if (getErrors) {
    errors = getErrors();
  }

  const inputAttributes = properties.inputProperties ? properties.inputProperties : {};
  delete properties.inputProperties;
  if (inputAttributes) {
    if (type === "number") {
      if (!inputAttributes.style) inputAttributes.style = {};
      if (!inputAttributes.style.width) inputAttributes.style.width = "40px";
    } 
  }
  const attributes = {
    oninput: callback(properties.key + ".oninput", event => setter(type === "checkbox" ? event.target.checked : event.target.value)),
    value: getter(),
    checked: getter(),
    type,
    style: {
      backgroundColor: errors ? "rgba(255, 240, 240, 255)" : "white",
      borderColor: "rgba(200, 200, 200, 20)", //errors ? "red" : 
      borderStyle: "solid",
      borderWidth: "1px" 
    },
    ...inputAttributes
  };
  
  const children = [getRenderContext().primitive({type: "elementNode", 
    key: properties.key + ".input", 
    componentTypeName: type + "InputField", 
    tagName: "input", 
    attributes, 
    onClick: properties.onClick})];
  const labelChild = label(text(labelText), {style: {paddingRight: "4px", margin: ""}}); 
  if (type === "checkbox") {
    children.push(labelChild);
  } else {
    children.unshift(filler());
    children.unshift(labelChild);
  }
  
  return row({style: {alignItems: "center", padding: "4px", ...properties.style}, children, ...properties}, );
}

// export const button = modernButton;

export const getButtonProperties = (parameters) => {
  const properties = getFlowProperties(parameters);
  findImplicitChildrenAndOnClick(properties);
  return properties; 
}

export function button(...parameters) { 
  const properties = getButtonProperties(parameters)

  addDefaultStyleToProperties(properties, {lineHeight: "28px", display: "block"})
  if (properties.disabled) properties.disabled = true; 
  
  // Inject debug printout in click.
  let result; 
  if (trace && properties.onClick) {
    const onClick = properties.onClick;
    properties.onClick = () => {
      // console.log("clicked at: " + JSON.stringify(result.getPath()));
      onClick();
    }  
  }

  return htmlButton(properties);
};

export const panel = (...parameters) => {
  const properties = getFlowProperties(parameters);
  addDefaultStyleToProperties(properties, {
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


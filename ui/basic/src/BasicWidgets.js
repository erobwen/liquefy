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
 * Shorthand parameter list for input fields. 
 * 
 * labelText, getter, setter
 * 
 * OR
 * 
 * labelText, targetObject, targetProperty
 * 
 * Extra feature: labelText will double as a key if you have no other key given. 
 */

export function findImplicitInputFieldParameters(properties) {
  const componentContent = extractProperty(properties, "componentContent");
  if (!componentContent) return properties;
  if (!componentContent.length === 4) throw new Error("An input field should have label text, getter and setter or object and property."); 

  properties.labelText = componentContent.shift();
  if (!properties.key) properties.key = properties.labelText;
  if (typeof(componentContent[0]) === "function") {
    properties.getter = componentContent.shift();
    console.log("here")
    properties.setter = componentContent.shift();
    console.log(properties.setter);
  } else {
    properties.targetObject = componentContent.shift();
    properties.targetProperty = componentContent.shift();
  }
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
  properties.type = "checkbox";
  findImplicitInputFieldParameters(properties);
  return inputField(properties);
}

export function numberInputField(...parameters) {
  const properties = getFlowProperties(parameters);
  properties.type = "number";
  findImplicitInputFieldParameters(properties);
  return inputField(properties);
}

export function textInputField(...parameters) {
  const properties = getFlowProperties(parameters);
  properties.type = "text";
  findImplicitInputFieldParameters(properties);
  return inputField(properties);
}

export function inputField(properties) {
  const type = extractProperty(properties, "type");
  let labelText = extractProperty(properties, "labelText");
  let getter = extractProperty(properties, "getter");
  let setter = extractProperty(properties, "setter");
  const targetObject = extractProperty(properties, "targetObject");
  const targetProperty = extractProperty(properties, "targetProperty");

  if (!getter && targetObject) {
    properties.key = properties.key + "." + targetObject.causality.id + "." + targetProperty;
    getter = callback(properties.key + ".getter", () => targetObject[targetProperty]);
    setter = callback(properties.key + ".setter", newValue => { targetObject[targetProperty] = (type === "number") ? parseInt(newValue) : newValue;})
  }

  // Cannot function as both key and label.... hmm.... or can it! 
  // let key;
  let error;

  if (targetObject) {
    error = targetObject[targetProperty + "Error"];
  }

  const inputAttributes = properties.inputProperties;
  delete properties.inputProperties;
  if (inputAttributes) {
    if (type === "number") {
      if (!inputAttributes.style) inputAttributes.style = {};
      if (!inputAttributes.style.width) inputAttributes.style.width = "50px";
    } 
  }
  const attributes = {
    oninput: callback(properties.key + ".oninput", event => setter(type === "checkbox" ? event.target.checked : event.target.value)),
    value: getter(),
    checked: getter(),
    type,
    style: {
      backgroundColor: error ? "rgba(255, 240, 240, 255)" : "white",
      borderColor: "rgba(200, 200, 200, 20)", //error ? "red" : 
      borderStyle: "solid",
      borderWidth: "1px" 
    },
    ...inputAttributes
  };
  
  const children = [getRenderContext().create({type: "elementNode", 
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


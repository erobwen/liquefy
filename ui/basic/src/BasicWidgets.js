import { trace, Component, callback } from "@liquefy/flow.core";
import { getTarget } from "@liquefy/flow.core";
import { getFlowProperties, findImplicitChildrenAndOnClick, getFlowPropertiesIncludingChildren } from "@liquefy/flow.core";

import { text, div, input, label as htmlLabel, button as htmlButton, extractAttributes, addDefaultStyleToProperties } from "@liquefy/flow.DOM";

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
export function label(...arglist) {
  let properties = getFlowProperties(arglist);

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

export function getInputFieldProperties(arglist) {
  return findInputFieldContent(getFlowProperties(arglist));
}

export function findInputFieldContent(properties) {
  const content = extractProperty(properties, "content");
  if (!content) return properties;
  if (!content.length === 4) throw new Error("An input field should have label text, getter and setter or object and property."); 

  properties.labelText = content.shift();
  
  if (!properties.key) properties.key = properties.labelText;

  if (typeof(content[0]) === "function") {
    properties.getter = content.shift();
    properties.setter = content.shift();
  } else {
    properties.targetObject = content.shift();
    properties.targetProperty = content.shift();
  }

  console.log(properties);
  return properties; 
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
export function checkboxInputField(...arglist) {
  const properties = getInputFieldProperties(arglist);
  properties.type = "checkbox";
  return inputField(properties);
}

export function numberInputField(...arglist) {
  const properties = getInputFieldProperties(arglist);
  properties.type = "number";
  return inputField(properties);
}

export function textInputField(...arglist) {
  const properties = getInputFieldProperties(arglist);
  properties.type = "text";
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

  const inputAttributes = extractAttributes(properties.inputProperties);
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
  
  const children = [input({
    key: properties.key + ".input", 
    // classNameOverride: type + "InputField", // TODO: Consider how to do?
    attributes, 
    onClick: properties.onClick
  })];
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

export function button(...arglist) { 
  const properties = getFlowProperties(arglist);
  findImplicitChildrenAndOnClick(properties);

  addDefaultStyleToProperties(properties, {lineHeight: "28px", display: "block"})
  const attributes = extractAttributes(properties);
  if (properties.disabled) attributes.disabled = true; 
  
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

export const panel = (...arglist) => {
  const properties = getFlowProperties(arglist);
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


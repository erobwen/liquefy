import { trace, Component, callback } from "@liquefy/flow.core";
import { getTarget } from "@liquefy/flow.core";
import { getFlowProperties, findImplicitChildrenAndOnClick, getFlowPropertiesIncludingChildren } from "@liquefy/flow.core";

import { text, div, label as htmlLabel, button as htmlButton, extractAttributes, addDefaultStyleToProperties } from "@liquefy/flow.DOM";

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
  let properties = getFlowProperties(parameters);

  // inherit("theme").text.style

  // Default style
  properties.style = Object.assign({}, basicWidgetTheme.text.style, properties.style);

  return htmlLabel(properties)
}


/**
 * Input macro flow
 * 
 * highlighted arguments: label, getter, setter,
 */
export function checkboxInputField(labelText, getter, setter, ...parameters) {
  return inputField("checkbox", labelText, getter, setter, ...parameters);
}

export function numberInputField(labelText, getter, setter, ...parameters) {
  return inputField("number", labelText, getter, setter, ...parameters);
}

export function textInputField(labelText, getter, setter, ...parameters) {
  return inputField("text", labelText, getter, setter, ...parameters);
}

export function inputField(type, labelText, getter, setter, ...parameters) {
  const properties = getFlowProperties(parameters);
  let key;
  let error;
  if (!properties.key) {
    properties.key = labelText;
  }

  if (typeof(getter) === "object" && typeof(setter) === "string") {
    const targetObject = getter;
    const targetProperty = setter; 
    properties.key = properties.key + "." + targetObject.causality.id + "." + targetProperty;
    key = properties.key; 
    getter = callback(() => targetObject[targetProperty], properties.key + ".getter");
    setter = callback(newValue => { targetObject[targetProperty] = (type === "number") ? parseInt(newValue) : newValue;}, properties.key + ".setter")
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
    oninput: callback(event => setter(type === "checkbox" ? event.target.checked : event.target.value), properties.key + ".oninput"),
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
  
  const children = [getTarget().create({type: "elementNode", 
    key: properties.key + ".input", 
    classNameOverride: type + "InputField", 
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

export function button(...parameters) { 
  const properties = getFlowProperties(parameters);
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


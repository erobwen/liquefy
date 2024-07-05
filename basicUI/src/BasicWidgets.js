import { trace, Component, callback } from "@liquefy/flow.core";
import { getTarget } from "@liquefy/flow.core";
import { getFlowProperties, findImplicitChildrenAndOnClick, addDefaultStyleToProperties } from "@liquefy/flow.core";

import { extractProperty, extractChildStyles, div, extractAttributes } from "@liquefy/flow.DOM";

import { filler, row } from "./Layout.js";
import { extractLoneChild } from "../../flow.DOM/src/BasicHtml.js";
import { findImplicitChildren, getFlowPropertiesAndChildren } from "../../flow.core/src/flowParameters.js";

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
 * Text macro flow
 * 
 * arguments: key, text, animate, + all HTML attributes 
 */
export function text(...parameters) { // TODO: Rename as label, move to basicUI
  let properties = getFlowProperties(parameters);

  // inherit("theme").text.style

  // Default style
  properties.style = Object.assign({}, basicWidgetTheme.text.style, properties.style);

  return label(properties)
}


export function label(...parameters) { // TODO: Rename as label
  let properties = getFlowPropertiesAndChildren(parameters);

  // const debugIdentifier = properties.text ? properties.text.substring(0, 20) + "..." : "...";
  extractAttributes(properties);

  // A label surrounded by div
  if (properties.div) return textDiv(properties);
  
  const key = extractProperty(properties, "key");
  const label = getTarget().create(key ? key : null, // TODO: move key into? 
    {
      type: "elementNode",
      classNameOverride: "text",// + debugIdentifier + "]",
      tagName: "label",
      attributes: extractProperty(properties, "attributes"), 
      children: extractProperty(properties, "children"), 
      animate: extractProperty(properties, "animate")
    });

  // Error on too many properties. TODO: Move this test to inside the create function? 
  if (Object.keys(properties).length) {
    throw new Error("text() macro flow got unknown properties:" + Object.keys(properties).join(", "));
  }

  return label; 
}


export function textDiv(properties) {
  delete properties.div;
  const style = extractChildStyles(extraproperties.attributes.style); 
  const animate = extractProperty(properties, "animate"); 
  const key = extractProperty(properties, "key");
  properties.key = key ? key + ".label" : null;
  return div(label(properties), {key, style, animate});
}


/**
 * Input macro flow
 * 
 * highlighted arguments: label, getter, setter,
 */
export function checkboxInputField(label, getter, setter, ...parameters) {
  return inputField("checkbox", label, getter, setter, ...parameters);
}

export function numberInputField(label, getter, setter, ...parameters) {
  return inputField("number", label, getter, setter, ...parameters);
}

export function textInputField(label, getter, setter, ...parameters) {
  return inputField("text", label, getter, setter, ...parameters);
}

export function inputField(type, label, getter, setter, ...parameters) {
  const properties = getFlowProperties(parameters);
  let key;
  let error;
  if (!properties.key) {
    properties.key = label;
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
  if (type === "number") {
    if (!inputAttributes.style) inputAttributes.style = {};
    if (!inputAttributes.style.width) inputAttributes.style.width = "50px";
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
  const labelChild = text(label, {style: {paddingRight: "4px", margin: ""}, ...properties.labelProperties}); 
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

  extractLoneChild(properties);
  const creationProperties = {
    type: "elementNode",
    classNameOverride: "button", 
    tagName: "button", 
    attributes, 
    children: properties.children, 
  }
  if (typeof(properties.animate) !== "undefined") { // Note: Had to do this to make animate undefined in the flow, so a set value could survive recreation. 
    creationProperties.animate = properties.animate;
  }
  if (typeof(properties.onClick) !== "undefined") { // Note: Had to do this to make onClick undefined in the flow, so a set value could survive recreation. 
    creationProperties.onClick = properties.onClick;
  }
  result = getTarget().create(properties.key, creationProperties);
  return result; 
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


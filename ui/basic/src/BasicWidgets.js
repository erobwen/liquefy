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
  let labelText = extractProperty(properties, "labelText");
  let getter = extractProperty(properties, "getter");
  let setter = extractProperty(properties, "setter");
  let getErrors = extractProperty(properties, "getErrors");
  addDefaultStyle(properties, {height: 28})

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
    onInput: callback(properties.key + ".oninput", event => setter(type === "checkbox" ? event.target.checked : event.target.value)),
    onClick: properties.onClick,
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
  
  const children = [
    elementNode({
      key: properties.key + ".input", 
      componentTypeName: type + "InputField", 
      tagName: "input", 
      attributes
    })
  ]; 
  const labelChild = label(text(labelText), {style: {paddingRight: "4px", margin: ""}}); 
  if (type === "checkbox") {
    children.push(labelChild);
  } else {
    children.unshift(filler());
    children.unshift(labelChild);
  }
  
  return row({style: {alignItems: "center", padding: "4px", ...properties.style}, children, ...properties}, );
}



export function button(...parameters) { 
  const properties = toButtonProperties(parameters)

  addDefaultStyle(properties, {lineHeight: "28px"}) //, display: "block"
  // if (properties.disabled) properties.disabled = true; 
  
  // Inject debug printout in click.
  // let result; 
  // if (trace && properties.onClick) {
  //   const onClick = properties.onClick;
  //   properties.onClick = () => {
  //     // console.log("clicked at: " + JSON.stringify(result.getPath()));
  //     onClick();
  //   }  
  // }

  return htmlButton(properties);
};

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


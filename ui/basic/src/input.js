import { callback, extractProperty } from "@liquefy/flow.core";
import { elementNode, text, label, addDefaultStyle, toInputProperties } from "@liquefy/flow.dom";
import { filler, row } from "./Layout";

/**
 * Input
 */
export function input(...parameters) {
  const properties = toInputProperties(parameters);
  return inputField(properties);
}

export function textInput(...parameters) {
  const properties = toInputProperties(parameters);
  properties.type = "text";
  return inputField(properties);
}

export function checkboxInput(...parameters) {
  const properties = toInputProperties(parameters);
  properties.type = "checkbox";
  return inputField(properties);
}

export function numberInput(...parameters) {
  const properties = toInputProperties(parameters);
  properties.type = "number";
  return inputField(properties);
}



/**
 * Input field (legacy)
 */
export function inputField(properties) {
  const type = extractProperty(properties, "type");
  const labelText = extractProperty(properties, "labelText");
  const getter = extractProperty(properties, "getter");
  const setter = extractProperty(properties, "setter");
  const getErrors = extractProperty(properties, "getErrors");  
  const style = properties.style;
  addDefaultStyle(
    properties,
    {
      alignItems: "stretch",      
    }
  )

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
      boxSizing: "border-box",
      backgroundColor: errors ? "rgba(255, 240, 240, 255)" : "white",
      borderColor: "rgba(200, 200, 200, 20)", //errors ? "red" : 
      borderStyle: "solid",
      borderWidth: "1px", 
      ...(type === "number" ? { width: 40 } : {}),
      ...((style && style.height) ? { height: style.height } : { height: 28 }),
    },
  };
  // console.log("Input attributes", inputAttributes);
  
  const children = [
    elementNode({
      key: properties.key + ".input", 
      tagName: "input",
      componentTypeName: type + "Input", 
      attributes: inputAttributes
    })
  ]; 
  const labelChild = label(
    text(labelText), 
    {style: {
      paddingRight: "4px", 
      margin: "", 
      ...((style && style.height) ? 
        { height: style.height, lineHeight: style.height } 
        : 
        { height: 28, lineHeight: 28 }),
    }}
  ); 
  if (type === "checkbox") {
    children.push(labelChild);
  } else {
    children.unshift(filler());
    children.unshift(labelChild);
  }
  return row({
    children, 
    ...properties
  });
}


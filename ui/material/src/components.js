import 'mdui/mdui.css';
import 'mdui';
import { getFlowProperties, getRenderContext } from "@liquefy/flow.core";
import { getButtonProperties, getInputProperties } from "@liquefy/flow.DOM";
import "./components.css";


/**
 * Icon component
 */
export const icon = (...parameters) => {
  const properties = getFlowProperties(parameters)
  const {key, ...attributes} = properties;
  return getRenderContext().primitive({
    key: key, 
    type: "elementNode", 
    tagName: "mdui-icon", 
    attributes
  })
}


/**
 * Button component
 */
export const button = (...parameters) => {
  const properties = getButtonProperties(parameters);
  const {key, ...attributes} = properties;
  return getRenderContext().primitive({
    key, 
    type: "elementNode", 
    tagName: "mdui-button", 
    ...attributes
  })
}


/**
 * Input element
 * 
 * type: 'text' | 'number' | 'password' | 'url' | 'email' | 'search' | 'tel' | 'hidden' | 'date' | 'datetime-local' | 'month' | 'time' | 'week'
 * inputmode: 'none' | 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url'
 */
export const input = (...parameters) => {
  const properties = getInputProperties(parameters);
  const {key, labelText, setter, getter, ...attributes} = properties;
  return getRenderContext().primitive({
    key, 
    type: "elementNode",
    tagName: "mdui-text-field", 
    attributes: {
      onInput: (event) => setter(event.target.value),
      value: getter(),
      label: labelText,
      ...attributes
    }
  });
}


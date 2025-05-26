import 'mdui/mdui.css';
import 'mdui';
import { getFlowProperties, getRenderContext } from "@liquefy/flow.core";
import { getButtonProperties, getInputProperties, elementNode } from "@liquefy/flow.DOM";
import "./components.css";

import { getMduiInputProperties } from './implicitProperties';


/**
 * Tag creation helper
 */
function taggedElement(tagName, properties) {
  return elementNode({tagName: tagName, componentTypeName: tagName, ...properties});
}


/**
 * Components
 */
export const icon = (...parameters) => taggedElement("mdui-icon", getFlowProperties(parameters));
export const button = (...parameters) => taggedElement("mdui-button", getButtonProperties(parameters));
export const input = (...parameters) => taggedElement("mdui-button", getMduiInputProperties(parameters));




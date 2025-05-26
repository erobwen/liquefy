import 'mdui/mdui.css';
import 'mdui';
import { toProperties, getRenderContext } from "@liquefy/flow.core";
import { toButtonProperties, toInputProperties, elementNode } from "@liquefy/flow.DOM";
import "./components.css";

import { toMduiInputProperties } from './implicitProperties';


/**
 * Tag creation helper
 */
function taggedElement(tagName, properties) {
  return elementNode({tagName: tagName, componentTypeName: tagName, ...properties});
}


/**
 * Components
 */
export const icon = (...parameters) => taggedElement("mdui-icon", toProperties(parameters));
export const button = (...parameters) => taggedElement("mdui-button", toButtonProperties(parameters));
export const input = (...parameters) => taggedElement("mdui-button", toMduiInputProperties(parameters));




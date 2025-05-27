import 'mdui/mdui.css';
import 'mdui';
import { toProperties, getRenderContext, toPropertiesWithChildren } from "@liquefy/flow.core";
import { toButtonProperties, toInputProperties, elementNode } from "@liquefy/flow.DOM";

import { toMduiInputProperties } from './implicitProperties';
import "./components.css";



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

export const layout = (...parameters) => taggedElement("mdui-layout", toPropertiesWithChildren(parameters));
export const topAppBar = (...parameters) => taggedElement("mdui-top-app-bar", toPropertiesWithChildren(parameters));
export const navigationDrawer = (...parameters) => taggedElement("mdui-navigation-drawer", toPropertiesWithChildren(parameters));
export const layoutMain = (...parameters) => taggedElement("mdui-layout-main", toPropertiesWithChildren(parameters));

export const buttonIcon = (...parameters) => taggedElement("mdui-button-icon", toPropertiesWithChildren(parameters));
export const topAppBarTitle = (...parameters) => taggedElement("mdui-top-app-bar-title", toPropertiesWithChildren(parameters));
export const langSelect = (...parameters) => taggedElement("pr-lang-select", toProperties(parameters));
export const themeSelect = (...parameters) => taggedElement("pr-theme-select", toProperties(parameters));
export const dropdown = (...parameters) => taggedElement("mdui-dropdown", toPropertiesWithChildren(parameters));

export const list = (...parameters) => taggedElement("mdui-list", toPropertiesWithChildren(parameters));
export const listItem = (...parameters) => taggedElement("mdui-list-item", toPropertiesWithChildren(parameters));
export const collapse = (...parameters) => taggedElement("mdui-collapse", toPropertiesWithChildren(parameters));
export const collapseItem = (...parameters) => taggedElement("mdui-collapseItem", toPropertiesWithChildren(parameters));




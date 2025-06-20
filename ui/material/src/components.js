import 'mdui/mdui.css';
import 'mdui/components/layout.js';
import 'mdui/components/layout-item.js';
import 'mdui/components/layout-main.js';
import 'mdui/components/button-icon.js';
import 'mdui';
import { toProperties, getRenderContext, toPropertiesWithChildren } from "@liquefy/flow.core";
import { toButtonProperties, toInputProperties, elementNode, addDefaultStyle } from "@liquefy/flow.DOM";

import { toMduiInputProperties } from './implicitProperties';
import "./components.css";
import { rowStyle, columnStyle } from '@liquefy/basic-ui'



/**
 * Tag creation helper
 */
function taggedElement(tagName, properties) {
  return elementNode({
    tagName: tagName, 
    componentTypeName: tagName, 
    ...properties
  });
}


/**
 * Components
 */
export const icon = (...parameters) => taggedElement("mdui-icon", toProperties(parameters));
export const button = (...parameters) => taggedElement("mdui-button", toButtonProperties(parameters));
export const input = (...parameters) => taggedElement("mdui-text-field", toMduiInputProperties(parameters));
export const card = (...parameters) => {
  const properties = toPropertiesWithChildren(parameters); 
  const {variant="elevated"} = properties;
  return taggedElement(
    "div", 
    addDefaultStyle(
      properties,
      getCardStyle(variant)
    )
  );
}

function getCardStyle(variant) {
  if (variant === "elevated") {
    return {
      padding: "10px",
      borderRadius:  "0.75rem",
      // borderRadius: "var(--shape-corner)",
      backgroundColor: "rgb(var(--mdui-color-surface-container-low))",
      boxShadow: "var(--mdui-elevation-level1)",
    }
  } else if (variant === "filled") {
    return {
      padding: "10px",
      borderRadius:  "0.75rem",
      backgroundColor: "rgb(179 168 206)",
      // backgroundColor: "rgb(var(--mdui-color-surface-container-low))",
      boxShadow: "var(--mdui-elevation-level1)", 
      "--shape-corner": "var(--mdui-shape-corner-medium)",
    }
  } else if (variant === "outlined") {
    return {
      padding: "10px",
      borderRadius:  "0.75rem",
      border: ".0625rem solid rgb(var(--mdui-color-outline))"
    }
  }
}

export const cardRow = (...parameters) => {
  const properties = toPropertiesWithChildren(parameters);
  return card(addDefaultStyle(
    properties, 
    rowStyle
  ))
}

export const cardColumn = (...parameters) => {
  const properties = toPropertiesWithChildren(parameters);
  return card(addDefaultStyle(
    properties, 
    columnStyle
  ))
}

export const layout = (...parameters) => taggedElement("mdui-layout", toPropertiesWithChildren(parameters));
export const topAppBar = (...parameters) => taggedElement("mdui-top-app-bar", toPropertiesWithChildren(parameters));
export const navigationDrawer = (...parameters) => taggedElement("mdui-navigation-drawer", toPropertiesWithChildren(parameters));
export const layoutMain = (...parameters) => taggedElement("mdui-layout-main", toPropertiesWithChildren(parameters));

export const buttonIcon = (...parameters) => taggedElement("mdui-button-icon", 
  addDefaultStyle(
    toButtonProperties(parameters), 
    {
      width: 40, 
      height: 40
    }
  )
);
export const topAppBarTitle = (...parameters) => taggedElement("mdui-top-app-bar-title", toPropertiesWithChildren(parameters));
export const langSelect = (...parameters) => taggedElement("pr-lang-select", toProperties(parameters));
export const themeSelect = (...parameters) => taggedElement("pr-theme-select", toProperties(parameters));
export const dropdown = (...parameters) => taggedElement("mdui-dropdown", toPropertiesWithChildren(parameters));

export const list = (...parameters) => taggedElement("mdui-list", toPropertiesWithChildren(parameters));
export const listItem = (...parameters) => taggedElement("mdui-list-item", toPropertiesWithChildren(parameters));
export const collapse = (...parameters) => taggedElement("mdui-collapse", toPropertiesWithChildren(parameters));
export const collapseItem = (...parameters) => taggedElement("mdui-collapseItem", toPropertiesWithChildren(parameters));




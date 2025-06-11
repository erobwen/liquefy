import 'mdui/mdui.css';
import 'mdui/components/layout.js';
import 'mdui/components/layout-item.js';
import 'mdui/components/layout-main.js';
import 'mdui/components/button-icon.js';
import 'mdui';
import { toProperties, getRenderContext, toPropertiesWithChildren } from "@liquefy/flow.core";
import { toButtonProperties, toInputProperties, elementNode, addDefaultStyleToProperties } from "@liquefy/flow.DOM";

import { toMduiInputProperties } from './implicitProperties';
import "./components.css";



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
export const card = (...parameters) => 
  taggedElement(
    "div", 
    addDefaultStyleToProperties(
      toPropertiesWithChildren(parameters),
      {
        padding: "10px",
        backgroundColor: "rgb(179 168 206)",
        // backgroundColor: "var(--mdui-color-surface-container-low)",
        boxShadow: "var(--mdui-elevation-level1)",
        "--shape-corner": "var(--mdui-shape-corner-medium)",
        borderRadius:  "0.75rem"
      }
    )
  );

  // --shape-corner: var(--mdui-shape-corner-medium);
  //   position: relative;
  //   display: inline-block;
  //   overflow: hidden;
  //   border-radius: var(--shape-corner);
// :host([variant=elevated]) {
//     background-color: rgb(var(--mdui-color-surface-container-low));
//     box-shadow: var(--mdui-elevation-level1);
// }
// constructed stylesheet
// :host {
//     --shape-corner: var(--mdui-shape-corner-medium);
//     position: relative;
//     display: inline-block;
//     overflow: hidden;
//     border-radius: var(--shape-corner);
//     -webkit-tap-highlight-color: transparent;
//     transition: box-shadow var(--mdui-motion-duration-short4) var(--mdui-motion-easing-linear);
//     --mdui-comp-ripple-state-layer-color: var(--mdui-color-on-surface);  //     background-color: rgb(var(--mdui-color-surface-container-low));
  //     box-shadow: var(--mdui-elevation-level1)
  // 0 0.5px 1.5px 0 rgba(0,0,0, 19%),0 0 1px 0 rgba(0,0,0, 3.9%)
  // ;

export const layout = (...parameters) => taggedElement("mdui-layout", toPropertiesWithChildren(parameters));
export const topAppBar = (...parameters) => taggedElement("mdui-top-app-bar", toPropertiesWithChildren(parameters));
export const navigationDrawer = (...parameters) => taggedElement("mdui-navigation-drawer", toPropertiesWithChildren(parameters));
export const layoutMain = (...parameters) => taggedElement("mdui-layout-main", toPropertiesWithChildren(parameters));

export const buttonIcon = (...parameters) => taggedElement("mdui-button-icon", 
  addDefaultStyleToProperties(
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




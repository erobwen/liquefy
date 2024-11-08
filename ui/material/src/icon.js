// import { getElementNodeProperties } from "@liquefy/flow.DOM";
// import "./materialAndIcons.css";

/**
 * Additional attributes
 */
const mduiIconAttributesCamelCase = [
  "name"
]

const mduiIconAttributes = mduiIconAttributesCamelCase.map(camelCase => ({camelCase, lowerCase: camelCase.toLowerCase()}));


/**
 * Icon component
 */
export const icon = (...parameters) => {
  const properties = getElementNodeProperties(parameters, mduiIconAttributes) 
  // console.log({...properties.attributes})
  // debugger;
  return getRenderContext().create({type: "elementNode", tagName: "mdui-icon", key: properties.key ? properties.key + ".text-" + stamp++ : null, attributes})
}

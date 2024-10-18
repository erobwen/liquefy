import { getElementNodeProperties } from "@liquefy/flow.DOM";
import "./materialAndIcons.css";

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
const icon = (...parameters) => {
  const properties = getElementNodeProperties(parameters) // TODO: mduiIconAttributes
  const attributes = {name: properties.name}; // Is this lifted by element nodes auto
  return getRenderContext().create({type: "elementNode", tagName: "mdui-icon", key: properties.key ? properties.key + ".text-" + stamp++ : null, attributes})
}

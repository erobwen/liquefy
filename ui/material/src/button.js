import "./materialAndIcons.css";
import { getButtonProperties } from "@liquefy/ui-themed"
import 'mdui/mdui.css';
import 'mdui';

/**
 * Additional attributes
 */
const mduiButtonAttributesCamelCase = [
  "full-width"
]

const mduiButtonAttributes = mduiButtonAttributesCamelCase.map(camelCase => ({camelCase, lowerCase: camelCase.toLowerCase()}));

/**
 * Button component
 */

const button = (...parameters) => {
  const properties = getButtonProperties(parameters, mduiButtonAttributes);
  const key = properties.key;
  return getRenderContext().create({type: "elementNode", tagName: "mdui-button", key: key ? key + ".text-" + stamp++ : null, ...properties})
}

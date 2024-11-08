import { getFlowProperties, findImplicitChildrenAndOnClick, getRenderContext } from "@liquefy/flow.core"
import "./materialAndIcons.css";
import "./button.css";
import 'mdui/mdui.css';
import 'mdui';


/**
 * Button component
 */

export const button = (...parameters) => {
  const properties = buttonParametersToProperties(parameters);
  const keyPrefix = properties.key;
  return getRenderContext().create({type: "elementNode", tagName: "mdui-button", key: keyPrefix ? keyPrefix + ".text-" + stamp++ : null, ...properties})
}

const buttonParametersToProperties = (parameters) => {
  const properties = getFlowProperties(parameters);
  findImplicitChildrenAndOnClick(properties);
  return properties; 
}
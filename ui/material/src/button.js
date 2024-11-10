import { getFlowProperties, findImplicitChildrenAndOnClick, getRenderContext } from "@liquefy/flow.core"
import "./materialAndIcons.css";
import "./button.css";
import 'mdui/mdui.css';
import 'mdui';


/**
 * Button component
 */
export const button = (...parameters) => 
   getRenderContext().primitive({type: "elementNode", tagName: "mdui-button", ...buttonParametersToProperties(parameters)})


const buttonParametersToProperties = (parameters) => {
  const properties = getFlowProperties(parameters);
  findImplicitChildrenAndOnClick(properties);
  return properties; 
}
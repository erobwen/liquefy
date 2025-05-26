import { getFlowProperties, getFlowPropertiesIncludingChildren } from "@liquefy/flow.core";
import "./icons.css";


/**
 * Icon component
 */
export const icon = (...parameters) => {
  const properties = getFlowProperties(parameters)
  const {key, ...attributes} = properties;
  return getRenderContext().primitive({
    key: key, 
    type: "elementNode", 
    tagName: "mdui-icon", 
    attributes
  })
}

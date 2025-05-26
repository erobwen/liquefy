import { toProperties, toPropertiesWithChildren } from "@liquefy/flow.core";
import "./icons.css";


/**
 * Icon component
 */
export const icon = (...parameters) => {
  const properties = toProperties(parameters)
  const {key, ...attributes} = properties;
  return getRenderContext().primitive({
    key: key, 
    type: "elementNode", 
    tagName: "mdui-icon", 
    attributes
  })
}

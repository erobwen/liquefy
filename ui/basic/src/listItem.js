import { toPropertiesWithChildren } from "@liquefy/flow.core"
import { li, button, addDefaultStyle } from "@liquefy/flow.DOM"


export function listItem(...parameters) {
  const properties = toPropertiesWithChildren(parameters);
  // if (properties.active) {
    addDefaultStyle(properties, {
      // backgroundColor: "rgb(200, 200, 200)"
      height: 35,
      backgroundColor: properties.active ? "rgb(200, 200, 200)" : ""
    })
  // }
  return button(properties);
}

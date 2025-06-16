import { toPropertiesWithChildren } from "@liquefy/flow.core"
import { li, button, addDefaultStyleToProperties } from "@liquefy/flow.DOM"


export function listItem(...parameters) {
  const properties = toPropertiesWithChildren(parameters);
  // if (properties.active) {
    addDefaultStyleToProperties(properties, {
      // backgroundColor: "rgb(200, 200, 200)"
      backgroundColor: properties.active ? "rgb(200, 200, 200)" : ""
    })
  // }
  return button(properties);
}

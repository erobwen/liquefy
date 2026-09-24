import { toProperties, findImplicitChildren, locateService } from "@liquefy/cascade.component";
import { defaultDOMServiceLocator } from "@liquefy/cascade.dom";

/**
 * Themed widgets - ported from flow.ui/themed: app code calls `button(...)`
 * and gets whatever the current theme provides for it, found through the
 * service locator in the render context (see cascade.component's
 * ServiceLocator.js) as `{ type: "widget", name: "button", properties }`.
 * Which theme that is, is decided by whoever set up the render context -
 * the app, or a subtree overriding it (serviceProvider()) - never by the
 * component using the widget.
 *
 * Each widget has a property contract every theme implements, so switching
 * themes changes appearance, not meaning:
 *
 *  - button: `key`, `onClick`, `disabled`, `style`, `children` - with
 *    flow's own argument convention, a loose function argument is
 *    `onClick` and anything else loose is a child:
 *    `button("Save", () => save())`.
 *
 * No theme in the context providing a widget falls back to the DOM
 * default, which ends in a visible, warning placeholder (see
 * DOMDebugServiceLocator) rather than an error.
 */

export function toButtonProperties(parameters) {
  const properties = toProperties(parameters);
  const content = properties.componentContent;
  if (content) {
    const handlers = content.filter((item) => typeof(item) === "function");
    if (handlers.length > 1) throw new Error("button(): only one loose onClick function allowed.");
    if (handlers.length === 1) {
      if (properties.onClick) throw new Error("button(): onClick given both loosely and in properties.");
      properties.onClick = handlers[0];
    }
    const rest = content.filter((item) => typeof(item) !== "function");
    if (rest.length > 0) properties.componentContent = rest;
    else delete properties.componentContent;
  }
  findImplicitChildren(properties);
  return properties;
}

export function widget(name, properties) {
  return locateService({ type: "widget", name, properties }, defaultDOMServiceLocator);
}

export const button = (...parameters) => widget("button", toButtonProperties(parameters));

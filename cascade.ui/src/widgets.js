import { toProperties, toPropertiesWithChildren, findImplicitChildren, locateService } from "@liquefy/cascade.component";
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
 *  - button: `key`, `onClick`, `disabled`, `variant` ("filled" for the
 *    main thing to do - what else a theme knows is up to it), `style`, `children` - with
 *    flow's own argument convention, a loose function argument is
 *    `onClick` and anything else loose is a child:
 *    `button("Save", () => save())`.
 *  - icon: `key`, `name` (a Material icon name - "info", "close",
 *    "shopping_cart", ...), `style` (fontSize sets its size). Both themes
 *    draw icons with Google's icon fonts, which the app links (see
 *    cascade.application/demo/index.html).
 *  - iconButton: `key`, `icon` (an icon name), `onClick` (or a loose
 *    function), `title`, `style` - a round button showing just an icon.
 *  - card: `key`, `variant` ("elevated" - the default - "filled" or
 *    "outlined"), `style`, `children` - a surface to group content on.
 *  - controlPanel: `key`, `style`, `children` - controls in a row (buttons,
 *    fields, a label), on a surface of their own, spaced evenly and
 *    wrapping when there isn't room: what a page puts its controls in, so
 *    they sit apart from what they control.
 *  - alert: `key`, `severity` ("info" - the default - "success",
 *    "warning" or "error"), `style`, `children` - a message with its
 *    severity's icon and colors (see alertSeverities).
 *  - listItem: `key`, `active`, `onClick` (or a loose function),
 *    `style`, `children` - one clickable row of a list, marked when active.
 *  - dialog: `key`, `title`, `close` (called by its close button),
 *    `fullScreen`, `style`, `children` - a dialog's own box: title bar,
 *    close button and body. Full screen, it fills whatever it's placed in,
 *    as a phone app's screen does: no corners, no shadow, and a back arrow
 *    at the top left (calling `close`) instead of the close button. Where it's shown (docked, or modal over the app) is up to
 *    whoever places it - see cascade.ui's overlay().
 *  - textField: `key`, `label` (optional), `placeholder`, `value`, `onInput` (called with the new
 *    value, as text), `type` ("text" - the default - or "number"), `unit`
 *    (shown after the value: "kg"), `error` (a message, shown under it,
 *    marking it as wrong), `style` - a labelled input field.
 *  - checkbox: `key`, `label`, `checked`, `onChange` (called with whether
 *    it's now checked), `style`.
 *  - colorField: `key`, `label`, `value` (a hex color: "#34495e"),
 *    `onInput` (called with the new one, as it's being picked), `style` - a
 *    color, and the browser's own picker for it.
 *  - tabBar: `key`, `tabs` (`[{ key, title }]`), `selected` (a tab's key),
 *    `onSelect` (called with the key of the tab clicked), `style` - a row of
 *    tabs, one of them selected. What each shows is up to whoever places it.
 *
 * Widgets that are more than one element (an alert: icon plus message) are
 * components of their own in each theme, so the keys inside them are
 * scoped to them rather than to whoever builds them - two alerts on one
 * page don't collide.
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
export const icon = (...parameters) => widget("icon", toProperties(parameters));
export const iconButton = (...parameters) => widget("iconButton", toButtonProperties(parameters));
export const card = (...parameters) => widget("card", toPropertiesWithChildren(parameters));
export const controlPanel = (...parameters) => widget("controlPanel", toPropertiesWithChildren(parameters));
export const alert = (...parameters) => widget("alert", toPropertiesWithChildren(parameters));
export const listItem = (...parameters) => widget("listItem", toButtonProperties(parameters));
export const dialog = (...parameters) => widget("dialog", toPropertiesWithChildren(parameters));
export const textField = (...parameters) => widget("textField", toProperties(parameters));
export const checkbox = (...parameters) => widget("checkbox", toProperties(parameters));
export const colorField = (...parameters) => widget("colorField", toProperties(parameters));
export const tabBar = (...parameters) => widget("tabBar", toProperties(parameters));

// Each alert severity's icon and colors - the same in every theme, so a
// warning reads as a warning whichever one is in use.
export const alertSeverities = {
  info: { icon: "info", background: "#f0f8ff", iconColor: "rgb(2, 136, 209)", color: "rgb(1, 67, 97)" },
  success: { icon: "check_circle", background: "#edf7ed", iconColor: "rgb(46, 125, 50)", color: "rgb(30, 70, 32)" },
  warning: { icon: "warning", background: "#fff4e5", iconColor: "rgb(237, 108, 2)", color: "rgb(102, 60, 0)" },
  error: { icon: "error", background: "#fdeded", iconColor: "rgb(211, 47, 47)", color: "rgb(95, 33, 32)" },
};

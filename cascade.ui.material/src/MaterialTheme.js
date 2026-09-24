import { element } from "@liquefy/cascade.dom";

/**
 * The Material theme - ported from flow.ui/material's own components.js:
 * the same widgets as cascade.ui's basic theme (see its widgets.js for each
 * widget's property contract), rendered as mdui 2 web components. A
 * service locator answering `{ type: "widget", name }` queries (see
 * cascade.component's ServiceLocator.js); the custom elements themselves
 * are just HTML elements with other tag names, looked up the same way as
 * any other.
 *
 * Needs the mdui components registered to look like anything - import this
 * package's index.js (which does that) in a browser, not this file.
 */
const widgets = {
  button({ onClick, children, ...rest }) {
    return element("mdui-button", {
      ...rest,
      ...(onClick ? { onclick: onClick } : {}),
      children,
    });
  },
};

export class MaterialThemeServiceLocator {
  locate(query) {
    if (query.type !== "widget") return undefined;
    const build = widgets[query.name];
    return build ? build(query.properties) : undefined;
  }
}

export const materialTheme = new MaterialThemeServiceLocator();

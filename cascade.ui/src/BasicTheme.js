import { button as htmlButton } from "@liquefy/cascade.dom";

/**
 * The basic theme - plain HTML, lightly styled (ported from
 * flow.ui/basic's own buttons.js). A service locator (see cascade.component's
 * ServiceLocator.js) answering `{ type: "widget", name }` queries for the
 * widgets in widgets.js, built out of ordinary HTML elements - which are
 * themselves looked up the same way, so a DOM-level locator further along
 * still decides what an HTML `button` actually is.
 */
const widgets = {
  button({ onClick, style, children, ...rest }) {
    return htmlButton({
      ...rest,
      ...(onClick ? { onclick: onClick } : {}),
      style: { lineHeight: "28px", padding: "0 14px", cursor: "pointer", ...style },
      children,
    });
  },
};

export class BasicThemeServiceLocator {
  locate(query) {
    if (query.type !== "widget") return undefined;
    const build = widgets[query.name];
    return build ? build(query.properties) : undefined;
  }
}

export const basicTheme = new BasicThemeServiceLocator();

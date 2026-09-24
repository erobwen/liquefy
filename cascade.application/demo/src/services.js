import { ObservableCompoundServiceLocator, observable } from "@liquefy/cascade.component";
import { DOMServiceLocator, DOMDebugServiceLocator } from "@liquefy/cascade.dom";
import { basicTheme } from "@liquefy/cascade.ui";
import { materialTheme } from "@liquefy/cascade.ui.material";

/**
 * The demo's services: what every component in it gets when it asks for an
 * HTML element or a themed widget (see cascade.component's
 * ServiceLocator.js). Handed to the whole app once, in the root render
 * context (see index.js); nothing in the app refers to a specific theme.
 *
 * Asked in order: real DOM elements, then the current theme's widgets, then
 * the debug locator, which renders a marked placeholder for anything nobody
 * provides instead of failing.
 *
 * Observable, so the theme can be swapped while the app runs (see
 * selectTheme() and pages/ThemesPage.js) and everything built with a themed
 * widget rebuilds with the new one. An app that never swaps anything would
 * use a plain CompoundServiceLocator instead - same order, same parts, no
 * dependency tracked on it at all:
 *
 *   new CompoundServiceLocator(new DOMServiceLocator(), basicTheme, new DOMDebugServiceLocator())
 */
export const themes = {
  basic: { title: "Basic", locator: basicTheme },
  material: { title: "Material", locator: materialTheme },
};

export const themeSelection = observable({ name: "basic" });

export const serviceLocator = new ObservableCompoundServiceLocator(
  new DOMServiceLocator(),
  themes.basic.locator,
  new DOMDebugServiceLocator(),
);

export function selectTheme(name) {
  themeSelection.name = name;
  serviceLocator.locators[1] = themes[name].locator;
}

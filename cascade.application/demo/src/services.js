import { ObservableCompoundServiceLocator } from "@liquefy/cascade.component";
import { DOMServiceLocator, DOMDebugServiceLocator } from "@liquefy/cascade.dom";
import { basicTheme } from "@liquefy/cascade.ui";
import { materialTheme } from "@liquefy/cascade.ui.material";

/**
 * The demo's root service locator: what every component in it gets when it
 * asks for an HTML element or a themed widget (see cascade.component's
 * ServiceLocator.js). It reaches components two different ways, on
 * purpose:
 *
 *  - Using it: through the render context (index.js puts it in the root
 *    context; RenderContext.derive() carries it down). Every component
 *    reads it, cheaply, and a subtree can have different services
 *    (serviceProvider()).
 *  - Changing it: only through inheritance - the root component provides it
 *    as `rootServiceLocator` (see ApplicationMenuFrame), so a component has
 *    to inherit("rootServiceLocator") to switch the app's theme, and any
 *    subtree can take that ability away by providing `rootServiceLocator:
 *    null` itself (see pages/ThemesPage.js).
 *
 * Asked in order: real DOM elements, then the current theme's widgets, then
 * the debug locator, which renders a marked placeholder for anything nobody
 * provides instead of failing.
 *
 * Observable, so the theme can be swapped while the app runs and everything
 * built with a themed widget rebuilds with the new one. An app that never
 * swaps anything would use a plain CompoundServiceLocator instead - same
 * order, same parts, no dependency tracked on it at all:
 *
 *   new CompoundServiceLocator(new DOMServiceLocator(), basicTheme, new DOMDebugServiceLocator())
 */
export class ThemedServiceLocator extends ObservableCompoundServiceLocator {
  constructor(themes, themeName) {
    super(new DOMServiceLocator(), themes[themeName].locator, new DOMDebugServiceLocator());
    this.themes = themes;
    this.themeName = themeName;
  }

  selectTheme(themeName) {
    this.themeName = themeName;
    this.locators[1] = this.themes[themeName].locator;
  }
}

export const rootServiceLocator = new ThemedServiceLocator({
  basic: { title: "Basic", locator: basicTheme },
  material: { title: "Material", locator: materialTheme },
}, "basic");

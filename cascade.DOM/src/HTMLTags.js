import { toPropertiesWithChildren, getCreator } from "@liquefy/cascade.component";
import { defaultDOMPrimitiveLocator } from "./DOMPrimitiveLocator.js";

/**
 * HTML tags - ported from flow.DOM/src/HTMLTags.js, one line per tag, same
 * mechanical shape: `buildPrimitive(tagName, toPropertiesWithChildren(parameters))`.
 * Only the handful actually needed so far (see
 * cascade.application/demo/src/pages/IntroductionPage.js) - adding
 * another tag is a one-line addition following the exact same pattern,
 * not a design decision; grow this list as components actually need
 * more of them rather than porting flow's full ~100-tag list speculatively.
 *
 * Each tag function goes through whichever component is currently being
 * built's own primitiveLocator (see cascade.component's Component.js -
 * unobservable.primitiveLocator, propagated down the construction chain
 * for free - and cascade.dom's DOMPrimitiveLocator, the DOM platform's own
 * one) rather than constructing DOMElementComponent directly: getCreator()
 * is exactly the "currently building" component - the same stack
 * Component.js itself pushes onto around every build() call - so a tag
 * function called from anywhere inside build() (however deeply nested in
 * ordinary JS argument position, e.g. `div(h1(...), p(...))`) always
 * resolves against whichever component's own build() is actually running,
 * not whoever's rendering right now. This is what makes the same `div()`
 * call able to eventually resolve to a different platform's own primitive
 * without this file itself ever changing - see this file's own git
 * history for the larger portability idea this is one piece of.
 */
function buildPrimitive(tag, properties) {
  const creator = getCreator();
  // No creator at all (not called from inside anyone's build()) - a
  // component built eagerly and held for later use, rather than returned
  // from a build() (see cascade.component's own "hardcoded child
  // reference" style), has no construction chain yet to reach a real
  // tree's own locator through - see defaultDOMPrimitiveLocator's own
  // comment for why falling back to it is safe today. A creator that
  // exists but genuinely has no locator of its own (shouldn't normally
  // happen once a tree's root is wired up - see Component.js's own
  // renderOnto() bootstrap) falls back the same way, rather than throwing.
  const locator = (creator && creator.unobservable.primitiveLocator) || defaultDOMPrimitiveLocator;
  return locator.build(tag, properties);
}

export const div = (...parameters) => buildPrimitive("div", toPropertiesWithChildren(parameters));
export const h1 = (...parameters) => buildPrimitive("h1", toPropertiesWithChildren(parameters));
export const h2 = (...parameters) => buildPrimitive("h2", toPropertiesWithChildren(parameters));
export const p = (...parameters) => buildPrimitive("p", toPropertiesWithChildren(parameters));
export const ul = (...parameters) => buildPrimitive("ul", toPropertiesWithChildren(parameters));
export const li = (...parameters) => buildPrimitive("li", toPropertiesWithChildren(parameters));
export const a = (...parameters) => buildPrimitive("a", toPropertiesWithChildren(parameters));
export const b = (...parameters) => buildPrimitive("b", toPropertiesWithChildren(parameters));
export const span = (...parameters) => buildPrimitive("span", toPropertiesWithChildren(parameters));
export const button = (...parameters) => buildPrimitive("button", toPropertiesWithChildren(parameters));
export const input = (...parameters) => buildPrimitive("input", toPropertiesWithChildren(parameters));

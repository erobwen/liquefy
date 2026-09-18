import { toPropertiesWithChildren } from "@liquefy/cascade.component";
import { taggedElement } from "./DOMElementNode.js";

/**
 * HTML tags - ported from flow.DOM/src/HTMLTags.js, one line per tag,
 * same mechanical shape: `taggedElement(tagName, toPropertiesWithChildren(parameters))`.
 * Only the handful actually needed so far (see
 * cascade.application/demo/src/pages/IntroductionPage.js) - adding
 * another tag is a one-line addition following the exact same pattern,
 * not a design decision; grow this list as components actually need
 * more of them rather than porting flow's full ~100-tag list speculatively.
 */
export const div = (...parameters) => taggedElement("div", toPropertiesWithChildren(parameters));
export const h1 = (...parameters) => taggedElement("h1", toPropertiesWithChildren(parameters));
export const h2 = (...parameters) => taggedElement("h2", toPropertiesWithChildren(parameters));
export const p = (...parameters) => taggedElement("p", toPropertiesWithChildren(parameters));
export const ul = (...parameters) => taggedElement("ul", toPropertiesWithChildren(parameters));
export const li = (...parameters) => taggedElement("li", toPropertiesWithChildren(parameters));
export const a = (...parameters) => taggedElement("a", toPropertiesWithChildren(parameters));
export const b = (...parameters) => taggedElement("b", toPropertiesWithChildren(parameters));
export const span = (...parameters) => taggedElement("span", toPropertiesWithChildren(parameters));
export const button = (...parameters) => taggedElement("button", toPropertiesWithChildren(parameters));

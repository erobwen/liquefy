import { extractProperty } from "@liquefy/cascade.component";
import { DOMNodeComponent } from "./DOMNodeComponent.js";
import { DOMTarget } from "./DOMTarget.js";
import { DOMTextNode } from "./DOMTextNode.js";

function defaultToPx(value) { // no style property is ever meant to be a bare number
  if (typeof(value) === "undefined" || value === null) return "";
  return typeof(value) === "number" ? value + "px" : value;
}

/**
 * A real Element node - ported from flow.DOM/src/DOMElementNode.js's own
 * setProperties()/ensureDomNodeAttributesSet()/updateStyle(): everything
 * not recognized as `tagName`/`children` becomes a DOM attribute, applied
 * (and, when later removed, cleared) by diffing against what was actually
 * set last time - not attributes.js's own explicit `attributes: {...}` bag
 * form (left out for now, no ported component needs it yet), just loose
 * top-level properties directly, the shape every call in
 * flow.application/demo/src/pages/introductionPage.js already uses.
 *
 * Rebuilt on top of DOMNodeComponent's render()/renderElement() rather
 * than flow's separate build-then-render pass. `children` are rendered
 * directly here (see render() below) - a plain DOMNodeComponent (e.g. a
 * component that owns one element but composes no others) has no generic
 * notion of children at all, so that's this class's own addition, not
 * the base's.
 */
export class DOMElementNode extends DOMNodeComponent {
  setProperties(properties) {
    this.tagName = extractProperty(properties, "tagName");
    if (!this.tagName) throw new Error("DOMElementNode requires a tagName.");
    this.children = extractProperty(properties, "children") || null;

    // Real element properties are lowercase (element.onclick, not
    // element.onClick - the latter is silently a no-op, not a stylistic
    // choice), so every remaining property is normalized the same way
    // flow's own version did.
    const attributes = {};
    for (const key in properties) {
      attributes[key.toLowerCase()] = properties[key];
    }
    this.attributes = attributes;
  }

  initialUnobservables() {
    const result = super.initialUnobservables();
    result.previouslySetAttributes = {};
    result.previouslySetStyle = {};
    return result;
  }

  renderElement(context, existingElement) {
    const element = existingElement || document.createElement(this.tagName);
    this.applyAttributes(element);
    return element;
  }

  // Clears whatever attribute is no longer present, sets whatever's new
  // or changed, leaves everything else untouched - so an animation (or
  // anything else outside this component's own knowledge) setting a
  // property directly on the real element in between reruns isn't fought
  // over on the next one, same reasoning flow's own version had.
  applyAttributes(element) {
    const u = this.unobservable;
    const newAttributes = this.attributes;

    for (const key in u.previouslySetAttributes) {
      if (typeof(newAttributes[key]) === "undefined") {
        if (key === "style") {
          this.applyStyle(element, {});
        } else {
          element[key] = "";
        }
      }
    }

    const nextPreviouslySet = {};
    for (const key in newAttributes) {
      const value = newAttributes[key];
      if (key === "style") {
        this.applyStyle(element, value || {});
      } else if (u.previouslySetAttributes[key] !== value) {
        if (key === "class") {
          // setAttribute, not element.class (not a real DOM property) or
          // element.className (breaks the lowercase-everything rule
          // above) - matches flow's own special case for this one key.
          element.setAttribute("class", value);
        } else {
          element[key] = value;
        }
      }
      nextPreviouslySet[key] = value;
    }
    u.previouslySetAttributes = nextPreviouslySet;
  }

  applyStyle(element, newStyle) {
    const u = this.unobservable;
    const elementStyle = element.style;

    for (const property in u.previouslySetStyle) {
      if (typeof(newStyle[property]) === "undefined") {
        elementStyle[property] = "";
      }
    }

    const nextPreviouslySet = {};
    for (const property in newStyle) {
      const value = newStyle[property];
      if (u.previouslySetStyle[property] !== value) {
        elementStyle[property] = defaultToPx(value);
      }
      nextPreviouslySet[property] = value;
    }
    u.previouslySetStyle = nextPreviouslySet;
  }

  render(context) {
    super.render(context);
    const u = this.unobservable;
    if (!u.childTarget) {
      u.childTarget = DOMTarget.forElement(u.element);
    }
    (this.children || []).forEach((child) => {
      // A loose string/number child (see cascade.component's own
      // toPropertiesWithChildren, which deliberately leaves these as-is -
      // this is the DOM-specific other half of that: what a plain string
      // child actually means once there's a real element to put it in).
      const childComponent = (typeof(child) === "string" || typeof(child) === "number")
        ? new DOMTextNode({ text: child })
        : child;
      childComponent.renderOnto(u.childTarget);
    });
  }
}

export function taggedElement(tagName, properties) {
  return new DOMElementNode({ tagName, ...properties });
}

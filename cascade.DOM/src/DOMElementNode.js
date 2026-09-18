import { extractProperty, RenderContext, accessInitialValues } from "@liquefy/cascade.component";
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
    const tagName = extractProperty(properties, "tagName");
    if (!tagName) throw new Error("DOMElementNode requires a tagName.");
    const children = extractProperty(properties, "children") || null;

    // Real element properties are lowercase (element.onclick, not
    // element.onClick - the latter is silently a no-op, not a stylistic
    // choice), so every remaining property is normalized the same way
    // flow's own version did.
    const attributes = {};
    for (const key in properties) {
      attributes[key.toLowerCase()] = properties[key];
    }

    // accessInitialValues(), not plain writes - a real bug found via
    // cascade.application/demo's ApplicationMenuFrame/OverlayFrame: a
    // plain write here lands positioned within whichever repeater
    // happens to be executing this call's own enclosing build() right
    // now. If that repeater is later disposed (e.g. an ancestor rebuilds
    // for an unrelated reason) while this exact DOMElementNode is *also*
    // being dropped from the tree in that same rebuild, retraction (which
    // would normally stop it from running again) only actually happens
    // once whatever renders this node's own children next notices it
    // wasn't relinked - which can run *after* a stale, already-queued
    // rerun of this node's own render() (invalidated by the disposal
    // itself unlinking these very writings) already fires with
    // tagName/children/attributes read back as undefined. See
    // Component.js's own reactiveBuildEquivalent() doc, and this bug's
    // own trail in cascade.application/demo's ApplicationMenuFrame
    // (MenuList's `frame` property, the same fix, found first).
    // accessInitialValues() writes at the baseline position instead - not
    // tied to whichever repeater happens to be constructing this node,
    // so disposing that repeater can never unlink it.
    accessInitialValues(() => {
      this.tagName = tagName;
      this.children = children;
      this.attributes = attributes;
    });
  }

  initialUnobservables() {
    const result = super.initialUnobservables();
    result.previouslySetAttributes = {};
    result.previouslySetStyle = {};
    return result;
  }

  renderElement(context, existingElement) {
    // context.target.appendElement (not a bare document.createElement) -
    // that's what actually inserts the new element into the real DOM, at
    // the right position (see DOMTarget's own lastChild tracking).
    const element = existingElement || context.target.appendElement(this.tagName);
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
    if (!u.childContext) {
      // A RenderContext, not the bare DOMTarget - renderElement() (this
      // class's own, and anything else's) reads context.target, exactly
      // like the context this component itself was handed.
      u.childContext = new RenderContext(DOMTarget.forElement(u.element));
    }
    (this.children || []).forEach((child) => {
      // null/undefined/false - typically Component.show(false)'s own
      // "don't include me at all" result (see its own doc) - simply
      // isn't renderOnto()'d this pass, same as any other child that
      // stops appearing in the children array; if it was previously
      // shown, that alone is what retracts it.
      if (child === null || typeof(child) === "undefined" || child === false) return;
      // A loose string/number child (see cascade.component's own
      // toPropertiesWithChildren, which deliberately leaves these as-is -
      // this is the DOM-specific other half of that: what a plain string
      // child actually means once there's a real element to put it in).
      const childComponent = (typeof(child) === "string" || typeof(child) === "number")
        ? new DOMTextNode({ text: child })
        : child;
      childComponent.renderOnto(u.childContext);
    });
  }
}

export function taggedElement(tagName, properties) {
  return new DOMElementNode({ tagName, ...properties });
}

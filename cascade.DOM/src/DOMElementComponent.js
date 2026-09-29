import { extractProperty, frozen } from "@liquefy/cascade.component";
import { DOMNodeComponent } from "./DOMNodeComponent.js";
import { DOMElementTarget } from "./DOMElementTarget.js";
import { DOMTextComponent } from "./DOMTextComponent.js";
import { applyStyle as diffApplyStyle } from "./applyStyle.js";

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
 * Rebuilt on top of DOMNodeComponent's render()/renderNode() rather
 * than flow's separate build-then-render pass. `children` are rendered
 * directly here (see render() below) - a plain DOMNodeComponent (e.g. a
 * component that owns one element but composes no others) has no generic
 * notion of children at all, so that's this class's own addition, not
 * the base's.
 */
export class DOMElementComponent extends DOMNodeComponent {
  // All three are *properties*, not state (see cascade.component/README.md):
  // they come from the build() call constructing this node and are meant
  // to change on every rebuild - applyAttributes() diffs them for exactly
  // that reason. (A dropped node's stale, still-queued rerun reading them
  // back as undefined was a real bug here once - fixed where it belongs,
  // by retracting a dropped component the moment its build identity
  // vanishes, see Component.onDispose(), not by repositioning these writes.)
  setProperties(properties) {
    this.tagName = extractProperty(properties, "tagName");
    if (!this.tagName) throw new Error("DOMElementComponent requires a tagName.");
    this.children = frozen(extractProperty(properties, "children") || null);

    // Event handlers are lowercase element properties (element.onclick,
    // not element.onClick - the latter is silently a no-op, not a stylistic
    // choice), so every remaining property is normalized the same way
    // flow's own version did - after the two whose DOM names differ from
    // their JS ones (className, htmlFor), which would otherwise land as
    // meaningless "classname"/"htmlfor". See applyAttributes() for how each
    // then reaches the element.
    const attributes = {};
    for (const key in properties) {
      attributes[attributeAliases[key] || key.toLowerCase()] = properties[key];
    }
    this.attributes = frozen(attributes);
  }

  initialUnobservables() {
    const result = super.initialUnobservables();
    result.previouslySetAttributes = {};
    result.previouslySetStyle = {};
    return result;
  }

  // Provides its node (see DOMNodeComponent): its own element, created once
  // and patched in place - placed by the default renderNode() when
  // rendered (its children then rendered by render() below), or by whoever
  // places it otherwise (cascade.dom's FlipAnimationContainer, which also
  // places its children).
  ensureNode() {
    const u = this.unobservable;
    let element = u.node;
    // A reconciled component whose tag changed (a theme swap turning a
    // `button` into an `mdui-button` under the same key, say) can't keep its
    // element - a real element's tag is fixed for life.
    if (element && element.tagName.toLowerCase() !== this.tagName.toLowerCase()) {
      element = this.replaceElement(element);
    }
    if (!element) {
      element = document.createElement(this.tagName);
      this.assignDebugId(element);
    }
    u.node = element;
    this.applyAttributes(element);
    return element;
  }

  // A new element with the current tag, taking the old one's place: same
  // position, same debug id, the old one's child nodes moved over, and
  // every attribute/style re-applied from scratch (none of them are set on
  // the new element yet).
  //
  // The children get a fresh target for the new element (see render(),
  // which creates it when missing) rather than having the old
  // target repointed: repointing would be a write by this component's
  // render repeater, retracted on its next rerun and never rewritten (the
  // tag doesn't change again), leaving the target pointing back at the old,
  // detached element - children rendering into it would vanish from the
  // page. Handed a different target, every child is re-rendered onto it
  // (see Component.renderOnto()) and reattaches its own node there.
  replaceElement(oldElement) {
    const u = this.unobservable;
    const newElement = document.createElement(this.tagName);
    if (oldElement.id) newElement.id = oldElement.id;
    while (oldElement.firstChild) newElement.appendChild(oldElement.firstChild);
    if (oldElement.parentNode) oldElement.parentNode.replaceChild(newElement, oldElement);
    u.childTarget = null;
    u.previouslySetAttributes = {};
    u.previouslySetStyle = {};
    return newElement;
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
          clearAttribute(element, key);
        }
      }
    }

    const nextPreviouslySet = {};
    for (const key in newAttributes) {
      const value = newAttributes[key];
      if (key === "style") {
        this.applyStyle(element, value || {});
      } else if (u.previouslySetAttributes[key] !== value) {
        setAttribute(element, key, value);
      }
      nextPreviouslySet[key] = value;
    }
    u.previouslySetAttributes = nextPreviouslySet;
  }

  // Delegates to the shared applyStyle.js (see its own doc) - every
  // component that owns a real element and accepts `style` directly needs
  // this same diffing, not just DOMElementComponent.
  applyStyle(element, newStyle) {
    const u = this.unobservable;
    u.previouslySetStyle = diffApplyStyle(element, newStyle, u.previouslySetStyle);
  }

  // Its children are rendered onto its own element - with the context it
  // was given: an element provides nothing, so it adds no context of its own.
  render(target, context) {
    super.render(target, context);
    const u = this.unobservable;
    if (!u.childTarget) u.childTarget = DOMElementTarget.forElement(u.node);
    // Rendered again after a placing container (see DOMPlacingContainer)
    // placed its children: whatever that left in its element is no
    // rendered child's - a node of a child removed while this element was
    // out of the container's tree (its luggage removed while the drawer
    // was hidden, say), never retracted, since it was never rendered. So
    // start from an empty element: every child rendered below puts its
    // own node back (they aren't rendered yet either - a retracted one is
    // reattached, see DOMNodeComponent.onReattach()).
    if (u.childrenPlaced) {
      u.childrenPlaced = false;
      while (u.node.firstChild) u.node.removeChild(u.node.firstChild);
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
        ? new DOMTextComponent({ text: child })
        : child;
      childComponent.renderOnto(u.childTarget, context);
    });
  }
}

// JS names whose DOM attribute is called something else.
const attributeAliases = { className: "class", htmlFor: "for" };

// How a property given to an element reaches it: as the element's own
// property where it has one by that name (onclick, value, checked,
// disabled, title, ...) - live state, not just the initial attribute - and
// as an attribute otherwise: class, for, aria-*, data-*, and every
// attribute whose property is spelled differently (tabindex, readonly,
// colspan, ...). An attribute given false, null or undefined is absent,
// true present and empty (a boolean attribute), anything else its text.
// A custom element (a tag with a dash in it - mdui-button) gets
// properties either way: before its definition is loaded, it doesn't have
// them yet, and a property set on it then is taken up when it upgrades -
// an attribute would only carry text.
function isElementProperty(element, key) {
  if (key === "class" || key === "for" || key.includes("-")) return false;
  return key in element || element.localName.includes("-");
}

function setAttribute(element, key, value) {
  if (isElementProperty(element, key)) {
    element[key] = value;
  } else if (value === false || value === null || typeof(value) === "undefined") {
    element.removeAttribute(key);
  } else {
    element.setAttribute(key, value === true ? "" : String(value));
  }
}

// No longer given: gone - the attribute removed, and a property back to
// what an element without it has.
function clearAttribute(element, key) {
  if (!isElementProperty(element, key)) {
    element.removeAttribute(key);
    return;
  }
  const current = element[key];
  if (typeof(current) === "boolean") element[key] = false;
  else if (typeof(current) === "function" || key.startsWith("on")) element[key] = null;
  else element[key] = "";
  if (element.hasAttribute(key)) element.removeAttribute(key);
}

export function taggedElement(tagName, properties) {
  return new DOMElementComponent({ tagName, ...properties });
}

import { frozen, observable, accessInitialValues, withoutRecording } from "@liquefy/cascade.component";
import { DOMNodeComponent } from "./DOMNodeComponent.js";
import { locateDOMComponent, registerDOMComponent } from "./DOMServiceLocator.js";
import { DOMElementTarget } from "./DOMElementTarget.js";
import { applyStyle } from "./applyStyle.js";

export function providingElement(...parameters) {
  return locateDOMComponent("providingElement", parameters);
}

/**
 * DOMProvidingElement: a real, styleable element (DOMNodeComponent),
 * whose sole further job is rendering its own `child` onto it - on a
 * target rooted at this element, so the child's own DOMElementTarget writes
 * (lastChild, appendElement/reattachElement) are scoped to it rather than to
 * whatever target this container itself was rendered onto - and providing
 * the fields of `context` to that child's subtree (see
 * ApplicationMenuFrame.js's own `workArea`, which hands its page its part
 * of the URL this way). They're kept up to date as they change - at the
 * baseline, as everything a context holds (see cascade.component's
 * RenderContext.js). What it provides must be timeless - never a measured
 * size, which belongs to the render target (see DOMElementBoundsProvider).
 */
export class DOMProvidingElement extends DOMNodeComponent {
  setProperties({ child, style, context }) {
    this.child = child;
    this.style = frozen(style || null);
    // What it provides (see ApplicationMenuFrame.js's own `workArea`).
    this.contextExtra = frozen(context || null);
  }

  // An observable object of its own, holding what it provides: created
  // with every field already in it, then only rewritten (see render()).
  provide() {
    const u = this.unobservable;
    if (!u.provided) u.provided = observable({ ...(this.contextExtra || {}) });
    return u.provided;
  }

  initialUnobservables() {
    const result = super.initialUnobservables();
    result.previouslySetStyle = {};
    return result;
  }

  renderNode(target, existingElement) {
    const element = existingElement || target.appendElement("div");
    if (existingElement) target.reattachElement(existingElement);
    const u = this.unobservable;
    u.previouslySetStyle = applyStyle(element, this.style || {}, u.previouslySetStyle);
    return element;
  }

  render(target, context) {
    super.render(target, context);
    const u = this.unobservable;
    if (!u.childTarget) u.childTarget = DOMElementTarget.forElement(u.node);
    provideAtBaseline(u.provided, this.contextExtra);
    this.child.renderOnto(u.childTarget, context);
  }
}

registerDOMComponent("providingElement", DOMProvidingElement);

// Write `values` into `provided` - a context's provided object - at the
// baseline, only where they differ: what a context holds has one value per
// render pass, so the latest writing is always the right one (see
// cascade.component's RenderContext.js).
export function provideAtBaseline(provided, values) {
  if (!values) return;
  const changed = withoutRecording(() => Object.keys(values).filter((key) => provided[key] !== values[key]));
  if (changed.length === 0) return;
  accessInitialValues(() => {
    for (const key of changed) provided[key] = values[key];
  });
}

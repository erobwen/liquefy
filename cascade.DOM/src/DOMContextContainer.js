import { DOMNodeRenderComponent } from "./DOMNodeRenderComponent.js";
import { DOMElementTarget } from "./DOMElementTarget.js";
import { applyStyle } from "./applyStyle.js";

export function contextContainer(...parameters) {
  return new DOMContextContainer(...parameters);
}

/**
 * DOMContextContainer: a real, styleable element (DOMNodeRenderComponent),
 * whose sole further job is handing its own `child` a fresh RenderContext -
 * rooted at this element, so the child's own DOMElementTarget writes (lastChild,
 * appendElement/reattachElement) are scoped to it rather than to whatever
 * target this container itself was rendered onto - with `context` merged
 * in as extra fields (see ApplicationMenuFrame.js's own `workArea`, which
 * hands its page usableWidth/usableHeight this way).
 *
 * Was DOMLegacyBridge, back when cascade.dom had two separate target
 * abstractions (DOMElementTarget's reactive appendElement()/reattachElement() vs.
 * DOMTargetElement's direct createChild()/insertChild()) and this class's
 * actual job was crossing between them. That second abstraction is gone
 * now that cascade.reactive's own engine correctly reconciles a
 * repositioned repeater's stale dependency on a moved-away predecessor's
 * writing (see cascade.reactive's own attachToCurrentParent()/
 * flagOverlapWithMovedPredecessor(), and cascade.dom/src/test/domElementTarget.js's
 * own reordering/grid-resize tests) - the actual reason DOMTargetElement
 * existed at all. With only one target kind left, what remains here is
 * just "own a styled div, hand my child an extended context" - no bridging
 * of anything.
 */
export class DOMContextContainer extends DOMNodeRenderComponent {
  setProperties({ child, style, context }) {
    this.child = child;
    this.style = style || null;
    // Extra fields to merge onto the inner RenderContext on every render -
    // e.g. usableWidth/usableHeight (see ApplicationMenuFrame.js's own
    // `workArea`).
    this.contextExtra = context || null;
  }

  initialUnobservables() {
    const result = super.initialUnobservables();
    result.previouslySetStyle = {};
    return result;
  }

  renderElement(context, existingElement) {
    const element = existingElement || context.target.appendElement("div");
    if (existingElement) context.target.reattachElement(existingElement);
    const u = this.unobservable;
    u.previouslySetStyle = applyStyle(element, this.style || {}, u.previouslySetStyle);
    return element;
  }

  render(context) {
    super.render(context);
    const u = this.unobservable;
    if (!u.innerContext) {
      u.innerContext = context.derive(DOMElementTarget.forElement(u.element));
    }
    if (this.contextExtra) Object.assign(u.innerContext, this.contextExtra);
    this.child.renderOnto(u.innerContext);
  }
}

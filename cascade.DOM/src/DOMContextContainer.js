import { frozen } from "@liquefy/cascade.component";
import { DOMNodeRenderComponent } from "./DOMNodeRenderComponent.js";
import { locateDOMComponent, registerDOMComponent } from "./DOMServiceLocator.js";
import { DOMElementTarget } from "./DOMElementTarget.js";
import { applyStyle } from "./applyStyle.js";

export function contextContainer(...parameters) {
  return locateDOMComponent("contextContainer", parameters);
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
 *
 * With `scrollToTopOnNewChild: true`, a container that scrolls (a page's
 * work area, say) starts each new child from its top: handed a different
 * child than it showed last, its element is scrolled back to the top -
 * rather than showing the new one as far down as the old one was scrolled.
 * The same child building again keeps its place.
 */
export class DOMContextContainer extends DOMNodeRenderComponent {
  setProperties({ child, style, context, scrollToTopOnNewChild }) {
    this.child = child;
    this.scrollToTopOnNewChild = !!scrollToTopOnNewChild;
    this.style = frozen(style || null);
    // Extra fields to merge onto the inner RenderContext on every render -
    // e.g. usableWidth/usableHeight (see ApplicationMenuFrame.js's own
    // `workArea`).
    this.contextExtra = frozen(context || null);
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
    if (this.scrollToTopOnNewChild && u.shownChild && u.shownChild !== this.child) u.element.scrollTop = 0;
    u.shownChild = this.child;
  }
}

registerDOMComponent("contextContainer", DOMContextContainer);

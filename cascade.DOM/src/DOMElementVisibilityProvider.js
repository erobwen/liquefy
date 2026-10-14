import { frozen } from "@liquefy/cascade.component";
import { DOMNodeComponent } from "./DOMNodeComponent.js";
import { DOMElementTarget } from "./DOMElementTarget.js";
import { applyStyle } from "./applyStyle.js";
import { locateDOMComponent, registerDOMComponent } from "./DOMServiceLocator.js";

/**
 * DOMElementVisibilityProvider: DOMElementBoundsProvider's sibling. It owns
 * one real DOM element, watched as it scrolls in and out of view (see
 * DOMElementTarget.observeVisibility()), and renders `child` onto it. The
 * child reads it the way it would read a measured size, from build() or
 * render() alike:
 *
 *  - this.fromTarget("inView"): whether the element is in view right now.
 *  - this.fromTarget("seen"): whether it has been since it was last
 *    shown - once true, it stays true, until it's hidden (its page switched
 *    away from) and shown again.
 *
 * What a page that reveals itself as it's scrolled is made of: each
 * section on a provider of its own, built again - that section alone - the
 * moment it comes into view. Built from `seen`, what's shown once stays
 * shown; from `inView`, it comes and goes with scrolling.
 *
 * `amount`: how much of it has to be visible to count as in view - a
 * fraction of its height, or of the viewport's for one taller than that
 * (default a quarter); `margin`: where the viewport's edges are taken to be
 * (see observeVisibility()).
 *
 * Unlike a bounds provider, not size-contained: its size is its content's,
 * as for any element. Otherwise fully styleable, and as for any element,
 * its creator decides how it fits into whatever it's placed in.
 */
export function elementVisibilityProvider(...parameters) {
  return locateDOMComponent("elementVisibilityProvider", parameters);
}

export class DOMElementVisibilityProvider extends DOMNodeComponent {
  setProperties({ child, style, className, amount, margin }) {
    this.child = child;
    this.style = frozen(style || null);
    this.className = className || null;
    this.amount = typeof(amount) === "number" ? amount : undefined;
    this.margin = margin || undefined;
  }

  initialUnobservables() {
    const result = super.initialUnobservables();
    result.previouslySetStyle = {};
    return result;
  }

  renderNode(target, existingElement) {
    const element = existingElement || target.appendElement("div");
    if (existingElement) target.reattachElement(existingElement);
    element.className = this.className || "";
    const u = this.unobservable;
    u.previouslySetStyle = applyStyle(element, this.style || {}, u.previouslySetStyle);
    return element;
  }

  // Watched from the start: the child's first build already reads what
  // there is to read - not seen yet, until the observer first reports.
  render(target, context) {
    super.render(target, context);
    const u = this.unobservable;
    if (!u.childTarget) {
      u.childTarget = DOMElementTarget.forElement(u.node);
      u.childTarget.observeVisibility({ amount: this.amount, margin: this.margin });
    }
    this.child.renderOnto(u.childTarget, context);
  }

  // Shown again: not seen again until it comes into view - what it
  // revealed, it reveals anew (see DOMElementTarget.resetVisibility()).
  // Before its child is rendered again: it's built not seen.
  onShow() {
    super.onShow();
    if (this.unobservable.childTarget) this.unobservable.childTarget.resetVisibility();
  }

  onDispose() {
    super.onDispose();
    if (this.unobservable.childTarget) this.unobservable.childTarget.stopObservingVisibility();
  }
}

registerDOMComponent("elementVisibilityProvider", DOMElementVisibilityProvider);

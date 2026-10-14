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
 *  - this.fromTarget("seen"): whether it has ever been - once true, it
 *    stays true.
 *
 * What a page that reveals itself as it's scrolled is made of: each
 * section on a provider of its own, built again - that section alone - the
 * moment it comes into view. Built from `seen`, what's shown once stays
 * shown; from `inView`, it comes and goes with scrolling.
 *
 * `margin`: how far inside the viewport's edges the element has to come to
 * count (an IntersectionObserver's rootMargin - see observeVisibility() for
 * the default).
 *
 * Unlike a bounds provider, not size-contained: its size is its content's,
 * as for any element. Otherwise fully styleable, and as for any element,
 * its creator decides how it fits into whatever it's placed in.
 */
export function elementVisibilityProvider(...parameters) {
  return locateDOMComponent("elementVisibilityProvider", parameters);
}

export class DOMElementVisibilityProvider extends DOMNodeComponent {
  setProperties({ child, style, className, margin }) {
    this.child = child;
    this.style = frozen(style || null);
    this.className = className || null;
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
      u.childTarget.observeVisibility(this.margin);
    }
    this.child.renderOnto(u.childTarget, context);
  }

  onDispose() {
    super.onDispose();
    if (this.unobservable.childTarget) this.unobservable.childTarget.stopObservingVisibility();
  }
}

registerDOMComponent("elementVisibilityProvider", DOMElementVisibilityProvider);

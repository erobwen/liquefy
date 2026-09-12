import { Component } from "@liquefy/cascade.component";

/**
 * DOMComponent: a cascade.component Component whose render(target) owns
 * exactly one real DOM element, reused (not recreated) across reruns.
 *
 * A rerun's own reactive reads/writes get reconciled automatically by
 * cascade.reactive's timelines, but a real DOM element is a side effect
 * the reactive system knows nothing about. Recreating it on every rerun
 * would be both wasteful and actively wrong for a component with
 * children: if this component's own wrapping element got swapped out
 * from under them, any child that was merely *relinked* rather than
 * rerun (its own inputs unchanged - the common case) would still be
 * parented under the old, now-detached element, since relinking never
 * re-executes render(). So renderElement() is always handed this
 * component's own previous element (or null, first time) and decides for
 * itself whether to reuse it (patch attributes/content in place - the
 * usual case) or make a new one (e.g. its tag needs to change).
 */
export class DOMComponent extends Component {
  render(target) {
    const u = this.unobservable;
    u.element = this.renderElement(target, u.element || null);
  }

  // Override: reuse `existingElement` (patching it in place) if given, or
  // create one via target.appendElement(tagName) if not - either way,
  // configure and return it.
  renderElement(target, existingElement) {
    throw new Error(this.constructor.name + " must implement renderElement(target, existingElement)");
  }
}

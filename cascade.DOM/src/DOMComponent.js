import { Component } from "@liquefy/cascade.component";

/**
 * DOMComponent: a cascade.component Component whose render(context) owns
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
  render(context) {
    const u = this.unobservable;
    u.element = this.renderElement(context, u.element || null);
  }

  // Override: reuse `existingElement` (patching it in place) if given, or
  // create one via context.target.appendElement(tagName) if not - either
  // way, configure and return it. `context` is whatever was passed to
  // renderOnto() - typically a RenderContext, so context.target is the
  // DOMTarget to manipulate and any other fields (e.g. spaceLeft) are
  // situational information from the parent, if it chose to pass any.
  renderElement(context, existingElement) {
    throw new Error(this.constructor.name + " must implement renderElement(context, existingElement)");
  }

  // Cascade's own retraction (see Component.onRetract()) cleans up
  // reactive state - writings, timelines - but has no idea a real DOM
  // node exists at all. Without this, a component that stops being
  // renderOnto()'d (e.g. crossing a responsive breakpoint - see
  // cascade.DOM/src/test/menuFrameModal.js) would be correctly retracted
  // on the reactive side while its element just sits there, orphaned,
  // still fully attached to the DOM.
  onRetract() {
    if (this.unobservable.element) this.unobservable.element.remove();
  }

  // The other half: if this component is renderOnto()'d again later
  // (crossing back over the same breakpoint, say), relinking reuses the
  // existing repeater without rerunning render() - so nothing else would
  // ever put the element back. Put it back at the current position, the
  // same way appendElement would for a brand new one.
  onReattach(context) {
    if (this.unobservable.element) context.target.reattachElement(this.unobservable.element);
  }
}

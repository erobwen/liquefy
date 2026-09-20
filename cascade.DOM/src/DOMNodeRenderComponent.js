import { Component, aggregateToString } from "@liquefy/cascade.component";

/**
 * DOMNodeRenderComponent: a cascade.component Component whose render(context) owns
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
export class DOMNodeRenderComponent extends Component {
  render(context) {
    const u = this.unobservable;
    const wasFresh = !u.element;
    u.element = this.renderElement(context, u.element || null);
    // Ported from flow.DOM's own DOMNode.js (ensureDomNodeExists()'s
    // domNode.id = aggregateToString(this)) - a real DOM element's own
    // debug identity: open DevTools, click an element, read its id, and
    // aggregateToString() (see cascade.component/src/Component.js) hands
    // back exactly which component (and which component built it, and
    // which built *that*, ...) produced it, matched straight against the
    // source. Only on a freshly-created element (nodeType 1 - excludes
    // DOMTextNode's own Text nodes, which have no id/class to set at
    // all) - reusing an existing one never touches it again, same as
    // flow's own version never re-derives it on a later rerun either.
    // Unconditional, no debug-mode flag, matching flow's own choice.
    if (wasFresh && u.element && u.element.nodeType === 1) {
      u.element.id = aggregateToString(this);
    }
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

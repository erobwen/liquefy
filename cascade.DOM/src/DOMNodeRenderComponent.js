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
    // DOMTextComponent's own Text nodes, which have no id/class to set at
    // all) - reusing an existing one never touches it again, same as
    // flow's own version never re-derives it on a later rerun either.
    // Unconditional, no debug-mode flag, matching flow's own choice.
    if (wasFresh && u.element && u.element.nodeType === 1 && !u.element.id) {
      u.element.id = aggregateToString(this);
    }
  }

  // Two ways to implement a DOM node component:
  //
  //  - ensureNode() - create this component's node if it has none, bring it
  //    up to date (attributes, content, ...), and return it, *without*
  //    placing it anywhere. That makes it a component that provides its node
  //    (see providesNode()): something a component placing nodes itself
  //    (cascade.dom's FlipAnimationContainer) can use directly. Ordinary rendering then
  //    just places the node (the default renderElement() below), so the
  //    component itself never knows which of the two it's in.
  //  - renderElement(context, existingElement) - do both at once, however
  //    it likes (measuring, owning a context for its children, ...). Such a
  //    component can only be rendered, never placed by someone else.
  //
  // ensureNode() keeps unobservable.element up to date itself.
  ensureNode() {
    throw new Error(this.constructor.name + " must implement ensureNode() or renderElement(context, existingElement)");
  }

  // Whether this component can hand over its node without being rendered
  // - it implements ensureNode().
  providesNode() {
    return this.ensureNode !== DOMNodeRenderComponent.prototype.ensureNode;
  }

  // For a component that sets a new element's own debug id itself (see
  // render() above for what it is) - one placed by someone else is never
  // render()ed.
  assignDebugId(element) {
    if (element.nodeType === 1 && !element.id) element.id = aggregateToString(this);
  }

  // Default: ensure the node, then put it at the current position in
  // context.target (typically a RenderContext's DOMElementTarget) - on every
  // render, not just when it's new. A reused node still needs its position
  // reconfirmed even though nothing here moves it: cascade.reactive retracts
  // a repeater's prior writings - including ones made onto a foreign, shared
  // object like DOMElementTarget's lastChild - the moment that repeater is
  // invalidated for a rerun. If this component reruns for a reason
  // unrelated to its node but skipped rewriting lastChild, that write would
  // simply be gone, and a sibling constructed later would read lastChild as
  // the baseline and be inserted before this node instead of after it.
  // reattachElement() itself skips the real DOM move when the node is
  // already exactly where it belongs.
  renderElement(context, existingElement) {
    const node = this.ensureNode();
    context.target.reattachElement(node);
    return node;
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

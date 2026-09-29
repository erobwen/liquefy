import { Component, aggregateToString } from "@liquefy/cascade.component";

/**
 * DOMNodeComponent: a cascade.component Component whose render(target, context) owns
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
 * re-executes render(). So renderNode() is always handed this
 * component's own previous element (or null, first time) and decides for
 * itself whether to reuse it (patch attributes/content in place - the
 * usual case) or make a new one (e.g. its tag needs to change).
 */
export class DOMNodeComponent extends Component {
  render(target, context) {
    const u = this.unobservable;
    const wasFresh = !u.node;
    u.node = this.renderNode(target, u.node || null);
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
    if (wasFresh && u.node && u.node.nodeType === 1 && !u.node.id) {
      u.node.id = aggregateToString(this);
    }
  }

  // Two ways to implement a DOM node component:
  //
  //  - ensureNode() - create this component's node if it has none, bring it
  //    up to date (attributes, content, ...), and return it, *without*
  //    placing it anywhere. That makes it a component that provides its node
  //    (see providesNode()): something a component placing nodes itself
  //    (cascade.dom's FlipAnimationContainer) can use directly. Ordinary rendering then
  //    just places the node (the default renderNode() below), so the
  //    component itself never knows which of the two it's in.
  //  - renderNode(target, existingElement) - do both at once, however
  //    it likes (measuring, owning a target for its children, ...). Such a
  //    component can only be rendered, never placed by someone else.
  //
  // ensureNode() keeps unobservable.node up to date itself.
  ensureNode() {
    throw new Error(this.constructor.name + " must implement ensureNode() or renderNode(target, existingElement)");
  }

  // Whether this component can hand over its node without being rendered
  // - it implements ensureNode().
  providesNode() {
    return this.ensureNode !== DOMNodeComponent.prototype.ensureNode;
  }

  // For a component that sets a new element's own debug id itself (see
  // render() above for what it is) - one placed by someone else is never
  // render()ed.
  assignDebugId(element) {
    if (element.nodeType === 1 && !element.id) element.id = aggregateToString(this);
  }

  // Default: ensure the node, then put it at the current position in
  // `target` (a DOMElementTarget) - on every
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
  renderNode(target, existingElement) {
    const node = this.ensureNode();
    target.reattachElement(node);
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
    if (this.unobservable.node) this.unobservable.node.remove();
    super.onRetract();
  }

  // The other half: if this component is renderOnto()'d again later
  // (crossing back over the same breakpoint, say), relinking reuses the
  // existing repeater without rerunning render() - so nothing else would
  // ever put the element back. Put it back at the current position, the
  // same way appendElement would for a brand new one.
  onReattach(target) {
    if (this.unobservable.node) target.reattachElement(this.unobservable.node);
    super.onReattach(target);
  }
}

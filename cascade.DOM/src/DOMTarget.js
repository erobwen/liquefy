import { observable } from "@liquefy/cascade.component";

/**
 * DOMTarget wraps one real DOM element that components render children
 * into. Unlike flow.DOM's RenderTarget (a service locator that only knew
 * how to create the right *kind* of primitive component, with actual DOM
 * mounting happening later in a separate pass), a DOMTarget is manipulated
 * directly and in real time: a component calls target.appendElement(...)
 * as part of its own render(target), and the resulting real DOM node is
 * created and inserted immediately, in the correct position.
 *
 * "Correct position" comes from `lastChild` - an ordinary observable
 * property, but because cascade.reactive gives every partial its own
 * position in its root repeater's partial chain, each component's *own*
 * read of target.lastChild resolves to whatever the specific component
 * positioned immediately before it (in render order) last wrote there -
 * not whatever the target's "final" value ends up being, and not its own
 * stale value from a previous run either. That's what lets a whole subtree
 * of components append children in turn, each seeing only what came
 * before it - exactly like cascade.reactive/src/test/renderOnto.js's
 * spaceLeft example, just for DOM insertion order instead of a number.
 */
export class DOMTarget {
  constructor(element) {
    this.element = element;
    this.lastChild = null;
    return observable(this);
  }

  // Create a new real DOM element, insert it immediately after whatever
  // this target's lastChild currently is (as seen from the calling
  // component's own tree position), and advance lastChild so whatever
  // renders next (later in tree order) sees it. Returns the new element.
  appendElement(tagName) {
    const newElement = document.createElement(tagName);
    this.reattachElement(newElement);
    return newElement;
  }

  // Same positioning as appendElement, but for an *existing* element
  // rather than a fresh one - see DOMComponent.onReattach(): a component
  // relinked after being retracted needs its own previously-removed
  // element put back, without rerunning render() (relinking never does)
  // to create a new one.
  reattachElement(element) {
    const referenceNode = this.lastChild ? this.lastChild.nextSibling : this.element.firstChild;
    this.element.insertBefore(element, referenceNode);
    this.lastChild = element;
  }

  // A target for rendering into a specific real element - typically a
  // component's own newly-created container, so its own children's
  // lastChild tracking is scoped to that element, not to this target's.
  static forElement(element) {
    return new DOMTarget(element);
  }
}

import { observable } from "@liquefy/cascade.component";
import { DOMPrimitiveLocator } from "./DOMPrimitiveLocator.js";

/**
 * DOMElementTarget wraps one real DOM element that components render children
 * into. Unlike flow.DOM's RenderTarget (a service locator that only knew
 * how to create the right *kind* of primitive component, with actual DOM
 * mounting happening later in a separate pass), a DOMElementTarget is manipulated
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
 *
 * Also owns (or, for a nested target, simply forwards) this tree's one
 * shared DOMPrimitiveLocator (see cascade.component's Component.js -
 * unobservable.primitiveLocator, propagated to every component down the
 * *construction* chain for free, with this target as the one bootstrap
 * point for whatever has no creator to inherit it from). A target created
 * with no `primitiveLocator` argument mints its own - the tree's actual
 * root - and every nested target this tree ever creates (DOMElementComponent's
 * own child context, DOMContextContainer, ...) passes its own
 * `this.unobservable.primitiveLocator` along instead of leaving this
 * argument out, so the whole tree shares exactly one instance. On
 * `this.causality` (see cascade.reactive's own reserved meta-property),
 * not a plain field - a locator is global and non-reactive, never meant
 * to participate in dependency tracking at all, unlike `element`/
 * `lastChild` just above.
 */
export class DOMElementTarget {
  constructor(element, primitiveLocator) {
    this.element = element;
    this.lastChild = null;
    const target = observable(this);
    target.causality.primitiveLocator = primitiveLocator || new DOMPrimitiveLocator();
    return target;
  }

  get primitiveLocator() {
    return this.causality.primitiveLocator;
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
  // rather than a fresh one - see DOMNodeRenderComponent.onReattach(): a component
  // relinked after being retracted needs its own previously-removed
  // element put back, without rerunning render() (relinking never does)
  // to create a new one. Also called on every render of a *reused* element
  // (see DOMElementComponent.renderElement()'s own comment) purely to keep
  // target.lastChild's write positioned correctly - which, for the very
  // common case where nothing structurally changed, means `element` is
  // already exactly where it belongs. Real DOM elements don't need to be
  // told twice: skip the actual insertBefore then, so an unrelated rerun
  // elsewhere in the tree doesn't touch every untouched sibling's real
  // node on its way past - insertBefore() always performs a real move
  // (firing mutation records DevTools' Elements panel flashes on, stealing
  // focus, restarting CSS transitions/animations) even when the node ends
  // up exactly where it already was.
  reattachElement(element) {
    const referenceNode = this.lastChild ? this.lastChild.nextSibling : this.element.firstChild;
    // Two ways "already exactly where it belongs" shows up: the ordinary
    // one (element.nextSibling is already referenceNode), and the
    // degenerate one where element *is* referenceNode - which happens
    // whenever element is (still) the very first live child accounted for
    // here (lastChild reads back null - nothing precedes it - so
    // referenceNode falls through to this.element.firstChild, which, if
    // element hasn't actually moved, is element itself). insertBefore(x, x)
    // is a real DOM call whose spec-defined result is "no change" - so is
    // this - but without checking for it explicitly, element.nextSibling
    // (never equal to element itself) always looks like a mismatch, forcing
    // a needless real move on every single "first child reconfirms its own
    // position" render, which is the common case for a subtree's own root
    // element and the first item of any list.
    const alreadyPositioned = element.parentNode === this.element &&
      (element === referenceNode || element.nextSibling === referenceNode);
    if (!alreadyPositioned) {
      this.element.insertBefore(element, referenceNode);
    }
    this.lastChild = element;
  }

  // A target for rendering into a specific real element - typically a
  // component's own newly-created container, so its own children's
  // lastChild tracking is scoped to that element, not to this target's.
  // Pass the current primitiveLocator along (see this class's own top
  // comment) - leaving it out doesn't break anything today (a fresh
  // DOMPrimitiveLocator behaves identically to any other, see its own
  // class doc), but would stop being harmless the moment a locator ever
  // holds real per-tree state.
  static forElement(element, primitiveLocator) {
    return new DOMElementTarget(element, primitiveLocator);
  }
}

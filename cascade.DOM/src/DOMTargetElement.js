import { observable } from "@liquefy/cascade.component";

/**
 * DOMTargetElement: one real DOM element, wrapped so a component can build
 * a whole subtree of real elements directly inside render(context) -
 * without needing to be a DOMNodeComponent at all. This is what makes
 * DOMNodeComponent no longer the central, load-bearing primitive it was in
 * flow.core (where everything had to expand into a primitive component to
 * ever touch the real DOM): an ordinary Component can call
 * context.target.createChild(...) straight from render(), get back
 * further DOMTargetElements, and keep going - "a fake DOM, built out of
 * observables" over the real one, always reachable via .element.
 * DOMNodeComponent still exists for the common "I own exactly one element,
 * patch it in place" shape (and will remain the shape FlipAnimationContainer
 * needs later), but it's now just one way to use this, not the only way.
 *
 * Ownership is direct and simple, not tracked by any shared list:
 * whoever calls createChild() owns the DOMTargetElement it returns, the
 * same way a DOMNodeComponent already owns its own single element - cache it
 * (typically on `this.unobservable`) and keep calling methods on that same
 * instance across reruns, rather than creating a fresh one every time. A
 * DOMNodeComponent ends up owning exactly one; an ordinary Component render()
 * can create and own as many as it needs.
 *
 * This is deliberately *not* built on DOMTarget's own `lastChild` - a
 * single observable property shared by every sibling that touches it,
 * whose dependency, once established at a component's first creation,
 * never gets a chance to clear (a same-value write is deduped without a
 * real rerun to shed the old dependency), so writing it again later for
 * an unrelated reason can spuriously invalidate a long-dormant sibling.
 * createChild/insertChild instead mutate the real DOM directly with no
 * observable property in between - no dependency is ever created by
 * calling them, so there is nothing to spuriously invalidate later.
 *
 * What's NOT built yet: a real reactive/temporal list of a parent's
 * children (so a rebuild could diff "children as of this run" against
 * "children as of last run" the way a property's own timeline already
 * does). Postponed deliberately - direct ownership is simpler and covers
 * what's needed today; revisit if a concrete case needs more.
 */
export class DOMTargetElement {
  constructor(element) {
    this.element = element;
    return observable(this);
  }

  // Create a new real child element, appended after this element's
  // current last real child, and wrap it in a DOMTargetElement of its
  // own. The caller owns the result (see class comment) - call this once
  // and cache what it returns; calling it again makes a second, separate
  // element rather than reusing the first.
  createChild(tagName) {
    const child = document.createElement(tagName);
    this.element.appendChild(child);
    return new DOMTargetElement(child);
  }

  // Reposition an already-owned child (one this same DOMTargetElement
  // previously handed out via createChild) so it sits immediately after
  // `after` (or first, if `after` is omitted/null) among this element's
  // current real children. For the one thing direct ownership alone
  // doesn't cover: a child whose relative order needs to change on a
  // later render without being torn down and recreated - see
  // cascade.application/demo's menu/work-area breakpoint, which
  // reorders its two children depending on docked vs. modal layout.
  // A plain, direct DOM move - not an observable write, so (unlike the
  // old shared `lastChild`) it creates no dependency for anything to
  // spuriously trip over later.
  insertChild(child, after) {
    const referenceNode = after ? after.element.nextSibling : this.element.firstChild;
    this.element.insertBefore(child.element, referenceNode);
  }

  // Escape hatch: peek behind the fake DOM to the real element - for
  // measuring (getBoundingClientRect), or anything else this wrapper
  // doesn't itself expose.
  static forElement(element) {
    return new DOMTargetElement(element);
  }
}

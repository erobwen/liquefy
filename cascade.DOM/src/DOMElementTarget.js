import { observable, accessInitialValues, withoutRecording } from "@liquefy/cascade.component";

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
 * (Services - which component an HTML tag or a themed widget turns into -
 * aren't a target's business: they're provided in the render context, see
 * cascade.component's ServiceLocator.js and RenderContext.js. A target holds
 * what is temporal - what's been placed on it so far - and nothing else.)
 */
export class DOMElementTarget {
  constructor(element) {
    this.element = element;
    this.lastChild = null;
    // What's timeless about this target - see observeBounds(). None, unless
    // its element is measured.
    this.timeless = null;
    return observable(this);
  }

  /**
   * Bounds - opt in: measure this target's element, and keep its size as a
   * timeless property of the target, `timeless.width`/`timeless.height` -
   * what a component rendered onto it reads from build() with
   * this.fromTarget("width") (see cascade.component's Component). Its
   * layout size - the content box, the room there is for what's inside, as
   * laid out: not as drawn, so a transform (a FlipAnimationContainer's
   * scale, say) never changes it.
   *
   * An advanced feature, for an element set up to know its size when it's
   * rendered: sized from outside (size-contained - see
   * DOMElementBoundsProvider), and with nothing added next to it later in
   * the same pass. So it's measured right away, once, when observing starts
   * - the first build already gets the real size - and a ResizeObserver
   * follows every real resize after that: it reports after layout and
   * before paint, so what's built again from a new size is never drawn
   * with the old one.
   *
   * Its first report, right after observing, then finds the size it was
   * measured with, and changes nothing. If it doesn't - the element's size
   * did change within the frame it was first measured in (a sibling added
   * after it, or a height following content the first build changed) - the
   * new size is simply taken, and what read the old one is built again:
   * graceful degradation, not the way it's meant to be used. The browser
   * may then log "ResizeObserver loop completed with undelivered
   * notifications" - the notification for the size the rebuild itself
   * caused comes a frame later. Harmless; the same message a size that
   * keeps changing itself (a build growing the element it reads the size
   * of) would give, when the browser cuts the loop off.
   *
   * Written at the baseline, only when it changes: a size has one value
   * per pass (see cascade.component's RenderContext.js on why timeless
   * values are safe for a build to read). Undefined while the element
   * isn't in the page.
   *
   * Where there is no ResizeObserver, a window resize listener measures
   * what it can.
   */
  observeBounds() {
    const meta = this.causality;
    if (meta.boundsObserver) return;
    const element = this.element;
    const view = element.ownerDocument.defaultView;
    const timeless = observable({ width: undefined, height: undefined });
    accessInitialValues(() => { this.timeless = timeless; });
    const write = (width, height) => {
      if (withoutRecording(() => timeless.width === width && timeless.height === height)) return;
      accessInitialValues(() => {
        timeless.width = width;
        timeless.height = height;
      });
    };
    // Its content box as laid out - from the computed style, which is the
    // layout size, to the fraction of a pixel a ResizeObserver reports.
    const measure = () => {
      if (!view || !element.isConnected) return;
      const style = view.getComputedStyle(element);
      const px = (value) => parseFloat(value) || 0;
      let width = px(style.width);
      let height = px(style.height);
      if (style.boxSizing === "border-box") {
        width -= px(style.paddingLeft) + px(style.paddingRight) + px(style.borderLeftWidth) + px(style.borderRightWidth);
        height -= px(style.paddingTop) + px(style.paddingBottom) + px(style.borderTopWidth) + px(style.borderBottomWidth);
      }
      write(width, height);
    };
    measure();
    if (view && typeof(view.ResizeObserver) === "function") {
      const observer = new view.ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.target === element && element.isConnected) write(entry.contentRect.width, entry.contentRect.height);
        }
      });
      observer.observe(element);
      meta.boundsObserver = () => observer.disconnect();
    } else if (view) {
      view.addEventListener("resize", measure);
      meta.boundsObserver = () => view.removeEventListener("resize", measure);
    }
  }

  // No longer measured - its element is gone for good.
  stopObservingBounds() {
    const meta = this.causality;
    if (!meta.boundsObserver) return;
    meta.boundsObserver();
    meta.boundsObserver = null;
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
  // rather than a fresh one - see DOMNodeComponent.onReattach(): a component
  // relinked after being retracted needs its own previously-removed
  // element put back, without rerunning render() (relinking never does)
  // to create a new one. Also called on every render of a *reused* element
  // (see DOMElementComponent.renderNode()'s own comment) purely to keep
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
  static forElement(element) {
    return new DOMElementTarget(element);
  }
}

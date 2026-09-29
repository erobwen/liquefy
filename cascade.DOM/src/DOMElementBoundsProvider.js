import { accessInitialValues, frozen, observable } from "@liquefy/cascade.component";
import { DOMNodeRenderComponent } from "./DOMNodeRenderComponent.js";
import { DOMElementTarget } from "./DOMElementTarget.js";
import { applyStyle } from "./applyStyle.js";
import { locateDOMComponent, registerDOMComponent } from "./DOMServiceLocator.js";

/**
 * DOMElementBoundsProvider: owns one real DOM element, measures it with
 * getBoundingClientRect(), renders `child` onto it, and provides the result
 * as `width`/`height` - found by that child, and anything further down its
 * subtree, as `this.inherit("width")`/`this.inherit("height")`, from build()
 * or render() alike, until a nearer bounds provider provides its own.
 *
 * Fully styleable, same as flow's own unwritten "every component takes
 * `style`" convention (see cascade.DOM/src/applyStyle.js's own doc) - its
 * creator decides how it fits into whatever it's placed in (fill its
 * parent, a fixed size, flex/grid participation, ...) rather than this
 * component imposing any layout of its own; it has no default style at all.
 * That's what lets a creator's child avoid an *extra* wrapper div purely
 * for sizing purposes - see ApplicationMenuFrame.js's own class doc, whose
 * root is a bare DOMElementBoundsProvider with no further wrapper around it.
 *
 * Also keeps the measurement current by itself, so nothing above this
 * component has to: a ResizeObserver on its element catches every change
 * of its size - a window resize, but also siblings arriving next to it in
 * a flex row, which make it narrower with no resize at all (a grid of
 * bounds providers: the first, measured on its own, would otherwise keep
 * the whole row's width). Where there is no ResizeObserver, a window
 * resize listener does what it can.
 * Measuring is real, synchronous DOM work - the reason this overrides
 * render() at all rather than build() (see cascade.component/README.md's
 * "most components should only implement build()").
 */
export function elementBoundsProvider(...parameters) {
  return locateDOMComponent("elementBoundsProvider", parameters);
}

export class DOMElementBoundsProvider extends DOMNodeRenderComponent {
  setProperties({ child, style, className }) {
    this.child = child;
    this.style = frozen(style || null);
    this.className = className || null;
  }

  initialUnobservables() {
    const result = super.initialUnobservables();
    result.previouslySetStyle = {};
    // What it provides, and what it last measured - created with both
    // fields in, only rewritten after that (see measure()).
    result.bounds = observable({ width: 0, height: 0 });
    result.measured = { width: 0, height: 0 };
    return result;
  }

  provide() {
    return this.unobservable.bounds;
  }

  renderElement(target, existingElement) {
    const element = existingElement || target.appendElement("div");
    if (existingElement) target.reattachElement(existingElement);
    // Unconditional (not `if (this.className)`) - a className that goes
    // from set to unset across a rebuild must clear the real attribute too,
    // not leave the old one stuck (same reasoning applyStyle below has for
    // a style property that disappears the same way).
    element.className = this.className || "";
    const u = this.unobservable;
    u.previouslySetStyle = applyStyle(element, this.style || {}, u.previouslySetStyle);
    return element;
  }

  // Measured before its child is rendered, so the child's first build
  // already sees the real size.
  render(target, context) {
    super.render(target, context);
    const u = this.unobservable;
    if (!u.innerTarget) u.innerTarget = DOMElementTarget.forElement(u.element);
    this.measure();
    this.observeSize();
    this.child.renderOnto(u.innerTarget, context);
  }

  // Measures again - called on every render() (in case something other
  // than a resize changed this element's real size) and directly from the
  // resize listener, an ordinary event handler outside any repeater.
  // (Width/height are neither properties nor state - see
  // cascade.component/README.md - but what this component provides.)
  //
  // Written at initial time (accessInitialValues()) wherever it's called
  // from, so both callers write the same slot: the listener's writes land
  // there anyway, being outside any repeater - but a plain write from
  // render() would be this render's own, positioned later in the pipeline,
  // and shadow every write the listener makes after it. Rendered again for
  // any reason (its creator rebuilding - an app-wide theme switch, say),
  // this would then stop following resizes altogether.
  measure() {
    const u = this.unobservable;
    const rect = u.element.getBoundingClientRect();
    // Compared with what it last wrote, kept unobservable: reading what it
    // provides here would make render() depend on what it writes.
    if (u.measured.width === rect.width && u.measured.height === rect.height) return;
    u.measured = { width: rect.width, height: rect.height };
    accessInitialValues(() => {
      u.bounds.width = rect.width;
      u.bounds.height = rect.height;
    });
  }

  // Measuring again whenever the element changes size - only then: a
  // measurement the same as before writes nothing.
  observeSize() {
    const u = this.unobservable;
    if (u.resizeObserver || u.resizeListener) return;
    const view = u.element.ownerDocument.defaultView;
    if (typeof(view.ResizeObserver) === "function") {
      u.resizeObserver = new view.ResizeObserver(() => {
        if (u.element.isConnected) this.measure();
      });
      u.resizeObserver.observe(u.element);
    } else {
      u.resizeListener = () => this.measure();
      view.addEventListener("resize", u.resizeListener);
    }
  }

  onDispose() {
    super.onDispose();
    const u = this.unobservable;
    if (u.resizeObserver) u.resizeObserver.disconnect();
    if (u.resizeListener) u.element.ownerDocument.defaultView.removeEventListener("resize", u.resizeListener);
  }
}

registerDOMComponent("elementBoundsProvider", DOMElementBoundsProvider);

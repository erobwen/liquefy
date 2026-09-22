import { RenderContext } from "@liquefy/cascade.component";
import { DOMNodeRenderComponent } from "./DOMNodeRenderComponent.js";
import { DOMTarget } from "./DOMTarget.js";
import { applyStyle } from "./applyStyle.js";

/**
 * DOMElementBoundsProvider: owns one real DOM element, measures it with
 * getBoundingClientRect(), and renders `child` onto a RenderContext that
 * carries the result as `width`/`height` - readable by that child (and, by
 * default forwarding, anything further down its subtree that doesn't sit
 * behind another render() override) as `this.renderContext.width`/`height`,
 * from build() or render() alike (see Component.js's own renderOnto(),
 * which sets `this.renderContext` unconditionally for every component).
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
 * Also owns the one window resize listener needed to keep the measurement
 * current, so nothing above this component has to manage one itself.
 * Measuring is real, synchronous DOM work - the reason this overrides
 * render() at all rather than build() (see cascade.component/README.md's
 * "most components should only implement build()").
 */
export class DOMElementBoundsProvider extends DOMNodeRenderComponent {
  setProperties({ child, style, className }) {
    this.child = child;
    this.style = style || null;
    this.className = className || null;
  }

  initialUnobservables() {
    const result = super.initialUnobservables();
    result.previouslySetStyle = {};
    return result;
  }

  renderElement(context, existingElement) {
    const element = existingElement || context.target.appendElement("div");
    if (existingElement) context.target.reattachElement(existingElement);
    // Unconditional (not `if (this.className)`) - a className that goes
    // from set to unset across a rebuild must clear the real attribute too,
    // not leave the old one stuck (same reasoning applyStyle below has for
    // a style property that disappears the same way).
    element.className = this.className || "";
    const u = this.unobservable;
    u.previouslySetStyle = applyStyle(element, this.style || {}, u.previouslySetStyle);
    return element;
  }

  render(context) {
    super.render(context);
    const u = this.unobservable;
    if (!u.innerContext) {
      // The one and only write to a fresh RenderContext's own width/height
      // must happen through its constructor's `extra` (applied via a plain
      // Object.assign before observable() ever wraps it - see
      // RenderContext.js), not as a follow-up assignment through the
      // now-reactive object immediately afterward: writing a *freshly
      // introduced* key through the wrapper a second time in the very same
      // pass that first introduced it leaves that key permanently unable to
      // propagate any *later* write (verified empirically - a real,
      // reproducible limitation of the underlying proxy, not a style
      // preference). measure() (below) is only safe to call again once
      // width/height already exist as ordinary tracked keys from a genuinely
      // separate, later pass - which this real initial measurement, folded
      // into construction itself, guarantees for every call after this one.
      const rect = u.element.getBoundingClientRect();
      u.innerContext = new RenderContext(DOMTarget.forElement(u.element), { width: rect.width, height: rect.height });
    } else {
      this.measure();
    }
    if (!u.resizeListener) {
      u.resizeListener = () => this.measure();
      window.addEventListener("resize", u.resizeListener);
    }
    this.child.renderOnto(u.innerContext);
  }

  // Re-measures an *already-established* innerContext - called on every
  // render() after the first (in case something other than a resize changed
  // this element's real size) and directly from the resize listener, an
  // ordinary event handler outside any repeater (these are plain property
  // writes either way - see cascade.component/README.md's properties-vs-
  // state distinction; width/height here are neither: situational fields on
  // this component's own cached RenderContext, not this component's own
  // state).
  measure() {
    const u = this.unobservable;
    const rect = u.element.getBoundingClientRect();
    u.innerContext.width = rect.width;
    u.innerContext.height = rect.height;
  }

  onDispose() {
    super.onDispose();
    const u = this.unobservable;
    if (u.resizeListener) window.removeEventListener("resize", u.resizeListener);
  }
}

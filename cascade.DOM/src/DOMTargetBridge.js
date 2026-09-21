import { Component, RenderContext } from "@liquefy/cascade.component";
import { DOMTarget } from "./DOMTarget.js";

/**
 * DOMTargetBridge: the other direction from DOMTargetElementBridge.js's own
 * bridge - that one lets a build()-composed, DOMTarget-based tree host an
 * existing DOMTargetElement-based component as a child. This one is for a
 * component that receives a DOMTargetElement-based context (from whatever
 * renderOnto()'d it - typically something still using the older
 * createChild()/insertChild() style, directly or via DOMTargetElementBridge)
 * but wants to compose itself purely with build() - what DOMElementNode
 * (what build()'s tag functions actually construct) needs is a DOMTarget-
 * based context instead (appendElement()/reattachElement(), not
 * createChild()/insertChild() - deliberately incompatible names, see
 * DOMTarget.js/DOMTargetElement.js's own comments on why they're separate
 * abstractions at all).
 *
 * Extend this and implement only build() - the ordinary shape for "most
 * common components" (see cascade.component/README.md) - rather than
 * reimplementing this bridging in application code. A component that
 * genuinely needs to interleave real, synchronous work with its own build()
 * (real DOM measurement before deciding what to build, say) has a reason to
 * override render() itself instead; bridging alone doesn't, which is why
 * this exists as a base to extend rather than something every such
 * component repeats. Only exceptional, cascade.DOM-level components (this
 * one included) should need to implement render() at all - see
 * cascade.component/README.md.
 */
export class DOMTargetBridge extends Component {
  // Optional - omitting `style` (or constructing with no properties at all,
  // the common case for a subclass like IntroductionPage.js) leaves this
  // bridging div at just its own height:100%/box-sizing default below.
  setProperties({ style } = {}) {
    this.style = style || null;
  }

  render(context) {
    const u = this.unobservable;
    if (!u.el) {
      u.el = context.target.createChild("div");
      // Explicit height (not left auto) by default, so a build()-composed
      // descendant's own height: 100% resolves against this bridging div's
      // real parent instead of this div's own content - otherwise this
      // div, having no height of its own to report, just auto-sizes to
      // whatever that descendant's content happens to need, breaking the
      // percentage-height chain in both directions (shrinks for short
      // content, overflows for tall content - a real bug found via exactly
      // this). `style` (if given) is applied on top, and can override it.
      Object.assign(u.el.element.style, { height: "100%", boxSizing: "border-box" });
      if (this.style) Object.assign(u.el.element.style, this.style);
    }
    if (!u.innerContext) {
      u.innerContext = new RenderContext(DOMTarget.forElement(u.el.element));
    }
    this.reactiveBuildEquivalent().renderOnto(u.innerContext);
  }

  onRetract() {
    this.unobservable.el.element.remove();
  }

  onReattach(context) {
    context.target.element.appendChild(this.unobservable.el.element);
  }
}

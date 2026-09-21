import { Component, RenderContext } from "@liquefy/cascade.component";
import { DOMTarget } from "./DOMTarget.js";

/**
 * DOMBuildBridge: the other direction from DOMLegacyBridge.js's own bridge -
 * that one lets a build()-composed, DOMTarget-based tree host an existing
 * DOMTargetElement-based component as a child. This one is for a component
 * that receives a DOMTargetElement-based context (from whatever
 * renderOnto()'d it - typically something still using the older
 * createChild()/insertChild() style, directly or via DOMLegacyBridge) but
 * wants to compose itself purely with build() - what DOMElementComponent
 * (what build()'s tag functions actually construct) needs is a DOMTarget-
 * based context instead (appendElement()/reattachElement(), not
 * createChild()/insertChild() - deliberately incompatible names, see
 * DOMTarget.js/DOMTargetElement.js's own comments on why they're separate
 * abstractions at all).
 *
 * Owns no real element of its own - reuses whatever real element the
 * received context already wraps (context.target.element) directly as the
 * DOMTarget root for build()-composed content, rather than creating a
 * *further* child div purely to re-enter DOMTarget-world. An earlier
 * version of this class did create its own div here - a real, if harmless,
 * instance of the same unnecessary-wrapper-div pattern found (and fixed)
 * in ApplicationMenuFrame.js (see that file's own git history): the extra
 * div was never actually needed, since a subclass's own build() result
 * (a real DOMElementComponent - e.g. IntroductionPage.js's own div(...))
 * already creates and styles its own single root element, the exact same
 * way it would if this class inserted a div of its own first.
 *
 * This is safe *because* of who hands this component its context, not in
 * spite of it: DOMLegacyBridge (every current caller) creates its own div
 * *solely* to hand off to one child, so nothing else ever writes into it
 * via the older API - there is no competing ownership over its children to
 * worry about. A subclass that wants to control its own root's real
 * styling does so the ordinary way, through its own build() result (see
 * IntroductionPage.js), not through a property on this bridge.
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
export class DOMBuildBridge extends Component {
  render(context) {
    const u = this.unobservable;
    if (!u.innerContext) {
      u.innerContext = new RenderContext(DOMTarget.forElement(context.target.element));
    }
    this.reactiveBuildEquivalent().renderOnto(u.innerContext);
  }
}

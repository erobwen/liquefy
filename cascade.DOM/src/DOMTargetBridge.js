import { Component, RenderContext } from "@liquefy/cascade.component";
import { DOMTarget } from "./DOMTarget.js";
import { applyStyle } from "./applyStyle.js";

// Defaults this bridging div starts from - a build()-composed descendant's
// own height: 100% needs *something* definite to resolve against, or it
// just auto-sizes to content instead (see this class's own render() doc).
// `style` (a property, so it may itself change across rebuilds - see
// cascade.component/README.md) always wins over these, same merge order as
// flow's own addDefaultStyle()/addDefault() convention.
const DEFAULT_STYLE = { height: "100%", boxSizing: "border-box" };

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
  // bridging div at just DEFAULT_STYLE above.
  setProperties({ style } = {}) {
    this.style = style || null;
  }

  initialUnobservables() {
    const result = super.initialUnobservables();
    result.previouslySetStyle = {};
    return result;
  }

  render(context) {
    const u = this.unobservable;
    if (!u.el) u.el = context.target.createChild("div");
    // Every render, not just the first - `style` is a property (see
    // cascade.component/README.md), meant to be re-set on every rebuild
    // like a function argument, so a creator that changes it must see that
    // reflected here too. applyStyle diffs against last time, so a rebuild
    // that leaves `style` unchanged touches the real element not at all.
    u.previouslySetStyle = applyStyle(u.el.element, { ...DEFAULT_STYLE, ...this.style }, u.previouslySetStyle);
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

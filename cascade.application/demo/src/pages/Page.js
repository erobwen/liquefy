import { Component, RenderContext } from "@liquefy/cascade.component";
import { DOMTarget } from "@liquefy/cascade.dom";

/**
 * Page - the render() override every page under this directory needed
 * (IntroductionPage, RecursiveDemo, ...), factored out. WorkArea (see
 * ApplicationMenuFrame.js's own bridgeToDOMTargetElement() call) hands
 * every page a DOMTargetElement-based context, matching the rest of the
 * demo's own frame code - but DOMElementNode (what build()'s tag
 * functions actually construct) needs a DOMTarget-based one instead
 * (appendElement/reattachElement, not createChild/insertChild -
 * deliberately incompatible names, see DOMTarget.js/DOMTargetElement.js's
 * own comments on why they're separate abstractions at all).
 *
 * Only a component that genuinely needs to interleave real, synchronous
 * work with build() (measuring the real DOM before deciding what to
 * build, say - see ApplicationMenuFrame.js) has a reason to override
 * render() itself; bridging alone doesn't, which is why this exists -
 * a page can extend this and implement only build(), the ordinary shape
 * for "most common components" (see cascade.component/README.md).
 */
export class Page extends Component {
  render(context) {
    const u = this.unobservable;
    if (!u.el) u.el = context.target.createChild("div");
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

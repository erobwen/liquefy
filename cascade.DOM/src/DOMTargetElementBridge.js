import { RenderContext } from "@liquefy/cascade.component";
import { DOMNodeRenderComponent } from "./DOMNodeRenderComponent.js";
import { DOMTargetElement } from "./DOMTargetElement.js";
import { applyStyle } from "./applyStyle.js";

/**
 * The other direction from DOMElementNode's own bridge (DOMTargetElement.js's
 * class comment): that one lets an ordinary Component call
 * context.target.createChild(...) directly from render(), without ever
 * becoming a DOMNodeRenderComponent. This one is for the opposite situation - an
 * existing DOMTargetElement-based component (createChild/insertChild,
 * cascade.application/demo's own frame-level style, predating
 * OverlayFrame/build()) needs to be rendered as an ordinary child inside a
 * build()-composed, DOMTarget-based tree (appendElement/reattachElement -
 * what DOMElementNode/OverlayFrame need, and the two target kinds don't
 * share a method name by accident - see DOMTarget.js/DOMTargetElement.js).
 *
 * One real element, owned the ordinary DOMNodeRenderComponent way (via whatever
 * *outer* target this bridge itself was renderOnto()'d with), with a
 * fresh, cached DOMTargetElement/RenderContext wrapping it underneath for
 * `child` to render into - "each level owns its own context for what's
 * below it", same shape as everywhere else in this demo, just bridging
 * target kinds instead of just field values (compare
 * IntroductionPage.js's own render(), which bridges the same two kinds in
 * the other direction).
 */
export function bridgeToDOMTargetElement(...parameters) {
  return new DOMTargetElementBridge(...parameters);
}

export class DOMTargetElementBridge extends DOMNodeRenderComponent {
  setProperties({ child, style, context }) {
    this.child = child;
    this.style = style || null;
    // Extra fields to copy onto the inner, DOMTargetElement-based
    // RenderContext each render - e.g. usableWidth/usableHeight/
    // menuIsOverlay, the situational fields this demo's own frame
    // components already expect from their parent (see index.js).
    this.contextExtra = context || null;
  }

  initialUnobservables() {
    const result = super.initialUnobservables();
    result.previouslySetStyle = {};
    return result;
  }

  renderElement(context, existingElement) {
    const element = existingElement || context.target.appendElement("div");
    // Same as DOMElementNode.renderElement(): a reused element reconfirms
    // its position every render (see there for why).
    if (existingElement) context.target.reattachElement(existingElement);
    // Diffed against last time (see applyStyle.js's own doc) - a plain
    // Object.assign(element.style, this.style) never clears a property
    // that was set before but is gone from `this.style` now.
    const u = this.unobservable;
    u.previouslySetStyle = applyStyle(element, this.style || {}, u.previouslySetStyle);
    return element;
  }

  render(context) {
    super.render(context);
    const u = this.unobservable;
    if (!u.innerContext) {
      u.innerContext = new RenderContext(DOMTargetElement.forElement(u.element));
    }
    if (this.contextExtra) Object.assign(u.innerContext, this.contextExtra);
    this.child.renderOnto(u.innerContext);
  }
}

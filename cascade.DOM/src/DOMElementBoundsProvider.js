import { frozen } from "@liquefy/cascade.component";
import { DOMNodeRenderComponent } from "./DOMNodeRenderComponent.js";
import { DOMElementTarget } from "./DOMElementTarget.js";
import { applyStyle } from "./applyStyle.js";
import { locateDOMComponent, registerDOMComponent } from "./DOMServiceLocator.js";

/**
 * DOMElementBoundsProvider: owns one real DOM element, measured - its
 * target, what `child` is rendered onto, knows the element's layout size
 * (see DOMElementTarget.observeBounds()) - and renders `child` onto it. The
 * child reads the size from build() or render() alike as
 * `this.fromTarget("width")`/`this.fromTarget("height")` (see
 * cascade.component's Component.fromTarget()). It's the size of the element
 * the child is placed in, so it means something there, and only there:
 * what the child renders into an element of its own is placed on that
 * element's target, which knows nothing of this size.
 *
 * Size-contained by default (\`contain: size layout\`): its size then comes
 * from its parent and siblings alone, never from what's inside it - so
 * what's built from the size can't change the size. Which means it must
 * get its size from outside: fill its parent, a flex share, a grid cell. A
 * provider sized by its content in one direction contains only the other -
 * \`contain: "inline-size layout"\` for one whose height follows its
 * content - by giving \`contain\` in its style.
 *
 * Otherwise fully styleable, same as flow's own unwritten "every component
 * takes `style`" convention (see cascade.DOM/src/applyStyle.js's own doc) -
 * its creator decides how it fits into whatever it's placed in. That's what
 * lets a creator's child avoid an *extra* wrapper div purely for sizing
 * purposes - see ApplicationMenuFrame.js's own class doc, whose root is a
 * bare DOMElementBoundsProvider with no further wrapper around it.
 *
 * Measured once when first rendered - so its child's first build already
 * gets the real size - and then followed through every change of the
 * element's size by itself: a window resize, but also siblings arriving
 * next to it in a flex row later on, which make it narrower with no resize
 * at all. Set up right, the size it's first measured with is its size in
 * that frame; see DOMElementTarget.observeBounds() for what happens when it
 * isn't.
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
    return result;
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
    u.previouslySetStyle = applyStyle(element, { contain: "size layout", ...(this.style || {}) }, u.previouslySetStyle);
    return element;
  }

  // Its element measured from the start - so the child's first build
  // already reads the size.
  render(target, context) {
    super.render(target, context);
    const u = this.unobservable;
    if (!u.innerTarget) {
      u.innerTarget = DOMElementTarget.forElement(u.element);
      u.innerTarget.observeBounds();
    }
    this.child.renderOnto(u.innerTarget, context);
  }

  onDispose() {
    super.onDispose();
    if (this.unobservable.innerTarget) this.unobservable.innerTarget.stopObservingBounds();
  }
}

registerDOMComponent("elementBoundsProvider", DOMElementBoundsProvider);

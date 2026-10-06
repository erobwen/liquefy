import { DOMElementTarget } from "@liquefy/cascade.dom";

/**
 * The target for an app's root element - when its page may be prerendered
 * (see prerender.js). Such a page's HTML already holds a snapshot of what
 * the app renders at its address, in the root element, marked
 * data-prerendered - and the style sheets the snapshot needs, in the head.
 *
 * The app renders as always, onto this target instead of a plain
 * DOMElementTarget, and the snapshot gives way: forElement() removes it,
 * and its style sheets (the app adds its own as it renders). Done in the
 * same task as the app's first render, nothing is painted in between: the
 * snapshot is replaced, in one frame, by the live app.
 *
 *   const target = PrerenderedElementTarget.forElement(document.getElementById("application"));
 *   app.renderOnto(target, context);
 *
 * Only for the root: everything rendered inside it gets plain
 * DOMElementTargets, as always. A page that wasn't prerendered (while
 * developing, say) is taken as it is.
 */
export class PrerenderedElementTarget extends DOMElementTarget {
  static forElement(element) {
    takeOverPrerendered(element);
    return new PrerenderedElementTarget(element);
  }
}

export const prerenderedAttribute = "data-prerendered";

// Remove a prerendered snapshot from `element`, and the style sheets it
// brought along - if it has one.
export function takeOverPrerendered(element) {
  if (!element.hasAttribute(prerenderedAttribute)) return;
  element.removeAttribute(prerenderedAttribute);
  while (element.firstChild) element.removeChild(element.firstChild);
  const head = element.ownerDocument.head;
  if (head) {
    for (const style of [...head.querySelectorAll(`style[${prerenderedAttribute}]`)]) style.remove();
  }
}

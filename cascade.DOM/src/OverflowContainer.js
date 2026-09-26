import { frozen } from "@liquefy/cascade.component";
import { DOMPlacingContainer } from "./DOMPlacingContainer.js";
import { DOMNodeRenderComponent } from "./DOMNodeRenderComponent.js";
import { applyStyle } from "./applyStyle.js";
import { locateDOMComponent, registerDOMComponent } from "./DOMServiceLocator.js";

export function overflowContainer(...parameters) {
  return locateDOMComponent("overflowContainer", parameters);
}

export function elementSlot(...parameters) {
  return locateDOMComponent("elementSlot", parameters);
}

/**
 * OverflowContainer - places its children in a row, one at a time, for as
 * long as they fit, and the rest elsewhere: an ellipsis toolbar's tools,
 * say, with those that don't fit in the popover its ellipsis button opens.
 *
 * It places its whole subtree itself (see DOMPlacingContainer: expanded
 * down to DOM nodes), and its own row with full control - real rendering,
 * in real time, nothing measured anywhere but where it will be:
 *  - one child's node at a time, followed by the ellipsis (\`ellipsis\` - a
 *    component, placed last whenever anything doesn't fit), is put in the
 *    row, and measured where it now is;
 *  - at the first one that makes the row overflow, that one comes out again,
 *    and it and every child after it are placed in \`overflowSlot\` instead
 *    (an elementSlot() - see below - shown wherever the overflow should be:
 *    the popover), the ellipsis last in the row.
 * All within one render, before anything is drawn. How many overflowed is
 * reported to \`onOverflow(count)\` when it changes (to show the right
 * number on the ellipsis, say).
 *
 * It lays out again whenever it's rendered again - its children changing,
 * or its width: it reads \`width\` from its render context, as measured by a
 * DOMElementBoundsProvider around it - and when a child's node changes size
 * by itself (a number growing a digit), which a ResizeObserver on them
 * catches.
 *
 * Children are placed as they expand: a component expanding to several
 * nodes has each placed on its own.
 */
export class OverflowContainer extends DOMPlacingContainer {
  setProperties({ children, style, isUnit, ellipsis, overflowSlot, onOverflow }) {
    super.setProperties({ children, style, isUnit });
    this.ellipsis = ellipsis || null;
    this.overflowSlot = overflowSlot || null;
    this.onOverflow = onOverflow || null;
  }

  initialUnobservables() {
    const result = super.initialUnobservables();
    result.nodes = [];
    result.ellipsisNodes = [];
    result.overflowCount = 0;
    result.observer = null;
    result.sizes = new WeakMap();
    return result;
  }

  render(context) {
    super.render(context);
    const u = this.unobservable;
    // Read, so that a resize (a bounds provider around it measuring) lays
    // it out again - though the room itself is measured on its own element.
    this.renderContext && this.renderContext.width;

    const { placements, placedBefore } = this.expandSubtree(context);
    const ellipsisPlacements = [];
    if (this.ellipsis) this.expandChildren(this, u.element, this.innerContext(context), [this.ellipsis], null, ellipsisPlacements);
    // Everything below the top level is put in order as always; the top
    // level is laid out by layout().
    for (const { parent, nodes } of [...placements.slice(1), ...ellipsisPlacements.slice(1)]) this.placeInOrder(parent, nodes);
    u.nodes = placements[0].nodes;
    u.ellipsisNodes = ellipsisPlacements.length ? ellipsisPlacements[0].nodes : [];

    this.layout();
    this.notifyPlaced(placedBefore);
  }

  // Place the top-level nodes: one at a time, for as long as they fit, the
  // rest in the overflow slot. Only DOM work - so it can run on its own too,
  // when a node changes size (see observe()).
  layout() {
    const u = this.unobservable;
    const row = u.element;
    const nodes = u.nodes;
    const overflowTarget = this.overflowSlot ? this.overflowSlot.ensureNode() : null;
    let cut = nodes.length;
    if (row.isConnected) {
      const style = row.ownerDocument.defaultView.getComputedStyle(row);
      const contentRight = row.getBoundingClientRect().right - (parseFloat(style.borderRightWidth) || 0) - (parseFloat(style.paddingRight) || 0);
      const fits = (node) => rightOf(node) <= contentRight + 0.5;
      const fitted = [];
      for (let index = 0; index < nodes.length; index++) {
        // The next one - and, unless it's the last, the ellipsis after it:
        // there must still be room for that, should anything come next.
        const isLast = index === nodes.length - 1;
        const trial = isLast ? [...fitted, nodes[index]] : [...fitted, nodes[index], ...u.ellipsisNodes];
        this.placeInOrder(row, trial);
        if (!fits(trial[trial.length - 1])) {
          cut = index;
          break;
        }
        fitted.push(nodes[index]);
      }
    }
    // Outside the page, nothing can be measured: everything in the row.
    this.placeInOrder(row, cut < nodes.length ? [...nodes.slice(0, cut), ...u.ellipsisNodes] : nodes);
    if (overflowTarget) this.placeInOrder(overflowTarget, nodes.slice(cut));
    // The sizes this layout was done with - what the observer compares with.
    for (const node of nodes) {
      this.observe(node);
      if (node.nodeType === 1 && node.isConnected) u.sizes.set(node, sizeOf(node));
    }

    const overflowCount = nodes.length - cut;
    if (overflowCount !== u.overflowCount) {
      u.overflowCount = overflowCount;
      if (this.onOverflow) this.onOverflow(overflowCount);
    }
  }

  // A node changing size by itself: lay out again. Only a real change of a
  // node that's in the page counts - compared with the size the last layout
  // was done with. One moved into or out of the row (removed, it reports no
  // size at all) isn't one, or laying out would keep making the observer
  // fire; one that has grown since - a web component drawing its contents a
  // moment after it was added, say - is. (Called by the observer, outside
  // any rendering - a plain event, like a click.)
  observe(node) {
    const u = this.unobservable;
    if (typeof(ResizeObserver) === "undefined" || node.nodeType !== 1 || u.sizes.has(node)) return;
    if (!u.observer) {
      u.observer = new ResizeObserver((entries) => {
        let changed = false;
        for (const entry of entries) {
          if (!entry.target.isConnected) continue;
          const size = sizeOf(entry.target);
          const before = u.sizes.get(entry.target);
          if (before !== size) {
            if (typeof(before) === "number") changed = true;
            u.sizes.set(entry.target, size);
          }
        }
        if (changed) this.layout();
      });
    }
    u.sizes.set(node, undefined);
    u.observer.observe(node);
  }

  onDispose() {
    super.onDispose();
    if (this.unobservable.observer) this.unobservable.observer.disconnect();
  }
}

// A node's drawn width, to a tenth of a pixel.
function sizeOf(element) {
  return Math.round(element.getBoundingClientRect().width * 10) / 10;
}

// Where a node's right edge is drawn.
function rightOf(node) {
  if (node.nodeType === 1) return node.getBoundingClientRect().right;
  const range = node.ownerDocument.createRange();
  range.selectNode(node);
  return range.getBoundingClientRect().right;
}

/**
 * DOMElementSlot - an element for others to fill: a component that is its
 * own, styleable element, with nothing of its own inside. Whoever owns it
 * places nodes in it (an OverflowContainer, its overflowing children) and
 * shows it wherever they belong (in a popover) - its contents stay whatever
 * was placed there, shown or not.
 */
export class DOMElementSlot extends DOMNodeRenderComponent {
  setProperties({ style }) {
    this.style = frozen(style || null);
  }

  initialUnobservables() {
    const result = super.initialUnobservables();
    result.previouslySetStyle = {};
    return result;
  }

  ensureNode() {
    const u = this.unobservable;
    if (!u.element) u.element = document.createElement("div");
    u.previouslySetStyle = applyStyle(u.element, this.style || {}, u.previouslySetStyle);
    return u.element;
  }
}

registerDOMComponent("overflowContainer", OverflowContainer);
registerDOMComponent("elementSlot", DOMElementSlot);

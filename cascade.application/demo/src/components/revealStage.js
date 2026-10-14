import { div, FlipAnimationContainer, defaultToPx } from "@liquefy/cascade.dom";

/**
 * A stage - a section of a page that reveals itself as it's scrolled into
 * view (see cascade.dom's elementVisibilityProvider()): its
 * FlipAnimationContainer, and the wings beside it.
 *
 * What's to fly in is handed to fly() while the section is built, and is
 * built in a slot of its own where it belongs: once the section has been
 * seen, in the slot; until then, in a wing - just outside the section's
 * left or right edge, or below it - clipped away, its slot empty. Seen, it
 * moves to its slot: it went to another parent, so the container makes it
 * travel there, from the side it waited at.
 *
 * Every piece is the same keyed component in its wing as in its slot, so
 * it's the same element: what's flown in has been in the page all along -
 * a prerendered page has it, too.
 *
 *   const stage = new Stage(shown);
 *   const picture = stage.fly("right", img({ key: "picture", ... }));
 *   return stage.build({ background: ... }, heading, picture);
 */
export class Stage {
  constructor(shown, { animate = true } = {}) {
    this.shown = shown;
    this.animate = animate;
    this.wings = { left: [], right: [], below: [] };
    this.slots = [];
  }

  // `piece` must be keyed: its slot is keyed after it.
  fly(from, piece) {
    const slot = div({ key: piece.key + "Slot" }, this.shown ? piece : null);
    if (!this.shown) {
      this.wings[from].push(piece);
      this.slots.push([slot, piece]);
    }
    return slot;
  }

  // The section itself: clipping what's in the wings - and so what flies
  // in from there, which comes in over its edge.
  build(style, ...content) {
    const wing = (position, pieces) => div(
      { style: { position: "absolute", display: "flex", flexDirection: "column", gap: "24px", ...position } },
      pieces,
    );
    return new RevealStage({
      enabled: this.animate,
      trial: this.shown ? null : this.slots,
      style: { position: "relative", overflow: "hidden", boxSizing: "border-box", ...style },
      children: [
        wing({ top: "15%", right: "calc(100% + 64px)", width: "40%" }, this.wings.left),
        wing({ top: "15%", left: "calc(100% + 64px)", width: "40%" }, this.wings.right),
        wing({ top: "calc(100% + 64px)", left: "10%", width: "80%" }, this.wings.below),
        ...content,
      ],
    });
  }
}

/**
 * The stage's container - a FlipAnimationContainer that, until its
 * section is revealed, keeps the room the section will need once it is:
 * so revealing it moves nothing around it, and nothing after it is pushed
 * down as it's scrolled to.
 *
 * Measured, not guessed: the toolbar ellipsis' technique (see cascade.dom's
 * OverflowContainer) - real placement, measured where it is, within one
 * render, before anything is drawn. Each render, once the subtree is
 * expanded, every piece is put in its slot (`trial`: [slot, piece] pairs)
 * and the section's height is read; then the container places everything
 * as it really is - the pieces back in their wings - with that height as
 * its least. The browser never draws the trial.
 *
 * Done where the container would place anyway: after it has recorded where
 * everything is drawn (what animates starts from there), before it places.
 * Pictures need a size of their own before they've loaded (an aspect
 * ratio), or they're measured without it.
 */
class RevealStage extends FlipAnimationContainer {
  setProperties({ trial, ...rest }) {
    super.setProperties(rest);
    this.trial = trial || null;
  }

  expandSubtree(context, children) {
    const result = super.expandSubtree(context, children);
    this.reserveRoom(result.placements);
    return result;
  }

  reserveRoom(placements) {
    const element = this.unobservable.node;
    const least = this.style && typeof(this.style.minHeight) !== "undefined" ? defaultToPx(this.style.minHeight, "minHeight") : "";
    element.style.minHeight = least;
    if (!this.trial || !element.isConnected) return;
    // Laid out as placed so far - what's new isn't in the page yet (all of
    // it, the first time). Added, not put in order: the container does
    // that, right after, and nothing on its way out is taken out early.
    for (const { parent, nodes } of placements) {
      for (const node of nodes) {
        if (node.parentNode !== parent) parent.appendChild(node);
      }
    }
    for (const [slot, piece] of this.trial) {
      const slotNode = slot.unobservable.node;
      const pieceNode = piece.unobservable.node;
      if (slotNode && pieceNode) slotNode.appendChild(pieceNode);
    }
    element.style.minHeight = element.offsetHeight + "px";
  }
}

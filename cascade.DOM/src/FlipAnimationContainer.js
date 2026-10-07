import { withoutRecording } from "@liquefy/cascade.component";
import { DOMPlacingContainer } from "./DOMPlacingContainer.js";
import { locateDOMComponent, registerDOMComponent } from "./DOMServiceLocator.js";

export function flipAnimationContainer(...parameters) {
  return locateDOMComponent("flipAnimationContainer", parameters);
}

/**
 * FlipAnimationContainer - a container that places its whole subtree
 * itself, in one pass, instead of letting each component in it render
 * itself, and animates every change in it: elements moving (within a
 * parent, or to another one), changing size, appearing and leaving. The
 * components in it stay exactly as they are everywhere else, knowing
 * nothing about animation.
 *
 * How it sees and places the subtree - expanded down to DOM nodes, then
 * every element's child nodes put in order, islands for what can only be
 * rendered - is DOMPlacingContainer's (see there). At rest, the result is
 * exactly the DOM rendering the same subtree normally would give.
 *
 * Animation. Every element it places is tracked. On every render, before
 * changing anything, it records where and how large each one is drawn
 * right now - whatever animation it's in the middle of included - then
 * expands and places, then reads where each one now lies in the new layout.
 * The difference (position, and size as a ratio) is what each element is
 * drawn at - a translate() and scale() - and a spring per element brings it
 * back to none. Because the starting point is "where it's drawn right
 * now", and a spring keeps its velocity, an element redirected mid-flight
 * curves smoothly towards its new place rather than jumping or stopping
 * dead. Every element animates from where it was, so a container growing
 * to make room for a newcomer (or shrinking after one leaves) just glides
 * to its new size, and everything around it glides out of the way - no
 * wrappers needed. A nested element is drawn relative to its nearest
 * tracked ancestor (its scale compensated), so movement and resizing never
 * add up twice, and a panel resizing doesn't squash what's in it.
 *
 *  - Appearing: an element with nothing to move from fades in (only the
 *    outermost new one - what's inside it comes along) - where it lies,
 *    whole. A card (or a drawer) growing to make room for it is drawn at its
 *    old size at first, so the newcomer reaches out over its edge: while it
 *    fades in, it and every animated element it's inside are lifted above
 *    what's around them - the siblings after the card are still moving out
 *    of the way, and drawn after it, they'd cover it - and one that clips
 *    what overflows it doesn't, meanwhile (see lift()). Unless the
 *    container is told to `confine` it: then what appears stays within
 *    the elements around it, as they're drawn - crisp edges, revealed as
 *    they grow. Newcomers in something that's on its way somewhere come
 *    along with it - each as far into it, for how large it's drawn, as it
 *    will be at rest, at its own size - rather than standing still while
 *    what's around them moves.
 *  - Travelling: an element on its way to another parent (not just
 *    carried along by what it's in, nor making room among its siblings)
 *    is lifted above what it passes over and lands among, until it has
 *    arrived.
 *  - Leaving: an element removed from the tree is put back as a "ghost" -
 *    where it was among its siblings, so it's still drawn above and below
 *    what it was, absolutely positioned exactly where and how it was
 *    drawn, keeping the font and color it had - which fades out and is
 *    then removed. One that's only a box around others, with nothing to
 *    see of its own, fades out as what's in it instead, each part on its
 *    own (see visibleParts()). A ghost in something on its way goes along
 *    with it, the way a newcomer does. If the same element comes back while
 *    it's fading, it's restored and moves on from there.
 *
 * Islands - components that can only be rendered, and what `isUnit` says
 * to place as one piece (see DOMPlacingContainer) - are animated as one
 * element, in the box the container gives them.
 */
export class FlipAnimationContainer extends DOMPlacingContainer {
  // `speed`: how fast its animations run - a factor, like
  // FlipAnimationContainer.speed (below), which it overrides for this
  // container: 1 is the springs' natural pace. Only read as frames are
  // drawn, so changing it never places anything again - animations under
  // way just go on at the new pace.
  //
  // `confine`: what appears stays within the elements it's in, as they're
  // drawn on their way to their new size - clipped where they clip, and
  // not lifted above what's around them (see lift()). Off by default: it
  // fades in whole, where it lies. Read as frames are drawn, too.
  //
  // `zoomAlong`: what fades in or out in something that's growing or
  // shrinking (its carrier - see startAnimations() and positionGhosts())
  // zooms along with it: a ghost in a card shrinking to half its size
  // shrinks to half its own on the way, and a newcomer in a card growing
  // from half its size starts at half its own. Uniformly - by the geometric
  // mean of the carrier's width and height scales - so text keeps its
  // shape. Off by default: they keep their own size, and only go along
  // with where their carrier goes. Read as frames are drawn, too.
  setProperties({ speed, confine, zoomAlong, ...rest }) {
    super.setProperties(rest);
    this.speed = typeof(speed) === "number" ? speed : null;
    this.confine = !!confine;
    this.zoomAlong = !!zoomAlong;
  }

  initialUnobservables() {
    const result = super.initialUnobservables();
    // Per animating element - see startAnimations().
    result.springs = new Map();
    // Elements lifted above their siblings while something in them appears,
    // with the inline z-index and position they had - see lift().
    result.lifted = new Map();
    // Where each tracked element lies in the current layout.
    result.layout = new Map();
    // Leaving elements, fading out - see removeAsGhosts() - and the
    // elements positioned to hold them, with the position they had.
    result.ghosts = new Map();
    result.positioning = new Map();
    result.framePending = false;
    result.hasRendered = false;
    return result;
  }

  render(target, context) {
    super.render(target, context);
    const u = this.unobservable;

    // Only meaningful while the container is in the page: hidden, nothing
    // has a position - it just places, and whatever was animating stops.
    // Nor while animation is switched off (FlipAnimationContainer.enabled):
    // then it places, and that's that.
    const animate = u.node.isConnected && u.hasRendered && FlipAnimationContainer.enabled;

    // Where every tracked element (and every fading ghost) is drawn right
    // now, before anything changes - including the attribute/style updates
    // expansion makes.
    const drawnAt = new Map();
    if (animate) {
      for (const { element } of u.tracked) {
        if (!element.isConnected) continue;
        const rect = rectOf(element);
        // Text is drawn at its font size times the (uniform) scale it's
        // animating with - see startAnimations().
        const spring = u.springs.get(element);
        const font = textFontSize(element);
        if (font) rect.font = font * (spring ? 1 + spring.sx : 1);
        // Where it is in the tree, too: one that goes elsewhere travels.
        rect.parent = element.parentNode;
        drawnAt.set(element, rect);
      }
      for (const element of u.ghosts.keys()) drawnAt.set(element, rectOf(element));
    }

    const previous = u.tracked;
    const { placements, placedBefore } = this.expandSubtree(context);

    const current = new Set(u.tracked.map(({ element }) => element));
    // Leaving: no longer in the tree - only the outermost of a leaving
    // subtree (what's inside it leaves with it).
    const leaving = animate
      ? previous.filter(({ element, ancestor }) =>
          !current.has(element) && element.isConnected && (!ancestor || current.has(ancestor)))
      : [];
    // What fades out, of each: the parts of it there are to see, each on its
    // own (see visibleParts()) - put back where it was among its siblings,
    // looking as it did.
    const fading = [];
    for (const { element } of leaving) {
      const place = { parent: element.parentNode, next: element.nextSibling };
      for (const part of this.visibleParts(element, drawnAt, current)) {
        fading.push({ element: part, place, look: computedLooks(part) });
      }
    }

    // A ghost that's back in the tree is restored before it's placed.
    for (const element of [...u.ghosts.keys()]) {
      if (current.has(element)) this.restoreGhost(element);
    }

    for (const { parent, nodes } of placements) this.placeInOrder(parent, nodes);

    if (animate) {
      const ghosts = this.removeAsGhosts(fading, drawnAt);
      this.startAnimations(drawnAt);
      this.positionGhosts(ghosts, drawnAt);
      // Restored ghosts have been placed elsewhere by now.
      this.releasePositioning();
    } else {
      this.stopAll();
    }
    u.hasRendered = u.node.isConnected;
    // What each island shows, as this render left it: its component takes
    // its own nodes out when it's retracted - before the next render, that
    // makes a ghost of the island, even starts.
    u.islandContents = new Map();
    for (const { element } of u.tracked) {
      if (element.nodeType === 1 && element.hasAttribute(this.constructor.islandAttribute)) {
        u.islandContents.set(element, [...element.childNodes]);
      }
    }
    this.notifyPlaced(placedBefore);
  }

  // No longer rendered - hidden, or gone for good (animation switched off,
  // say): whatever was animating is done now. Above all, ghosts are removed
  // with their own style back - an element fading out may well come back,
  // rendered somewhere else, and must not still look like a ghost there.
  onRetract() {
    this.stopAll();
    this.unobservable.hasRendered = false;
    super.onRetract();
  }

  // Leaving ghosts (see removeAsGhosts()) stay where they are while their
  // container places its children.
  leftAlone(node) {
    return GHOSTS.has(node);
  }

  // What there is to see of a leaving element, to fade out: the element
  // itself - or, for one that's only a box around other elements (nothing
  // to see of its own: no background, border or shadow, and no text of its
  // own), what's in it, each on its own, in the same way. Those parts then
  // fade out exactly where each was drawn, rather than together in a box
  // whose layout changes as what's in it leaves for elsewhere (a close-up's
  // title going back to its tile, say), or as it's carried along.
  // What's in it that's still in the tree isn't leaving at all.
  visibleParts(element, drawnAt, current) {
    if (element.nodeType !== 1 || element.hasAttribute(this.constructor.islandAttribute) || !isBareBox(element)) return [element];
    const parts = [];
    for (const child of element.childNodes) {
      if (child.nodeType === 3 && child.textContent.trim() !== "") return [element];
      if (child.nodeType !== 1 || current.has(child)) continue;
      if (!drawnAt.has(child)) return [element];
      parts.push(child);
    }
    return parts.flatMap((part) => this.visibleParts(part, drawnAt, current));
  }

  // Put each part fading out (see visibleParts()) back where what it's
  // part of was among its siblings - so it's still drawn above and below
  // what it was drawn above and below - absolutely positioned, looking as
  // it did, and fade it out. Exactly where it was drawn is set once
  // everything else has started animating (see positionGhosts()). With
  // that place gone (or no longer in the container), it goes into the
  // container itself.
  removeAsGhosts(fading, drawnAt) {
    const u = this.unobservable;
    const ghosts = [];
    const root = u.node;
    for (const { element, place, look } of fading) {
      const rect = drawnAt.get(element);
      if (!rect) continue;
      // Not lifted any more - nor anything in it: the style it's saved with
      // is its own, and comes back if it does.
      for (const lifted of [...u.lifted.keys()]) {
        if (lifted === element || element.contains(lifted)) this.unlift(lifted);
      }
      // Islands - the leaving element itself, or ones inside it - fade out
      // showing what they showed, as copies: their components take their
      // own nodes out when they're retracted (and may yet put them back).
      const islandAttribute = this.constructor.islandAttribute;
      const islands = element.nodeType === 1 && element.hasAttribute(islandAttribute) ? [element] : [];
      islands.push(...element.querySelectorAll("[" + islandAttribute + "]"));
      const copies = [];
      for (const island of islands) {
        const shown = u.islandContents ? u.islandContents.get(island) : null;
        if (island.childNodes.length === 0) {
          if (shown) for (const node of shown) copies.push(island.appendChild(node.cloneNode(true)));
        } else {
          for (const node of [...island.childNodes]) {
            const copy = node.cloneNode(true);
            island.replaceChild(copy, node);
            copies.push(copy);
          }
        }
      }
      const savedStyle = element.getAttribute("style");
      element.querySelectorAll("*").forEach((each) => { each.style.transform = ""; });
      Object.assign(element.style, {
        position: "absolute",
        left: "0px",
        top: "0px",
        width: rect.width + "px",
        height: rect.height + "px",
        margin: "0",
        boxSizing: "border-box",
        transform: "",
        pointerEvents: "none",
        ...look,
      });
      const { parent, next } = place;
      if (parent && parent.isConnected && (parent === root || root.contains(parent))) {
        // Positioned by what it's in - so it goes along with that, exactly.
        if (parent !== root && !u.positioning.has(parent) && root.ownerDocument.defaultView.getComputedStyle(parent).position === "static") {
          u.positioning.set(parent, parent.style.position);
          parent.style.position = "relative";
        }
        parent.insertBefore(element, next && next.parentNode === parent ? next : null);
      } else {
        if (root.ownerDocument.defaultView.getComputedStyle(root).position === "static") root.style.position = "relative";
        root.appendChild(element);
      }
      u.springs.delete(element);
      u.ghosts.set(element, { savedStyle, copies, opacity: 1, velocity: 0 });
      GHOSTS.add(element);
      ghosts.push(element);
    }
    return ghosts;
  }

  // Each new ghost exactly where, and as large as, it was drawn: measured
  // where it now is (at 0, 0 in what it's in), and moved by the
  // difference. Done once the animations have started, because what it's
  // in may be moving or scaled itself, and is now drawn as it will be in
  // the first frame. From then on, it goes along with that (its carrier) -
  // its place in there growing and shrinking with it, as everything else
  // in there does - but at its own size (see follow()), the way something
  // appearing in it isn't scaled along either.
  positionGhosts(ghosts, drawnAt) {
    const u = this.unobservable;
    for (const element of ghosts) {
      const rect = drawnAt.get(element);
      const at = rectOf(element);
      const width = parseFloat(element.style.width) || 0;
      const height = parseFloat(element.style.height) || 0;
      const sx = width > 0 && at.width > 0 ? at.width / width : 1;
      const sy = height > 0 && at.height > 0 ? at.height / height : 1;
      const left = (rect.x - at.x) / sx;
      const top = (rect.y - at.y) / sy;
      element.style.left = left + "px";
      element.style.top = top + "px";
      const carrier = element.parentNode;
      if (!u.layout.has(carrier)) continue;
      // Where it is in its carrier as that's drawn now - and where the
      // carrier's own coordinates start, for placing it there.
      const drawn = rectOf(carrier);
      Object.assign(u.ghosts.get(element), {
        carrier, left, top,
        originX: (at.x - drawn.x) / sx, originY: (at.y - drawn.y) / sy,
        offsetX: rect.x - drawn.x, offsetY: rect.y - drawn.y,
        carrierWidth: drawn.width, carrierHeight: drawn.height,
      });
      element.style.transform = sx === 1 && sy === 1 ? "" : "scale(" + 1 / sx + ", " + 1 / sy + ")";
      element.style.transformOrigin = sx === 1 && sy === 1 ? "" : "0 0";
    }
  }

  // A ghost where it belongs in its carrier as that's drawn now (at
  // `carrier`: its drawn corner and scale): as far into it, in proportion
  // to how large it's drawn, as when the ghost was placed - at its own size.
  // With `zoom`, at its own size times as much as its carrier has grown or
  // shrunk since (see zoomAlong in setProperties()).
  follow(element, ghost, carrier, zoom) {
    const layout = this.unobservable.layout.get(ghost.carrier);
    if (!layout || !(carrier.sx > 0) || !(carrier.sy > 0)) return;
    const intoX = ghost.carrierWidth > 0 ? ghost.offsetX * layout.width / ghost.carrierWidth : ghost.offsetX / carrier.sx;
    const intoY = ghost.carrierHeight > 0 ? ghost.offsetY * layout.height / ghost.carrierHeight : ghost.offsetY / carrier.sy;
    const tx = intoX - ghost.originX - ghost.left;
    const ty = intoY - ghost.originY - ghost.top;
    const grown = zoom && ghost.carrierWidth > 0 && ghost.carrierHeight > 0
      ? Math.sqrt((layout.width * carrier.sx / ghost.carrierWidth) * (layout.height * carrier.sy / ghost.carrierHeight))
      : 1;
    const kx = grown / carrier.sx;
    const ky = grown / carrier.sy;
    const none = Math.abs(tx) < 0.01 && Math.abs(ty) < 0.01 && Math.abs(kx - 1) < 0.0001 && Math.abs(ky - 1) < 0.0001;
    element.style.transform = none ? "" : "translate(" + tx + "px, " + ty + "px) scale(" + kx + ", " + ky + ")";
    element.style.transformOrigin = none ? "" : "0 0";
  }

  // What's in a parent only to position its ghosts goes back to how it
  // was once none are left in it.
  releasePositioning() {
    const u = this.unobservable;
    for (const [parent, position] of [...u.positioning]) {
      if ([...u.ghosts.keys()].some((ghost) => ghost.parentNode === parent)) continue;
      parent.style.position = position;
      u.positioning.delete(parent);
    }
  }

  restoreGhost(element) {
    const u = this.unobservable;
    const { savedStyle, copies } = u.ghosts.get(element);
    // Back in the tree: its islands' components put their own nodes back.
    for (const copy of copies) copy.remove();
    if (savedStyle === null) element.removeAttribute("style"); else element.setAttribute("style", savedStyle);
    u.ghosts.delete(element);
    GHOSTS.delete(element);
  }

  // Given where and how large each element was drawn before this render,
  // read where each one lies now, and start (or redirect) the springs that
  // close the gap.
  startAnimations(drawnAt) {
    const u = this.unobservable;
    const tracked = new Set(u.tracked.map(({ element }) => element));
    for (const element of u.springs.keys()) {
      if (!tracked.has(element)) u.springs.delete(element);
    }

    // All writes (clearing this container's own transforms), then all reads
    // (the new layout) - one layout pass, not one per element.
    for (const { element } of u.tracked) {
      element.style.transform = "";
      element.style.transformOrigin = "";
    }
    u.layout = new Map(u.tracked.map(({ element }) => [element, rectOf(element)]));
    const fonts = new Map();
    for (const { element } of u.tracked) {
      const font = textFontSize(element);
      if (font) fonts.set(element, font);
    }
    const ancestorOf = new Map(u.tracked.map(({ element, ancestor }) => [element, ancestor]));
    u.following = new Map();

    for (const { element, ancestor } of u.tracked) {
      const before = drawnAt.get(element);
      const now = u.layout.get(element);
      const spring = u.springs.get(element) || newSpring();
      if (before) {
        spring.x = before.x - now.x;
        spring.y = before.y - now.y;
        // Moved to another parent: on its way somewhere - lifted, until it
        // has arrived (see lift()).
        if (before.parent && before.parent !== element.parentNode) spring.travelling = true;
        if (fonts.has(element)) {
          // An element with text of its own can't have its box scaled: its
          // text nodes can't be counter-scaled, so the text would be
          // squashed along - and its box often changes size for reasons
          // that have nothing to do with it (a stretching flex parent whose
          // widest item left, say). So it's scaled uniformly, by how large
          // its text is drawn, and only when that changes (moving to a
          // parent with another font size); its box takes its new size at
          // once.
          const ratio = before.font ? before.font / fonts.get(element) - 1 : 0;
          spring.sx = ratio;
          spring.sy = ratio;
        } else {
          spring.sx = now.width > 0 ? before.width / now.width - 1 : 0;
          spring.sy = now.height > 0 ? before.height / now.height - 1 : 0;
        }
      } else if (!ancestor || drawnAt.has(ancestor)) {
        // Appearing (the outermost new element): fades in where it lies.
        spring.o = -1;
      }
      // New, in something that was there and is on its way (its carrier):
      // it comes along - see applyAnimation().
      if (!before && ancestor) {
        let carrier = ancestor;
        while (carrier && !drawnAt.has(carrier)) carrier = ancestorOf.get(carrier);
        if (carrier && u.springs.has(carrier)) u.following.set(element, carrier);
      }
      if (isSettled(spring)) {
        u.springs.delete(element);
        element.style.opacity = "";
      } else {
        u.springs.set(element, spring);
      }
    }

    this.applyAnimation();
    if (u.springs.size > 0 || u.ghosts.size > 0) this.requestFrame();
  }

  // Draw every tracked element where its spring says - relative to its
  // nearest tracked ancestor, which moves and scales it already.
  applyAnimation() {
    const u = this.unobservable;
    const zoomAlong = withoutRecording(() => this.zoomAlong);
    const drawn = new Map(); // element -> { x, y, sx, sy }: its drawn top-left and total scale, in page terms
    for (const { element, ancestor } of u.tracked) {
      const layout = u.layout.get(element);
      if (!layout) continue;
      const spring = u.springs.get(element) || RESTING;
      let here = { x: layout.x + spring.x, y: layout.y + spring.y, sx: 1 + spring.sx, sy: 1 + spring.sy };
      // New in something on its way (see startAnimations()): as far into
      // it, for how large it's drawn, as it will be at rest - on its own
      // path there, each new element, at its own size. Until that has
      // arrived: then this is just where it lies.
      const carrier = u.following && u.following.get(element);
      if (carrier) {
        const at = drawn.get(carrier);
        const carrierLayout = u.layout.get(carrier);
        // Zooming along: at the carrier's own scale - which it reaches 1
        // at, at rest - uniformly.
        const zoom = at && zoomAlong ? Math.sqrt(at.sx * at.sy) : 1;
        if (at && carrierLayout) here = { x: at.x + (layout.x - carrierLayout.x) * at.sx, y: at.y + (layout.y - carrierLayout.y) * at.sy, sx: zoom, sy: zoom };
        if (!u.springs.has(carrier)) u.following.delete(element);
      }
      drawn.set(element, here);
      let tx = spring.x;
      let ty = spring.y;
      let sx = here.sx;
      let sy = here.sy;
      const above = ancestor && drawn.get(ancestor);
      if (above) {
        const ancestorLayout = u.layout.get(ancestor);
        tx = (here.x - above.x) / above.sx - (layout.x - ancestorLayout.x);
        ty = (here.y - above.y) / above.sy - (layout.y - ancestorLayout.y);
        sx = here.sx / above.sx;
        sy = here.sy / above.sy;
      }
      const moved = Math.abs(tx) > 0.01 || Math.abs(ty) > 0.01 || Math.abs(sx - 1) > 0.0001 || Math.abs(sy - 1) > 0.0001;
      element.style.transform = moved ? "translate(" + tx + "px, " + ty + "px) scale(" + sx + ", " + sy + ")" : "";
      element.style.transformOrigin = moved ? "0 0" : "";
      element.style.opacity = spring.o < -0.001 ? String(Math.max(0, 1 + spring.o)) : "";
    }
    for (const [element, ghost] of u.ghosts) {
      element.style.opacity = String(Math.max(0, Math.min(1, ghost.opacity)));
      // Along with its carrier, at its own size - see positionGhosts().
      const carrier = ghost.carrier && drawn.get(ghost.carrier);
      if (carrier) this.follow(element, ghost, carrier, zoomAlong);
    }
    this.lift();
  }

  // Lift every appearing element, and every animated element it's inside,
  // above its siblings - so what moves around it never covers it (see the
  // class doc). The whole chain, since an animated element is a stacking
  // context of its own: lifted inside it alone, the newcomer would still be
  // covered by whatever comes after it. A z-index needs a position that
  // isn't static; one that is becomes relative meanwhile.
  //
  // And none of them clips: one drawn smaller than it now is, on its way
  // to its new size, would cut off what's already drawn where it will be -
  // at rest, it fits. Only what clips, though (`overflow: hidden` or
  // `clip`): what scrolls (`auto`, `scroll`) keeps scrolling.
  //
  // Put back as it was as soon as nothing in it is appearing any more - or
  // right away, if the container confines what appears.
  //
  // Travelling elements are lifted too: one on its way to another parent
  // (not just carried along by what it's in, nor making room among its
  // siblings) is drawn above what it passes over, and what it lands among
  // - a ghost fading out over its destination included. Only the element
  // itself (what it's in stays as it is), and it isn't unclipped: what it
  // shows is its own business.
  //
  // A travelling element with a z-index of its own keeps it: it's already
  // where it wants to be.
  lift() {
    const u = this.unobservable;
    const lifting = new Map(); // element -> whether it's unclipped too
    let ancestorOf = null;
    const ancestors = () => ancestorOf || (ancestorOf = new Map(u.tracked.map(({ element, ancestor }) => [element, ancestor])));
    const confine = withoutRecording(() => this.confine);
    for (const [element, spring] of confine ? [] : u.springs) {
      if (!(spring.o < -0.001)) continue;
      for (let each = element; each && !lifting.get(each); each = ancestors().get(each)) lifting.set(each, true);
    }
    for (const [element, spring] of u.springs) {
      if (!spring.travelling || lifting.has(element) || (Math.abs(spring.x) < 1 && Math.abs(spring.y) < 1)) continue;
      const carrier = u.springs.get(ancestors().get(element));
      if (carrier && Math.abs(carrier.x - spring.x) < 1 && Math.abs(carrier.y - spring.y) < 1) continue;
      lifting.set(element, false);
    }
    for (const element of [...u.lifted.keys()]) {
      if (!lifting.has(element)) this.unlift(element);
    }
    for (const [element, unclip] of lifting) {
      const saved = u.lifted.get(element);
      if (saved && (saved.unclipped || !unclip)) continue;
      const style = element.ownerDocument.defaultView.getComputedStyle(element);
      if (!saved) {
        u.lifted.set(element, { zIndex: element.style.zIndex, position: element.style.position, overflow: element.style.overflow, unclipped: false });
        if (!style.position || style.position === "static") element.style.position = "relative";
        if (unclip || !style.zIndex || style.zIndex === "auto") element.style.zIndex = "1";
      }
      if (unclip) {
        const clips = (value) => value === "hidden" || value === "clip";
        if (clips(style.overflowX) || clips(style.overflowY) || clips(style.overflow)) element.style.overflow = "visible";
        u.lifted.get(element).unclipped = true;
      }
    }
  }

  unlift(element) {
    const u = this.unobservable;
    const saved = u.lifted.get(element);
    if (!saved) return;
    element.style.zIndex = saved.zIndex;
    element.style.position = saved.position;
    element.style.overflow = saved.overflow;
    u.lifted.delete(element);
  }

  requestFrame() {
    const u = this.unobservable;
    if (u.framePending) return;
    u.framePending = true;
    u.lastFrameTime = FlipAnimationContainer.clock.now();
    FlipAnimationContainer.clock.requestFrame(() => this.frame());
  }

  frame() {
    const u = this.unobservable;
    u.framePending = false;
    // Switched off meanwhile: everything is where it belongs, at once.
    if (!FlipAnimationContainer.enabled) {
      this.stopAll();
      return;
    }
    if (u.springs.size === 0 && u.ghosts.size === 0) return;
    const now = FlipAnimationContainer.clock.now();
    // Capped, so a frame after the tab was in the background doesn't fling
    // everything past its target; scaled by its speed.
    const speed = withoutRecording(() => this.speed);
    let remaining = Math.min((now - u.lastFrameTime) / 1000, 0.05) * (speed !== null && typeof(speed) === "number" ? speed : FlipAnimationContainer.speed);
    while (remaining > 0) {
      const step = Math.min(remaining, SPRING_STEP);
      for (const spring of u.springs.values()) advanceSpring(spring, step);
      for (const ghost of u.ghosts.values()) {
        const a = -STIFFNESS * ghost.opacity - DAMPING * ghost.velocity;
        ghost.velocity += a * step;
        ghost.opacity += ghost.velocity * step;
      }
      remaining -= step;
    }
    for (const [element, spring] of u.springs) {
      if (isSettled(spring)) u.springs.delete(element);
    }
    this.applyAnimation();
    for (const [element, ghost] of [...u.ghosts]) {
      if (ghost.opacity < 0.02) this.removeGhost(element);
    }
    if (u.springs.size > 0 || u.ghosts.size > 0) this.requestFrame();
  }

  stopAll() {
    const u = this.unobservable;
    u.springs.clear();
    if (u.following) u.following.clear();
    for (const element of [...u.lifted.keys()]) this.unlift(element);
    for (const { element } of u.tracked) {
      element.style.transform = "";
      element.style.transformOrigin = "";
      element.style.opacity = "";
    }
    for (const element of [...u.ghosts.keys()]) this.removeGhost(element);
  }

  // A ghost done fading: gone from the page - with its own style back, as
  // it was before it became a ghost, since the same element may well come
  // back later (a product put into a hidden cart, shown when the cart is).
  removeGhost(element) {
    this.restoreGhost(element);
    element.remove();
    this.releasePositioning();
  }
}

// When animation frames happen, and what time it is - replaceable (tests
// drive frames by hand).
FlipAnimationContainer.clock = {
  now: () => performance.now(),
  requestFrame: (callback) => requestAnimationFrame(callback),
};

// How fast animations run, unless a container says otherwise (its `speed`):
// a factor - 1, the default, is the springs' natural pace, 0.5 half that.
// An app sets it once for all its containers (the Cascade demo has a
// slider for it).
FlipAnimationContainer.speed = 1;

// Whether containers animate at all: false, and they only place - what's
// on its way when it's switched off is where it belongs by the next frame.
// For a user who'd rather have no motion (prefers-reduced-motion, say).
// Read as frames are drawn and changes are placed, like `speed`.
FlipAnimationContainer.enabled = true;

// Its islands' holders are marked as its own.
FlipAnimationContainer.islandAttribute = "data-flip-island";

// A spring per element, pulling each deviation - position (x, y, pixels),
// size (sx, sy, ratio - 1), opacity (o, 0 is fully visible) - to zero.
// Firm enough to arrive in well under a second at full speed, damped just
// enough not to overshoot.
const STIFFNESS = 170;
const DAMPING = 26;
const SPRING_STEP = 1 / 240;
const FIELDS = ["x", "y", "sx", "sy", "o"];
const RESTING = { x: 0, y: 0, sx: 0, sy: 0, o: 0 };

function newSpring() {
  return { x: 0, y: 0, sx: 0, sy: 0, o: 0, vx: 0, vy: 0, vsx: 0, vsy: 0, vo: 0 };
}

function advanceSpring(spring, seconds) {
  for (const field of FIELDS) {
    const velocity = "v" + field;
    spring[velocity] += (-STIFFNESS * spring[field] - DAMPING * spring[velocity]) * seconds;
    spring[field] += spring[velocity] * seconds;
  }
}

function isSettled(spring) {
  return Math.abs(spring.x) < 0.5 && Math.abs(spring.y) < 0.5 && Math.abs(spring.vx) < 5 && Math.abs(spring.vy) < 5
    && Math.abs(spring.sx) < 0.002 && Math.abs(spring.sy) < 0.002 && Math.abs(spring.vsx) < 0.02 && Math.abs(spring.vsy) < 0.02
    && Math.abs(spring.o) < 0.01 && Math.abs(spring.vo) < 0.05;
}

// Whether an element's box has nothing to see of its own - no background,
// border, shadow or outline: only what's in it shows.
function isBareBox(element) {
  const style = element.ownerDocument.defaultView.getComputedStyle(element);
  const clear = (color) => !color || color === "transparent" || /^rgba\(.*,\s*0\)$/.test(color);
  const none = (value) => !value || value === "none";
  const thin = (width) => !(parseFloat(width) > 0);
  return clear(style.backgroundColor) && none(style.backgroundImage) && none(style.boxShadow)
    && thin(style.borderTopWidth) && thin(style.borderRightWidth) && thin(style.borderBottomWidth) && thin(style.borderLeftWidth)
    && (none(style.outlineStyle) || thin(style.outlineWidth));
}

function rectOf(element) {
  const rect = element.getBoundingClientRect();
  return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
}

// The font size of an element's own text - undefined if it has no text of
// its own (only elements, or whitespace), or no known font size.
function textFontSize(element) {
  let hasText = false;
  for (const node of element.childNodes) {
    if (node.nodeType === 3 && node.textContent.trim() !== "") { hasText = true; break; }
  }
  if (!hasText) return undefined;
  const size = parseFloat(element.ownerDocument.defaultView.getComputedStyle(element).fontSize);
  return size > 0 ? size : undefined;
}

// What a leaving element loses by leaving its place: whatever it inherited
// from its surroundings that makes it look like itself.
function computedLooks(element) {
  const style = element.ownerDocument.defaultView.getComputedStyle(element);
  return {
    fontFamily: style.fontFamily, fontSize: style.fontSize, fontWeight: style.fontWeight, fontStyle: style.fontStyle,
    lineHeight: style.lineHeight, color: style.color, textAlign: style.textAlign,
  };
}

// Every leaving element currently shown as a ghost (see removeAsGhosts()),
// whichever container it belongs to - so placement leaves them alone.
const GHOSTS = new WeakSet();

registerDOMComponent("flipAnimationContainer", FlipAnimationContainer);

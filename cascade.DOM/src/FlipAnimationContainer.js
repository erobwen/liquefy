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
 * wrappers needed. So does the container's own box, and with it what's
 * around the container (see startSizing()). A nested element is drawn relative to its nearest
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
 *    what's around them moves. As a ghost goes (see Leaving, below): one
 *    with something to see of its own comes along whole, what's in it with
 *    it; one that's only a box around others, as what's in it, each part
 *    on its own.
 *  - Travelling: an element on its way to another parent (not just
 *    carried along by what it's in, nor making room among its siblings)
 *    is drawn above everything in the container - what it passes over, and
 *    what it lands among - until it has arrived (see Stacking, below). It
 *    looks as it will where it lands - its color, background, shadow, how
 *    bold its text is, whatever it gets from there - gradually, on its way
 *    (see changeLooks()). One with text and a visible box of its own grows
 *    or shrinks to its new size, its text laid out anew rather than
 *    squashed (see raise()).
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
 * Stacking. At rest, what's drawn above what is the app's business alone:
 * its DOM order and the z-indexes it gives - the container adds nothing.
 * An overlay meant to cover everything but one element says so with a
 * z-index of its own; it doesn't rely on what happens to come after it.
 * Only while something animates does the container draw it otherwise:
 *  - A travelling element is raised: taken out of its parent, into a layer
 *    of the container's own above everything else in it, drawn exactly
 *    where it would be - an invisible placeholder keeping its spot in the
 *    layout meanwhile. A z-index of its own couldn't do that: it only
 *    counts among what its parents are stacked with, and where it goes
 *    may well be under an overlay. Arrived, it's lowered back into its
 *    place, and stacks there as the app says again (see raise()).
 *  - An appearing element is lifted above its siblings while it fades in
 *    (see lift()).
 *  - A ghost stays where it was among its siblings, with its own z-index.
 *
 * Islands - components that can only be rendered, and what `isUnit` says
 * to place as one piece (see DOMPlacingContainer) - are animated as one
 * element, in the box the container gives them.
 */
export class FlipAnimationContainer extends DOMPlacingContainer {
  // `enabled`: whether it animates at all (default true). Switched off,
  // it only places - and what's on its way is where it belongs at once. An
  // app can just as well build a plain element in its place (keyed
  // differently, its children keyed to come along): this is for keeping
  // the container.
  //
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
  //
  // `keepCorners`: rounded corners keep their roundness while what they're
  // on is scaled on its way - rather than squashed and stretched along with
  // it - going gradually from how round they were drawn to how round they
  // are at rest (see drawCorners()). On by default. It repaints what's
  // scaled every frame, where a transform alone wouldn't: off, nothing but
  // transforms and opacity change while things move.
  setProperties({ enabled, speed, confine, zoomAlong, keepCorners, ...rest }) {
    super.setProperties(rest);
    this.enabled = enabled !== false;
    this.speed = typeof(speed) === "number" ? speed : null;
    this.confine = !!confine;
    this.zoomAlong = !!zoomAlong;
    this.keepCorners = keepCorners !== false;
  }

  initialUnobservables() {
    const result = super.initialUnobservables();
    // Per animating element - see startAnimations().
    result.springs = new Map();
    // Elements lifted above their siblings while something in them appears,
    // with the inline z-index and position they had - see lift().
    result.lifted = new Map();
    // Travelling elements raised into the layer above everything, with the
    // placeholder keeping their spot and the inline style they had - see
    // raise().
    result.raised = new Map();
    result.layer = null;
    // Changes of look under way - a paused animation each, from how an
    // element looked to how it looks now - see changeLooks().
    result.looks = new Map();
    // Where each tracked element lies in the current layout.
    result.layout = new Map();
    // Leaving elements, fading out - see removeAsGhosts() - and the
    // elements positioned to hold them, with the position they had.
    result.ghosts = new Map();
    result.positioning = new Map();
    // Rounded corners kept round while what they're on is scaled, with the
    // inline border radius each had - see drawCorners().
    result.corners = new Map();
    // Where (and how large) each tracked element was last drawn - see
    // applyAnimation().
    result.drawn = new Map();
    // The container's own box, growing or shrinking to its new size - see
    // startSizing().
    result.sizing = null;
    result.framePending = false;
    result.hasRendered = false;
    return result;
  }

  render(target, context) {
    const u = this.unobservable;
    // How large its own box is drawn right now - on its way to another size
    // included.
    const sizedAt = u.node && u.node.isConnected ? { width: u.node.offsetWidth, height: u.node.offsetHeight } : null;
    super.render(target, context);

    // Only meaningful while the container is in the page: hidden, nothing
    // has a position - it just places, and whatever was animating stops.
    // Nor while it's switched off (`enabled`): then it places, and that's
    // that.
    const animate = u.node.isConnected && u.hasRendered && this.enabled;

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
        // A raised one is where its placeholder is.
        const raised = u.raised.get(element);
        rect.parent = raised ? raised.placeholder.parentNode : element.parentNode;
        // And how it looks - as drawn, a change of look under way included.
        if (element.nodeType === 1) rect.looks = looksOf(element);
        // How round its corners are drawn - and where its own texts are.
        if (element.nodeType === 1) rect.corners = cornersOf(element, u.drawn.get(element));
        if (element.nodeType === 1) rect.texts = textsOf(element);
        drawnAt.set(element, rect);
      }
      for (const element of u.ghosts.keys()) drawnAt.set(element, rectOf(element));
    }
    // Changes of look under way are done with: the new looks are read
    // as the app has them, and each change goes on from where it's drawn.
    const changingLooks = this.endLooks();
    // Corners too: as the app has them, before it updates them. And its own
    // box, as the app has it, to be placed anew.
    this.endCorners();
    this.endSizing();
    // Everything raised back in its place, before anything is placed - and
    // raised again once the new layout is known, if still on its way.
    this.lowerAll();

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
      this.startAnimations(drawnAt, changingLooks, sizedAt);
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
    if (!this.isMereBox(element)) return [element];
    const parts = [];
    for (const child of element.childNodes) {
      if (child.nodeType !== 1 || current.has(child)) continue;
      if (!drawnAt.has(child)) return [element];
      parts.push(child);
    }
    return parts.flatMap((part) => this.visibleParts(part, drawnAt, current));
  }

  // Whether an element is only a box around others: nothing to see of its
  // own (see isBareBox()), no text of its own, and not an island. What's in
  // one leaves - and appears - each on its own (see visibleParts() and
  // startAnimations()); anything else does so whole.
  isMereBox(element) {
    return element.nodeType === 1 && !element.hasAttribute(this.constructor.islandAttribute) && isBareBox(element) && !hasOwnText(element);
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
      this.setPosition(parent, position);
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
  // close the gap. And its own box, from the size it was drawn at
  // (`sizedAt`), to its size now.
  startAnimations(drawnAt, changingLooks, sizedAt) {
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
    const sizedNow = { width: u.node.offsetWidth, height: u.node.offsetHeight };
    const fonts = new Map();
    for (const { element } of u.tracked) {
      const font = textFontSize(element);
      if (font) fonts.set(element, font);
    }
    const keepCorners = withoutRecording(() => this.keepCorners);
    const ancestorOf = new Map(u.tracked.map(({ element, ancestor }) => [element, ancestor]));
    u.following = new Map();
    u.carried = new Set();
    // Where each element, and each element's own texts, were drawn - for
    // what's in one raised to be sized (see applyAnimation() and raise()).
    u.from = new Map();
    u.relaid = new Set();

    for (const { element, ancestor } of u.tracked) {
      const before = drawnAt.get(element);
      const now = u.layout.get(element);
      const spring = u.springs.get(element) || newSpring();
      if (before) {
        u.from.set(element, before);
        spring.x = before.x - now.x;
        spring.y = before.y - now.y;
        // Moved to another parent: on its way somewhere - raised, until it
        // has arrived (see raise()).
        const moved = before.parent && before.parent !== element.parentNode;
        if (moved) spring.travelling = true;
        // What it gets from where it lands - its color, say - it takes on
        // along the way (see changeLooks()); as does one already doing so.
        if (before.looks && (moved || changingLooks.has(element))) this.changeLooks(element, before.looks, spring);
        if (fonts.has(element)) {
          // An element with text of its own can't have its box scaled: its
          // text nodes can't be counter-scaled, so the text would be
          // squashed along - and its box often changes size for reasons
          // that have nothing to do with it (a stretching flex parent whose
          // widest item left, say). So it's scaled uniformly, by how large
          // its text is drawn, and only when that changes (moving to a
          // parent with another font size). Its box takes its new size at
          // once - unless it's raised: then it's sized, from the size it's
          // drawn at, rather than scaled (w and h - see applyAnimation()).
          const ratio = before.font ? before.font / fonts.get(element) - 1 : 0;
          spring.sx = ratio;
          spring.sy = ratio;
          spring.w = now.width > 0 ? before.width / (now.width * (1 + ratio)) - 1 : 0;
          spring.h = now.height > 0 ? before.height / (now.height * (1 + ratio)) - 1 : 0;
        } else {
          spring.sx = now.width > 0 ? before.width / now.width - 1 : 0;
          spring.sy = now.height > 0 ? before.height / now.height - 1 : 0;
          spring.w = 0;
          spring.h = 0;
        }
        if (keepCorners && before.corners) this.startCorners(element, before.corners, spring);
      } else if (!ancestor || drawnAt.has(ancestor)) {
        // Appearing (the outermost new element): fades in where it lies.
        spring.o = -1;
      }
      // New, in something that was there and is on its way (its carrier):
      // it comes along - see applyAnimation(). The way what leaves goes
      // (see visibleParts()): what's only a box around others comes along
      // as what's in it, each on its own path; what has something to see
      // of its own comes along whole, everything new in it with it.
      if (!before && ancestor) {
        if (u.carried.has(ancestor) || (u.following.has(ancestor) && !this.isMereBox(ancestor))) {
          u.carried.add(element);
        } else {
          let carrier = ancestor;
          while (carrier && !drawnAt.has(carrier)) carrier = ancestorOf.get(carrier);
          if (carrier && u.springs.has(carrier)) u.following.set(element, carrier);
        }
      }
      if (isSettled(spring)) {
        u.springs.delete(element);
        element.style.opacity = "";
      } else {
        u.springs.set(element, spring);
      }
    }
    if (sizedAt) this.startSizing(sizedAt, sizedNow);

    this.applyAnimation();
    if (this.isAnimating()) this.requestFrame();
  }

  isAnimating() {
    const u = this.unobservable;
    return u.springs.size > 0 || u.ghosts.size > 0 || !!u.sizing;
  }

  // The container's own box, too, grows or shrinks to its new size - from
  // the size it was drawn at (`from`), by a spring of its own - rather than
  // taking it at once: what's around it then makes room for what's in it,
  // or closes up after it, as gradually as what's in it moves. A ghost
  // doesn't hold the space it leaves, and a newcomer needs the space it
  // will take: with the last of what's in it leaving, or the first coming,
  // the container would otherwise snap shut, or open. Its width and height
  // are set meanwhile - only the ones that change, and only while they do
  // (see drawSize()) - which places what's around it anew every frame.
  startSizing(from, to) {
    const u = this.unobservable;
    const dx = from.width - to.width;
    const dy = from.height - to.height;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    const spring = newSpring();
    spring.x = dx;
    spring.y = dy;
    // Going on from where the last one was, at its pace.
    const previous = u.sizing && u.sizing.spring;
    if (previous) {
      spring.vx = previous.vx;
      spring.vy = previous.vy;
    }
    const style = u.node.style;
    const saved = { boxSizing: style.boxSizing };
    if (Math.abs(dx) >= 1) saved.width = style.width;
    if (Math.abs(dy) >= 1) saved.height = style.height;
    u.sizing = { spring, to, saved, written: {} };
  }

  drawSize() {
    const u = this.unobservable;
    const { spring, to, saved, written } = u.sizing;
    written.boxSizing = "border-box";
    if ("width" in saved) written.width = round(Math.max(0, to.width + spring.x)) + "px";
    if ("height" in saved) written.height = round(Math.max(0, to.height + spring.y)) + "px";
    Object.assign(u.node.style, written);
  }

  // Its own box as the app has it again - what the app has given it
  // meanwhile (its style updated) kept.
  endSizing() {
    const u = this.unobservable;
    if (!u.sizing) return;
    const style = u.node.style;
    const { saved, written } = u.sizing;
    for (const key of Object.keys(written)) {
      if (style[key] === written[key]) style[key] = saved[key];
    }
    u.sizing = null;
  }

  // Rounded corners on something on its way, kept round: drawn as round as
  // they were (`from`, in page terms - see cornersOf()) at first, then
  // gradually as round as they are at rest - at the pace of its spring's k,
  // as a change of look is - however it's scaled on the way (see
  // drawCorners()). Corners given in percent are left alone: they're
  // relative to the box, and go along with it anyway.
  startCorners(element, from, spring) {
    const u = this.unobservable;
    const to = cornersOf(element);
    if (!to || !from) return;
    if (to.every(([x, y]) => x === 0 && y === 0) && from.every(([x, y]) => x === 0 && y === 0)) return;
    u.corners.set(element, { saved: element.style.borderRadius, from, to });
    if (to.some(([x, y], i) => Math.abs(x - from[i][0]) > 0.01 || Math.abs(y - from[i][1]) > 0.01)) {
      spring.k = 1;
      spring.vk = 0;
    }
  }

  // Its corners as round as they're drawn at this point on its way (see
  // startCorners()), at `here` - its drawn scale: each radius divided by
  // that, so it isn't scaled along.
  drawCorners(element, corners, spring, here) {
    if (!(here.sx > 0) || !(here.sy > 0)) return;
    const k = Math.max(0, Math.min(1, spring.k));
    const horizontal = [];
    const vertical = [];
    corners.to.forEach(([x, y], i) => {
      const [fromX, fromY] = corners.from[i];
      horizontal.push(round((x + (fromX - x) * k) / here.sx) + "px");
      vertical.push(round((y + (fromY - y) * k) / here.sy) + "px");
    });
    element.style.borderRadius = horizontal.join(" ") + " / " + vertical.join(" ");
  }

  endCorners(element) {
    const u = this.unobservable;
    for (const each of element ? [element] : [...u.corners.keys()]) {
      each.style.borderRadius = u.corners.get(each).saved;
      u.corners.delete(each);
    }
  }

  // Draw every tracked element where its spring says - relative to its
  // nearest tracked ancestor, which moves and scales it already. Unless
  // it's raised: then it's in the layer, out of its ancestors' reach, and
  // drawn in page terms.
  applyAnimation() {
    const u = this.unobservable;
    this.raiseTravellers();
    const zoomAlong = withoutRecording(() => this.zoomAlong);
    const drawn = new Map(); // element -> { x, y, sx, sy }: its drawn top-left and total scale, in page terms
    const inSized = new Set(); // what's in a raised element being sized
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
      // New in a newcomer that comes along whole: drawn as part of it.
      const whole = u.carried && u.carried.has(element) && drawn.get(ancestor);
      if (whole) {
        const ancestorLayout = u.layout.get(ancestor);
        here = { x: whole.x + (layout.x - ancestorLayout.x) * whole.sx, y: whole.y + (layout.y - ancestorLayout.y) * whole.sy, sx: whole.sx, sy: whole.sy };
      }
      drawn.set(element, here);
      let tx = spring.x;
      let ty = spring.y;
      let sx = here.sx;
      let sy = here.sy;
      const above = ancestor && !u.raised.has(element) && drawn.get(ancestor);
      if (above) {
        const ancestorLayout = u.layout.get(ancestor);
        tx = (here.x - above.x) / above.sx - (layout.x - ancestorLayout.x);
        ty = (here.y - above.y) / above.sy - (layout.y - ancestorLayout.y);
        sx = here.sx / above.sx;
        sy = here.sy / above.sy;
      }
      // In a raised element being sized (see raise()), laid out anew as it
      // grows or shrinks: where that puts it, at its own scale - around its
      // middle - rather than where it will be once that has its new size.
      // And at first where it was drawn, gliding from there to where the
      // layout puts it (see relay()): laid out otherwise there - a column
      // turned into a row - it doesn't jump to its new place in it.
      const raisedAncestor = ancestor && u.raised.get(ancestor);
      if (ancestor && (inSized.has(ancestor) || (raisedAncestor && raisedAncestor.sized))) {
        inSized.add(element);
        const scale = above || { sx: 1, sy: 1 };
        const middleX = (1 - sx) * layout.width / 2;
        const middleY = (1 - sy) * layout.height / 2;
        // Measured as drawn around its middle.
        const measure = () => {
          const at = rectOf(element);
          return { x: at.x + middleX * scale.sx, y: at.y + middleY * scale.sy };
        };
        const offset = this.relay(element, u.from.get(element), measure) || RESTING;
        tx = middleX + offset.x / scale.sx;
        ty = middleY + offset.y / scale.sy;
      }
      const moved = Math.abs(tx) > 0.01 || Math.abs(ty) > 0.01 || Math.abs(sx - 1) > 0.0001 || Math.abs(sy - 1) > 0.0001;
      element.style.transform = moved ? "translate(" + tx + "px, " + ty + "px) scale(" + sx + ", " + sy + ")" : "";
      element.style.transformOrigin = moved ? "0 0" : "";
      element.style.opacity = spring.o < -0.001 ? String(Math.max(0, 1 + spring.o)) : "";
      // Raised, with a box of its own to see and text in it: sized on its
      // way, rather than taking its new size at once (see raise()).
      const raised = u.raised.get(element);
      if (raised && raised.sized) {
        element.style.width = layout.width * (1 + spring.w) + "px";
        element.style.height = layout.height * (1 + spring.h) + "px";
      }
      // Rounded corners kept round on the way (see startCorners()) - as the
      // app has them again once it has arrived.
      const corners = u.corners.get(element);
      if (corners) {
        if (u.springs.has(element)) this.drawCorners(element, corners, spring, here);
        else this.endCorners(element);
      }
    }
    u.drawn = drawn;
    // The texts of each raised element being sized, as what's in it.
    for (const [element, { texts }] of u.raised) {
      const scale = drawn.get(element) || { sx: 1, sy: 1 };
      for (const text of texts) {
        const { node, span, from, appearing, leaving } = text;
        const spring = u.springs.get(span);
        if (leaving || appearing) {
          // Fading out until gone - or in, where it lies.
          if (leaving && !spring) span.remove();
          span.style.opacity = !spring ? "" : String(Math.max(0, Math.min(1, leaving ? spring.o : 1 + spring.o)));
          continue;
        }
        const offset = this.relay(span, from, () => textRectOf(node));
        span.style.transform = offset ? "translate(" + offset.x / scale.sx + "px, " + offset.y / scale.sy + "px)" : "";
      }
    }
    if (u.sizing) this.drawSize();
    // How far along each change of look is: as far as its spring.
    for (const [element, change] of u.looks) {
      const spring = u.springs.get(element);
      if (!spring) {
        change.cancel();
        u.looks.delete(element);
      } else {
        change.currentTime = Math.max(0, Math.min(1, 1 - spring.k)) * LOOK_DURATION;
      }
    }
    for (const [element, ghost] of u.ghosts) {
      element.style.opacity = String(Math.max(0, Math.min(1, ghost.opacity)));
      // Along with its carrier, at its own size - see positionGhosts().
      const carrier = ghost.carrier && drawn.get(ghost.carrier);
      if (carrier) this.follow(element, ghost, carrier, zoomAlong);
    }
    this.lift();
  }

  // The spring moving something in a raised element being sized (`key`:
  // an element in it, or a wrapped text of its own - see wrapTexts()) from
  // where it was drawn (`from`) to where the layout puts it. Started the
  // first time it's drawn there, measured (`measure`) where it's laid out
  // in it at the size it's drawn at then: from there on, the layout carries
  // it as the element grows or shrinks, and the spring only takes it the
  // rest of the way. Null for what has no spring: nothing to start from, or
  // arrived.
  relay(key, from, measure) {
    const u = this.unobservable;
    if (u.relaid.has(key)) return u.springs.get(key) || null;
    if (!from) return null;
    u.relaid.add(key);
    key.style.transform = "";
    const at = measure();
    const spring = u.springs.get(key) || newSpring();
    spring.x = from.x - at.x;
    spring.y = from.y - at.y;
    u.springs.set(key, spring);
    return spring;
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
  // `clip`): what scrolls (`auto`, `scroll`) keeps scrolling. Nor one with
  // rounded corners: clipping is what rounds what's in it (a card's header,
  // square at the top otherwise) - its corners are part of how it looks.
  // What appears in it is revealed within it as it grows, as if confined.
  //
  // Put back as it was as soon as nothing in it is appearing any more - or
  // right away, if the container confines what appears. Its overflow only
  // if it was changed - and all of it, the shorthand and both longhands:
  // the shorthand alone, written back empty, would clear an `overflowY`
  // given on its own, and an element scrolling one way would scroll no more.
  lift() {
    const u = this.unobservable;
    const lifting = new Set();
    const ancestorOf = new Map(u.tracked.map(({ element, ancestor }) => [element, ancestor]));
    const confine = withoutRecording(() => this.confine);
    for (const [element, spring] of confine ? [] : u.springs) {
      if (!(spring.o < -0.001)) continue;
      for (let each = element; each && !lifting.has(each); each = ancestorOf.get(each)) lifting.add(each);
    }
    for (const element of [...u.lifted.keys()]) {
      if (!lifting.has(element)) this.unlift(element);
    }
    for (const element of lifting) {
      if (u.lifted.has(element)) continue;
      const style = element.ownerDocument.defaultView.getComputedStyle(element);
      const clips = (value) => value === "hidden" || value === "clip";
      const clipped = (clips(style.overflowX) || clips(style.overflowY) || clips(style.overflow)) && !hasRoundedCorners(style);
      const { overflow, overflowX, overflowY } = element.style;
      u.lifted.set(element, { zIndex: element.style.zIndex, position: this.positionOf(element), overflow: clipped ? { overflow, overflowX, overflowY } : null });
      if (!style.position || style.position === "static") element.style.position = "relative";
      element.style.zIndex = "1";
      if (clipped) element.style.overflow = "visible";
    }
  }

  unlift(element) {
    const u = this.unobservable;
    const saved = u.lifted.get(element);
    if (!saved) return;
    element.style.zIndex = saved.zIndex;
    this.setPosition(element, saved.position);
    if (saved.overflow) {
      element.style.overflow = saved.overflow.overflow;
      element.style.overflowX = saved.overflow.overflowX;
      element.style.overflowY = saved.overflow.overflowY;
    }
    u.lifted.delete(element);
  }

  // Raise every element on its way to another parent - not just carried
  // along by what it's in, nor making room among its siblings - and lower
  // every raised one that has arrived (see Stacking in the class doc). A
  // ghost fading out over its destination is beneath it, too.
  raiseTravellers() {
    const u = this.unobservable;
    const ancestorOf = new Map(u.tracked.map(({ element, ancestor }) => [element, ancestor]));
    const travelling = new Set();
    for (const [element, spring] of u.springs) {
      if (!spring.travelling || element.nodeType !== 1 || !element.isConnected || !u.layout.has(element)) continue;
      // On its way - or, raised to be sized, still growing or shrinking.
      const layout = u.layout.get(element);
      const raised = u.raised.get(element);
      const moving = Math.abs(spring.x) >= 1 || Math.abs(spring.y) >= 1;
      const sizing = raised && raised.sized && (Math.abs(spring.w) * layout.width >= 0.5 || Math.abs(spring.h) * layout.height >= 0.5);
      if (!moving && !sizing) continue;
      const carrier = u.springs.get(ancestorOf.get(element));
      if (carrier && Math.abs(carrier.x - spring.x) < 1 && Math.abs(carrier.y - spring.y) < 1) continue;
      travelling.add(element);
    }
    for (const element of [...u.raised.keys()]) {
      if (!travelling.has(element)) this.lower(element);
    }
    for (const element of travelling) {
      if (!u.raised.has(element)) this.raise(element);
    }
  }

  // Take a travelling element out of its parent and into the layer above
  // everything in the container (see layer()): absolutely positioned
  // exactly where it lies in the layout, at its size there, looking as it
  // does - what it inherited from where it is comes along. In its place,
  // an invisible placeholder as large, so nothing around it moves.
  //
  // Out of the layout, it can be sized without moving anything else: one
  // with text of its own, which can't be scaled to its new size, and a box
  // of its own to see (a dashed frame around "Add", say), grows or shrinks
  // to it instead - from the size it was drawn at, its text laid out
  // anew all the way rather than squashed, and what doesn't fit in it yet
  // cut off (see applyAnimation()).
  raise(element) {
    const u = this.unobservable;
    const document = element.ownerDocument;
    const style = document.defaultView.getComputedStyle(element);
    const layout = u.layout.get(element);
    const placeholder = document.createElement("div");
    const inFlow = style.position !== "absolute" && style.position !== "fixed";
    Object.assign(placeholder.style, {
      display: !inFlow ? "none" : style.display === "inline" ? "inline-block" : style.display,
      visibility: "hidden", pointerEvents: "none", boxSizing: "border-box", flex: "none",
      width: layout.width + "px", height: layout.height + "px",
      marginTop: style.marginTop, marginRight: style.marginRight, marginBottom: style.marginBottom, marginLeft: style.marginLeft,
      alignSelf: style.alignSelf, justifySelf: style.justifySelf, order: style.order, gridArea: style.gridArea,
    });
    const looks = { ...computedLooks(element), pointerEvents: style.pointerEvents, cursor: style.cursor, visibility: style.visibility };
    const sized = !!textFontSize(element) && !isBareBox(element);
    const raisedStyle = {
      position: "absolute", left: "0px", top: "0px", right: "auto", bottom: "auto",
      width: layout.width + "px", height: layout.height + "px", minWidth: "0px", minHeight: "0px", maxWidth: "none", maxHeight: "none",
      marginTop: "0px", marginRight: "0px", marginBottom: "0px", marginLeft: "0px", boxSizing: "border-box", ...looks,
      ...(sized ? { overflow: "hidden" } : {}),
    };
    const saved = {};
    for (const key of Object.keys(raisedStyle)) saved[key] = element.style[key];
    element.parentNode.replaceChild(placeholder, element);
    const layer = this.layer();
    Object.assign(element.style, raisedStyle);
    layer.appendChild(element);
    const at = rectOf(layer);
    element.style.left = (layout.x - at.x) + "px";
    element.style.top = (layout.y - at.y) + "px";
    u.raised.set(element, { placeholder, saved, sized, texts: sized ? this.wrapTexts(element) : [] });
  }

  // The texts of an element raised to be sized, each wrapped in an element
  // of its own while it is - so they, too, glide to where its layout puts
  // them, rather than jumping there (see applyAnimation()): "Add luggage"
  // beside its plus, after being below it. Only in a flex or grid box,
  // where a text is laid out as a box of its own anyway - so wrapped, it's
  // laid out exactly the same.
  //
  // A text that says something else now ("Add to cart", once "Add") is a
  // new one: it fades in where it lies, and what it said before leaves as
  // a ghost of its own (see textGhost()) - the way an element appears and
  // leaves in something on its way.
  wrapTexts(element) {
    const u = this.unobservable;
    const from = u.from.get(element);
    if (!from || !from.texts || !isBoxLayout(element)) return [];
    const texts = [];
    const shown = new Set();
    for (const node of [...element.childNodes]) {
      if (node.nodeType !== 3 || node.textContent.trim() === "") continue;
      const span = element.ownerDocument.createElement("span");
      TEXT_WRAPPERS.add(span);
      element.replaceChild(span, node);
      span.appendChild(node);
      const at = from.texts.get(node);
      if (at && at.text === node.textContent) {
        shown.add(node);
        texts.push({ node, span, from: at });
      } else {
        const spring = newSpring();
        spring.o = -1;
        u.springs.set(span, spring);
        texts.push({ node, span, appearing: true });
      }
    }
    for (const [node, at] of from.texts) {
      if (!shown.has(node)) texts.push(this.textGhost(element, from, at));
    }
    return texts;
  }

  // What a text said before (`at`: where it was drawn, and what it said),
  // fading out in the element it was in (drawn at `box`) - as far into it,
  // its middle, for how large that's drawn, as it was: so it goes along as
  // that grows or shrinks, the way a ghost goes along with its carrier.
  textGhost(element, box, at) {
    const u = this.unobservable;
    const span = element.ownerDocument.createElement("span");
    span.textContent = at.text;
    const share = (offset, size) => (size > 0 ? offset / size * 100 : 50) + "%";
    Object.assign(span.style, {
      position: "absolute", whiteSpace: "pre", pointerEvents: "none",
      left: share(at.x + at.width / 2 - box.x, box.width), top: share(at.y + at.height / 2 - box.y, box.height),
      transform: "translate(-50%, -50%)",
    });
    element.appendChild(span);
    const spring = newSpring();
    spring.o = 1;
    u.springs.set(span, spring);
    return { span, leaving: true };
  }

  // Back in its place - and the layer gone, once nothing is in it.
  lower(element) {
    const u = this.unobservable;
    const { placeholder, saved, texts } = u.raised.get(element);
    for (const { node, span, leaving } of texts) {
      if (leaving) span.remove();
      else if (span.parentNode) span.parentNode.replaceChild(node, span);
      u.springs.delete(span);
    }
    Object.assign(element.style, saved);
    if (placeholder.parentNode) placeholder.parentNode.replaceChild(element, placeholder);
    else element.remove();
    u.raised.delete(element);
    if (u.raised.size === 0 && u.layer) {
      u.layer.remove();
      u.layer = null;
    }
  }

  lowerAll() {
    for (const element of [...this.unobservable.raised.keys()]) this.lower(element);
  }

  // An element on its way somewhere takes on how it looks there - its
  // color, its background, its shadow, how bold its text is (see
  // looksOf()) - along the way, rather than at once: what it looked like
  // (`from`, as it was drawn) and what it looks like now, at rest, make a
  // paused animation, which its spring's k (1, all the way to 0) moves
  // along - at the pace of everything else, however fast that is. Its font
  // size is its scale's business (see startAnimations()).
  changeLooks(element, from, spring) {
    const u = this.unobservable;
    if (typeof element.animate !== "function") return;
    const to = looksOf(element);
    const before = {};
    const after = {};
    for (const key of Object.keys(to)) {
      if (from[key] !== to[key]) {
        before[key] = from[key];
        after[key] = to[key];
      }
    }
    if (Object.keys(after).length === 0) return;
    const change = element.animate([before, after], { duration: LOOK_DURATION, fill: "both" });
    change.pause();
    change.currentTime = 0;
    u.looks.set(element, change);
    spring.k = 1;
    spring.vk = 0;
  }

  // Every change of look done with, at once - the elements that were
  // changing returned, to go on from where they're drawn.
  endLooks() {
    const u = this.unobservable;
    const changing = new Set(u.looks.keys());
    for (const change of u.looks.values()) change.cancel();
    u.looks.clear();
    return changing;
  }

  // An element's own inline position - for a raised one, the one it gets
  // back when lowered: raised, it's absolutely positioned in the layer, and
  // stays so whatever else the container puts back meanwhile (a ghost done
  // fading in it, a lift ending).
  positionOf(element) {
    const raised = this.unobservable.raised.get(element);
    return raised ? raised.saved.position : element.style.position;
  }

  setPosition(element, position) {
    const raised = this.unobservable.raised.get(element);
    if (raised) raised.saved.position = position;
    else element.style.position = position;
  }

  // The layer raised elements are drawn in: last in the container, above
  // the highest z-index in it - so above everything in it, overlays
  // included, whatever stacks them.
  layer() {
    const u = this.unobservable;
    if (u.layer) return u.layer;
    const root = u.node;
    const view = root.ownerDocument.defaultView;
    let highest = 0;
    for (const element of [...u.tracked.map(({ element }) => element), ...u.ghosts.keys()]) {
      if (element.nodeType !== 1) continue;
      const zIndex = parseInt(view.getComputedStyle(element).zIndex, 10);
      if (zIndex > highest) highest = zIndex;
    }
    if (view.getComputedStyle(root).position === "static") root.style.position = "relative";
    const layer = root.ownerDocument.createElement("div");
    Object.assign(layer.style, { position: "absolute", left: "0px", top: "0px", width: "0px", height: "0px", overflow: "visible", pointerEvents: "none", zIndex: String(highest + 1) });
    root.appendChild(layer);
    u.layer = layer;
    return layer;
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
    if (!withoutRecording(() => this.enabled)) {
      this.stopAll();
      return;
    }
    if (!this.isAnimating()) return;
    const now = FlipAnimationContainer.clock.now();
    // Capped, so a frame after the tab was in the background doesn't fling
    // everything past its target; scaled by its speed.
    const speed = withoutRecording(() => this.speed);
    let remaining = Math.min((now - u.lastFrameTime) / 1000, 0.05) * (speed !== null && typeof(speed) === "number" ? speed : FlipAnimationContainer.speed);
    while (remaining > 0) {
      const step = Math.min(remaining, SPRING_STEP);
      for (const spring of u.springs.values()) advanceSpring(spring, step);
      if (u.sizing) advanceSpring(u.sizing.spring, step);
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
    if (u.sizing && isSettled(u.sizing.spring)) this.endSizing();
    this.applyAnimation();
    for (const [element, ghost] of [...u.ghosts]) {
      if (ghost.opacity < 0.02) this.removeGhost(element);
    }
    if (this.isAnimating()) this.requestFrame();
  }

  stopAll() {
    const u = this.unobservable;
    u.springs.clear();
    if (u.following) u.following.clear();
    if (u.carried) u.carried.clear();
    for (const element of [...u.lifted.keys()]) this.unlift(element);
    this.lowerAll();
    this.endLooks();
    this.endCorners();
    this.endSizing();
    u.drawn = new Map();
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
// Only a default: a container given its own speed goes by that.
FlipAnimationContainer.speed = 1;

// Its islands' holders are marked as its own.
FlipAnimationContainer.islandAttribute = "data-flip-island";

// A spring per element, pulling each deviation - position (x, y, pixels),
// size (sx, sy, ratio - 1), opacity (o, 0 is fully visible) - to zero.
// Firm enough to arrive in well under a second at full speed, damped just
// enough not to overshoot.
const STIFFNESS = 170;
const DAMPING = 26;
const SPRING_STEP = 1 / 240;
// A change of look's length, as an animation: only ever moved along by
// hand (see changeLooks()), so any will do.
const LOOK_DURATION = 1000;

const FIELDS = ["x", "y", "sx", "sy", "o", "w", "h", "k"];
const RESTING = { x: 0, y: 0, sx: 0, sy: 0, o: 0, w: 0, h: 0, k: 0 };

function newSpring() {
  return { x: 0, y: 0, sx: 0, sy: 0, o: 0, w: 0, h: 0, k: 0, vx: 0, vy: 0, vsx: 0, vsy: 0, vo: 0, vw: 0, vh: 0, vk: 0 };
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
    && Math.abs(spring.o) < 0.01 && Math.abs(spring.vo) < 0.05
    && Math.abs(spring.w) < 0.002 && Math.abs(spring.h) < 0.002 && Math.abs(spring.vw) < 0.02 && Math.abs(spring.vh) < 0.02
    && Math.abs(spring.k) < 0.01 && Math.abs(spring.vk) < 0.05;
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

// Whether an element (its computed `style`) has rounded corners - any of
// them, by any radius.
function hasRoundedCorners(style) {
  return ["borderTopLeftRadius", "borderTopRightRadius", "borderBottomRightRadius", "borderBottomLeftRadius"]
    .some((key) => parseFloat(style[key]) > 0);
}

function round(value) {
  return Math.round(value * 100) / 100;
}

// How round an element's corners are drawn: each corner's horizontal and
// vertical radius, top left first, clockwise - at `scale`, how large it's
// drawn (by default, as large as it is). Null if any is given in percent.
function cornersOf(element, scale = { sx: 1, sy: 1 }) {
  const style = element.ownerDocument.defaultView.getComputedStyle(element);
  const corners = [];
  for (const key of ["borderTopLeftRadius", "borderTopRightRadius", "borderBottomRightRadius", "borderBottomLeftRadius"]) {
    const value = style[key] || "0px";
    if (value.includes("%")) return null;
    const [x, y = x] = value.split(/\s+/).map((each) => parseFloat(each) || 0);
    corners.push([x * scale.sx, y * scale.sy]);
  }
  return corners;
}

// Whether an element lays out its children as boxes - a flex or grid box.
function isBoxLayout(element) {
  return /flex|grid/.test(element.ownerDocument.defaultView.getComputedStyle(element).display);
}

// Where an element's own texts are drawn - each non-blank text node of its
// own - if it's a flex or grid box with any (see wrapTexts()).
function textsOf(element) {
  if (!hasOwnText(element) || !isBoxLayout(element)) return undefined;
  const texts = new Map();
  for (const each of element.childNodes) {
    // Already wrapped, on its way: the text in the wrapper.
    const node = TEXT_WRAPPERS.has(each) ? each.firstChild : each;
    if (node && node.nodeType === 3 && node.textContent.trim() !== "") texts.set(node, { ...textRectOf(node), text: node.textContent });
  }
  return texts;
}

function textRectOf(node) {
  const range = node.ownerDocument.createRange();
  range.selectNodeContents(node);
  if (typeof range.getBoundingClientRect !== "function") return rectOf(node.parentNode);
  const rect = range.getBoundingClientRect();
  return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
}

function rectOf(element) {
  const rect = element.getBoundingClientRect();
  return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
}

// The font size of an element's own text - undefined if it has no text of
// its own (only elements, or whitespace), or no known font size.
function textFontSize(element) {
  if (!hasOwnText(element)) return undefined;
  const size = parseFloat(element.ownerDocument.defaultView.getComputedStyle(element).fontSize);
  return size > 0 ? size : undefined;
}

// Text in a wrapper of the container's own (see wrapTexts()) is still the
// element's own.
function hasOwnText(element) {
  for (const node of element.childNodes) {
    if ((node.nodeType === 3 || TEXT_WRAPPERS.has(node)) && node.textContent.trim() !== "") return true;
  }
  return false;
}

// What an element looks like that's worth changing gradually, as it lands
// somewhere else (see changeLooks()): what it may inherit from there, and
// what the app may style it with there - all of it interpolable.
const LOOKS = [
  "color", "backgroundColor", "borderTopColor", "borderRightColor", "borderBottomColor", "borderLeftColor",
  "outlineColor", "textDecorationColor", "boxShadow", "textShadow", "fontWeight", "letterSpacing", "wordSpacing",
];

function looksOf(element) {
  const style = element.ownerDocument.defaultView.getComputedStyle(element);
  const looks = {};
  for (const key of LOOKS) looks[key] = style[key];
  return looks;
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

// Every wrapper a text is in while what it's in is raised to be sized (see
// wrapTexts()).
const TEXT_WRAPPERS = new WeakSet();

registerDOMComponent("flipAnimationContainer", FlipAnimationContainer);

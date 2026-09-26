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
 *    outermost new one - what's inside it comes along).
 *  - Leaving: an element removed from the tree is put back as a "ghost" -
 *    absolutely positioned exactly where and how it was drawn, keeping the
 *    font and color it had - which fades out and is then removed. If the
 *    same element comes back while it's fading, it's restored and moves on
 *    from there.
 *
 * Islands - components that can only be rendered, and what `isUnit` says
 * to place as one piece (see DOMPlacingContainer) - are animated as one
 * element, in the box the container gives them.
 */
export class FlipAnimationContainer extends DOMPlacingContainer {
  initialUnobservables() {
    const result = super.initialUnobservables();
    // Per animating element - see startAnimations().
    result.springs = new Map();
    // Where each tracked element lies in the current layout.
    result.layout = new Map();
    // Leaving elements, fading out - see removeAsGhosts().
    result.ghosts = new Map();
    result.framePending = false;
    result.hasRendered = false;
    return result;
  }

  render(context) {
    super.render(context);
    const u = this.unobservable;

    // Only meaningful while the container is in the page: hidden, nothing
    // has a position - it just places, and whatever was animating stops.
    const animate = u.element.isConnected && u.hasRendered;

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
    const leavingLooks = new Map(leaving.map(({ element }) => [element, computedLooks(element)]));

    // A ghost that's back in the tree is restored before it's placed.
    for (const element of [...u.ghosts.keys()]) {
      if (current.has(element)) this.restoreGhost(element);
    }

    for (const { parent, nodes } of placements) this.placeInOrder(parent, nodes);

    if (animate) {
      this.removeAsGhosts(leaving, drawnAt, leavingLooks);
      this.startAnimations(drawnAt);
    } else {
      this.stopAll();
    }
    u.hasRendered = u.element.isConnected;
    this.notifyPlaced(placedBefore);
  }

  // Leaving ghosts (see removeAsGhosts()) stay where they are while their
  // container places its children.
  leftAlone(node) {
    return GHOSTS.has(node);
  }

  // Put each leaving element (only the outermost of a leaving subtree)
  // back, absolutely positioned inside the container exactly where and how
  // it was drawn, looking as it did (it's no longer inside whatever gave
  // it its font or color), and fade it out.
  removeAsGhosts(leaving, drawnAt, looks) {
    const u = this.unobservable;
    if (leaving.length === 0) return;
    const root = u.element;
    if (root.ownerDocument.defaultView.getComputedStyle(root).position === "static") root.style.position = "relative";
    const rootRect = rectOf(root);
    for (const { element } of leaving) {
      const rect = drawnAt.get(element);
      if (!rect) continue;
      const savedStyle = element.getAttribute("style");
      const look = looks.get(element);
      element.querySelectorAll("*").forEach((each) => { each.style.transform = ""; });
      Object.assign(element.style, {
        position: "absolute",
        left: (rect.x - rootRect.x - root.clientLeft + root.scrollLeft) + "px",
        top: (rect.y - rootRect.y - root.clientTop + root.scrollTop) + "px",
        width: rect.width + "px",
        height: rect.height + "px",
        margin: "0",
        boxSizing: "border-box",
        transform: "",
        pointerEvents: "none",
        ...look,
      });
      root.appendChild(element);
      u.springs.delete(element);
      u.ghosts.set(element, { savedStyle, opacity: 1, velocity: 0 });
      GHOSTS.add(element);
    }
  }

  restoreGhost(element) {
    const u = this.unobservable;
    const { savedStyle } = u.ghosts.get(element);
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

    for (const { element, ancestor } of u.tracked) {
      const before = drawnAt.get(element);
      const now = u.layout.get(element);
      const spring = u.springs.get(element) || newSpring();
      if (before) {
        spring.x = before.x - now.x;
        spring.y = before.y - now.y;
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
    const drawn = new Map(); // element -> { x, y, sx, sy }: its drawn top-left and total scale, in page terms
    for (const { element, ancestor } of u.tracked) {
      const layout = u.layout.get(element);
      if (!layout) continue;
      const spring = u.springs.get(element) || RESTING;
      const here = { x: layout.x + spring.x, y: layout.y + spring.y, sx: 1 + spring.sx, sy: 1 + spring.sy };
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
    }
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
    if (u.springs.size === 0 && u.ghosts.size === 0) return;
    const now = FlipAnimationContainer.clock.now();
    // Capped, so a frame after the tab was in the background doesn't fling
    // everything past its target; slowed down by SPEED.
    let remaining = Math.min((now - u.lastFrameTime) / 1000, 0.05) * FlipAnimationContainer.speed;
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
  }
}

// When animation frames happen, and what time it is - replaceable (tests
// drive frames by hand).
FlipAnimationContainer.clock = {
  now: () => performance.now(),
  requestFrame: (callback) => requestAnimationFrame(callback),
};

// How fast animations run: 1 is the springs' natural pace; the demo runs at
// half that, so what happens is easier to follow.
FlipAnimationContainer.speed = 0.5;

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

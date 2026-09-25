import { DOMNodeRenderComponent } from "./DOMNodeRenderComponent.js";
import { DOMElementComponent } from "./DOMElementComponent.js";
import { DOMTextComponent } from "./DOMTextComponent.js";
import { DOMElementTarget } from "./DOMElementTarget.js";
import { applyStyle } from "./applyStyle.js";

export function flipAnimationContainer(...parameters) {
  return new FlipAnimationContainer(...parameters);
}

/**
 * FlipAnimationContainer - a container that places its whole subtree
 * itself, in one pass, instead of letting each component in it render
 * itself, and animates what moves. To animate nodes moving, appearing and
 * leaving (and to wrap them, make room for them, keep a leaving one
 * visible a while), the container has to be the one deciding where every
 * node goes - while the components in it stay exactly as they are
 * everywhere else, knowing nothing about animation.
 *
 * How it sees the subtree: each child is expanded all the way down to
 * primitives (Component.expandToPrimitives() - every component on the way
 * given its render context, so services such as a theme are found exactly
 * as when rendering normally), each primitive asked for its node
 * (ensureNode() - see DOMNodeRenderComponent), and a DOM element's own
 * children expanded the same way, recursively. Then every element's child
 * nodes are put in order, touching only nodes that actually need to move.
 * Without any movement, the result is exactly the DOM rendering the same
 * subtree normally would give.
 *
 * Moves (so far the only thing animated - an element appearing or leaving
 * does so at once): every element it places is tracked. On every render,
 * before placing anything, it records where each tracked element is drawn
 * right now - its current animation offset included - then places, then
 * reads where each one now lies in the new layout. The difference is an
 * offset the element is drawn at (a translation), and a spring per element
 * brings it back to zero. Because "where it's drawn right now" is the
 * starting point, and the spring keeps its velocity, an element redirected
 * mid-flight (the list reshuffled again before it arrived) curves smoothly
 * towards its new place instead of jumping or stopping dead. Offsets are
 * page positions, so an element moving to another parent - from one list
 * to another - moves just the same; a nested element is drawn relative to
 * its nearest tracked ancestor, so movements never add up twice.
 *
 * Islands: a component that can only be rendered, not expanded (one with
 * its own render() - a bounds provider, say) is rendered normally, into an
 * element of its own (`display: contents`, so it doesn't affect layout), and
 * that element is placed like any other node (not animated, so far). Edits
 * inside an island stay the island's own business, as efficient as anywhere
 * else; anything that changes the structure of the rest of the subtree
 * reruns the whole container - it reads the entire expanded tree.
 */
export class FlipAnimationContainer extends DOMNodeRenderComponent {
  setProperties({ children, style }) {
    this.children = children || [];
    this.style = style || null;
  }

  initialUnobservables() {
    const result = super.initialUnobservables();
    result.previouslySetStyle = {};
    // Every element placed last time, each with its nearest tracked
    // ancestor element (or null) - see render().
    result.tracked = [];
    // Per element: { x, y, vx, vy } - its current offset (where it's drawn,
    // relative to where it lies in the layout) and velocity, in page pixels.
    result.springs = new Map();
    result.framePending = false;
    return result;
  }

  // The container's own element, placed like any other rendered node.
  renderElement(context, existingElement) {
    const u = this.unobservable;
    const element = existingElement || document.createElement("div");
    context.target.reattachElement(element);
    u.previouslySetStyle = applyStyle(element, this.style || {}, u.previouslySetStyle);
    return element;
  }

  render(context) {
    super.render(context);
    const u = this.unobservable;
    if (!u.innerContext) u.innerContext = context.derive(DOMElementTarget.forElement(u.element));

    // Where every tracked element is drawn right now, before anything moves.
    // Only meaningful while the container is in the page (hidden, nothing
    // has a position - it just places, and whatever was moving stops).
    const visible = u.element.isConnected;
    const drawnAt = new Map();
    if (visible) {
      for (const { element } of u.tracked) {
        if (element.isConnected) drawnAt.set(element, pagePosition(element));
      }
    }

    u.tracked = [];
    this.placeChildren(this, u.element, u.innerContext, this.children, null);

    if (visible) {
      this.startMoves(drawnAt);
    } else {
      this.stopAll();
    }
  }

  // Place the nodes of `children` (the children of `owner`, whose node is
  // `parentElement`) into `parentElement`, in order. `ancestor` is the
  // nearest tracked element above them (null directly under the container).
  placeChildren(owner, parentElement, context, children, ancestor) {
    const nodes = [];
    children.forEach((child, index) => {
      if (child === null || typeof(child) === "undefined" || child === false) return;
      if (typeof(child) === "string" || typeof(child) === "number") {
        nodes.push(this.looseText(owner, index, child).ensureNode());
        return;
      }
      for (const expanded of child.expandToPrimitives(context, owner)) {
        nodes.push(this.nodeOf(expanded, context, ancestor));
      }
    });
    placeInOrder(parentElement, nodes);
  }

  nodeOf(component, context, ancestor) {
    if (!component.isPrimitive()) return this.renderIsland(component, context);
    const node = component.ensureNode();
    if (component instanceof DOMElementComponent) {
      this.unobservable.tracked.push({ element: node, ancestor });
      const u = component.unobservable;
      // Cached, like DOMElementComponent's own render() does - the same
      // context object every time, so expanding again changes nothing any
      // build depends on. Dropped when the element is replaced (a tag
      // change - see DOMElementComponent.replaceElement()).
      if (!u.childContext) u.childContext = context.derive(DOMElementTarget.forElement(node));
      this.placeChildren(component, node, u.childContext, component.children || [], node);
    }
    return node;
  }

  // A loose string/number child, as a Text node - kept per position in its
  // owner's children, so re-expanding patches the same node rather than
  // making a new one (DOMElementComponent's own render() makes a fresh
  // one every time; the resulting DOM is the same).
  looseText(owner, index, value) {
    const u = owner.unobservable;
    if (!u.looseTexts) u.looseTexts = [];
    let textComponent = u.looseTexts[index];
    if (!textComponent) {
      textComponent = new DOMTextComponent({ text: value });
      u.looseTexts[index] = textComponent;
    } else {
      textComponent.text = value;
    }
    return textComponent;
  }

  renderIsland(component, context) {
    const u = component.unobservable;
    if (!u.islandElement) {
      u.islandElement = document.createElement("div");
      u.islandElement.style.display = "contents";
      u.islandContext = context.derive(DOMElementTarget.forElement(u.islandElement));
    }
    component.renderOnto(u.islandContext);
    return u.islandElement;
  }

  // Given where each element was drawn before this render, work out where
  // each one lies now, and start (or redirect) the springs that close the
  // gap.
  startMoves(drawnAt) {
    const u = this.unobservable;
    const tracked = new Set(u.tracked.map(({ element }) => element));
    for (const element of u.springs.keys()) {
      if (!tracked.has(element)) u.springs.delete(element);
    }

    // All writes (clearing this container's own translations), then all
    // reads (the new layout) - one layout pass, not one per element.
    for (const { element } of u.tracked) element.style.transform = "";
    const layoutAt = new Map(u.tracked.map(({ element }) => [element, pagePosition(element)]));

    for (const { element } of u.tracked) {
      const before = drawnAt.get(element);
      if (!before) continue; // new here - nothing to move from
      const now = layoutAt.get(element);
      const spring = u.springs.get(element) || { vx: 0, vy: 0 };
      spring.x = before.x - now.x;
      spring.y = before.y - now.y;
      if (isSettled(spring)) {
        u.springs.delete(element);
      } else {
        u.springs.set(element, spring);
      }
    }

    this.applyOffsets();
    if (u.springs.size > 0) this.requestFrame();
  }

  // Draw every tracked element at its offset - relative to its nearest
  // tracked ancestor's, since it moves along with that one already.
  applyOffsets() {
    const u = this.unobservable;
    const offset = (element) => u.springs.get(element) || ZERO;
    for (const { element, ancestor } of u.tracked) {
      const own = offset(element);
      const inherited = ancestor ? offset(ancestor) : ZERO;
      const dx = own.x - inherited.x;
      const dy = own.y - inherited.y;
      element.style.transform = (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) ? "" : "translate(" + dx + "px, " + dy + "px)";
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
    if (u.springs.size === 0) return;
    const now = FlipAnimationContainer.clock.now();
    // Capped, so a frame after the tab was in the background doesn't fling
    // everything past its target.
    let remaining = Math.min((now - u.lastFrameTime) / 1000, 0.05);
    while (remaining > 0) {
      const step = Math.min(remaining, SPRING_STEP);
      for (const spring of u.springs.values()) advanceSpring(spring, step);
      remaining -= step;
    }
    for (const [element, spring] of u.springs) {
      if (isSettled(spring)) u.springs.delete(element);
    }
    this.applyOffsets();
    if (u.springs.size > 0) this.requestFrame();
  }

  stopAll() {
    const u = this.unobservable;
    u.springs.clear();
    for (const { element } of u.tracked) element.style.transform = "";
  }
}

// When animation frames happen, and what time it is - replaceable (tests
// drive frames by hand).
FlipAnimationContainer.clock = {
  now: () => performance.now(),
  requestFrame: (callback) => requestAnimationFrame(callback),
};

const ZERO = { x: 0, y: 0 };

// A damped spring per axis, pulling the offset to zero: firm enough to
// arrive in well under a second, damped enough to barely overshoot.
const STIFFNESS = 170;
const DAMPING = 26;
const SPRING_STEP = 1 / 240;

function advanceSpring(spring, seconds) {
  const ax = -STIFFNESS * spring.x - DAMPING * spring.vx;
  const ay = -STIFFNESS * spring.y - DAMPING * spring.vy;
  spring.vx += ax * seconds;
  spring.vy += ay * seconds;
  spring.x += spring.vx * seconds;
  spring.y += spring.vy * seconds;
}

function isSettled(spring) {
  return Math.abs(spring.x) < 0.5 && Math.abs(spring.y) < 0.5
    && Math.abs(spring.vx) < 5 && Math.abs(spring.vy) < 5;
}

function pagePosition(element) {
  const rect = element.getBoundingClientRect();
  return { x: rect.left, y: rect.top };
}

// Make `parent`'s child nodes exactly `nodes`, in that order - moving only
// the nodes that aren't already in place (the same "don't touch what
// didn't move" rule as DOMElementTarget.reattachElement()), and removing
// whatever is no longer among them.
function placeInOrder(parent, nodes) {
  let current = parent.firstChild;
  for (const node of nodes) {
    if (node === current) {
      current = current.nextSibling;
    } else {
      parent.insertBefore(node, current);
    }
  }
  while (current) {
    const next = current.nextSibling;
    parent.removeChild(current);
    current = next;
  }
}

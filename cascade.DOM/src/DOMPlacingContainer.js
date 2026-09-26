import { frozen } from "@liquefy/cascade.component";
import { DOMNodeRenderComponent } from "./DOMNodeRenderComponent.js";
import { DOMElementComponent } from "./DOMElementComponent.js";
import { DOMTextComponent } from "./DOMTextComponent.js";
import { DOMElementTarget } from "./DOMElementTarget.js";
import { applyStyle } from "./applyStyle.js";

/**
 * DOMPlacingContainer - the base of containers that place their whole
 * subtree themselves, in one pass, instead of letting each component in it
 * render itself: cascade.DOM's FlipAnimationContainer (which animates every
 * change it places) and OverflowContainer (which places its children one at
 * a time, until they no longer fit). The components in it stay exactly as
 * they are everywhere else, knowing nothing about how they're placed.
 *
 * How it sees the subtree: each child is expanded (Component.expand() -
 * every component on the way given its render context, so services such
 * as a theme are found exactly as when rendering normally) down to
 * components that can hand over their own node (providesNode() - see
 * DOMNodeRenderComponent), each of those asked for its node
 * (ensureNode()), and a DOM element's own children expanded the same way,
 * recursively - see expandSubtree(). Where each element's child nodes go is
 * recorded as a list of placements, which a subclass then puts in order
 * (placeInOrder()), touching only nodes that actually need to move - or
 * places some of them its own way first. At rest, placed in order, the
 * result is exactly the DOM rendering the same subtree normally would give.
 *
 * Islands: a component that can only be rendered, not expanded (one with
 * its own render() - a bounds provider, say) is rendered normally, into a
 * plain block element of its own, which is placed like any other element.
 * So is any component the app wants placed as one piece - a card, say,
 * rather than each element in it: `isUnit`, a function given each
 * component on the way down, answering true for those. Edits inside an
 * island stay the island's own business, as efficient as anywhere else;
 * anything that changes the structure of the rest of the subtree reruns
 * the whole container - it reads the entire expanded tree.
 *
 * What it places, it tells when it's shown and hidden - as rendering would
 * have (see Component.onShow()/onHide(), and notifyPlaced()).
 */
export class DOMPlacingContainer extends DOMNodeRenderComponent {
  setProperties({ children, style, isUnit }) {
    this.children = frozen(children || []);
    this.style = frozen(style || null);
    this.isUnit = isUnit || null;
  }

  // Where expanding stops (see Component.expand()): at what the app wants
  // placed as one piece, and otherwise at what can hand over its own node.
  isLeaf(component) {
    return (this.isUnit && this.isUnit(component)) || (component instanceof DOMNodeRenderComponent && component.providesNode());
  }

  initialUnobservables() {
    const result = super.initialUnobservables();
    result.previouslySetStyle = {};
    // Every element placed this time, in tree order, each with its nearest
    // placed ancestor element (or null) - see nodeOf().
    result.tracked = [];
    // Every component it placed last time - expanded, not rendered - and
    // whether it's hidden itself right now (see onShow()/onHide()).
    result.placed = new Set();
    result.hidden = false;
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

  // The context its children are expanded with - its own element as their
  // target. Cached: the same context object every time.
  innerContext(context) {
    const u = this.unobservable;
    if (!u.innerContext) u.innerContext = context.derive(DOMElementTarget.forElement(u.element));
    return u.innerContext;
  }

  // Expand `children` (default: its own) into nodes, afresh: returns the
  // placements - one { parent, nodes } per element whose children it
  // expanded, this container's own first - and who was placed before (for
  // notifyPlaced()). u.tracked lists every placed element afterwards.
  expandSubtree(context, children = this.children) {
    const u = this.unobservable;
    u.tracked = [];
    const placements = [];
    const placedBefore = u.placed;
    u.placed = new Set();
    this.expandChildren(this, u.element, this.innerContext(context), children, null, placements);
    return { placements, placedBefore };
  }

  // Expand `children` (the children of `owner`, whose node is
  // `parentElement`) into nodes, recording where each element's children
  // go in `placements` (placed afterwards, all at once). `ancestor` is the
  // nearest placed element above them (null directly under the container).
  expandChildren(owner, parentElement, context, children, ancestor, placements) {
    const nodes = [];
    placements.push({ parent: parentElement, nodes });
    children.forEach((child, index) => {
      if (child === null || typeof(child) === "undefined" || child === false) return;
      if (typeof(child) === "string" || typeof(child) === "number") {
        nodes.push(this.looseText(owner, index, child).ensureNode());
        return;
      }
      for (const expanded of child.expand(context, owner, (component) => this.isLeaf(component), this.unobservable.placed)) {
        nodes.push(this.nodeOf(expanded, context, ancestor, placements));
      }
    });
  }

  nodeOf(component, context, ancestor, placements) {
    const isUnit = this.isUnit && this.isUnit(component);
    if (isUnit || !(component instanceof DOMNodeRenderComponent && component.providesNode())) {
      const holder = this.renderIsland(component, context);
      // Rendered, not placed: rendering tells it when it's shown or hidden.
      this.unobservable.placed.delete(component);
      this.unobservable.tracked.push({ element: holder, ancestor });
      return holder;
    }
    const node = component.ensureNode();
    if (component instanceof DOMElementComponent) {
      this.unobservable.tracked.push({ element: node, ancestor });
      const u = component.unobservable;
      // Cached, like DOMElementComponent's own render() does - the same
      // context object every time, so expanding again changes nothing any
      // build depends on. Dropped when the element is replaced (a tag
      // change - see DOMElementComponent.replaceElement()).
      if (!u.childContext) u.childContext = context.derive(DOMElementTarget.forElement(node));
      this.expandChildren(component, node, u.childContext, component.children || [], node, placements);
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

  // An island is rendered normally, into a plain block element the
  // container provides - which gives it a box to be placed as a unit.
  renderIsland(component, context) {
    const u = component.unobservable;
    if (!u.islandElement) {
      u.islandElement = document.createElement("div");
      u.islandElement.setAttribute(this.constructor.islandAttribute, "");
      u.islandContext = context.derive(DOMElementTarget.forElement(u.islandElement));
    }
    component.renderOnto(u.islandContext);
    return u.islandElement;
  }

  // Make `parent`'s child nodes exactly `nodes`, in that order - moving only
  // the nodes that aren't already in place (the same "don't touch what
  // didn't move" rule as DOMElementTarget.reattachElement()), and removing
  // whatever is no longer among them, except what leftAlone() says to leave
  // where it is.
  placeInOrder(parent, nodes) {
    const skip = (node) => {
      while (node && this.leftAlone(node)) node = node.nextSibling;
      return node;
    };
    let current = skip(parent.firstChild);
    for (const node of nodes) {
      if (node === current) {
        current = skip(current.nextSibling);
      } else {
        parent.insertBefore(node, current);
      }
    }
    while (current) {
      const next = skip(current.nextSibling);
      parent.removeChild(current);
      current = next;
    }
  }

  // A node placeInOrder() leaves where it is - none, by default.
  leftAlone(node) {
    return false;
  }

  // What it placed gets told it's shown or hidden, as rendering would have
  // told it (see Component.onShow()): hidden first - whatever it hands over
  // to something new (a portal's contents, say) is let go before the new
  // one takes it. Unless the container itself is hidden.
  notifyPlaced(placedBefore) {
    const u = this.unobservable;
    if (u.hidden) return;
    for (const component of placedBefore) {
      if (!u.placed.has(component)) component.onHide();
    }
    for (const component of u.placed) {
      if (!placedBefore.has(component)) component.onShow();
    }
  }

  // Hidden itself (its page switched away from, say): so is everything it
  // placed - and shown again with it. (Islands are rendered, so rendering
  // tells them itself.)
  onHide() {
    super.onHide();
    const u = this.unobservable;
    u.hidden = true;
    for (const component of u.placed) component.onHide();
  }

  onShow() {
    super.onShow();
    const u = this.unobservable;
    if (!u.hidden) return;
    u.hidden = false;
    for (const component of u.placed) component.onShow();
  }
}

// The attribute an island's holder element is marked with.
DOMPlacingContainer.islandAttribute = "data-island";

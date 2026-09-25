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
 * itself. The foundation the flip animations will be built on: to animate
 * nodes moving, appearing and leaving (and to wrap them, make room for
 * them, keep a leaving one visible a while), the container has to be the
 * one deciding where every node goes - while the components in it stay
 * exactly as they are everywhere else, knowing nothing about animation.
 *
 * So far it only places: rendering a subtree through it gives the same DOM
 * as rendering it normally.
 *
 * How it sees the subtree: each child is expanded all the way down to
 * primitives (Component.expandToPrimitives() - every component on the way
 * given its render context, so services such as a theme are found exactly
 * as when rendering normally), each primitive asked for its node
 * (ensureNode() - see DOMNodeRenderComponent), and a DOM element's own
 * children expanded the same way, recursively. Then every element's child
 * nodes are put in order, touching only nodes that actually need to move.
 *
 * Islands: a component that can only be rendered, not expanded (one with
 * its own render() - a bounds provider, say) is rendered normally, into an
 * element of its own (`display: contents`, so it doesn't affect layout), and
 * that element is placed like any other node. Edits inside an island stay
 * the island's own business, as efficient as anywhere else; anything that
 * changes the structure of the rest of the subtree reruns the whole
 * container - it reads the entire expanded tree.
 */
export class FlipAnimationContainer extends DOMNodeRenderComponent {
  setProperties({ children, style }) {
    this.children = children || [];
    this.style = style || null;
  }

  initialUnobservables() {
    const result = super.initialUnobservables();
    result.previouslySetStyle = {};
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
    this.placeChildren(this, u.element, u.innerContext, this.children);
  }

  // Place the nodes of `children` (the children of `owner`, whose node is
  // `parentElement`) into `parentElement`, in order.
  placeChildren(owner, parentElement, context, children) {
    const nodes = [];
    children.forEach((child, index) => {
      if (child === null || typeof(child) === "undefined" || child === false) return;
      if (typeof(child) === "string" || typeof(child) === "number") {
        nodes.push(this.looseText(owner, index, child).ensureNode());
        return;
      }
      for (const expanded of child.expandToPrimitives(context, owner)) {
        nodes.push(this.nodeOf(expanded, context, owner));
      }
    });
    placeInOrder(parentElement, nodes);
  }

  nodeOf(component, context, owner) {
    if (!component.isPrimitive()) return this.renderIsland(component, context);
    const node = component.ensureNode();
    if (component instanceof DOMElementComponent) {
      const u = component.unobservable;
      // Cached, like DOMElementComponent's own render() does - the same
      // context object every time, so expanding again changes nothing any
      // build depends on. Dropped when the element is replaced (a tag
      // change - see DOMElementComponent.replaceElement()).
      if (!u.childContext) u.childContext = context.derive(DOMElementTarget.forElement(node));
      this.placeChildren(component, node, u.childContext, component.children || []);
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

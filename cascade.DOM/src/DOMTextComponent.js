import { extractProperty } from "@liquefy/cascade.component";
import { DOMNodeRenderComponent } from "./DOMNodeRenderComponent.js";

/**
 * A real Text node, ported from flow.DOM/src/DOMTextNode.js's own role -
 * what a loose string/number child (see DOMElementComponent's own children
 * handling) gets wrapped into, so it's a real DOMNodeRenderComponent like any
 * other child, not a bare JS value renderOnto() can't call anything on.
 */
export class DOMTextComponent extends DOMNodeRenderComponent {
  setProperties(properties) {
    this.text = extractProperty(properties, "text");
  }

  renderElement(context, existingElement) {
    // DOMElementTarget has no dedicated "append a text node" of its own (only
    // appendElement, which always creates via document.createElement) -
    // reattachElement is the generic insertion primitive underneath both,
    // so it's the right call for a freshly-created Text node too.
    let node = existingElement;
    if (!node) {
      node = document.createTextNode("");
    }
    // Reconfirm position every render, not just on fresh creation - see
    // DOMElementComponent.renderElement()'s own comment for why a reused node
    // still needs this.
    context.target.reattachElement(node);
    if (node.data !== String(this.text)) {
      node.data = String(this.text);
    }
    return node;
  }
}

// Matches flow.DOM's own `text(...)` name and argument shape (see
// flow.DOM/src/DOMTextNode.js's own getTextNodeProperties) - used
// explicitly wherever a bare string can't be passed directly (e.g. as the
// sole child of a tag call that itself takes other loose arguments), as
// opposed to a loose string/number child being auto-wrapped implicitly
// (see DOMElementComponent's own render()) - or, as of this second form,
// wherever a *keyed* text node is needed: a loose string/number child is
// always wrapped fresh, unkeyed, on every parent rerun (see
// DOMElementComponent.render()'s own comment), so a component whose own text
// content changes independently of everything else around it - without a
// key, a real DOM Text node it could otherwise just mutate in place gets
// torn down and recreated instead. `text("value")` for the common,
// unkeyed case (unchanged); `text({key: "...", text: "value"})` or
// `text("value", {key: "..."})` for a keyed one.
export function text(...parameters) {
  let value;
  if (typeof(parameters[0]) === "string" || typeof(parameters[0]) === "number") {
    value = parameters.shift() + "";
  }
  const properties = typeof(parameters[0]) === "object" && parameters[0] !== null ? parameters.shift() : {};
  if (typeof(properties.text) !== "undefined" && typeof(value) !== "undefined") {
    throw new Error("text(): cannot have both a loose value and a 'text' property.");
  }
  if (typeof(value) !== "undefined") properties.text = value;
  return new DOMTextComponent(properties);
}

import { extractProperty } from "@liquefy/cascade.component";
import { DOMNodeComponent } from "./DOMNodeComponent.js";

/**
 * A real Text node, ported from flow.DOM/src/DOMTextNode.js's own role -
 * what a loose string/number child (see DOMElementNode's own children
 * handling) gets wrapped into, so it's a real DOMNodeComponent like any
 * other child, not a bare JS value renderOnto() can't call anything on.
 */
export class DOMTextNode extends DOMNodeComponent {
  setProperties(properties) {
    this.text = extractProperty(properties, "text");
  }

  renderElement(context, existingElement) {
    const node = existingElement || document.createTextNode("");
    if (node.data !== String(this.text)) {
      node.data = String(this.text);
    }
    return node;
  }
}

// Matches flow.DOM's own `text(...)` name - used explicitly wherever a
// bare string can't be passed directly (e.g. as the sole child of a tag
// call that itself takes other loose arguments), as opposed to a loose
// string/number child being auto-wrapped implicitly (see DOMElementNode's
// own render()).
export function text(value) {
  return new DOMTextNode({ text: value });
}

import { extractProperty, accessInitialValues } from "@liquefy/cascade.component";
import { DOMNodeComponent } from "./DOMNodeComponent.js";

/**
 * A real Text node, ported from flow.DOM/src/DOMTextNode.js's own role -
 * what a loose string/number child (see DOMElementNode's own children
 * handling) gets wrapped into, so it's a real DOMNodeComponent like any
 * other child, not a bare JS value renderOnto() can't call anything on.
 */
export class DOMTextNode extends DOMNodeComponent {
  setProperties(properties) {
    // accessInitialValues() - see DOMElementNode.js's own setProperties()
    // for why: a plain write here would be positioned within whichever
    // repeater happens to be constructing this node right now, so
    // disposing that repeater (e.g. an ancestor rebuilding while this
    // exact node is also being dropped from the tree) could unlink it
    // before a still-queued, stale rerun of this node's own render()
    // reads it back.
    const text = extractProperty(properties, "text");
    accessInitialValues(() => { this.text = text; });
  }

  renderElement(context, existingElement) {
    // DOMTarget has no dedicated "append a text node" of its own (only
    // appendElement, which always creates via document.createElement) -
    // reattachElement is the generic insertion primitive underneath both,
    // so it's the right call for a freshly-created Text node too.
    let node = existingElement;
    if (!node) {
      node = document.createTextNode("");
      context.target.reattachElement(node);
    }
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

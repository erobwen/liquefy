import { Component } from "@liquefy/cascade.component";
import { div, button, input, text } from "@liquefy/cascade.dom";

/**
 * Recursive Demo - ported from
 * flow.application/demo/src/pages/recursiveDemoApplication.js's own
 * RecursiveExample/ControlRow/List/Item. A List either builds one Item and
 * stops, or builds an Item and recurses into another List one level
 * deeper - however many levels "count" (a Recursive/List/Item recursion
 * depth, driven by the More/Less buttons) currently calls for.
 *
 * The point, same as flow's own version: every List/Item's own build()
 * reruns *every* time count changes, at *every* level, regardless of
 * whether that particular level's own place in the structure actually
 * changed - but the real DOM barely moves, because:
 *  - every build()-composed element here carries an explicit key, so it
 *    reconciles to the *same* real element across rebuilds instead of
 *    being torn down and recreated (see DOMElementComponent.js's own key-based
 *    reconciliation, and this file's own use of keyed text() nodes -
 *    DOMElementComponent.render()'s own auto-wrap of a loose string/number
 *    child is deliberately *not* used for any text that might actually
 *    change, since that wrap is always fresh and unkeyed);
 *  - a component whose own inputs didn't genuinely change (same value,
 *    same reference) never reruns its own build() at all - cascade's
 *    ordinary same-value write dedup, not anything special to this demo.
 * Open the browser's DevTools (Rendering panel -> "Paint flashing", or
 * just watch the Elements panel) while clicking More/Less or typing in
 * the shared-value field to see this directly: the JS side rebuilds the
 * whole chain, the DOM side only ever touches the one or two nodes that
 * actually changed.
 *
 * Also demonstrates the other two things flow's own version did:
 *  - component hierarchy inheritance (provide()/inherit() - see
 *    Component.js) - every Item reads the *same* shared value, provided
 *    once by RecursiveDemo itself, however deep it's nested;
 *  - stable local state across a rebuild (initializeState() - see
 *    Component.js/README.md) - each Item's own local number, entered once
 *    and never touched again by any rebuild, however many times its own
 *    build() reruns for unrelated reasons (a sibling level being added or
 *    removed further down the chain, say).
 */
export class RecursiveDemo extends Component {
  // The number of levels (More/Less), and the value every Item shares -
  // both changed only by the user (the buttons, the shared-value input's
  // own oninput handler), never reset by a rebuild.
  initializeState() {
    return { levels: 1, sharedValue: 42 };
  }

  // provide()'s own default already returns `this` - inherit("sharedValue")
  // from anywhere underneath finds it here, on whichever RecursiveDemo
  // instance is nearest (there's only ever one in this demo, but the
  // mechanism is the same one OverlayFrame/inherit("overlayFrame") use for
  // genuinely recursive nesting - see cascade.ui/src/OverlayFrame.js).

  build() {
    return div(
      { key: "recursiveDemo", style: { maxWidth: 720 } },
      new ControlRow({ key: "controlRow", demo: this }),
      new ListLevel({ key: "rootList", maxDepth: this.levels, depth: 1 }),
    );
  }
}

class ControlRow extends Component {
  setProperties({ demo }) {
    this.demo = demo;
  }

  build() {
    const { demo } = this;
    return div(
      { key: "controls", style: {
        display: "flex", alignItems: "center", gap: "12px",
        padding: "8px 0 16px", borderBottom: "1px solid #dfe6e9", marginBottom: "12px",
      } },
      div({ key: "label" }, "Recursive Structure"),
      button({
        key: "more",
        // Outside any repeater (a real DOM event handler) - a plain write
        // to a state property is fine here, same as ApplicationMenuFrame's
        // own hamburger onclick.
        onclick: () => { demo.levels = demo.levels + 1; },
        style: { padding: "4px 12px", cursor: "pointer" },
      }, "More"),
      button({
        key: "less",
        onclick: () => { if (demo.levels > 1) demo.levels = demo.levels - 1; },
        style: { padding: "4px 12px", cursor: "pointer" },
      }, "Less"),
      div({ key: "sharedLabel" }, "Shared value:"),
      input({
        key: "sharedInput",
        type: "number",
        value: demo.sharedValue,
        oninput: (event) => { demo.sharedValue = Number(event.target.value); },
        style: { width: "72px" },
      }),
    );
  }
}

class ListLevel extends Component {
  setProperties({ maxDepth, depth }) {
    this.maxDepth = maxDepth;
    this.depth = depth;
  }

  build() {
    const children = [new ListItem({ key: "item", depth: this.depth })];
    if (this.depth < this.maxDepth) {
      children.push(new ListLevel({ key: "rest", maxDepth: this.maxDepth, depth: this.depth + 1 }));
    }
    return div(
      { key: "level", style: {
        border: "1px solid #b2bec3", borderRadius: "4px",
        padding: "8px 8px 8px 16px", marginBottom: "6px",
      } },
      children,
    );
  }
}

class ListItem extends Component {
  setProperties({ depth }) {
    this.depth = depth;
  }

  // Local to this one Item, established once - never reset by whatever
  // rebuild caused this component's own build() to rerun again.
  initializeState() {
    return { value: 42 };
  }

  build() {
    const shared = this.inherit("sharedValue");
    return div(
      { key: "item", style: { display: "flex", alignItems: "center", gap: "16px" } },
      // Keyed - see this file's own top comment on why: this text's own
      // content only ever depends on `depth`, which never changes for a
      // given Item once constructed, but keeping it keyed (matching
      // flow's own choice here) means a rerun for any reason at all still
      // reconciles to the same real Text node rather than replacing it.
      text({ key: "depthLabel", text: "Depth " + this.depth }),
      input({
        key: "localValue",
        type: "number",
        value: this.value,
        oninput: (event) => { this.value = Number(event.target.value); },
        style: { width: "72px" },
      }),
      // Keyed for real this time - every Item's own copy of this text
      // changes whenever *anyone* edits the shared value, and it's the
      // one place in this demo where you can watch a rerun that touches
      // many Items at once still only mutate a Text node in place at
      // each one, never recreate it.
      text({ key: "sharedLabel", text: "Shared value: " + shared }),
    );
  }
}

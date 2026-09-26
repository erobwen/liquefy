import { Component, callback } from "@liquefy/cascade.component";
import { div, text } from "@liquefy/cascade.dom";
import { button, card, controlPanel, textField, row, filler } from "@liquefy/cascade.ui";
import { pageActions } from "../components/pageActions.js";
import { pageColumn } from "../components/layout.js";
import source from "./RecursiveDemo.js?raw";

// What this page's information button shows (see ../components/pageActions.js).
const information = {
  summary: "A recursive structure of components, rebuilt at every level whenever the depth changes:",
  points: [
    "Minimal DOM updates: every level rebuilds, but only the nodes that actually changed are touched (watch the Elements panel).",
    "Stable component identity across rebuilds, so each item's local state is kept.",
    "Hierarchy inheritance: every item, however deep, reads the same shared value through inherit().",
  ],
};

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
    return pageColumn(
      { key: "recursiveDemo", style: { maxWidth: "760px" } },
      pageActions({ information, source, fileName: "src/pages/RecursiveDemo.js" }),
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
    // Themed widgets - whichever theme the app is using provides them. The
    // handlers run outside any repeater (a real DOM event), so a plain
    // write to a state property is fine here.
    return controlPanel(
      { key: "controls" },
      div({ key: "label", style: { fontWeight: "bold" } }, text({ key: "labelText", text: "Recursive structure" })),
      button({ key: "more" }, text({ key: "moreText", text: "More" }), callback("more", () => { demo.levels = demo.levels + 1; })),
      button({ key: "less", disabled: demo.levels <= 1 }, text({ key: "lessText", text: "Less" }), callback("less", () => { if (demo.levels > 1) demo.levels = demo.levels - 1; })),
      filler({ key: "controlsFiller" }),
      textField({
        key: "sharedValue",
        label: "Shared value",
        type: "number",
        value: demo.sharedValue,
        onInput: callback("sharedValue", (value) => { if (value !== "") demo.sharedValue = Number(value); }),
      }),
    );
  }
}

// One level: its item, and - if it isn't the last - the next level, inside
// it.
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
    return card(
      { key: "level", variant: this.depth === 1 ? "elevated" : "outlined", style: { display: "flex", flexDirection: "column", gap: "12px" } },
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
    return row(
      { key: "item", style: { alignItems: "center", gap: "16px", flexWrap: "wrap", overflow: "visible" } },
      // Keyed text - every Item's own copy of the shared value changes
      // whenever anyone edits it, and a keyed text() is mutated in place at
      // each one, never recreated.
      div({ key: "depth", style: { fontWeight: "bold", minWidth: "64px" } }, text({ key: "depthLabel", text: "Depth " + this.depth })),
      textField({
        key: "localValue",
        label: "Local value",
        type: "number",
        value: this.value,
        onInput: callback("localValue", (value) => { if (value !== "") this.value = Number(value); }),
      }),
      text({ key: "sharedLabel", text: "Shared value: " + shared }),
    );
  }
}

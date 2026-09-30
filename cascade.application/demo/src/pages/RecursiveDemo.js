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
 * The point, same as flow's own version: when count changes, every List
 * level's own build() reruns - each is handed the new count, whether or
 * not its own place in the structure changed - but the real DOM barely
 * moves, because:
 *  - what a rerun build() constructs is matched to what it constructed
 *    the time before: the same class (for an element, the same tag) in
 *    the same place is the same component, and keeps its real element,
 *    rather than being torn down and recreated (see
 *    cascade.component/README.md, "Keys and pattern matching"). Only the
 *    levels themselves are keyed: a level that drops out is gone, state
 *    and all, when count decreases;
 *  - a component whose own inputs didn't genuinely change (same value,
 *    same reference) never reruns its own build() at all - an Item, say,
 *    whose depth is the same as before - cascade's ordinary same-value
 *    write dedup, not anything special to this demo.
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
 *  - stable local state across a rebuild (initialState() - see
 *    Component.js/README.md) - each Item's own local number, entered once
 *    and never touched again by any rebuild, however many times its own
 *    build() reruns (the shared value being edited, say) or its level's
 *    does (a level being added or removed further down the chain).
 */
export class RecursiveDemo extends Component {
  // The number of levels (More/Less), and the value every Item shares -
  // both changed only by the user (the buttons, the shared-value input's
  // own oninput handler), never reset by a rebuild.
  initialState() {
    return { levels: 1, sharedValue: 42 };
  }

  // inherit("sharedValue") from anywhere underneath finds it here, on
  // whichever RecursiveDemo instance is nearest (there's only ever one in
  // this demo, but the mechanism is the same one
  // OverlayFrame/inherit("overlayFrame") use for genuinely recursive
  // nesting - see cascade.ui/src/OverlayFrame.js). A getter: it follows the
  // state it reads.
  provide() {
    const demo = this;
    return { get sharedValue() { return demo.sharedValue; } };
  }

  build() {
    return pageColumn(
      { style: { maxWidth: "760px" } },
      pageActions({ information, source, fileName: "src/pages/RecursiveDemo.js" }),
      new ControlRow({ demo: this }),
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
      div({ style: { fontWeight: "bold" } }, text("Recursive structure")),
      button(text("More"), callback("more", () => { demo.levels = demo.levels + 1; })),
      button({ disabled: demo.levels <= 1 }, text("Less"), callback("less", () => { if (demo.levels > 1) demo.levels = demo.levels - 1; })),
      filler(),
      textField({
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
    const children = [new ListItem({ depth: this.depth })];
    if (this.depth < this.maxDepth) {
      children.push(new ListLevel({ key: "rest", maxDepth: this.maxDepth, depth: this.depth + 1 }));
    }
    return card(
      { variant: this.depth === 1 ? "elevated" : "outlined", style: { display: "flex", flexDirection: "column", gap: "12px" } },
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
  initialState() {
    return { value: 42 };
  }

  build() {
    const shared = this.inherit("sharedValue");
    return row(
      { style: { alignItems: "center", gap: "16px", flexWrap: "wrap", overflow: "visible" } },
      // Every Item's own copy of the shared value changes whenever anyone
      // edits it - the text(), matched to the one before by its place, is
      // mutated in place at each one, never recreated.
      div({ style: { fontWeight: "bold", minWidth: "64px" } }, text("Depth " + this.depth)),
      textField({
        label: "Local value",
        type: "number",
        value: this.value,
        onInput: callback("localValue", (value) => { if (value !== "") this.value = Number(value); }),
      }),
      text("Shared value: " + shared),
    );
  }
}

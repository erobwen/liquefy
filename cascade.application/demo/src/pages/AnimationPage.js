import { Component, postponeInvalidations, continueInvalidations } from "@liquefy/cascade.component";
import { div, text, flipAnimationContainer } from "@liquefy/cascade.dom";
import { button, row, column, filler, fillerStyle, naturalSizeStyle } from "@liquefy/cascade.ui";
import { pageActions } from "../components/pageActions.js";
import source from "./AnimationPage.js?raw";

// What this page's information button shows (see ../components/pageActions.js).
const information = {
  summary: "Animated moves, with FlipAnimationContainer:",
  points: [
    "Try Add, Remove, Randomize and Juggle.",
    "Items move, grow and shrink between the panels, new ones fade in, and removed ones fade out where they were.",
    "Nothing in the page knows about animation: the container expands the subtree and animates every change in it.",
  ],
};

/**
 * Animation - ported from flow.application/demo/src/pages/animationExample.js
 * (its information and code buttons in the top bar - see
 * ../components/pageActions.js): items in two panels - add, remove, randomize, and juggle them
 * between the panels - and every move animated.
 *
 * The animation is FlipAnimationContainer's (see cascade.DOM): it's wrapped
 * around both panels, so an item moving from one panel to the other is
 * just another move inside it. Nothing else here knows about animation -
 * the panels and items are ordinary build()-composed elements. Each item
 * is keyed by its name, so it keeps its identity (and its element) wherever
 * it goes; that's what lets the container see it move rather than one item
 * disappear and another appear.
 *
 * Changes that touch both lists happen in one go (transaction(), as in
 * flow's version): written one after the other, an item would be in
 * neither list for a rebuild in between - dropped for good (see
 * cascade.component/README.md) - and come back as a new one.
 */
const items = ["Foo", "Fie", "Fum", "Bar", "Foobar", "Fiebar", "Fumbar"];

const smallSpace = "5px";
const largeSpace = "20px";

function transaction(action) {
  postponeInvalidations();
  try {
    action();
  } finally {
    continueInvalidations();
  }
}

const panelStyle = {
  marginBottom: "0px", borderRadius: "15px", backgroundColor: "#eeeeee",
  borderColor: "#cccccc", borderStyle: "solid", borderWidth: "1px", padding: "10px",
};

const panel = (key, list, style) => column(
  { key, style: { ...panelStyle, ...style } },
  list.map((item) => div(
    { key: item, style: { display: "block", margin: smallSpace, textAlign: "left" } },
    text({ key: item + "Text", text: item }),
  )),
);

export class AnimationPage extends Component {
  // The lists are state, changed only by the buttons - each change a new
  // array, rather than one mutated in place.
  initializeState() {
    return { store: [...items], listA: [], listB: [] };
  }

  addRandom() {
    const { rest, item } = removeOneRandom(this.store);
    transaction(() => {
      this.store = rest;
      this.listA = insertRandomly(item, this.listA);
    });
  }

  removeRandom() {
    const { rest, item } = removeOneRandom(this.listA);
    transaction(() => {
      this.listA = rest;
      this.store = [...this.store, item];
    });
  }

  randomize() {
    this.listA = randomized(this.listA);
  }

  juggle() {
    let listA = this.listA;
    let listB = this.listB;
    const aToB = listA.length > 0 && listA.length + 1 >= listB.length;
    const bToA = listB.length > 0 && listB.length + 1 >= listA.length;
    let fromA = null;
    let fromB = null;
    if (aToB) ({ rest: listA, item: fromA } = removeOneRandom(listA));
    if (bToA) ({ rest: listB, item: fromB } = removeOneRandom(listB));
    if (fromA !== null) listB = insertRandomly(fromA, listB);
    if (fromB !== null) listA = insertRandomly(fromB, listA);
    transaction(() => {
      this.listA = listA;
      this.listB = listB;
    });
  }

  build() {
    return column(
      { key: "page", style: { height: "100%", width: "100%" } },
      pageActions(this, { information, source, fileName: "src/pages/AnimationPage.js" }),
      row(
        { key: "controls" },
        row(
          { key: "addRemove", style: { gap: "5px" } },
          button({ key: "add", disabled: this.store.length === 0 }, "Add random", () => this.addRandom()),
          button({ key: "remove", disabled: this.listA.length === 0 }, "Remove random", () => this.removeRandom()),
        ),
        filler({ key: "controlsFiller" }),
        row(
          { key: "shuffle", style: { gap: "5px" } },
          button({ key: "randomize" }, "Randomize", () => this.randomize()),
          button({ key: "juggle" }, "Juggle", () => this.juggle()),
        ),
      ),
      flipAnimationContainer(
        { key: "animated", style: { ...fillerStyle, display: "flex", flexDirection: "column", overflow: "visible" } },
        filler({ key: "above" }),
        row(
          { key: "panels", style: { overflow: "visible", ...naturalSizeStyle } },
          column(
            { key: "columnA", style: { overflow: "visible" } },
            filler({ key: "aAbove" }),
            panel("panelA", this.listA, { fontSize: "40px", lineHeight: "40px", margin: largeSpace, padding: largeSpace, overflow: "visible" }),
            filler({ key: "aBelow" }),
          ),
          filler({ key: "between" }),
          column(
            { key: "columnB", style: { overflow: "visible" } },
            filler({ key: "bAbove" }),
            panel("panelB", this.listB, { fontSize: "20px", lineHeight: "20px", color: "blue", margin: largeSpace, padding: largeSpace, overflow: "visible" }),
            filler({ key: "bBelow" }),
          ),
        ),
        filler({ key: "below" }),
      ),
    );
  }
}

// Random helpers - flow's own, returning new arrays instead of changing
// the one given.
function removeOneRandom(list) {
  const index = Math.floor(Math.random() * list.length);
  return { item: list[index], rest: [...list.slice(0, index), ...list.slice(index + 1)] };
}

function insertRandomly(item, list) {
  const index = Math.floor(Math.random() * list.length);
  return [...list.slice(0, index), item, ...list.slice(index)];
}

function randomized(list) {
  let remaining = list;
  let result = [];
  while (remaining.length > 0) {
    const { item, rest } = removeOneRandom(remaining);
    remaining = rest;
    result = insertRandomly(item, result);
  }
  return result;
}

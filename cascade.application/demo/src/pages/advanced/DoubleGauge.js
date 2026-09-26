import { Component, callback } from "@liquefy/cascade.component";
import { div, input, text } from "@liquefy/cascade.dom";
import { button, row, column } from "@liquefy/cascade.ui";
import { gaugeSvg } from "./Gauge.js";

// Two nodes, side by side - no wrapper around them. So it renders itself:
// render(context) puts both straight on context.target, the element its
// parent renders into, right after target.lastChild - and then advances
// lastChild to the last of them.
//
// lastChild is a temporal signal: each component reads it as the one
// rendered just before it left it. So whatever comes after the double gauge
// sees the second gauge, and lands after both of them. (Read it once and
// write it once: a component reading back what it wrote itself would only
// be rendered again.)
export class DoubleGauge extends Component {
  setProperties({ left, right, swapped }) {
    this.left = left;
    this.right = right;
    this.swapped = swapped;
  }

  render(context) {
    const u = this.unobservable;
    if (!u.leftElement) {
      u.leftElement = document.createElement("div");
      u.rightElement = document.createElement("div");
    }
    u.leftElement.innerHTML = gaugeSvg(this.left);
    u.rightElement.innerHTML = gaugeSvg(this.right, "#27ae60");
    this.place(context.target);
  }

  place(target) {
    const [first, second] = this.swapped
      ? [this.unobservable.rightElement, this.unobservable.leftElement]
      : [this.unobservable.leftElement, this.unobservable.rightElement];
    const previous = target.lastChild; // what was rendered just before
    const next = previous ? previous.nextSibling : target.element.firstChild;
    // Touch the real DOM only when they're not already in place.
    if (next !== first || first.nextSibling !== second) {
      target.element.insertBefore(first, next);
      target.element.insertBefore(second, first.nextSibling);
    }
    target.lastChild = second; // what's rendered next goes after both
  }

  // Not rendered for a while (see DOMNodeRenderComponent, which does the
  // same for one node): take the nodes out - and put them back, in place.
  onRetract() {
    this.unobservable.leftElement?.remove();
    this.unobservable.rightElement?.remove();
    super.onRetract();
  }

  onReattach(context) {
    if (this.unobservable.leftElement) this.place(context.target);
    super.onReattach(context);
  }
}

// Using it - between two ordinary siblings, all in one row.
export class DoubleGaugeDemo extends Component {
  initializeState() {
    return { left: 64, right: 30, swapped: false };
  }

  build() {
    const slider = (key, name) => input({
      key, type: "range", min: 0, max: 100, value: this[name],
      oninput: callback(key, (event) => { this[name] = Number(event.target.value); }),
    });
    return column(
      { key: "doubleGaugeDemo", style: { gap: "16px" } },
      row(
        { key: "gauges", style: { alignItems: "center", gap: "16px", flexWrap: "wrap" } },
        div({ key: "before" }, text({ key: "beforeText", text: "Before" })),
        new DoubleGauge({ key: "doubleGauge", left: this.left, right: this.right, swapped: this.swapped }),
        div({ key: "after" }, text({ key: "afterText", text: "After both" })),
      ),
      row(
        { key: "controls", style: { alignItems: "center", gap: "16px", flexWrap: "wrap" } },
        slider("blueSlider", "left"),
        slider("greenSlider", "right"),
        button({ key: "swap" }, text({ key: "swapText", text: "Swap the gauges" }), callback("swap", () => { this.swapped = !this.swapped; })),
      ),
    );
  }
}

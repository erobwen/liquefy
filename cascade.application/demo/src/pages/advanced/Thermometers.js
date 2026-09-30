import { Component, callback } from "@liquefy/cascade.component";
import { div, input, text } from "@liquefy/cascade.dom";
import { button, card, row, column } from "@liquefy/cascade.ui";

// As many nodes as `count` says - zero, one or many, side by side, with no
// wrapper around them. So it renders itself: render(target) puts them
// straight on the target, the element its parent renders into, right after
// target.lastChild - and then advances lastChild to the last of them, or,
// with none, leaves it where it was.
//
// lastChild is a temporal signal: each component reads it as the one
// rendered just before it left it. So whatever comes after the thermometers
// sees the last of them - or, with none, whatever came before them - and
// lands right after it. (Read it once and write it once: a component
// reading back what it wrote itself would only be rendered again.)
export class Thermometers extends Component {
  setProperties({ count, temperature }) {
    this.count = count;
    this.temperature = temperature;
  }

  render(target) {
    const u = this.unobservable;
    if (!u.nodes) u.nodes = [];
    while (u.nodes.length < this.count) u.nodes.push(document.createElement("div"));
    while (u.nodes.length > this.count) u.nodes.pop().remove();
    for (const node of u.nodes) node.innerHTML = thermometerSvg(this.temperature);
    this.place(target);
  }

  place(target) {
    let previous = target.lastChild; // what was rendered just before
    for (const node of this.unobservable.nodes) {
      const next = previous ? previous.nextSibling : target.element.firstChild;
      // Touch the real DOM only when it's not already in place.
      if (next !== node) target.element.insertBefore(node, next);
      previous = node;
    }
    target.lastChild = previous; // what's rendered next goes after them all
  }

  // Not rendered for a while (see DOMNodeComponent, which does the
  // same for one node): take the nodes out - and put them back, in place.
  onRetract() {
    for (const node of this.unobservable.nodes || []) node.remove();
    super.onRetract();
  }

  onReattach(target) {
    if (this.unobservable.nodes) this.place(target);
    super.onReattach(target);
  }
}

// -20 - 40 degrees.
export function thermometerSvg(temperature) {
  const level = (temperature + 20) / 60; // 0 - 1
  const top = 14 + (1 - level) * 96;
  return `
    <svg viewBox="0 0 40 160" width="40" height="160" role="img" aria-label="${temperature}°">
      <rect x="13" y="8" width="14" height="112" rx="7" fill="#dfe6ee" />
      <circle cx="20" cy="124" r="14" fill="#e74c3c" />
      <rect x="17" y="${top}" width="6" height="${124 - top}" rx="3" fill="#e74c3c" />
      <text x="20" y="156" text-anchor="middle" font-size="12" font-weight="bold" fill="currentColor">${temperature}°</text>
    </svg>`;
}

// Using it - between two cards, all in one row. The count is changed from
// outside: at zero, there's nothing left of the thermometers to hold it.
export class ThermometersDemo extends Component {
  initialState() {
    return { count: 3, temperature: 21 };
  }

  build() {
    return column(
      { style: { gap: "16px" } },
      row(
        { style: { alignItems: "center", gap: "16px", flexWrap: "wrap" } },
        card(text("Before")),
        new Thermometers({ count: this.count, temperature: this.temperature }),
        card(text("After")),
      ),
      row(
        { style: { alignItems: "center", gap: "16px", flexWrap: "wrap" } },
        button(text("−"), callback("fewer", () => { this.count = Math.max(0, this.count - 1); })),
        div(text(this.count + (this.count === 1 ? " thermometer" : " thermometers"))),
        button(text("+"), callback("more", () => { this.count = Math.min(8, this.count + 1); })),
        input({
          type: "range", min: -20, max: 40, value: this.temperature,
          oninput: callback("temperature", (event) => { this.temperature = Number(event.target.value); }),
        }),
      ),
    );
  }
}

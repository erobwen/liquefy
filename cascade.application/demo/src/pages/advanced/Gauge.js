import { Component, callback } from "@liquefy/cascade.component";
import { DOMNodeComponent, input } from "@liquefy/cascade.dom";
import { row, themeColor } from "@liquefy/cascade.ui";

// A render component: it makes its own DOM - here an SVG gauge, written as
// a template literal - and keeps it up to date. Cascade decides when:
// whenever something it read changes (this.value).
export class Gauge extends DOMNodeComponent {
  setProperties({ value }) {
    this.value = value; // 0 - 100
  }

  ensureNode() {
    const u = this.unobservable;
    if (!u.node) u.node = document.createElement("div");
    u.node.innerHTML = gaugeSvg(this.value);
    return u.node;
  }
}

// The theme's colors, as CSS variables - in style: an SVG attribute
// doesn't take var().
export function gaugeSvg(value, color = themeColor.accent) {
  const arc = "M 10 60 A 50 50 0 0 1 110 60";
  return `
    <svg viewBox="0 0 120 70" width="240" height="140" role="img" aria-label="${value}%">
      <path d="${arc}" fill="none" style="stroke: ${themeColor.border}" stroke-width="12" stroke-linecap="round" />
      <path d="${arc}" fill="none" style="stroke: ${color}" stroke-width="12" stroke-linecap="round"
            pathLength="100" stroke-dasharray="${value} 100" />
      <text x="60" y="58" text-anchor="middle" font-size="18" font-weight="bold" fill="currentColor">${value}%</text>
    </svg>`;
}

// Using it - like any other component.
export class GaugeDemo extends Component {
  initialState() {
    return { value: 64 };
  }

  build() {
    return row(
      { style: { alignItems: "center", gap: "24px", flexWrap: "wrap" } },
      new Gauge({ value: this.value }),
      input({
        type: "range",
        min: 0,
        max: 100,
        value: this.value,
        oninput: callback("slide", (event) => { this.value = Number(event.target.value); }),
      }),
    );
  }
}

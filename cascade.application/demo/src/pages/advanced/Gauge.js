import { Component, callback } from "@liquefy/cascade.component";
import { DOMNodeRenderComponent, input } from "@liquefy/cascade.dom";
import { row } from "@liquefy/cascade.ui";

// A render component: it makes its own DOM - here an SVG gauge, written as
// a template literal - and keeps it up to date. Cascade decides when:
// whenever something it read changes (this.value).
export class Gauge extends DOMNodeRenderComponent {
  setProperties({ value }) {
    this.value = value; // 0 - 100
  }

  ensureNode() {
    const u = this.unobservable;
    if (!u.element) u.element = document.createElement("div");
    u.element.innerHTML = gaugeSvg(this.value);
    return u.element;
  }
}

export function gaugeSvg(value, color = "#2e86c1") {
  const arc = "M 10 60 A 50 50 0 0 1 110 60";
  return `
    <svg viewBox="0 0 120 70" width="240" height="140" role="img" aria-label="${value}%">
      <path d="${arc}" fill="none" stroke="#dfe6ee" stroke-width="12" stroke-linecap="round" />
      <path d="${arc}" fill="none" stroke="${color}" stroke-width="12" stroke-linecap="round"
            pathLength="100" stroke-dasharray="${value} 100" />
      <text x="60" y="58" text-anchor="middle" font-size="18" font-weight="bold" fill="currentColor">${value}%</text>
    </svg>`;
}

// Using it - like any other component.
export class GaugeDemo extends Component {
  initializeState() {
    return { value: 64 };
  }

  build() {
    return row(
      { key: "gaugeDemo", style: { alignItems: "center", gap: "24px", flexWrap: "wrap" } },
      new Gauge({ key: "gauge", value: this.value }),
      input({
        key: "slider",
        type: "range",
        min: 0,
        max: 100,
        value: this.value,
        oninput: callback("slide", (event) => { this.value = Number(event.target.value); }),
      }),
    );
  }
}

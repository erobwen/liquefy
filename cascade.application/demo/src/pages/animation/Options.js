import { Component, callback } from "@liquefy/cascade.component";
import { div, text, animationContainer } from "@liquefy/cascade.dom";
import { button, checkbox, column, controlPanel } from "@liquefy/cascade.ui";

const box = { display: "flex", flexDirection: "column", gap: "6px", padding: "10px", width: "150px", background: "#d5f5e3" };
const item = { padding: "6px 10px", borderRadius: "4px", background: "#1e8449", color: "white" };

// The container's options - each a property, and each can change while
// things move. Two boxes get the same items: one square, clipping what
// overflows it - where `confine` shows - and one with rounded corners -
// where `keepCorners` does.
export class Options extends Component {
  initialState() {
    return { count: 2, enabled: true, slow: true, confine: false, zoomAlong: false, keepCorners: true };
  }

  build() {
    const option = (name) => checkbox({
      label: name, checked: this[name], onChange: callback(name, (checked) => { this[name] = checked; }),
    });
    // Keyed by which box they're in, too: a key is one element's, in all of a build.
    const items = (box) => Array.from({ length: this.count }, (unused, index) => div({ key: box + index, style: item }, text("Item " + (index + 1))));
    return column(
      { style: { gap: "12px", overflow: "visible" } },
      controlPanel(
        button({ disabled: this.count === 6 }, text("Add"), callback("add", () => { this.count++; })),
        button({ disabled: this.count === 0 }, text("Remove"), callback("remove", () => { this.count--; })),
        option("enabled"), option("slow"), option("confine"), option("zoomAlong"), option("keepCorners"),
      ),
      animationContainer(
        {
          enabled: this.enabled,
          speed: this.slow ? 0.25 : 1,
          confine: this.confine,
          zoomAlong: this.zoomAlong,
          keepCorners: this.keepCorners,
          style: { display: "flex", alignItems: "flex-start", gap: "24px" },
        },
        div({ key: "square", style: { ...box, overflow: "hidden" } }, items("square")),
        div({ key: "rounded", style: { ...box, borderRadius: "28px" } }, items("rounded")),
      ),
    );
  }
}

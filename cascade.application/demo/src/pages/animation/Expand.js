import { Component, callback } from "@liquefy/cascade.component";
import { div, text, animationContainer } from "@liquefy/cascade.dom";

const panel = { padding: "12px 16px", borderRadius: "8px", background: "#ebdef0", color: "#4a235a", cursor: "pointer", width: "280px" };
const planets = {
  Mercury: "The smallest planet, and the closest to the sun: a year there is 88 days.",
  Venus: "The hottest planet - hotter than Mercury, under its thick clouds.",
  Earth: "The only one known to have a guide to animation containers.",
};

// Changing size. A panel that gets something more in it just is larger in
// the new layout: it grows there, and the panels after it glide out of the
// way. No wrappers, no heights to work out - and what's in it isn't
// stretched along.
export class Expand extends Component {
  initialState() {
    return { open: "Venus" };
  }

  build() {
    return animationContainer(
      { style: { display: "flex", flexDirection: "column", gap: "8px" } },
      Object.keys(planets).map((name) => div(
        { key: name, style: panel, onclick: callback("open" + name, () => { this.open = this.open === name ? null : name; }) },
        div({ style: { fontWeight: "bold" } }, text(name)),
        this.open === name
          ? div({ key: name + "Details", style: { marginTop: "6px", fontSize: "14px" } }, text(planets[name]))
          : null,
      )),
    );
  }
}

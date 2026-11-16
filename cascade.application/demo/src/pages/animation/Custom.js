import { Component, callback } from "@liquefy/cascade.component";
import { div, text, FlipAnimationContainer } from "@liquefy/cascade.dom";

const chip = { padding: "6px 14px", borderRadius: "16px", background: "#fadbd8", color: "#78281f", cursor: "pointer" };

// A container of your own: FlipAnimationContainer, with one thing done
// differently. Each step of what it does is a method - here the one that
// turns what's leaving into ghosts: struck through, as they fade out.
class StrikingContainer extends FlipAnimationContainer {
  removeAsGhosts(fading, drawnAt) {
    const ghosts = super.removeAsGhosts(fading, drawnAt);
    for (const ghost of ghosts) ghost.style.textDecoration = "line-through";
    return ghosts;
  }
}

// Made as any component is.
const strikingContainer = (properties, ...children) => new StrikingContainer({ ...properties, children });

export class Custom extends Component {
  initialState() {
    return { items: ["Milk", "Eggs", "Flour", "Butter", "Sugar"] };
  }

  build() {
    return strikingContainer(
      { style: { display: "flex", flexWrap: "wrap", gap: "8px", minHeight: "34px" } },
      ...this.items.map((name) => div(
        { key: name, style: chip, onclick: callback("got" + name, () => { this.items = this.items.filter((each) => each !== name); }) },
        text(name),
      )),
    );
  }
}

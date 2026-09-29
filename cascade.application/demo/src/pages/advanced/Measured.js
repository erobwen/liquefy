import { Component } from "@liquefy/cascade.component";
import { div, text, elementBoundsProvider } from "@liquefy/cascade.dom";
import { icon } from "@liquefy/cascade.ui";

// Lays itself out by the room it really has - measured, not guessed: side
// by side when there's room, stacked when there isn't.
class Profile extends Component {
  build() {
    const width = this.fromTarget("width") || 0; // the element it's placed in, measured
    const wide = width >= 420;
    return div(
      {
        style: {
          display: "flex", flexDirection: wide ? "row" : "column", alignItems: "center", gap: "16px",
          padding: "16px", textAlign: wide ? "left" : "center",
        },
      },
      icon({ name: "account_circle", style: { fontSize: wide ? "64px" : "48px" } }),
      div(
        div({ style: { fontWeight: "bold", fontSize: "18px" } }, text("Ada Lovelace")),
        div({ style: { opacity: 0.7 } }, text((wide ? "Wide: " : "Narrow: ") + Math.round(width) + "px to lay out in")),
      ),
    );
  }
}

// The provider measures its own element - here one you can resize: drag
// its corner - and hands the size to its child, as
// what's placed on it: this.fromTarget("width") and this.fromTarget("height").
// Its height follows what's inside it, so only its width is contained.
export class Measured extends Component {
  build() {
    return elementBoundsProvider({
      style: {
        width: "100%", maxWidth: "100%", minWidth: "220px", boxSizing: "border-box", contain: "inline-size layout",
        resize: "horizontal", overflow: "auto", border: "1px solid #cdd7e2", borderRadius: "8px",
      },
      child: new Profile(),
    });
  }
}

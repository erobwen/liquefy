import { Component, callback } from "@liquefy/cascade.component";
import { h1, img, p, text } from "@liquefy/cascade.dom";
import { button, column } from "@liquefy/cascade.ui";

export class HelloWorld extends Component {
  // State: set up once, then changed by the user - here, by the button.
  initialState() {
    return { count: 0 };
  }

  // Runs again whenever something it read changes (this.count): only what
  // actually changed is updated in the page.
  build() {
    return column(
      {
        style: {
          alignItems: "center", gap: "16px", padding: "40px 24px", borderRadius: "12px",
          background: "#1f2d3b", color: "#e6eef6", textAlign: "center",
        },
      },
      img({
        src: "https://erobwen.github.io/liquefy/cascade-logo.svg",
        alt: "Cascade",
        style: { width: "100%", maxWidth: "320px" },
      }),
      h1({ style: { margin: 0 } }, text("Hello Cascade")),
      button(text("Count is " + this.count), callback("count", () => { this.count++; })),
      p({ style: { margin: 0, opacity: 0.75 } }, text("Edit HelloWorld.js and save - the page follows.")),
    );
  }
}

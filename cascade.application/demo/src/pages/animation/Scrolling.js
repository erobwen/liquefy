import { Component, callback } from "@liquefy/cascade.component";
import { div, text, animationContainer, scrollArea } from "@liquefy/cascade.dom";
import { button, column, controlPanel } from "@liquefy/cascade.ui";

const message = { padding: "8px 12px", borderRadius: "6px", background: "#d6dbdf", color: "#212f3d", cursor: "pointer" };

// Scrolling. The container is in something that scrolls - here a
// scrollArea(), an indicator in place of a scroll bar, and faded edges. A
// message that leaves fades out where it was: scrolled along, and cut off
// where the area ends. The indicator follows the container's own box, as
// that grows and shrinks.
export class Scrolling extends Component {
  initialState() {
    return { messages: [1, 2, 3, 4, 5, 6, 7], next: 8 };
  }

  build() {
    return column(
      { style: { gap: "12px", overflow: "visible" } },
      controlPanel(button(text("Add at the top"), callback("add", () => {
        this.messages = [this.next, ...this.messages];
        this.next++;
      }))),
      scrollArea(
        { fade: 24, style: { height: "200px", width: "280px" }, scrollStyle: { flex: 1, paddingRight: "10px" } },
        animationContainer(
          { style: { display: "flex", flexDirection: "column", gap: "6px" } },
          this.messages.map((id) => div(
            {
              key: "message" + id,
              style: message,
              onclick: callback("remove" + id, () => { this.messages = this.messages.filter((each) => each !== id); }),
            },
            text("Message " + id + " - click to remove"),
          )),
        ),
      ),
    );
  }
}

import { Component, callback } from "@liquefy/cascade.component";
import { div, text, flipAnimationContainer } from "@liquefy/cascade.dom";
import { button, column, controlPanel } from "@liquefy/cascade.ui";

const note = { padding: "8px 12px", borderRadius: "6px", background: "#fcf3cf", color: "#7d6608", cursor: "pointer" };

// Appearing and leaving. A new note fades in where it lies; one that's
// removed fades out where it was, while the rest close the gap. The line
// below isn't in the container at all - it follows the container's own box.
export class AppearLeave extends Component {
  initialState() {
    return { notes: [1, 2, 3], next: 4 };
  }

  build() {
    const add = callback("add", () => {
      // In the middle: so there's something to make room.
      const at = Math.floor(this.notes.length / 2);
      this.notes = [...this.notes.slice(0, at), this.next, ...this.notes.slice(at)];
      this.next++;
    });
    return column(
      { style: { gap: "12px", overflow: "visible" } },
      controlPanel(button(text("Add a note"), add)),
      flipAnimationContainer(
        { style: { display: "flex", flexDirection: "column", gap: "6px", width: "260px" } },
        this.notes.map((id) => div(
          {
            key: "note" + id,
            style: note,
            onclick: callback("remove" + id, () => { this.notes = this.notes.filter((each) => each !== id); }),
          },
          text("Note " + id + " - click to remove"),
        )),
      ),
      div(text(this.notes.length + (this.notes.length === 1 ? " note" : " notes"))),
    );
  }
}

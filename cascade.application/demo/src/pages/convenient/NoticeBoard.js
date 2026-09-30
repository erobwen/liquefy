import { Component, callback } from "@liquefy/cascade.component";
import { div, text } from "@liquefy/cascade.dom";
import { button, card, column, portal, portalSource } from "@liquefy/cascade.ui";

// Owns a portal - a place for others to put things in - and provides it by
// name, for anything below to find. Owns it for real: created here, not in
// a build(), so it's this board that establishes it and disposes of it (see
// Component.establish()).
export class NoticeBoard extends Component {
  initialUnobservables() {
    return {
      board: portal(
        { style: { padding: "12px", minHeight: "48px", border: "2px dashed #cdd7e2", borderRadius: "8px" } },
        div({ style: { opacity: 0.6 } }, text("No notices - the board is empty.")),
      ).establish(),
    };
  }

  onDispose() {
    this.unobservable.board.dispose();
    super.onDispose();
  }

  // Found by inherit("noticeBoard") from anywhere below.
  provide() {
    return { noticeBoard: this.unobservable.board };
  }

  build() {
    return card(
      { style: { display: "flex", flexDirection: "column", gap: "12px" } },
      this.unobservable.board,
      div({ style: { padding: "12px", border: "1px dashed #cdd7e2", borderRadius: "8px" } },
        div({ style: { padding: "12px", border: "1px dashed #cdd7e2", borderRadius: "8px" } },
          new Poster())),
    );
  }
}

// Deep inside - and puts its notice on the board, by the board's name.
class Poster extends Component {
  initialState() {
    return { posted: false };
  }

  build() {
    return column(
      { style: { gap: "8px", alignItems: "flex-start" } },
      text("A component, deep inside."),
      button(
        text(this.posted ? "Take the notice down" : "Put up a notice"),
        callback("toggle", () => { this.posted = !this.posted; }),
      ),
      // Keyed: built even while it isn't shown, and kept alive by its key.
      portalSource(
        { key: "notice", portal: "noticeBoard" },
        card(text("A notice - posted from deep inside, shown up here.")),
      ).showIf(this.posted),
    );
  }
}

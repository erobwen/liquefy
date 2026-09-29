import { Component, callback } from "@liquefy/cascade.component";
import { div, text } from "@liquefy/cascade.dom";
import { button, card, column, portal, portalContents } from "@liquefy/cascade.ui";

// Owns a portal - a place for others to put things in - and provides it by
// name, for anything below to find. Owns it for real: created here, not in
// a build(), so it's this board that establishes it and disposes of it (see
// Component.establish()).
export class NoticeBoard extends Component {
  initialUnobservables() {
    return {
      board: portal(
        { style: { padding: "10px 14px", borderRadius: "8px", background: "#fff4e5", color: "#663c00" } },
        text("No notices."),
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
      portalContents(
        { key: "notice", portal: "noticeBoard" },
        text("Posted from deep inside - shown up here."),
      ).show(this.posted),
    );
  }
}

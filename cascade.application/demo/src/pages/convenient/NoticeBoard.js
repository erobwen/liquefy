import { Component, callback } from "@liquefy/cascade.component";
import { div, text } from "@liquefy/cascade.dom";
import { button, card, column, portal, portalContents } from "@liquefy/cascade.ui";

// Owns a portal - a place for others to put things in - and provides it by
// name, for anything below to find.
export class NoticeBoard extends Component {
  initialUnobservables() {
    return {
      board: portal(
        { key: "board", style: { padding: "10px 14px", borderRadius: "8px", background: "#fff4e5", color: "#663c00" } },
        text({ key: "empty", text: "No notices." }),
      ),
    };
  }

  // Found by inherit("noticeBoard") from anywhere below.
  get noticeBoard() {
    return this.unobservable.board;
  }

  build() {
    return card(
      { key: "noticeBoard", style: { display: "flex", flexDirection: "column", gap: "12px" } },
      this.unobservable.board,
      div({ key: "deep", style: { padding: "12px", border: "1px dashed #cdd7e2", borderRadius: "8px" } },
        div({ key: "deeper", style: { padding: "12px", border: "1px dashed #cdd7e2", borderRadius: "8px" } },
          new Poster({ key: "poster" }))),
    );
  }
}

// Deep inside - and puts its notice on the board, by the board's name.
class Poster extends Component {
  initializeState() {
    return { posted: false };
  }

  build() {
    return column(
      { key: "poster", style: { gap: "8px", alignItems: "flex-start" } },
      text({ key: "where", text: "A component, deep inside." }),
      button(
        { key: "toggle" },
        text({ key: "toggleText", text: this.posted ? "Take the notice down" : "Put up a notice" }),
        callback("toggle", () => { this.posted = !this.posted; }),
      ),
      portalContents(
        { key: "notice", portal: "noticeBoard" },
        text({ key: "noticeText", text: "Posted from deep inside - shown up here." }),
      ).show(this.posted),
    );
  }
}

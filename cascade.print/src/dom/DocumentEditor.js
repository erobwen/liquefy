import { Component, callback, frozen, postponeInvalidations, continueInvalidations } from "@liquefy/cascade.component";
import { div } from "@liquefy/cascade.dom";
import { insertText, deleteBackward, deleteForward, splitParagraph, moveLeft, moveRight, documentStart, documentEnd } from "../editing.js";
import { caretAt, hitTest, lineStart, lineEnd, lineAbove, lineBelow } from "../positions.js";
import { paperSequenceView } from "./PaperSequenceView.js";
import { TextInput } from "./TextInput.js";

/**
 * DocumentEditor - a document you can type in: its papers on screen (see
 * PaperSequenceView), a caret dropped where you click, and the keyboard
 * editing the model at the caret. The layout follows the model, and the
 * caret follows the layout.
 *
 *   documentEditor({ document, sequence, measurer, zoom })
 *
 * `document` is the model (see PrintDocument), `sequence` the paper
 * sequence it's laid out onto - by someone else: the editor only reads it -
 * and `measurer` the one it's laid out with, for placing the caret between
 * the same characters the lines were broken at.
 *
 * The caret is a position in the model (see editing.js) - state of the
 * editor - and drawn where the layout puts it (positions.js's caretAt()).
 * Typing edits the model; the paragraph is laid out again; the caret,
 * reading the new layout, is drawn where its position now is.
 *
 * Keys: the arrows (Up and Down keep the x moving up and down began at),
 * Home and End (Ctrl/Cmd: the start and end of the document), Backspace,
 * Delete, Enter.
 */
export class DocumentEditor extends Component {
  setProperties({ document, sequence, measurer, zoom = 1, style }) {
    this.document = document;
    this.sequence = sequence;
    this.measurer = measurer;
    this.zoom = zoom;
    this.style = frozen(style || {});
  }

  initialState() {
    // caret: a position, or null before the first click. blink: counts the
    // caret's moves, restarting its blink each time.
    return { caret: null, focused: false, blink: 0 };
  }

  initialUnobservables() {
    return {
      // Created here and placed in build() as it is - this editor owns it
      // (see cascade.component/README.md on creating a sub-component
      // directly).
      input: new TextInput({ onCommand: (command) => this.command(command) }).establish(),
      // Where moving up and down began, in µm - kept while moving up and
      // down, dropped by any other move or edit.
      goalX: null,
      element: null,
    };
  }

  onDispose() {
    this.unobservable.input.dispose();
    super.onDispose();
  }

  build() {
    const { caret, focused, sequence, measurer } = this;
    const geometry = caret && focused ? caretAt(sequence, caret, measurer) : null;
    return div(
      {
        style: { position: "relative", ...this.style },
        onmousedown: callback("press", (event) => this.press(event)),
      },
      paperSequenceView({ sequence, zoom: this.zoom, caret: geometry && { ...geometry, blink: this.blink } }),
      this.unobservable.input,
    );
  }

  // A click on a paper: the caret to the place in the text nearest to it.
  press(event) {
    const paper = event.target.closest && event.target.closest("[data-page]");
    if (!paper || event.button !== 0) return;
    // Not the paper taking focus from the input - the input takes it.
    event.preventDefault();
    this.unobservable.element = event.currentTarget;
    const page = Number(paper.getAttribute("data-page"));
    const format = this.sequence.pages[page];
    const rect = paper.getBoundingClientRect();
    const x = Math.round((event.clientX - rect.left) / rect.width * format.width);
    const y = Math.round((event.clientY - rect.top) / rect.height * format.height);
    const at = hitTest(this.sequence, page, x, y, this.measurer);
    this.unobservable.input.focus();
    if (at) this.moveCaret(at);
  }

  command(command) {
    if (command.type === "focus") this.focused = true;
    else if (command.type === "blur") this.focused = false;
    if (!this.caret) return;
    if (command.type === "insert") this.edit((at) => insertText(this.document, at, command.text));
    else if (command.type === "key") this.pressKey(command);
  }

  pressKey({ key, primary }) {
    const { document, sequence, measurer } = this;
    switch (key) {
      case "Backspace": return this.edit((at) => deleteBackward(document, at));
      case "Delete": return this.edit((at) => deleteForward(document, at));
      case "Enter": return this.edit((at) => splitParagraph(document, at));
      case "ArrowLeft": return this.moveCaret(moveLeft(document, this.caret));
      case "ArrowRight": return this.moveCaret(moveRight(document, this.caret));
      case "Home": return this.moveCaret(primary ? documentStart(document) : lineStart(sequence, this.caret));
      case "End": return this.moveCaret(primary ? documentEnd(document) : lineEnd(sequence, this.caret));
      case "ArrowUp":
      case "ArrowDown": {
        const u = this.unobservable;
        if (u.goalX === null) {
          const geometry = caretAt(sequence, this.caret, measurer);
          u.goalX = geometry ? geometry.x : 0;
        }
        const move = key === "ArrowUp" ? lineAbove : lineBelow;
        return this.moveCaret(move(sequence, this.caret, u.goalX, measurer), { vertical: true });
      }
    }
  }

  // An edit at the caret: the model changed in one go - laid out once, not
  // once per write - and the caret where the edit leaves it.
  edit(change) {
    let after;
    postponeInvalidations();
    try {
      after = change(this.caret);
    } finally {
      continueInvalidations();
    }
    this.moveCaret(after);
  }

  moveCaret(at, { vertical = false } = {}) {
    if (!vertical) this.unobservable.goalX = null;
    postponeInvalidations();
    this.caret = at;
    this.blink++;
    continueInvalidations();
    this.followCaret();
  }

  // The input to the caret, so an input method opens there - and the caret
  // scrolled into view.
  followCaret() {
    const element = this.unobservable.element;
    const mark = element && element.querySelector("[data-caret]");
    if (!mark) return;
    const rect = mark.getBoundingClientRect();
    this.unobservable.input.moveTo(rect.left, rect.top);
    if (mark.scrollIntoView) mark.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
}

export function documentEditor(...parameters) {
  return new DocumentEditor(...parameters);
}

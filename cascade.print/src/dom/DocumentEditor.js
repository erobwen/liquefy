import { Component, callback, frozen, postponeInvalidations, continueInvalidations } from "@liquefy/cascade.component";
import { div } from "@liquefy/cascade.dom";
import {
  position, paragraphLength, insertText, deleteBackward, deleteForward, deleteBetween, splitParagraph,
  moveLeft, moveRight, documentStart, documentEnd, orderedRange, samePosition, wordAt,
} from "../editing.js";
import { isFormatted, toggleBold, toggleItalic, setParagraphStyle, setAlignment, toggleFirstLineIndent, paragraphFormatAt } from "../formatting.js";
import { caretAt, hitTest, selectionRects, lineStart, lineEnd, lineAbove, lineBelow } from "../positions.js";
import { paperSequenceView } from "./PaperSequenceView.js";
import { TextInput } from "./TextInput.js";

/**
 * DocumentEditor - a document you can type in: its papers on screen (see
 * PaperSequenceView), a caret dropped where you click, a selection, and the
 * keyboard editing the model there. The layout follows the model, and the
 * caret and the selection follow the layout.
 *
 *   documentEditor({ document, sequence, measurer, zoom })
 *
 * `document` is the model (see PrintDocument), `sequence` the paper
 * sequence it's laid out onto - by someone else: the editor only reads it -
 * and `measurer` the one it's laid out with, for placing the caret between
 * the same characters the lines were broken at.
 *
 * The caret and the selection are positions in the model (see editing.js)
 * - state of the editor - drawn where the layout puts them (positions.js's
 * caretAt() and selectionRects()). The selection runs from its anchor, where
 * it started, to the caret, where it's extended to: the two are the same
 * position, or there's no anchor, when nothing is selected. Typing edits the
 * model; the paragraph is laid out again; the caret, reading the new layout,
 * is drawn where its position now is.
 *
 * Selecting: drag, Shift+click, double click (a word), triple click (a
 * paragraph), Shift with any of the moving keys, Ctrl/Cmd+A (everything).
 * Typing replaces the selection, Backspace and Delete delete it, Enter
 * replaces it with a paragraph break.
 *
 * Moving: the arrows (Up and Down keep the x moving up and down began at),
 * Home and End (Ctrl/Cmd: the start and end of the document). With
 * something selected, Left and Right go to its start and end.
 *
 * Formatting (see formatting.js), for a toolbar to call - format() - and to
 * show - currentFormat(): bold and italic (also Ctrl/Cmd+B and +I) for the
 * selection, or, with nothing selected, the word the caret is in; a
 * paragraph style, an alignment and a first line indent (on or off) for
 * every paragraph the selection touches.
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
    // caret: a position, or null before the first click. anchor: where the
    // selection started - null, or the caret's position, when nothing is
    // selected. blink: counts the caret's moves, restarting its blink.
    return { caret: null, anchor: null, focused: false, blink: 0 };
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
      // While the mouse is held down: what stops following it.
      endDrag: null,
    };
  }

  onDispose() {
    const u = this.unobservable;
    if (u.endDrag) u.endDrag();
    u.input.dispose();
    super.onDispose();
  }

  hasSelection() {
    return !!this.anchor && !!this.caret && !samePosition(this.anchor, this.caret);
  }

  build() {
    const { caret, focused, sequence, measurer } = this;
    const selected = this.hasSelection();
    // With something selected, the selection shows where the caret is.
    const geometry = caret && focused && !selected ? caretAt(sequence, caret, measurer) : null;
    const selection = selected
      ? { rects: selectionRects(sequence, ...orderedRange(this.document, this.anchor, caret), measurer), focused }
      : null;
    return div(
      {
        style: { position: "relative", ...this.style },
        onmousedown: callback("press", (event) => this.press(event)),
      },
      paperSequenceView({ sequence, zoom: this.zoom, caret: geometry && { ...geometry, blink: this.blink }, selection }),
      this.unobservable.input,
    );
  }

  // A press on a paper: the caret there - or, with Shift, the selection
  // extended there; two in a row select a word, three a paragraph. Held
  // down and dragged, the selection follows the mouse.
  press(event) {
    const paper = event.target.closest && event.target.closest("[data-page]");
    if (!paper || event.button !== 0) return;
    // Not the paper taking focus from the input - the input takes it.
    event.preventDefault();
    const u = this.unobservable;
    u.element = event.currentTarget;
    const at = this.positionAtPoint(event.clientX, event.clientY);
    u.input.focus();
    if (!at) return;
    if (event.detail >= 3) {
      this.select(position(at.paragraph, 0), position(at.paragraph, paragraphLength(at.paragraph)));
    } else if (event.detail === 2) {
      const [start, end] = wordAt(at.paragraph, at.offset);
      this.select(position(at.paragraph, start), position(at.paragraph, end));
    } else {
      this.moveCaret(at, { extend: event.shiftKey && !!this.caret });
    }
    this.followMouse(event);
  }

  followMouse(event) {
    const u = this.unobservable;
    if (u.endDrag) u.endDrag();
    const doc = event.currentTarget.ownerDocument;
    const startX = event.clientX;
    const startY = event.clientY;
    const move = (moved) => {
      // A click that wobbles a pixel isn't a drag.
      if (Math.abs(moved.clientX - startX) + Math.abs(moved.clientY - startY) < 3) return;
      const at = this.positionAtPoint(moved.clientX, moved.clientY);
      if (at && !samePosition(at, this.caret)) this.moveCaret(at, { extend: true });
    };
    const end = () => {
      doc.removeEventListener("mousemove", move);
      doc.removeEventListener("mouseup", end);
      u.endDrag = null;
    };
    doc.addEventListener("mousemove", move);
    doc.addEventListener("mouseup", end);
    u.endDrag = end;
  }

  // The place in the text nearest a point on screen - on the paper it's on,
  // or, between and beside the papers, the nearest one.
  positionAtPoint(clientX, clientY) {
    const element = this.unobservable.element;
    if (!element) return null;
    let nearest = null;
    let distance = Infinity;
    for (const paper of element.querySelectorAll("[data-page]")) {
      const rect = paper.getBoundingClientRect();
      const away = Math.max(0, rect.top - clientY, clientY - rect.bottom);
      if (away < distance) {
        distance = away;
        nearest = { paper, rect };
      }
    }
    if (!nearest) return null;
    const page = Number(nearest.paper.getAttribute("data-page"));
    const format = this.sequence.pages[page];
    const { rect } = nearest;
    const clamp = (value) => Math.max(0, Math.min(1, value));
    const x = Math.round(clamp((clientX - rect.left) / rect.width) * format.width);
    const y = Math.round(clamp((clientY - rect.top) / rect.height) * format.height);
    return hitTest(this.sequence, page, x, y, this.measurer);
  }

  command(command) {
    if (command.type === "focus") this.focused = true;
    else if (command.type === "blur") this.focused = false;
    if (!this.caret) return;
    if (command.type === "insert") this.edit((at) => insertText(this.document, at, command.text));
    else if (command.type === "key") this.pressKey(command);
  }

  pressKey({ key, shift, primary }) {
    const { document, sequence } = this;
    const selected = this.hasSelection();
    switch (key) {
      case "Backspace": return this.edit(selected ? null : (at) => deleteBackward(document, at));
      case "Delete": return this.edit(selected ? null : (at) => deleteForward(document, at));
      case "Enter": return this.edit((at) => splitParagraph(document, at));
      case "SelectAll": return this.select(documentStart(document), documentEnd(document));
      case "Bold": return this.format("bold");
      case "Italic": return this.format("italic");
    }
    // Moving. Without Shift, a selection collapses: Left and Right to
    // its start and end, Up and Down from there.
    let from = this.caret;
    if (selected && !shift) {
      const [start, end] = orderedRange(document, this.anchor, this.caret);
      if (key === "ArrowLeft") return this.moveCaret(start);
      if (key === "ArrowRight") return this.moveCaret(end);
      if (key === "ArrowUp") from = start;
      if (key === "ArrowDown") from = end;
    }
    const extend = { extend: shift };
    switch (key) {
      case "ArrowLeft": return this.moveCaret(moveLeft(document, from), extend);
      case "ArrowRight": return this.moveCaret(moveRight(document, from), extend);
      case "Home": return this.moveCaret(primary ? documentStart(document) : lineStart(sequence, from), extend);
      case "End": return this.moveCaret(primary ? documentEnd(document) : lineEnd(sequence, from), extend);
      case "ArrowUp":
      case "ArrowDown": {
        const u = this.unobservable;
        if (u.goalX === null) {
          const geometry = caretAt(sequence, from, this.measurer);
          u.goalX = geometry ? geometry.x : 0;
        }
        const move = key === "ArrowUp" ? lineAbove : lineBelow;
        return this.moveCaret(move(sequence, from, u.goalX, this.measurer), { ...extend, vertical: true });
      }
    }
  }

  // Formatting, as a toolbar asks for it: "bold" and "italic" toggled,
  // "style" and "align" set to `value`, "firstLineIndent" toggled (to
  // `value` µm, if given, when on). The keyboard goes back to the
  // text - a toolbar button clicked has just taken it.
  format(kind, value) {
    if (!this.caret) return;
    const { document } = this;
    postponeInvalidations();
    try {
      if (kind === "bold" || kind === "italic") {
        const range = this.textRange();
        if (range) (kind === "bold" ? toggleBold : toggleItalic)(document, ...range);
      } else if (kind === "style") {
        setParagraphStyle(document, this.anchor || this.caret, this.caret, value);
      } else if (kind === "align") {
        setAlignment(document, this.anchor || this.caret, this.caret, value);
      } else if (kind === "firstLineIndent") {
        toggleFirstLineIndent(document, this.anchor || this.caret, this.caret, value);
      }
    } finally {
      continueInvalidations();
    }
    this.unobservable.input.focus();
    this.followCaret();
  }

  // What's formatted how at the caret, for a toolbar: { bold, italic,
  // style, align, firstLineIndent } - bold and italic for all of the
  // selection, the rest for the paragraph the caret is in - or null
  // before there's a caret.
  currentFormat() {
    const { caret, document } = this;
    if (!caret) return null;
    const anchor = this.hasSelection() ? this.anchor : caret;
    return {
      bold: isFormatted(document, anchor, caret, (font) => font.weight >= 600),
      italic: isFormatted(document, anchor, caret, (font) => !!font.italic),
      ...paragraphFormatAt(document, caret),
    };
  }

  // What bold and italic apply to: the selection - or, with nothing
  // selected, the word the caret is inside (not at either end of), as in
  // Word. Null if neither.
  textRange() {
    if (this.hasSelection()) return [this.anchor, this.caret];
    const { paragraph, offset } = this.caret;
    const [start, end] = wordAt(paragraph, offset);
    return start < offset && offset < end ? [position(paragraph, start), position(paragraph, end)] : null;
  }

  // An edit at the caret - what's selected taken out first, and the edit
  // made where it was. The model changed in one go - laid out once, not
  // once per write - and the caret where the edit leaves it.
  edit(change) {
    let after;
    postponeInvalidations();
    try {
      let at = this.caret;
      if (this.hasSelection()) at = deleteBetween(this.document, this.anchor, this.caret);
      after = change ? change(at) : at;
    } finally {
      continueInvalidations();
    }
    this.moveCaret(after);
  }

  // The caret to `at`: the selection collapsed there - or, extending,
  // stretched from its anchor (where the caret was, if nothing was
  // selected) to there.
  moveCaret(at, { extend = false, vertical = false } = {}) {
    if (!vertical) this.unobservable.goalX = null;
    postponeInvalidations();
    if (!extend) this.anchor = null;
    else if (!this.anchor) this.anchor = this.caret;
    this.caret = at;
    this.blink++;
    continueInvalidations();
    this.followCaret();
  }

  select(anchor, focus) {
    if (!anchor || !focus) return;
    this.unobservable.goalX = null;
    postponeInvalidations();
    this.anchor = anchor;
    this.caret = focus;
    this.blink++;
    continueInvalidations();
    this.followCaret();
  }

  // The input to the caret - or the selection's end - so an input method
  // opens there, and it scrolled into view.
  followCaret() {
    const element = this.unobservable.element;
    if (!element) return;
    const marks = element.querySelectorAll("[data-caret], [data-selection]");
    const mark = this.hasSelection() ? this.focusEndOf(marks) : marks[0];
    if (!mark) return;
    const rect = mark.getBoundingClientRect();
    this.unobservable.input.moveTo(rect.left, rect.top);
    if (mark.scrollIntoView) mark.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  // The highlight the caret end of the selection is in: the last one if the
  // selection was extended forward, the first if backward.
  focusEndOf(marks) {
    const [start] = orderedRange(this.document, this.anchor, this.caret);
    return start === this.anchor ? marks[marks.length - 1] : marks[0];
  }
}

export function documentEditor(...parameters) {
  return new DocumentEditor(...parameters);
}

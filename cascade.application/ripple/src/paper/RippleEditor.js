import { Component, callback, frozen, postponeInvalidations, continueInvalidations } from "@liquefy/cascade.component";
import { div } from "@liquefy/cascade.dom";
import { TextInput } from "@liquefy/cascade.print/dom";
import { samePosition, isGap } from "../model/parts.js";
import { caretRows } from "./markers.js";
import {
  caretAt, hitTest, selectionRects, lineStart, lineEnd, rowAbove, rowBelow, stepLeft, stepRight,
  sequenceStart, sequenceEnd, orderedRange,
} from "./positions.js";
import { ripplePaperView } from "./RipplePaperView.js";

/**
 * RippleEditor - Ripple's papers with a caret: cascade.print's PaperEditor,
 * made for Ripple's document - its caret moves through every place in it,
 * the text and the gaps between its parts at every level (see markers.js,
 * positions.js), and a gap's caret is a horizontal bar across the text area.
 *
 *   rippleEditor({ sequence, root, measurer, editing, zoom, showAllAreas })
 *
 * `sequence` is the paper sequence the document is laid out onto - by
 * someone else: the editor only reads it - `root` the document's root (the
 * sequence of documents, see ../model/parts.js), and `measurer` the one it's
 * laid out with, for placing the caret between the same characters the lines
 * were broken at.
 *
 * At a gap, the gap's area - what it stands for (see markers.js) - is drawn
 * under the text: the room between two siblings, or the part a list starts
 * or ends with. `showAllAreas` draws every gap's at once, to see them all.
 *
 * The caret and the selection are positions (see ../model/parts.js) - in a
 * paragraph's text, or a gap - state of the editor, drawn where the layout
 * puts them. Moving the caret is moving through the document's caret rows,
 * in reading order. What an edit does is the model's business, given as
 * `editing`, every function taking and returning positions:
 *
 *   {
 *     insertText(at, text),          // typed - with "\n" for a paragraph break
 *     deleteBackward(at), deleteForward(at), splitParagraph(at),
 *     deleteBetween(anchor, focus),  // a selection, either way round
 *     wordAt(at), paragraphAt(at),   // [start, end] around a position
 *   }
 *
 * Every one returns the position after it - where the caret goes. Without
 * `editing`, the editor is a caret only: it moves and selects, and nothing
 * typed changes anything.
 *
 * Selecting: drag, Shift+click, double click (a word), triple click (a
 * paragraph), Shift with any of the moving keys, Ctrl/Cmd+A (everything).
 *
 * Moving: the arrows - Left and Right through every place, Up and Down from
 * row to row, a gap's marker a row of its own (Up and Down keep the x moving
 * began at, on lines) - and Home and End (Ctrl/Cmd: the start and end of
 * everything). With something selected, Left and Right go to its start and
 * end.
 *
 * For whatever else changes the model around the caret - a toolbar:
 * selection() tells what's selected, apply(change) makes a change in one go
 * and gives the keyboard back to the text. And `shortcuts` - { b: "Bold" }:
 * Ctrl/Cmd plus a key, handed to `onShortcut(name)`.
 */
export class RippleEditor extends Component {
  setProperties({ sequence, root, measurer, editing, zoom = 1, shortcuts, onShortcut, showAllAreas = false, style }) {
    this.sequence = sequence;
    this.root = root;
    this.showAllAreas = !!showAllAreas;
    this.measurer = measurer;
    this.editing = editing;
    this.zoom = zoom;
    this.shortcuts = frozen(shortcuts || {});
    this.onShortcut = onShortcut || null;
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
      input: new TextInput({
        onCommand: (command) => this.command(command),
        shortcutFor: (key) => this.shortcutFor(key),
      }).establish(),
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

  // Where the caret can be, now: every line and gap, in reading order.
  rows() {
    return caretRows(this.sequence, this.root);
  }

  hasSelection() {
    return !!this.anchor && !!this.caret && !samePosition(this.anchor, this.caret);
  }

  // What's selected: { anchor, focus, selected } - with nothing selected,
  // both at the caret. Null before there's a caret.
  selection() {
    if (!this.caret) return null;
    const selected = this.hasSelection();
    return { anchor: selected ? this.anchor : this.caret, focus: this.caret, selected };
  }

  // A change made around the caret from outside the text - a toolbar's: in
  // one go, laid out once. The keyboard goes back to the text - a toolbar
  // button clicked has just taken it - and the caret is followed.
  apply(change) {
    postponeInvalidations();
    try {
      change();
    } finally {
      continueInvalidations();
    }
    this.unobservable.input.focus();
    this.followCaret();
  }

  build() {
    const { caret, focused, sequence, measurer } = this;
    const selected = this.hasSelection();
    const rows = caret || this.showAllAreas ? this.rows() : [];
    const areas = this.showAllAreas ? rows.flatMap(({ row }) => row.area || []) : this.areaAtCaret(rows);
    // With something selected, the selection shows where the caret is.
    const geometry = caret && focused && !selected ? caretAt(rows, caret, measurer) : null;
    const selection = selected
      ? { rects: selectionRects(rows, ...orderedRange(rows, this.anchor, caret), measurer), focused }
      : null;
    return div(
      {
        style: { position: "relative", ...this.style },
        onmousedown: callback("press", (event) => this.press(event)),
      },
      ripplePaperView({ sequence, zoom: this.zoom, caret: geometry && { ...geometry, blink: this.blink }, selection, areas }),
      this.unobservable.input,
    );
  }

  // The area of the gap the caret is at - none in the text.
  areaAtCaret(rows) {
    const caret = this.caret;
    if (!caret || !isGap(caret) || this.hasSelection()) return [];
    const found = rows.find(({ row }) => "gap" in row && samePosition(row.gap, caret));
    return found ? found.row.area : [];
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
    const editing = this.editing;
    if (event.detail >= 3 && editing && editing.paragraphAt) this.select(...editing.paragraphAt(at));
    else if (event.detail === 2 && editing && editing.wordAt) this.select(...editing.wordAt(at));
    else this.moveCaret(at, { extend: event.shiftKey && !!this.caret });
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
    return hitTest(this.rows(), page, x, y, this.measurer);
  }

  // What Ctrl/Cmd plus `key` is - Ctrl+A selects everything; the rest are
  // whoever placed the editor's (`shortcuts`).
  shortcutFor(key) {
    return key === "a" ? "SelectAll" : this.shortcuts[key];
  }

  command(command) {
    if (command.type === "focus") this.focused = true;
    else if (command.type === "blur") this.focused = false;
    if (!this.caret) return;
    if (command.type === "insert") {
      if (this.editing) this.edit((at) => this.editing.insertText(at, command.text));
    }
    else if (command.type === "key") this.pressKey(command);
  }

  pressKey({ key, shift, primary }) {
    const { editing } = this;
    const selected = this.hasSelection();
    const rows = this.rows();
    switch (key) {
      case "Backspace": return editing && this.edit(selected ? null : (at) => editing.deleteBackward(at));
      case "Delete": return editing && this.edit(selected ? null : (at) => editing.deleteForward(at));
      case "Enter": return editing && this.edit((at) => editing.splitParagraph(at));
      case "SelectAll": return this.select(sequenceStart(rows), sequenceEnd(rows));
    }
    // Moving. Without Shift, a selection collapses: Left and Right to
    // its start and end, Up and Down from there.
    let from = this.caret;
    if (selected && !shift) {
      const [start, end] = orderedRange(rows, this.anchor, this.caret);
      if (key === "ArrowLeft") return this.moveCaret(start);
      if (key === "ArrowRight") return this.moveCaret(end);
      if (key === "ArrowUp") from = start;
      if (key === "ArrowDown") from = end;
    }
    const extend = { extend: shift };
    switch (key) {
      case "ArrowLeft": return this.moveCaret(stepLeft(rows, from), extend);
      case "ArrowRight": return this.moveCaret(stepRight(rows, from), extend);
      case "Home": return this.moveCaret(primary ? sequenceStart(rows) : lineStart(rows, from), extend);
      case "End": return this.moveCaret(primary ? sequenceEnd(rows) : lineEnd(rows, from), extend);
      case "ArrowUp":
      case "ArrowDown": {
        const u = this.unobservable;
        if (u.goalX === null) {
          const geometry = caretAt(rows, from, this.measurer);
          u.goalX = geometry ? geometry.x : 0;
        }
        const move = key === "ArrowUp" ? rowAbove : rowBelow;
        return this.moveCaret(move(rows, from, u.goalX, this.measurer), { ...extend, vertical: true });
      }
    }
    // Anything else is a shortcut of whoever placed the editor.
    if (this.onShortcut) this.onShortcut(key);
  }

  // An edit at the caret - what's selected taken out first, and the edit
  // made where it was. The model changed in one go - laid out once, not
  // once per write - and the caret where the edit leaves it.
  edit(change) {
    let after;
    postponeInvalidations();
    try {
      let at = this.caret;
      if (this.hasSelection()) at = this.editing.deleteBetween(this.anchor, this.caret);
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
    const [start] = orderedRange(this.rows(), this.anchor, this.caret);
    return start === this.anchor ? marks[marks.length - 1] : marks[0];
  }
}

export function rippleEditor(...parameters) {
  return new RippleEditor(...parameters);
}

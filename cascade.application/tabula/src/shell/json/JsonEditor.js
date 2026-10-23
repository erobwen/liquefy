import { Component, callback, frozen } from "@liquefy/cascade.component";
import { div, span, text, button as htmlButton } from "@liquefy/cascade.dom";
import {
  jsonText, pathKey, stopKey, valueAt, setAt, removeAt, duplicateAt, moveAt, itemPathAround,
} from "./jsonText.js";

/**
 * JsonEditor - the JSON mode: the whole root (see ../documents.js) as JSON,
 * and edited as JSON - but not as free text. The text is written from the
 * JSON (jsonText.js), and the caret goes only where it says - into strings
 * and numbers, onto true, false and null, before every array item and
 * property - and does only what's defined there:
 *
 *   typing, Backspace, Delete, Enter   in a string or a number
 *   Space or Enter                     on true or false: toggled
 *   Delete or Backspace                before an item or a property: removed
 *   Ctrl+D                             the item the caret is in, duplicated
 *   Alt+Up, Alt+Down                   the item the caret is in, moved
 *   arrows, Home, End, a click         moving the caret between its places
 *
 * Every change is handed to `apply(json)` - the app hydrates it through the
 * plugins (see ../TabulaApp.js) - which says what's wrong with it, or
 * nothing, if it's taken. What isn't taken never gets in: the JSON can't
 * be made into anything its plugins can't hold. What's shown is always
 * what the documents are, written again - a property no plugin keeps is
 * gone at once, one it can't do without back.
 *
 * But for typing: a string or a number half typed - "lett" on the way to
 * "letter", "1." to "1.5" - is kept as a draft, shown, wavy, where the
 * value is, until it's taken, or the caret leaves it (then it's dropped).
 *
 *   jsonEditor({ json, apply, zoom })
 */
export class JsonEditor extends Component {
  setProperties({ json, apply, zoom = 1 }) {
    this.json = frozen(json);
    this.apply = apply;
    this.zoom = zoom;
  }

  initialState() {
    // caret: { path, kind, offset } - a stop (see jsonText.js), or null.
    // drafts: path key to text. message: why the last change wasn't taken.
    return { caret: null, drafts: frozen({}), message: null, focused: false };
  }

  initialUnobservables() {
    // Where the caret was among the stops - for when what it was at is gone
    // - and the column it's going up and down along.
    return { lastIndex: 0, goalColumn: null };
  }

  // The text, and where the caret is in it: its stop, or - if that's gone -
  // the one in its place.
  layout() {
    const { lines, stops } = jsonText(this.json, { drafts: new Map(Object.entries(this.drafts)) });
    let index = -1;
    if (this.caret) {
      const key = stopKey(this.caret);
      index = stops.findIndex((each) => stopKey(each) === key);
      if (index < 0) index = Math.min(this.unobservable.lastIndex, stops.length - 1);
    }
    return { lines, stops, index };
  }

  moveTo(stop, { keepGoal = false } = {}) {
    if (!stop) return;
    if (!keepGoal) this.unobservable.goalColumn = null;
    // Left: a draft not taken is dropped.
    const leaving = this.caret && pathKey(this.caret.path) !== pathKey(stop.path);
    if (leaving && Object.keys(this.drafts).length > 0) this.drafts = frozen({});
    this.caret = frozen({ path: stop.path, kind: stop.kind, offset: stop.offset });
    this.message = null;
  }

  // A change, handed on - taken, or why not.
  change(json, caret) {
    const error = this.apply(json);
    if (error) {
      this.message = error;
      return false;
    }
    this.drafts = frozen({});
    this.message = null;
    if (caret) this.caret = frozen(caret);
    return true;
  }

  // A string's or a number's new text, typed: taken as its value if it is
  // one, kept as a draft if not.
  typeText(stop, newText, offset) {
    const value = valueAt(this.json, stop.path);
    const key = pathKey(stop.path);
    const caret = { path: stop.path, kind: "text", offset };
    if (typeof(value) === "number") {
      if (numberPattern.test(newText) && this.change(setAt(this.json, stop.path, Number(newText)), caret)) return;
    } else if (this.change(setAt(this.json, stop.path, newText), caret)) {
      return;
    }
    this.drafts = frozen({ [key]: newText });
    this.caret = frozen(caret);
  }

  textAt(stop) {
    const draft = this.drafts[pathKey(stop.path)];
    return typeof(draft) === "string" ? draft : String(valueAt(this.json, stop.path));
  }

  // The operations on the item the caret is in (itemPathAround()).
  removeItem(path) {
    const parentPath = path.slice(0, -1);
    const parent = valueAt(this.json, parentPath);
    const index = path[path.length - 1];
    const next = parent instanceof Array && parent.length > 1 ? [...parentPath, Math.min(index, parent.length - 2)] : parentPath;
    this.change(removeAt(this.json, path), { path: next, kind: "node", offset: 0 });
  }

  duplicateItem(path) {
    const index = path[path.length - 1];
    this.change(duplicateAt(this.json, path), { path: [...path.slice(0, -1), index + 1], kind: "node", offset: 0 });
  }

  moveItem(path, by) {
    const index = path[path.length - 1];
    const moved = [...path.slice(0, -1), index + by];
    // The caret moves with the item - at the same place in it.
    const caret = this.caret && { ...this.caret, path: [...moved, ...this.caret.path.slice(path.length)] };
    this.change(moveAt(this.json, path, by), caret);
  }

  toggle(path) {
    this.change(setAt(this.json, path, !valueAt(this.json, path)), { path, kind: "atom", offset: 0 });
  }

  keyDown(event) {
    const { stops, index } = this.layout();
    if (stops.length === 0) return;
    const stop = stops[Math.max(index, 0)];
    this.unobservable.lastIndex = Math.max(index, 0);
    const handled = () => event.preventDefault();
    const control = event.ctrlKey || event.metaKey;
    const item = itemPathAround(this.json, stop.path);

    if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      if (item) this.moveItem(item, event.key === "ArrowUp" ? -1 : 1);
      return handled();
    }
    if (control && event.key.toLowerCase() === "d") {
      if (item) this.duplicateItem(item);
      return handled();
    }
    switch (event.key) {
      case "ArrowLeft": this.moveTo(stops[Math.max(0, index - 1)]); return handled();
      case "ArrowRight": this.moveTo(stops[Math.min(stops.length - 1, index + 1)]); return handled();
      case "ArrowUp": case "ArrowDown": {
        const goal = this.unobservable.goalColumn ?? stop.column;
        this.unobservable.goalColumn = goal;
        this.moveTo(stopOnLine(stops, stop.line, event.key === "ArrowUp" ? -1 : 1, goal), { keepGoal: true });
        return handled();
      }
      case "Home": this.moveTo(stops.find((each) => each.line === stop.line)); return handled();
      case "End": this.moveTo([...stops].reverse().find((each) => each.line === stop.line)); return handled();
      case "Escape": this.drafts = frozen({}); this.message = null; return handled();
    }
    if (stop.kind === "text") {
      const current = this.textAt(stop);
      if (event.key === "Backspace") {
        if (stop.offset > 0) this.typeText(stop, current.slice(0, stop.offset - 1) + current.slice(stop.offset), stop.offset - 1);
        return handled();
      }
      if (event.key === "Delete") {
        if (stop.offset < current.length) this.typeText(stop, current.slice(0, stop.offset) + current.slice(stop.offset + 1), stop.offset);
        return handled();
      }
      const typed = event.key === "Enter" ? "\n" : event.key.length === 1 && !control ? event.key : null;
      if (typed !== null) {
        // A line break only in a string.
        if (typed === "\n" && typeof(valueAt(this.json, stop.path)) !== "string") return handled();
        this.typeText(stop, current.slice(0, stop.offset) + typed + current.slice(stop.offset), stop.offset + 1);
        return handled();
      }
      return;
    }
    if (stop.kind === "atom" && (event.key === " " || event.key === "Enter")) {
      if (typeof(valueAt(this.json, stop.path)) === "boolean") this.toggle(stop.path);
      return handled();
    }
    // Before an item or a property - or on one that's an atom in an array.
    if (event.key === "Delete" || event.key === "Backspace") {
      if (stop.path.length > 0) this.removeItem(stop.path);
      return handled();
    }
  }

  // A click: the caret to the stop nearest it, on the line clicked.
  press(event) {
    event.currentTarget.focus();
    const line = event.target.closest && event.target.closest("[data-line]");
    if (!line) return;
    event.preventDefault();
    const lineIndex = Number(line.getAttribute("data-line"));
    let column = Infinity;
    const doc = event.target.ownerDocument;
    const range = doc.caretRangeFromPoint ? doc.caretRangeFromPoint(event.clientX, event.clientY)
      : doc.caretPositionFromPoint ? toRange(doc.caretPositionFromPoint(event.clientX, event.clientY)) : null;
    const token = range && range.startContainer && range.startContainer.parentElement && range.startContainer.parentElement.closest("[data-column]");
    if (token && line.contains(token)) column = Number(token.getAttribute("data-column")) + range.startOffset;
    const { stops } = this.layout();
    const onLine = stops.filter((each) => each.line === lineIndex);
    const candidates = onLine.length > 0 ? onLine : [stopOnLine(stops, lineIndex, 1, 0) || stopOnLine(stops, lineIndex, -1, 0)].filter(Boolean);
    this.moveTo(nearest(candidates, column));
  }

  build() {
    const { lines, stops, index } = this.layout();
    const stop = index >= 0 ? stops[index] : null;
    return div(
      { style: { zoom: this.zoom } },
      div(
        { style: sheetStyle },
        this.toolbar(stop),
        div(
          {
            tabindex: 0,
            onkeydown: callback("keyDown", (event) => this.keyDown(event)),
            onmousedown: callback("press", (event) => this.press(event)),
            onfocus: callback("focus", () => { this.focused = true; }),
            onblur: callback("blur", () => { this.focused = false; }),
            style: { ...codeStyle, outline: "none", padding: "12px 0", cursor: "text" },
          },
          lines.map((line, lineIndex) => jsonLine({
            line: lineIndex,
            tokens: line.tokens,
            caret: stop && stop.line === lineIndex ? { column: stop.column, kind: stop.kind, focused: this.focused } : null,
          })),
        ),
      ),
    );
  }

  // Above the text: where the caret is - its path - what can be done there,
  // and why the last change wasn't taken.
  toolbar(stop) {
    const json = this.json;
    const item = stop && itemPathAround(json, stop.path);
    const parent = item && valueAt(json, item.slice(0, -1));
    const index = item ? item[item.length - 1] : 0;
    const atom = stop && stop.kind === "atom" ? valueAt(json, stop.path) : undefined;
    return div(
      { style: toolbarStyle },
      div(
        { style: { display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" } },
        div({ style: { flex: "1 1 auto", fontFamily: codeStyle.fontFamily, fontSize: "12px", color: colors.quiet, minWidth: 0, overflowWrap: "anywhere" } },
          text(stop ? describePath(stop.path) : "Click in the JSON to place the caret.")),
        typeof(atom) === "boolean" ? tool("Toggle", "Space", () => this.toggle(stop.path)) : null,
        item ? tool("Remove", "Delete", () => this.removeItem(item)) : null,
        item ? tool("Duplicate", "Ctrl+D", () => this.duplicateItem(item)) : null,
        item ? tool("Up", "Alt+↑", () => this.moveItem(item, -1), index === 0) : null,
        item ? tool("Down", "Alt+↓", () => this.moveItem(item, 1), index >= parent.length - 1) : null,
      ),
      this.message ? div({ style: { color: colors.error, fontSize: "12px", marginTop: "4px" } }, text("Not taken: " + this.message)) : null,
    );
  }
}

// A button for an operation - clicked without taking the focus from the text.
function tool(label, keys, action, disabled = false) {
  return htmlButton(
    {
      key: label,
      title: label + " (" + keys + ")",
      disabled,
      onmousedown: (event) => event.preventDefault(),
      onclick: action,
      style: {
        font: "inherit", fontSize: "12px", padding: "2px 8px", borderRadius: "4px", border: "1px solid #dadce0",
        background: "white", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.45 : 1,
      },
    },
    text(label),
  );
}

// A line of the text - only the lines the caret leaves or enters build
// again when it moves.
class JsonLine extends Component {
  setProperties({ line, tokens, caret }) {
    this.line = line;
    this.tokens = frozen(tokens);
    this.caret = frozen(caret);
  }

  build() {
    const { caret } = this;
    const parts = [];
    let placed = !caret;
    for (const token of this.tokens) {
      const start = token.column;
      const end = start + token.text.length;
      const style = tokenStyles[token.kind] || {};
      if (!placed && caret.kind === "atom" && caret.column === start) {
        parts.push(span({ "data-column": start, style: { ...style, ...atomCaretStyle(caret.focused) } }, text(token.text)));
        placed = true;
      } else if (!placed && caret.column >= start && caret.column < end && token.kind !== "space") {
        const at = caret.column - start;
        if (at > 0) parts.push(span({ "data-column": start, style }, text(token.text.slice(0, at))));
        parts.push(caretBar(caret.focused));
        parts.push(span({ "data-column": caret.column, style }, text(token.text.slice(at))));
        placed = true;
      } else {
        parts.push(span({ "data-column": start, style }, text(token.text)));
      }
    }
    if (!placed) parts.push(caretBar(caret.focused));
    return div({ "data-line": this.line, style: { whiteSpace: "pre-wrap", overflowWrap: "anywhere", padding: "0 16px", minHeight: "1.6em" } }, parts);
  }
}

const jsonLine = (...parameters) => new JsonLine(...parameters);

const caretBar = (focused) => span({
  style: {
    display: "inline-block", width: 0, height: "1.25em", verticalAlign: "text-bottom", marginRight: "-2px",
    borderLeft: "2px solid " + (focused ? colorsCaret : "#9aa0a6"),
  },
});

const atomCaretStyle = (focused) => ({ outline: "2px solid " + (focused ? colorsCaret : "#9aa0a6"), outlineOffset: "1px", borderRadius: "2px" });

// The stop on the nearest line above (-1) or below (1) `line` that has
// any, nearest `column`.
function stopOnLine(stops, line, direction, column) {
  const lines = [...new Set(stops.map((each) => each.line))].filter((each) => direction < 0 ? each < line : each > line);
  if (lines.length === 0) return null;
  const target = direction < 0 ? Math.max(...lines) : Math.min(...lines);
  return nearest(stops.filter((each) => each.line === target), column);
}

function nearest(stops, column) {
  let best = null;
  for (const each of stops) {
    if (!best || Math.abs(each.column - column) < Math.abs(best.column - column)) best = each;
  }
  return best;
}

function toRange(position) {
  return position && { startContainer: position.offsetNode, startOffset: position.offset };
}

// root › 1 › properties › children › 3
function describePath(path) {
  return ["root", ...path.map((key) => typeof(key) === "number" ? "[" + key + "]" : key)].join(" › ");
}

// A JSON number - nothing half typed.
const numberPattern = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/;

const colorsCaret = "#1a73e8";
const colors = { key: "#881391", string: "#c41a16", number: "#1a1aa6", plain: "#303942", quiet: "#80868b", error: "#b3261e" };
const tokenStyles = {
  key: { color: colors.key },
  string: { color: colors.string },
  number: { color: colors.number },
  boolean: { color: colors.number },
  null: { color: colors.quiet },
  punctuation: { color: colors.plain },
  draft: { color: colors.string, textDecoration: "underline wavy " + colors.error },
};
const codeStyle = { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", fontSize: "13px", lineHeight: 1.6, color: colors.plain };
const sheetStyle = {
  width: "100%", boxSizing: "border-box", background: "white", borderRadius: "8px", border: "1px solid #dadce0",
  boxShadow: "0 1px 4px rgba(0, 0, 0, 0.08)", overflow: "visible",
};
const toolbarStyle = {
  position: "sticky", top: 0, zIndex: 1, padding: "8px 16px", background: "#f1f3f4", borderBottom: "1px solid #dadce0",
  borderRadius: "8px 8px 0 0",
};

export const jsonEditor = (...parameters) => new JsonEditor(...parameters);

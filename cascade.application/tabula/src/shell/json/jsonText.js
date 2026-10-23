/**
 * JSON as text with places for a caret - the JSON mode's text buffer (see
 * JsonEditor.js). Not text to edit freely: the text is written from the
 * JSON, every node adding its characters to it, and the places where a
 * caret can be - its stops - are given by the nodes too:
 *
 *  - a node stop, before every node that can go: an array's items, an
 *    object's properties (`kind: "node"`) - for removing, duplicating,
 *    moving it;
 *  - in a string or a number, before every character and after the last
 *    (`kind: "text"`, `offset`) - for typing;
 *  - on true, false and null (`kind: "atom"`) - true and false are
 *    toggled.
 *
 * A stop is where it is in the text - `line` and `column` - and what it's
 * at: `path`, the keys and indices from the root to its node.
 *
 *   jsonText(json, { drafts }) -> { lines: [{ tokens: [{ text, kind, column }] }], stops }
 *
 * `drafts` - path key (pathKey()) to text - shows a string or number being
 * typed, not yet a value of its own (see JsonEditor.js's drafts), instead
 * of the value.
 *
 * Objects and arrays holding only short values are written on one line;
 * the rest one node a line, indented, as JSON.stringify(json, null, 2)
 * writes them.
 */
export function jsonText(json, { drafts = new Map() } = {}) {
  const lines = [];
  const stops = [];
  let tokens = [];
  let column = 0;
  let indent = 0;

  const emit = (text, kind) => {
    tokens.push({ text, kind, column });
    column += text.length;
  };
  const newLine = () => {
    lines.push({ tokens });
    tokens = [];
    column = 0;
    emit("  ".repeat(indent), "space");
  };
  const stop = (path, kind, offset = 0) => stops.push({ path, kind, offset, line: lines.length, column: column + (kind === "text" ? offset : 0) });

  const write = (value, path, ownStop) => {
    const draft = drafts.get(pathKey(path));
    if (typeof(draft) === "string") {
      if (ownStop) stop(path, "node");
      const quoted = typeof(value) === "string";
      if (quoted) emit("\"", "string");
      for (let offset = 0; offset <= draft.length; offset++) stop(path, "text", offset);
      emit(visible(draft), "draft");
      if (quoted) emit("\"", "string");
    } else if (typeof(value) === "string") {
      if (ownStop) stop(path, "node");
      emit("\"", "string");
      for (let offset = 0; offset <= value.length; offset++) stop(path, "text", offset);
      emit(visible(value), "string");
      emit("\"", "string");
    } else if (typeof(value) === "number") {
      if (ownStop) stop(path, "node");
      const text = String(value);
      for (let offset = 0; offset <= text.length; offset++) stop(path, "text", offset);
      emit(text, "number");
    } else if (value === null || typeof(value) === "boolean") {
      // A node stop and an atom stop would be at the same place: the atom's
      // does for both.
      stop(path, "atom");
      emit(String(value), value === null ? "null" : "boolean");
    } else {
      if (ownStop) stop(path, "node");
      const array = value instanceof Array;
      const entries = array ? value.map((each, index) => [index, each]) : Object.entries(value);
      const [open, close] = array ? ["[", "]"] : ["{", "}"];
      if (entries.length === 0) return emit(open + close, "punctuation");
      const inline = fitsOnALine(value);
      emit(open, "punctuation");
      if (!inline) indent++;
      entries.forEach(([key, each], index) => {
        if (inline) emit(index === 0 ? " " : ", ", "punctuation");
        else newLine();
        const at = [...path, key];
        if (!array) {
          stop(at, "node");
          emit(JSON.stringify(key), "key");
          emit(": ", "punctuation");
        }
        // An item's own stop is before it; a property's, before its key.
        write(each, at, array);
        if (!inline && index < entries.length - 1) emit(",", "punctuation");
      });
      if (inline) emit(" " + close, "punctuation");
      else {
        indent--;
        newLine();
        emit(close, "punctuation");
      }
    }
  };

  write(json, [], false);
  lines.push({ tokens });
  return { lines, stops };
}

// What can't be seen, shown - one character for one, so a column is an offset.
const visible = (text) => text.replace(/\n/g, "↵").replace(/\t/g, "→");

function fitsOnALine(value) {
  const children = value instanceof Array ? value : Object.values(value);
  return children.every((each) => each === null || typeof(each) !== "object") && JSON.stringify(value).length <= 64;
}

export const pathKey = (path) => JSON.stringify(path);
export const stopKey = (stop) => pathKey(stop.path) + "|" + stop.kind + "|" + stop.offset;

export function valueAt(json, path) {
  return path.reduce((value, key) => value[key], json);
}

// The JSON with the value at `path` replaced - all else the same objects.
export function setAt(json, path, value) {
  if (path.length === 0) return value;
  const [key, ...rest] = path;
  const copy = json instanceof Array ? [...json] : { ...json };
  copy[key] = setAt(json[key], rest, value);
  return copy;
}

export function removeAt(json, path) {
  const parent = valueAt(json, path.slice(0, -1));
  const key = path[path.length - 1];
  if (parent instanceof Array) return setAt(json, path.slice(0, -1), parent.filter((_, index) => index !== key));
  const { [key]: removed, ...rest } = parent;
  return setAt(json, path.slice(0, -1), rest);
}

export function duplicateAt(json, path) {
  const parent = valueAt(json, path.slice(0, -1));
  const index = path[path.length - 1];
  return setAt(json, path.slice(0, -1), [...parent.slice(0, index + 1), structuredClone(parent[index]), ...parent.slice(index + 1)]);
}

export function moveAt(json, path, by) {
  const parent = valueAt(json, path.slice(0, -1));
  const index = path[path.length - 1];
  const to = index + by;
  if (to < 0 || to >= parent.length) return json;
  const items = [...parent];
  [items[index], items[to]] = [items[to], items[index]];
  return setAt(json, path.slice(0, -1), items);
}

// The innermost array item at or around `path` - what's removed,
// duplicated and moved from there - or null.
export function itemPathAround(json, path) {
  for (let length = path.length; length > 0; length--) {
    if (valueAt(json, path.slice(0, length - 1)) instanceof Array) return path.slice(0, length);
  }
  return null;
}

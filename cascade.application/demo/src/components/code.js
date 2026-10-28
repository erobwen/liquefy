import { Component, callback } from "@liquefy/cascade.component";
import { DOMNodeComponent } from "@liquefy/cascade.dom";
import { overlay, modalAssembly, iconButton, dialog } from "@liquefy/cascade.ui";
import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import xml from "highlight.js/lib/languages/xml";
import bash from "highlight.js/lib/languages/bash";
import plaintext from "highlight.js/lib/languages/plaintext";
import "highlight.js/styles/github.css";

hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("plaintext", plaintext);

/**
 * Showing a page's own source code - ported from
 * flow.application/demo/src/components/information.js's DisplayCodeButton /
 * CodeDisplay.
 */

// Source, syntax highlighted - JavaScript, or `language`: "html", "bash" or "plaintext": a <pre><code> whose content is
// highlight.js's HTML. A node of its own rather than a code() tag, since
// that HTML has to go in as innerHTML - which element properties can't
// set (DOMElementComponent lowercases every property name, and
// element.innerhtml is nothing). Highlighted again only when the source
// (or what's marked in it) changes.
//
// `marks`: what to draw attention to, as with a highlighter pen - each
// { call: "name" }, every call of that function, from its name to its
// closing parenthesis, or { text: "..." }, every occurrence of that text.
// `markStyle` is how a mark looks - a yellow marker by default.
export class HighlightedCode extends DOMNodeComponent {
  setProperties({ source, language, marks, markStyle, style }) {
    this.source = source || "";
    this.language = language || "javascript";
    this.marks = marks || [];
    this.markStyle = markStyle || null;
    this.style = style || null;
  }

  ensureNode() {
    const u = this.unobservable;
    if (!u.node) {
      u.node = document.createElement("pre");
      u.node.style.margin = "0";
      u.code = document.createElement("code");
      u.code.className = "hljs language-" + this.language;
      Object.assign(u.code.style, { display: "inline-block", minWidth: "100%", boxSizing: "border-box", padding: "15px", fontSize: "14px", userSelect: "text" });
      u.node.appendChild(u.code);
    }
    const highlighted = JSON.stringify([this.source, this.marks, this.markStyle]);
    if (u.highlighted !== highlighted) {
      u.code.innerHTML = hljs.highlight(this.source, { language: this.language }).value;
      markRanges(u.code, markedRanges(this.source, this.marks), { ...defaultMarkStyle, ...this.markStyle });
      u.highlighted = highlighted;
    }
    Object.assign(u.node.style, this.style || {});
    return u.node;
  }
}

const defaultMarkStyle = { background: "rgba(255, 214, 10, 0.45)", color: "inherit", borderRadius: "2px", padding: "1px 0" };

// Where each of `marks` (see HighlightedCode) is in `source`: [start, end)
// character ranges, in order.
function markedRanges(source, marks) {
  const ranges = [];
  for (const mark of marks) {
    if (mark.call) {
      // Its name, not part of another one's - a method call is a call too.
      const name = new RegExp("(?<![\\w$])" + mark.call.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\(", "g");
      for (const match of source.matchAll(name)) {
        const close = closingParenthesis(source, match.index + match[0].length - 1);
        if (close >= 0) ranges.push([match.index, close + 1]);
      }
    } else if (mark.text) {
      for (let at = source.indexOf(mark.text); at >= 0; at = source.indexOf(mark.text, at + mark.text.length)) {
        ranges.push([at, at + mark.text.length]);
      }
    }
  }
  return ranges.sort((one, other) => one[0] - other[0]);
}

// The parenthesis closing the one at `open` in JavaScript `source` - not
// counting those in strings and comments - or -1.
function closingParenthesis(source, open) {
  let depth = 0;
  for (let at = open; at < source.length; at++) {
    const char = source[at];
    if (char === "\"" || char === "'" || char === "`") {
      for (at++; at < source.length && source[at] !== char; at++) {
        if (source[at] === "\\") at++;
      }
    } else if (char === "/" && source[at + 1] === "/") {
      at = source.indexOf("\n", at);
      if (at < 0) return -1;
    } else if (char === "/" && source[at + 1] === "*") {
      at = source.indexOf("*/", at + 2) + 1;
      if (at <= 0) return -1;
    } else if (char === "(") {
      depth++;
    } else if (char === ")") {
      depth--;
      if (depth === 0) return at;
    }
  }
  return -1;
}

// Wrap the characters in `ranges` of `code`'s text in marks - piece by
// piece, since a range may well cross highlight.js's spans: each text node
// it covers has its share of it marked.
function markRanges(code, ranges, style) {
  if (ranges.length === 0) return;
  const document = code.ownerDocument;
  const texts = [];
  const walker = document.createTreeWalker(code, 4); // NodeFilter.SHOW_TEXT
  while (walker.nextNode()) texts.push(walker.currentNode);
  let offset = 0;
  for (const node of texts) {
    const start = offset;
    const end = offset + node.data.length;
    offset = end;
    const covering = ranges.filter(([from, to]) => from < end && to > start);
    if (covering.length === 0) continue;
    const pieces = document.createDocumentFragment();
    let at = start;
    for (const [from, to] of covering) {
      const markFrom = Math.max(from, at);
      const markTo = Math.min(to, end);
      if (markTo <= markFrom) continue;
      if (markFrom > at) pieces.appendChild(document.createTextNode(node.data.slice(at - start, markFrom - start)));
      const mark = document.createElement("mark");
      Object.assign(mark.style, style);
      mark.textContent = node.data.slice(markFrom - start, markTo - start);
      pieces.appendChild(mark);
      at = markTo;
    }
    if (at < end) pieces.appendChild(document.createTextNode(node.data.slice(at - start)));
    node.parentNode.replaceChild(pieces, node);
  }
}

// A piece of a file's text (a `?raw` import) - real code, shown as it is,
// whatever it becomes: from the first line, after `after` (where to start
// looking, if given), that starts with `from`, through the first line after
// it, indented as much, that starts with `to` - its indentation taken off.
//
//   excerpt(source, { after: "class FocusStore ", from: "build() {", to: "}" })
export function excerpt(source, { after, from, to }) {
  const begin = after ? source.indexOf(after) : 0;
  if (begin < 0) throw new Error("excerpt(): no \"" + after + "\" in the source");
  const lines = source.slice(begin).split(/\r?\n/);
  const indentOf = (line) => line.length - line.trimStart().length;
  const first = lines.findIndex((line) => line.trimStart().startsWith(from));
  if (first < 0) throw new Error("excerpt(): no line starting with \"" + from + "\"");
  const indent = indentOf(lines[first]);
  const last = lines.findIndex((line, index) => index > first && indentOf(line) === indent && line.trimStart().startsWith(to));
  if (last < 0) throw new Error("excerpt(): no line starting with \"" + to + "\" after \"" + from + "\"");
  return lines.slice(first, last + 1).map((line) => line.slice(Math.min(indent, indentOf(line)))).join("\n");
}

// A button that shows `source` (a file's text - see index.js's `?raw`
// imports) in a modal dialog titled `fileName`.
export class CodeButton extends Component {
  setProperties({ source, fileName }) {
    this.source = source || "";
    this.fileName = fileName || "";
  }

  initialState() {
    return { open: false };
  }

  build() {
    const close = callback("close", () => { this.open = false; });
    const codeDialog = dialog({
      title: this.fileName,
      close,
      style: { flex: "1 1 auto", minHeight: 0 },
      children: [new HighlightedCode({ source: this.source })],
    });
    return [
      iconButton({
        icon: "code",
        title: "Show the code for this page",
        onClick: callback("open", () => { this.open = true; }),
        style: { color: "#7bed9f" },
      }),
      overlay(modalAssembly({ close, width: "80%", height: "80%", fullScreenBelow: 600, style: { maxWidth: "1000px" } }, codeDialog), { showing: this.open }),
    ];
  }
}

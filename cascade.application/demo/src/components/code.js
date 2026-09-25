import { Component } from "@liquefy/cascade.component";
import { button as htmlButton, DOMNodeRenderComponent } from "@liquefy/cascade.dom";
import { overlay } from "@liquefy/cascade.ui";
import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import "highlight.js/styles/github.css";
import { DialogChrome, modalPresentation } from "./dialog.js";

hljs.registerLanguage("javascript", javascript);

/**
 * Showing a page's own source code - ported from
 * flow.application/demo/src/components/information.js's DisplayCodeButton /
 * CodeDisplay.
 */

// JavaScript source, syntax highlighted: a <pre><code> whose content is
// highlight.js's HTML. A node of its own rather than a code() tag, since
// that HTML has to go in as innerHTML - which element properties can't
// set (DOMElementComponent lowercases every property name, and
// element.innerhtml is nothing). Highlighted again only when the source
// changes.
export class HighlightedCode extends DOMNodeRenderComponent {
  setProperties({ source, style }) {
    this.source = source || "";
    this.style = style || null;
  }

  ensureNode() {
    const u = this.unobservable;
    if (!u.element) {
      u.element = document.createElement("pre");
      u.element.style.margin = "0";
      u.code = document.createElement("code");
      u.code.className = "hljs language-javascript";
      Object.assign(u.code.style, { display: "inline-block", minWidth: "100%", boxSizing: "border-box", padding: "15px", fontSize: "14px", userSelect: "text" });
      u.element.appendChild(u.code);
    }
    if (u.highlighted !== this.source) {
      u.code.innerHTML = hljs.highlight(this.source, { language: "javascript" }).value;
      u.highlighted = this.source;
    }
    Object.assign(u.element.style, this.style || {});
    return u.element;
  }
}

// A button that shows `source` (a file's text - see index.js's `?raw`
// imports) in a modal dialog titled `fileName`. Styled for the dark top
// bar it sits in (the themed widget contract has no icon button yet).
export class CodeButton extends Component {
  setProperties({ source, fileName }) {
    this.source = source || "";
    this.fileName = fileName || "";
  }

  initializeState() {
    return { open: false };
  }

  build() {
    const close = () => { this.open = false; };
    const dialog = new DialogChrome({
      key: "codeDialog",
      title: this.fileName,
      close,
      style: { width: "80%", maxWidth: "1000px", height: "80%", flex: "none" },
      children: [new HighlightedCode({ key: "code", source: this.source })],
    });
    return [
      htmlButton({
        key: "button",
        title: "Show the code for this page",
        onclick: () => { this.open = true; },
        style: {
          height: "32px", padding: "0 10px", border: "none", borderRadius: "4px", flex: "none",
          background: "#1a252f", color: "#7bed9f", cursor: "pointer", fontFamily: "monospace", fontSize: "14px", fontWeight: "bold",
        },
      }, "</>"),
      overlay(modalPresentation(dialog, close), { key: "codeOverlay", showing: this.open }),
    ];
  }
}

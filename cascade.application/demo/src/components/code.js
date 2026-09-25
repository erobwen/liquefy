import { Component, callback } from "@liquefy/cascade.component";
import { DOMNodeRenderComponent } from "@liquefy/cascade.dom";
import { overlay, iconButton, dialog } from "@liquefy/cascade.ui";
import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import "highlight.js/styles/github.css";
import { modalPresentation } from "./modal.js";

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
// imports) in a modal dialog titled `fileName`.
export class CodeButton extends Component {
  setProperties({ source, fileName }) {
    this.source = source || "";
    this.fileName = fileName || "";
  }

  initializeState() {
    return { open: false };
  }

  build() {
    const close = callback("close", () => { this.open = false; });
    const codeDialog = dialog({
      key: "codeDialog",
      title: this.fileName,
      close,
      style: { width: "80%", maxWidth: "1000px", height: "80%", flex: "none" },
      children: [new HighlightedCode({ key: "code", source: this.source })],
    });
    return [
      iconButton({
        key: "button",
        icon: "code",
        title: "Show the code for this page",
        onClick: callback("open", () => { this.open = true; }),
        style: { color: "#7bed9f" },
      }),
      overlay(modalPresentation(codeDialog, close), { key: "codeOverlay", showing: this.open }),
    ];
  }
}

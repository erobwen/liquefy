import { Component, callback } from "@liquefy/cascade.component";
import { DOMNodeComponent } from "@liquefy/cascade.dom";
import { overlay, modalAssembly, iconButton, dialog } from "@liquefy/cascade.ui";
import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import xml from "highlight.js/lib/languages/xml";
import bash from "highlight.js/lib/languages/bash";
import "highlight.js/styles/github.css";

hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("bash", bash);

/**
 * Showing a page's own source code - ported from
 * flow.application/demo/src/components/information.js's DisplayCodeButton /
 * CodeDisplay.
 */

// Source, syntax highlighted - JavaScript, or `language`: "html" or "bash": a <pre><code> whose content is
// highlight.js's HTML. A node of its own rather than a code() tag, since
// that HTML has to go in as innerHTML - which element properties can't
// set (DOMElementComponent lowercases every property name, and
// element.innerhtml is nothing). Highlighted again only when the source
// changes.
export class HighlightedCode extends DOMNodeComponent {
  setProperties({ source, language, style }) {
    this.source = source || "";
    this.language = language || "javascript";
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
    if (u.highlighted !== this.source) {
      u.code.innerHTML = hljs.highlight(this.source, { language: this.language }).value;
      u.highlighted = this.source;
    }
    Object.assign(u.node.style, this.style || {});
    return u.node;
  }
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

import { Component, callback, observable } from "@liquefy/cascade.component";
import { div, textarea } from "@liquefy/cascade.dom";
import { documentPlugin } from "../../shell/documents.js";
import { removeButton } from "../../shell/removeButton.js";
import { paperSizes, mm } from "../../print/index.js";

/**
 * Plain text - just text, no structure, no styling: `{ "text": "..." }`.
 */
export const plainText = {
  name: "plainText",
  label: "Plain text",
  icon: "notes",
  description: "Just text.",
  create: () => observable({ text: "" }),
  hydrate: (properties) => observable({ text: String(properties.text || "") }),
  dehydrate: (model) => ({ text: model.text }),
  editor: ({ target, ...properties }) => target === "web" ? new PlainTextWeb(properties) : new PlainTextEditor(properties),
  // Flowing over as many A4 pages as it takes.
  print: (model) => [{ format: paperSizes.A4, margin: mm(20), node: printNode(model) }],
  // Its paragraphs - what's between blank lines - by their first words.
  outline: (model) => model.text.split(/\n\s*\n/).map((each) => each.trim()).filter((each) => each)
    .map((each) => ({ label: each.length > 60 ? each.slice(0, 60) + " …" : each, icon: "notes", children: [] })),
};

// A sheet of it, as wide as a paper, growing with what's written - with a
// remove button at its corner, when in a sequence (see ../../shell/documents.js).
class PlainTextEditor extends Component {
  setProperties({ model, zoom = 1, onRemove }) {
    this.model = model;
    this.zoom = zoom;
    this.onRemove = onRemove || null;
  }

  build() {
    const { model } = this;
    const lines = model.text.split("\n").length;
    return div(
      { style: { padding: "8mm", zoom: this.zoom } },
      div(
        { style: { position: "relative", width: "210mm" } },
        textarea({
          value: model.text,
          placeholder: "Text",
          spellcheck: false,
          rows: Math.max(12, lines + 1),
          oninput: callback("input", (event) => { model.text = event.target.value; }),
          style: {
            display: "block", width: "100%", boxSizing: "border-box", resize: "none", border: "none", outline: "none",
            padding: "32px 40px", background: "white", boxShadow: "0 2px 12px rgba(0, 0, 0, 0.12)", color: "#222",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", fontSize: "14px", lineHeight: 1.6,
          },
        }),
        this.onRemove ? removeButton(this.onRemove) : null,
      ),
    );
  }
}

// On the web: only the text, as wide as the card it's in (see
// ../../shell/layouts.js) - growing with what's written.
class PlainTextWeb extends Component {
  setProperties({ model }) {
    this.model = model;
  }

  build() {
    const { model } = this;
    return textarea({
      value: model.text,
      placeholder: "Text",
      spellcheck: false,
      rows: Math.max(4, model.text.split("\n").length + 1),
      oninput: callback("input", (event) => { model.text = event.target.value; }),
      style: {
        display: "block", width: "100%", boxSizing: "border-box", resize: "none", border: "none", outline: "none", padding: 0,
        background: "transparent", color: "#222", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", fontSize: "14px", lineHeight: 1.6,
      },
    });
  }
}

function printNode(model) {
  const pre = document.createElement("pre");
  Object.assign(pre.style, { margin: 0, whiteSpace: "pre-wrap", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", fontSize: "10pt", lineHeight: 1.5 });
  pre.textContent = model.text;
  return pre;
}

export const plainTextPlugin = documentPlugin({
  name: "plainText",
  label: "Plain text",
  description: "Text without structure or styling.",
  documentTypes: [plainText],
});

import { Component, callback, observable } from "@liquefy/cascade.component";
import { div, textarea } from "@liquefy/cascade.dom";
import { documentPlugin } from "../../shell/documents.js";
import { removeButton } from "../../shell/removeButton.js";

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
  editor: (properties) => new PlainTextEditor(properties),
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

export const plainTextPlugin = documentPlugin({
  name: "plainText",
  label: "Plain text",
  description: "Text without structure or styling.",
  documentTypes: [plainText],
});

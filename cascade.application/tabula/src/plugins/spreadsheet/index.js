import { Component, callback, observable, view } from "@liquefy/cascade.component";
import { div, table, tbody, tr, th, td, input, text } from "@liquefy/cascade.dom";
import { button } from "@liquefy/cascade.ui";
import { documentPlugin } from "../../shell/documents.js";
import { removeButton } from "../../shell/removeButton.js";

/**
 * A spreadsheet - for now only a grid of values, no formulas:
 *
 *   { "columns": 6, "rows": 12, "cells": { "A1": "Name", "B1": "42" } }
 *
 * Only cells with something in them are saved.
 */
export const spreadsheet = {
  name: "spreadsheet",
  label: "Spreadsheet",
  icon: "table_chart",
  description: "A grid of cells.",
  create: () => grid(6, 12, {}),
  hydrate: (properties) => grid(properties.columns || 6, properties.rows || 12, properties.cells || {}),
  dehydrate: (model) => ({
    columns: model.columns,
    rows: model.rows,
    cells: Object.fromEntries(Object.entries(model.cells).filter(([, value]) => value !== "")),
  }),
  editor: (properties) => new SpreadsheetEditor(properties),
};

const grid = (columns, rows, cells) => observable({ columns, rows, cells: observable({ ...cells }) });

// A, B, ... Z, AA, AB, ...
function columnName(index) {
  let name = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + (n - 1) % 26) + name;
  return name;
}

const headerStyle = { background: "#f1f3f4", color: "#5f6368", fontWeight: 500, fontSize: "12px", border: "1px solid #dadce0", padding: "2px 6px", minWidth: "28px" };

class SpreadsheetEditor extends Component {
  setProperties({ model, zoom = 1, onRemove }) {
    this.model = model;
    this.zoom = zoom;
    this.onRemove = onRemove || null;
  }

  // On a white sheet of its own, as wide as it is - with a remove button at
  // its corner, when in a sequence (see ../../shell/documents.js).
  build() {
    const { model } = this;
    const columns = Array.from({ length: model.columns }, (_, index) => columnName(index));
    return div(
      { style: { padding: "8mm", zoom: this.zoom, width: "fit-content" } },
      div(
        { style: { position: "relative", background: "white", padding: "16px", boxShadow: "0 2px 12px rgba(0, 0, 0, 0.12)" } },
        this.onRemove ? removeButton(this.onRemove) : null,
        table(
          { style: { borderCollapse: "collapse", fontFamily: "sans-serif", fontSize: "14px" } },
          tbody(
            tr(th({ style: headerStyle }), columns.map((name) => th({ style: headerStyle }, text(name)))),
            Array.from({ length: model.rows }, (_, row) => tr(
              th({ style: headerStyle }, text(String(row + 1))),
              // Each cell reads only its own value - typing in one rebuilds
              // that one. No keys: rows and columns are only ever added at
              // the end.
              columns.map((name) => cell({ cells: model.cells, name: name + (row + 1) })),
            )),
          ),
        ),
        div(
          { style: { display: "flex", gap: "8px", marginTop: "12px" } },
          button("Add row", callback("addRow", () => { model.rows++; })),
          button("Add column", callback("addColumn", () => { model.columns++; })),
        ),
      ),
    );
  }
}

const cell = view("Cell", ({ cells, name }) => td(
  { style: { border: "1px solid #dadce0", padding: 0 } },
  input({
    value: cells[name] || "",
    "aria-label": name,
    oninput: callback("input", (event) => { cells[name] = event.target.value; }),
    style: { border: "none", outline: "none", padding: "4px 6px", width: "96px", font: "inherit", background: "transparent" },
  }),
));

export const spreadsheetPlugin = documentPlugin({
  name: "spreadsheet",
  label: "Spreadsheet",
  description: "Grids of cells.",
  documentTypes: [spreadsheet],
});

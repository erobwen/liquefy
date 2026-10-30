import { Component, callback, observable, view } from "@liquefy/cascade.component";
import { div, table, tbody, tr, th, td, input, text } from "@liquefy/cascade.dom";
import { iconButton, row as menuRow } from "@liquefy/cascade.ui";
import { documentPlugin } from "../../shell/documents.js";
import { removeButton } from "../../shell/removeButton.js";
import { surfacePadding } from "../../shell/spacing.js";
import { takeFocus, releaseFocus, menuHeading, menuNote } from "../../shell/contextMenus.js";
import { paperSizes, mm } from "../../print/index.js";

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
  // The grid, on A4 pages - as many as it takes.
  print: (model) => [{ format: paperSizes.A4, margin: mm(15), node: printNode(model) }],
  // The cells with something in them.
  outline: (model) => Object.entries(model.cells).filter(([, value]) => value !== "")
    .map(([name, value]) => ({ label: name + ": " + value, icon: "grid_on", children: [] })),
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
  setProperties({ model, zoom = 1, onRemove, target = "paper" }) {
    this.model = model;
    this.zoom = zoom;
    this.onRemove = onRemove || null;
    this.target = target;
  }

  onDispose() {
    releaseFocus(this);
    super.onDispose();
  }

  // A cell focused: the grid has the focus, and its context menu - its
  // size - is shown (see ../../shell/contextMenus.js). A grid is all there
  // is to it: its menu is the root's, with no leaf below.
  contextPath() {
    const { model } = this;
    return [{
      key: "spreadsheet",
      icon: "table_chart",
      title: "Spreadsheet",
      build: () => [
        menuHeading("Size"),
        sizeRow("Rows", model.rows, callback("fewerRows", () => { model.rows = Math.max(1, model.rows - 1); }), callback("moreRows", () => { model.rows++; })),
        sizeRow("Columns", model.columns, callback("fewerColumns", () => { model.columns = Math.max(1, model.columns - 1); }), callback("moreColumns", () => { model.columns++; })),
        menuNote("What's in the cells taken away is kept, and back when they are."),
      ],
    }];
  }

  // On paper: on a white sheet of its own, as wide as it is - with a remove
  // button at its corner, when in a sequence (see ../../shell/documents.js).
  // On the web: only the grid, in the card it's in (see ../../shell/layouts.js).
  build() {
    const { model } = this;
    const web = this.target === "web";
    const columns = Array.from({ length: model.columns }, (_, index) => columnName(index));
    // A cell focused, the grid has the focus.
    const onFocus = callback("focus", () => takeFocus(this));
    return div(
      { style: web ? { overflowX: "auto" } : { padding: surfacePadding, zoom: this.zoom, width: "fit-content" } },
      div(
        { style: web ? {} : { position: "relative", background: "white", padding: "16px", boxShadow: "0 2px 12px rgba(0, 0, 0, 0.12)" } },
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
              columns.map((name) => cell({ cells: model.cells, name: name + (row + 1), onFocus })),
            )),
          ),
        ),
      ),
    );
  }
}

// A size in its menu: what it is, fewer and more.
function sizeRow(label, count, fewer, more) {
  return menuRow(
    { style: { alignItems: "center", gap: "6px" } },
    div({ style: { flex: "1" } }, text(label)),
    iconButton({ icon: "remove", title: "Fewer " + label.toLowerCase(), disabled: count <= 1, onClick: fewer }),
    div({ style: { minWidth: "24px", textAlign: "center" } }, text(String(count))),
    iconButton({ icon: "add", title: "More " + label.toLowerCase(), onClick: more }),
  );
}

const cell = view("Cell", ({ cells, name, onFocus }) => td(
  { style: { border: "1px solid #dadce0", padding: 0 } },
  input({
    value: cells[name] || "",
    "aria-label": name,
    oninput: callback("input", (event) => { cells[name] = event.target.value; }),
    onfocus: onFocus,
    style: { border: "none", outline: "none", padding: "4px 6px", width: "96px", font: "inherit", background: "transparent" },
  }),
));

function printNode(model) {
  const table = document.createElement("table");
  Object.assign(table.style, { borderCollapse: "collapse", fontFamily: "sans-serif", fontSize: "9pt" });
  for (let row = 0; row < model.rows; row++) {
    const tr = table.insertRow();
    for (let column = 0; column < model.columns; column++) {
      const td = tr.insertCell();
      Object.assign(td.style, { border: "0.5pt solid #999", padding: "2pt 4pt", minWidth: "18mm" });
      td.textContent = model.cells[columnName(column) + (row + 1)] || "";
    }
  }
  return table;
}

export const spreadsheetPlugin = documentPlugin({
  name: "spreadsheet",
  label: "Spreadsheet",
  description: "Grids of cells.",
  documentTypes: [spreadsheet],
});

import { observable, callback } from "@liquefy/cascade.component";
import { div, span, text, img } from "@liquefy/cascade.dom";
import { button, checkbox, colorField, iconButton, row } from "@liquefy/cascade.ui";
import { documentPlugin } from "../../shell/documents.js";

/**
 * Images, tables, shapes and page numbers - what goes in a frame, in
 * another document: in its text (see ../../model/frames.js), or on its
 * pages (../../model/pageLayout.js). Document types with a `frame` and no
 * editor of their own (see ../../shell/documents.js), created from the
 * creation menu - each where it can be: in the text, on a page, or both.
 *
 *  - An image: a picture, as a data URL (`src`) - none, at first: a grey
 *    box saying so, its frame's context menu choosing one - and its aspect
 *    ratio, the picture's own once there's one.
 *  - A table: rows of cells, each a text - a placeholder, for now: shown,
 *    rows and columns added and taken away from its frame's context menu,
 *    its cells not yet edited. In the end, perhaps a spreadsheet (see
 *    ../spreadsheet).
 *  - A shape: a box, filled with a colour - or a gradient, from one to
 *    another - its corners rounded or not. On pages only.
 *  - A page number: the number of the page it's on - or "Page 2 of 7" -
 *    in the middle of its box. On pages only.
 */
export const image = {
  name: "image",
  label: "Image",
  icon: "image",
  description: "A picture, in a frame.",
  create: () => observable({ src: null, aspectRatio: 4 / 3 }),
  hydrate: (properties) => observable({ src: properties.src || null, aspectRatio: properties.aspectRatio || 4 / 3 }),
  dehydrate: (model) => ({ src: model.src, aspectRatio: model.aspectRatio }),
  frame: {
    places: ["text", "page"],
    aspectRatio: (model) => model.aspectRatio,
    view: (model) => model.src
      ? img({ src: model.src, alt: "", style: { display: "block", width: "100%", height: "100%", objectFit: "cover" } })
      : emptyBox("image", "Image"),
    printNode: (model) => {
      if (!model.src) return greyBox();
      const node = globalThis.document.createElement("img");
      node.src = model.src;
      Object.assign(node.style, { display: "block", width: "100%", height: "100%", objectFit: "cover" });
      return node;
    },
    controls: (model) => [
      button({ key: "choosePicture" }, model.src ? "Another picture…" : "Choose picture…", callback("choosePicture", () => choosePicture(model))),
    ],
  },
};

// A cell's size, for a table's aspect ratio: its columns are this wide,
// its rows this tall.
const cellWidth = 30;
const cellHeight = 8;
const emptyRows = (rows, columns) => Array.from({ length: rows }, () => Array.from({ length: columns }, () => ""));

export const table = {
  name: "table",
  label: "Table",
  icon: "table",
  description: "Rows and columns, in a frame.",
  create: () => observable({ rows: emptyRows(3, 3) }),
  hydrate: (properties) => observable({ rows: properties.rows && properties.rows.length > 0 ? properties.rows : emptyRows(3, 3) }),
  dehydrate: (model) => ({ rows: model.rows }),
  frame: {
    places: ["text"],
    aspectRatio: (model) => (model.rows[0].length * cellWidth) / (model.rows.length * cellHeight),
    view: (model) => div(
      { style: { display: "grid", gridTemplateColumns: `repeat(${model.rows[0].length}, 1fr)`, width: "100%", height: "100%", boxSizing: "border-box", border: "1px solid #5f6368" } },
      model.rows.flatMap((cells) => cells.map((cell) => div({ style: cellStyle }, text(cell)))),
    ),
    printNode: (model) => {
      const node = globalThis.document.createElement("div");
      Object.assign(node.style, { display: "grid", gridTemplateColumns: `repeat(${model.rows[0].length}, 1fr)`, width: "100%", height: "100%", boxSizing: "border-box", border: "1px solid #5f6368" });
      for (const cell of model.rows.flat()) {
        const each = globalThis.document.createElement("div");
        Object.assign(each.style, cellStyle);
        each.textContent = cell;
        node.appendChild(each);
      }
      return node;
    },
    controls: (model) => [
      count("Rows", model.rows.length, (rows) => { model.rows = resized(model.rows, rows, model.rows[0].length); }),
      count("Columns", model.rows[0].length, (columns) => { model.rows = resized(model.rows, model.rows.length, columns); }),
    ],
  },
};

export const shape = {
  name: "shape",
  label: "Shape",
  icon: "rectangle",
  description: "A box of colour, on a page.",
  create: () => observable({ fill: "#4285f4", to: null, angle: 135, rounded: false }),
  hydrate: (properties) => observable({ fill: properties.fill || "#4285f4", to: properties.to || null, angle: properties.angle ?? 135, rounded: !!properties.rounded }),
  dehydrate: (model) => ({ fill: model.fill, to: model.to, angle: model.angle, rounded: model.rounded }),
  frame: {
    places: ["page"],
    aspectRatio: () => 3,
    view: (model) => div({ style: shapeStyle(model) }),
    printNode: (model) => {
      const node = globalThis.document.createElement("div");
      Object.assign(node.style, shapeStyle(model));
      return node;
    },
    controls: (model) => [
      colorField({ key: "fill", label: model.to ? "From" : "Colour", value: model.fill, onInput: (color) => { model.fill = color; } }),
      checkbox({ key: "gradient", label: "Gradient", checked: !!model.to, onChange: (checked) => { model.to = checked ? "#ffffff" : null; } }),
      model.to ? colorField({ key: "to", label: "To", value: model.to, onInput: (color) => { model.to = color; } }) : null,
      model.to ? count("Angle", model.angle, (angle) => { model.angle = (angle + 360) % 360; }, 45) : null,
      checkbox({ key: "rounded", label: "Rounded corners", checked: model.rounded, onChange: (checked) => { model.rounded = checked; } }),
    ],
  },
};

const pageNumberFormats = [
  { value: "number", label: "2", text: ({ page }) => String(page) },
  { value: "ofPages", label: "Page 2 of 7", text: ({ page, pages }) => "Page " + page + " of " + pages },
];
const pageNumberText = (model, page) => (pageNumberFormats.find((each) => each.value === model.format) || pageNumberFormats[0]).text(page || { page: 1, pages: 1 });

export const pageNumber = {
  name: "pageNumber",
  label: "Page number",
  icon: "tag",
  description: "The number of the page it's on.",
  create: () => observable({ format: "number", size: 10 }),
  hydrate: (properties) => observable({ format: properties.format || "number", size: properties.size || 10 }),
  dehydrate: (model) => ({ format: model.format, size: model.size }),
  frame: {
    places: ["page"],
    aspectRatio: () => 4,
    view: (model, page) => div({ style: pageNumberStyle(model) }, text(pageNumberText(model, page))),
    printNode: (model, page) => {
      const node = globalThis.document.createElement("div");
      Object.assign(node.style, pageNumberStyle(model));
      node.textContent = pageNumberText(model, page);
      return node;
    },
    controls: (model) => [
      row(
        { key: "format", style: { gap: "4px", flexWrap: "wrap" } },
        pageNumberFormats.map(({ value, label }) => button(
          { key: "format" + value, variant: model.format === value ? "filled" : undefined },
          label,
          callback("format" + value, () => { model.format = value; }),
        )),
      ),
      count("Size", model.size, (size) => { model.size = size; }),
    ],
  },
};

export const framesPlugin = documentPlugin({
  name: "frames",
  label: "Images, tables and shapes",
  description: "Pictures and tables in the text - shapes, pictures and page numbers on the pages.",
  documentTypes: [image, table, shape, pageNumber],
});

const shapeStyle = (model) => ({
  width: "100%", height: "100%", borderRadius: model.rounded ? "3mm" : "0",
  background: model.to ? "linear-gradient(" + model.angle + "deg, " + model.fill + ", " + model.to + ")" : model.fill,
  printColorAdjust: "exact", WebkitPrintColorAdjust: "exact",
});

const pageNumberStyle = (model) => ({
  width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
  fontFamily: "Georgia, serif", fontSize: model.size + "pt", color: "black", whiteSpace: "nowrap",
});

const cellStyle = { border: "1px solid #bdc1c6", fontFamily: "sans-serif", fontSize: "9pt", padding: "1mm", overflow: "hidden", boxSizing: "border-box" };

// The cells as they were, as many rows and columns as asked for - new ones
// empty.
function resized(rows, rowCount, columnCount) {
  return Array.from({ length: rowCount }, (_, r) => Array.from({ length: columnCount }, (_, c) => (rows[r] && rows[r][c]) || ""));
}

// How many of something: - and +, `step` at a time - at least one, counting
// one by one.
function count(label, value, set, step = 1) {
  return row(
    { key: label, style: { alignItems: "center", gap: "6px" } },
    div({ style: { flex: "1" } }, text(label)),
    iconButton({ icon: "remove", title: "Less", disabled: step === 1 && value <= 1, onClick: callback("fewer" + label, () => set(value - step)) }),
    div({ style: { minWidth: "16px", textAlign: "center" } }, text(String(value))),
    iconButton({ icon: "add", title: "More", onClick: callback("more" + label, () => set(value + step)) }),
  );
}

// No picture yet: a grey box, its kind's icon and name in it.
function emptyBox(icon, label) {
  return div(
    { style: { width: "100%", height: "100%", background: "#e8eaed", color: "#5f6368", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "2mm", fontFamily: "sans-serif", fontSize: "10pt" } },
    span({ class: "material-symbols-outlined", style: { fontSize: "32px" } }, text(icon)),
    text(label),
  );
}

function greyBox() {
  const node = globalThis.document.createElement("div");
  Object.assign(node.style, { width: "100%", height: "100%", background: "#e8eaed" });
  return node;
}

// A picture from a file the user picks - as a data URL, its aspect ratio
// its own.
function choosePicture(model) {
  const input = globalThis.document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = () => {
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result;
      const picture = new Image();
      picture.onload = () => {
        model.aspectRatio = picture.naturalWidth / picture.naturalHeight || model.aspectRatio;
        model.src = src;
      };
      picture.src = src;
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

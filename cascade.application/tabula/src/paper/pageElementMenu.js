import { callback, postponeInvalidations, continueInvalidations } from "@liquefy/cascade.component";
import { div, text, input } from "@liquefy/cascade.dom";
import { button, row } from "@liquefy/cascade.ui";
import { elementRect, pageKinds } from "../model/pageLayout.js";
import { menuHeading as heading, menuNote as note } from "../shell/contextMenus.js";

/**
 * A page element's context menu (see ../shell/contextMenus.js) - the
 * element selected on a page layout (see ../model/pageLayout.js,
 * PageLayoutEditor.js): a structured text's, laying out its pages, or a
 * page's of its own (see ../plugins/page).
 *
 * `editor`: what shows it - its `model`, { paper, pageLayout }, and
 * `selectElement(selection)`. `where`: what it's on, said - its page
 * of the page layout, if not given.
 */
export const sideName = (side, duplex) => ({ left: duplex ? "Inner" : "Left", right: duplex ? "Outer" : "Right", top: "Top", bottom: "Bottom" })[side];

// The page element selected: its size, the edges it's measured from - the
// ones nearest it, as it's placed, or the others, as chosen - what its
// kind has to offer, and taking it out.
export function elementEntry(editor, { element, kind }, where = null) {
  const type = element.content && element.content.documentType;
  const frame = type ? type.frame : null;
  const paper = editor.model.paper;
  const page = pageKinds.find((each) => each.name === kind);
  const duplex = editor.model.pageLayout.duplex;
  // Measured from another edge, it stays where it is.
  const measureFrom = (horizontal, vertical) => {
    const rect = elementRect(element, paper);
    inOneGo(() => {
      element.horizontal = horizontal;
      element.x = horizontal === "left" ? rect.x : paper.width - rect.x - rect.width;
      element.vertical = vertical;
      element.y = vertical === "top" ? rect.top : paper.height - rect.top - rect.height;
    });
  };
  const size = (label, key) => row(
    { key, style: { alignItems: "center", gap: "6px" } },
    div({ style: { flex: "1" } }, text(label)),
    input({
      key: key + "Input", type: "number", min: 1, step: 1,
      value: String(Math.round(element[key] / 100) / 10),
      onchange: callback(key, (event) => {
        const value = Number(event.target.value);
        if (Number.isFinite(value) && value > 0) element[key] = Math.round(value * 1000);
      }),
      style: { width: "72px", font: "inherit", padding: "2px 4px" },
    }),
    div({ style: { fontSize: "13px", opacity: 0.7 } }, text("mm")),
  );
  const choice = (key, values, current, choose) => row(
    { key, style: { gap: "4px" } },
    values.map(({ value, label }) => button({ key: key + value, variant: current === value ? "filled" : undefined }, label, callback(key + value, () => choose(value)))),
  );
  return {
    key: "element",
    icon: type ? type.icon : "help",
    title: type ? type.label : "Element",
    details: () => [note("On " + (where || "the " + page.label.toLowerCase()) + ". Drag it to move it, its corner to resize it - Delete takes it out.")],
    build: () => [
      heading("Size"),
      size("Width", "width"),
      size("Height", "height"),
      heading("Measured from"),
      choice("horizontal", [{ value: "left", label: sideName("left", duplex) + " edge" }, { value: "right", label: sideName("right", duplex) + " edge" }], element.horizontal, (value) => measureFrom(value, element.vertical)),
      choice("vertical", [{ value: "top", label: "Top edge" }, { value: "bottom", label: "Bottom edge" }], element.vertical, (value) => measureFrom(element.horizontal, value)),
      note("Where it stays, on paper of another size - the nearest edges, as it's placed."),
      frame && frame.controls ? [heading(type.label), ...frame.controls(element.content.model)] : null,
      button({ key: "remove" }, "Remove", callback("remove", () => {
        const list = editor.model.pageLayout[kind];
        const index = list.indexOf(element);
        if (index >= 0) list.splice(index, 1);
        editor.selectElement(null);
      })),
    ],
  };
}

// Changes made together, one change to what follows them.
export function inOneGo(change) {
  postponeInvalidations();
  try {
    change();
  } finally {
    continueInvalidations();
  }
}

import { Component, callback, frozen } from "@liquefy/cascade.component";
import { div, text, input } from "@liquefy/cascade.dom";
import { icon, iconButton, card, popover, themeColor } from "@liquefy/cascade.ui";
import { chip, categoryChoices, border } from "./parts.js";
import { filesIn } from "./model.js";

/**
 * The path bar - at the top of the content: the path shown, as the
 * categories it's the intersection of, and a field to search by adding
 * more. A folder's path is no different from a search's: picking a folder
 * puts its path here, and changing it here goes to the folder with that
 * path, if there is one.
 *
 *  - path: the categories shown.
 *  - onPath(path): the user changed it - removed a category, or added one.
 *  - leading, trailing: what goes before and after it (a button opening
 *    the folders, how the files are sorted, ...).
 */
export class PathBar extends Component {
  setProperties({ path, onPath, leading, trailing }) {
    this.path = frozen(path || []);
    this.onPath = onPath || null;
    this.leading = frozen(leading || []);
    this.trailing = frozen(trailing || []);
  }

  // What's typed, whether the list is open (+ clicked), and the field it's
  // shown under.
  initialState() {
    return { query: "", listing: false, anchor: null };
  }

  build() {
    const add = (category) => {
      this.query = "";
      this.listing = false;
      if (this.onPath) this.onPath([...this.path, category]);
    };
    // Each with how many files there would be, with it added.
    const { choices, first } = categoryChoices({
      query: this.query, leaveOut: this.path, allowCreate: false, pick: add, keyPrefix: "add",
      countOf: (category) => filesIn([...this.path, category]).length,
    });
    const path = this.path.length === 0
      ? [div({ key: "everything", style: { flex: "none", color: themeColor.textSoft } }, text("All files"))]
      : this.path.map((category) => chip({
        key: category.id,
        label: category.name,
        onRemove: callback("remove" + category.id, () => this.onPath && this.onPath(this.path.filter((each) => each !== category))),
      }));
    return div(
      {
        style: {
          display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px", padding: "8px 12px", minHeight: "52px",
          boxSizing: "border-box", borderBottom: border, flex: "none",
        },
      },
      this.leading,
      icon({ name: "filter_alt", style: { flex: "none", color: themeColor.accent } }),
      path,
      this.buildAdder(first, add),
      div({ style: { flex: "1 1 0", minWidth: 0 } }),
      this.trailing,
      // The categories to add - all of them, or those matching what's
      // typed. Picking one adds it.
      popover(
        {
          anchor: this.anchor,
          showing: this.listing || this.query.trim() !== "",
          close: callback("closeList", () => {
            this.query = "";
            this.listing = false;
          }),
        },
        card(
          { style: { width: "240px", padding: "6px", maxHeight: "320px", overflowY: "auto", display: "flex", flexDirection: "column", boxSizing: "border-box" } },
          choices,
        ),
      ),
    );
  }

  // Adding a category - one field: a + that lists every category there is
  // to add, no typing needed; and, beside it, typing to narrow the list
  // down (Enter adds the first; Backspace, in an empty field, removes the
  // last category of the path).
  buildAdder(first, add) {
    return div(
      {
        style: {
          display: "flex", alignItems: "center", flex: "1 1 150px", maxWidth: "240px", height: "32px", boxSizing: "border-box",
          border, borderRadius: "6px", background: themeColor.surface, overflow: "hidden",
        },
      },
      iconButton({
        icon: "add",
        title: "Add a category",
        style: { flex: "none", width: "30px", height: "30px", padding: 0, borderRadius: 0, borderRight: border },
        onClick: callback("list", (event) => {
          this.anchor = event.currentTarget.parentNode;
          this.listing = !this.listing;
        }),
      }),
      input({
        type: "text",
        placeholder: this.path.length === 0 ? "Search by category" : "Add a category",
        value: this.query,
        style: { flex: "1 1 auto", minWidth: 0, height: "100%", border: "none", outline: "none", padding: "0 8px", font: "inherit", background: "transparent", color: themeColor.text },
        oninput: callback("input", (event) => {
          this.anchor = event.target.parentNode;
          this.query = event.target.value;
        }),
        onkeydown: callback("keydown", (event) => {
          if (event.key === "Enter" && first) add(first);
          else if (event.key === "Escape") {
            this.query = "";
            this.listing = false;
          } else if (event.key === "ArrowDown") {
            this.anchor = event.target.parentNode;
            this.listing = true;
          } else if (event.key === "Backspace" && this.query === "" && this.path.length > 0 && this.onPath) {
            this.onPath(this.path.slice(0, -1));
          }
        }),
      }),
    );
  }
}

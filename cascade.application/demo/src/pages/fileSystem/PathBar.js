import { Component, callback, frozen } from "@liquefy/cascade.component";
import { div, text } from "@liquefy/cascade.dom";
import { icon, card, popover, themeColor } from "@liquefy/cascade.ui";
import { chip, textInput, categoryChoices, border } from "./parts.js";

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

  initialState() {
    return { query: "", anchor: null };
  }

  build() {
    const add = (category) => {
      this.query = "";
      if (this.onPath) this.onPath([...this.path, category]);
    };
    const { choices, first } = categoryChoices({ query: this.query, leaveOut: this.path, allowCreate: false, pick: add, keyPrefix: "add" });
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
      textInput({
        placeholder: this.path.length === 0 ? "Search by category" : "Add a category",
        value: this.query,
        style: { flex: "1 1 120px", maxWidth: "220px" },
        oninput: callback("input", (event) => {
          this.anchor = event.target;
          this.query = event.target.value;
        }),
        onkeydown: callback("keydown", (event) => {
          if (event.key === "Enter" && first) add(first);
          else if (event.key === "Escape") this.query = "";
          else if (event.key === "Backspace" && this.query === "" && this.path.length > 0 && this.onPath) {
            this.onPath(this.path.slice(0, -1));
          }
        }),
      }),
      div({ style: { flex: "1 1 0", minWidth: 0 } }),
      this.trailing,
      // What's typed, matched - picking one adds it.
      popover(
        { anchor: this.anchor, showing: this.query.trim() !== "", close: callback("closeSuggestions", () => { this.query = ""; }) },
        card(
          { style: { width: "220px", padding: "6px", maxHeight: "280px", overflowY: "auto", display: "flex", flexDirection: "column", boxSizing: "border-box" } },
          choices,
        ),
      ),
    );
  }
}

import { Component, callback, frozen } from "@liquefy/cascade.component";
import { div, img, a, text } from "@liquefy/cascade.dom";
import { iconButton, themeColor } from "@liquefy/cascade.ui";
import { vault, hasCategory, addCategory, removeCategory } from "./model.js";
import { chip, CategoryPicker, focusSoon, border } from "./parts.js";

/**
 * The files selected: one - its picture, name, date, where it's from, and
 * its categories - or several - how many, and the categories any of them
 * has (faded where not all do). Categories are what the folders go by:
 * adding one here can make a file show in a folder, and removing one take
 * it out - the way to sort a file the folders didn't find.
 *
 *  - files: those selected.
 */
export class FileDetails extends Component {
  setProperties({ files }) {
    this.files = frozen(files || []);
  }

  initialState() {
    return { adding: false, anchor: null };
  }

  build() {
    const files = this.files;
    if (files.length === 0) {
      return div(
        { style: { padding: "24px 16px", color: themeColor.textSoft, textAlign: "center" } },
        text("Select a file to see it here - and its categories, to change what folders it's in."),
      );
    }
    const single = files.length === 1 ? files[0] : null;
    return div(
      { style: { display: "flex", flexDirection: "column", gap: "12px", padding: "16px" } },
      single ? this.buildFile(single) : this.buildSeveral(files),
      this.buildCategories(files),
    );
  }

  buildFile(file) {
    const credit = file.credit || {};
    const year = file.date.slice(0, 4);
    return div(
      { key: "file", style: { display: "flex", flexDirection: "column", gap: "6px" } },
      img({ src: file.image, alt: file.name, style: { width: "100%", height: "200px", objectFit: "contain", display: "block", background: themeColor.filled, borderRadius: "6px" } }),
      div({ style: { fontSize: "18px", fontWeight: "bold", marginTop: "4px" } }, text(file.name)),
      div({ style: { fontSize: "13px", color: themeColor.textSoft } }, text(file.date.endsWith("-01-01") ? year : file.date)),
      div(
        { style: { fontSize: "12px", color: themeColor.textSoft, lineHeight: "1.5" } },
        text((credit.author ? credit.author + " · " : "") + credit.license + " · "),
        a({ href: credit.source, target: "_blank", rel: "noopener", style: { color: themeColor.accent } }, text("Wikimedia Commons")),
      ),
    );
  }

  buildSeveral(files) {
    return div(
      { key: "several", style: { display: "flex", flexDirection: "column", gap: "8px" } },
      div(
        { style: { display: "flex", gap: "4px" } },
        files.slice(0, 4).map((file) => img({ key: file.id, src: file.image, alt: file.name, style: { width: "56px", height: "56px", objectFit: "cover", borderRadius: "4px" } })),
      ),
      div({ style: { fontSize: "18px", fontWeight: "bold" } }, text(files.length + " files selected")),
    );
  }

  // Every category any of them has - in the order there is to them - faded
  // where only some do. Removing one takes it from all; adding one gives
  // it to all.
  buildCategories(files) {
    const shown = vault.categories.filter((category) => files.some((file) => hasCategory(file, category)));
    const onAll = shown.filter((category) => files.every((file) => hasCategory(file, category)));
    return div(
      { key: "categories", style: { display: "flex", flexDirection: "column", gap: "8px", paddingTop: "12px", borderTop: border } },
      div({ style: { fontSize: "13px", fontWeight: "bold" } }, text("Categories")),
      div(
        { style: { display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" } },
        shown.map((category) => chip({
          key: category.id,
          label: category.name,
          faded: !onAll.includes(category),
          title: onAll.includes(category) ? undefined : "Only some of them",
          onRemove: callback("remove" + category.id, () => files.forEach((file) => removeCategory(file, category))),
        })),
        shown.length === 0 ? div({ key: "none", style: { fontSize: "13px", color: themeColor.textSoft } }, text("None yet")) : null,
        iconButton({
          key: "add",
          icon: "add",
          title: "Add a category",
          onClick: callback("startAdding", (event) => {
            this.anchor = event.currentTarget;
            this.adding = true;
            focusSoon("addCategory");
          }),
        }),
      ),
      new CategoryPicker({
        title: files.length === 1 ? "Add a category" : "Add a category to all " + files.length,
        anchor: this.anchor,
        showing: this.adding,
        leaveOut: onAll,
        allowCreate: true,
        focusName: "addCategory",
        close: callback("stopAdding", () => { this.adding = false; }),
        onPick: callback("add", (category) => {
          this.adding = false;
          files.forEach((file) => addCategory(file, category));
        }),
      }),
    );
  }
}

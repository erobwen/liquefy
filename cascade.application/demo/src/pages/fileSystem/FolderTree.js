import { Component, callback } from "@liquefy/cascade.component";
import { div, span, text } from "@liquefy/cascade.dom";
import { icon, iconButton, themeColor } from "@liquefy/cascade.ui";
import { vault, folderPath, filesIn, addFolder, removeFolder } from "./model.js";
import { CategoryPicker, focusSoon, border } from "./parts.js";

/**
 * The folders - filter folders, each showing the files that have its
 * category and those of the folders above it. A tree to browse, a place
 * to drop files on (they get what they need to show there), and buttons
 * to add a folder under the one shown, or remove it.
 *
 *  - current: the folder shown, if the path shown is one's.
 *  - onSelect(folder): the user picked one.
 *  - dragging: the files being dragged, if any - a folder takes them.
 *  - onDrop(folder): they were dropped on it.
 */
export class FolderTree extends Component {
  setProperties({ current, onSelect, dragging, onDrop }) {
    this.current = current || null;
    this.onSelect = onSelect || null;
    this.dragging = dragging || null;
    this.onDrop = onDrop || null;
  }

  initialState() {
    return { adding: false, anchor: null, dropTarget: null };
  }

  build() {
    const rows = [];
    const visit = (folder, depth) => {
      rows.push(this.buildRow(folder, depth));
      if (folder.open) for (const child of folder.children) visit(child, depth + 1);
    };
    visit(vault.root, 0);

    const current = this.current;
    const leaveOut = current ? [...folderPath(current), ...current.children.map((child) => child.category).filter(Boolean)] : [];
    return div(
      { style: { display: "flex", flexDirection: "column", height: "100%", minHeight: 0 } },
      div({ style: { flex: "1 1 auto", minHeight: 0, overflowY: "auto", padding: "8px 0" } }, rows),
      div(
        { style: { flex: "none", display: "flex", alignItems: "center", gap: "4px", padding: "6px 8px", borderTop: border } },
        div({ style: { flex: "1 1 auto", fontSize: "12px", color: themeColor.textSoft } }, text(current ? "In “" + current.name + "”:" : "Pick a folder")),
        iconButton({
          icon: "create_new_folder",
          title: "New folder in this one",
          disabled: !current,
          onClick: callback("startAdding", (event) => {
            this.anchor = event.currentTarget;
            this.adding = true;
            focusSoon("newFolder");
          }),
        }),
        iconButton({
          icon: "folder_delete",
          title: "Remove this folder",
          disabled: !current || current === vault.root,
          onClick: callback("remove", () => {
            const parent = current.parent;
            removeFolder(current);
            if (this.onSelect) this.onSelect(parent);
          }),
        }),
      ),
      new CategoryPicker({
        title: "New folder, for the category",
        anchor: this.anchor,
        showing: this.adding && !!current,
        leaveOut,
        allowCreate: true,
        focusName: "newFolder",
        close: callback("stopAdding", () => { this.adding = false; }),
        onPick: callback("add", (category) => {
          this.adding = false;
          const added = addFolder(current, category);
          if (this.onSelect) this.onSelect(added);
        }),
      }),
    );
  }

  // A folder: its chevron (if it has folders in it), icon, name, and how
  // many files it shows. Takes dragged files.
  buildRow(folder, depth) {
    const selected = folder === this.current;
    const dropping = this.dragging && this.dropTarget === folder;
    const count = filesIn(folderPath(folder)).length;
    return div(
      {
        key: folder.id,
        onclick: callback("select" + folder.id, () => this.onSelect && this.onSelect(folder)),
        ondragover: callback("over" + folder.id, (event) => {
          if (!this.dragging) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
          if (this.dropTarget !== folder) this.dropTarget = folder;
        }),
        ondragleave: callback("leave" + folder.id, () => {
          if (this.dropTarget === folder) this.dropTarget = null;
        }),
        ondrop: callback("drop" + folder.id, (event) => {
          event.preventDefault();
          this.dropTarget = null;
          if (this.onDrop) this.onDrop(folder);
        }),
        style: {
          display: "flex", alignItems: "center", gap: "4px", height: "34px", boxSizing: "border-box",
          padding: "0 10px 0 " + (4 + depth * 16) + "px", cursor: "pointer", userSelect: "none",
          background: dropping ? themeColor.accentSoft : selected ? themeColor.accentFaint : "transparent",
          borderLeft: "3px solid " + (selected ? themeColor.accent : "transparent"),
          outline: dropping ? "2px dashed " + themeColor.accent : "none", outlineOffset: "-2px",
        },
      },
      folder.children.length > 0
        ? iconButton({
          icon: folder.open ? "expand_more" : "chevron_right",
          title: folder.open ? "Collapse" : "Expand",
          style: { flex: "none", width: "24px", height: "24px", padding: 0 },
          onClick: callback("toggle" + folder.id, (event) => {
            event.stopPropagation();
            folder.open = !folder.open;
          }),
        })
        : span({ style: { flex: "none", width: "24px" } }),
      icon({ name: folder.icon || (selected ? "folder_open" : "folder"), style: { flex: "none", fontSize: "20px", color: selected ? themeColor.accent : themeColor.textSoft } }),
      span({ style: { flex: "1 1 auto", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: selected ? "bold" : "normal" } }, text(folder.name)),
      span({ style: { flex: "none", fontSize: "12px", color: themeColor.textSoft } }, text(String(count))),
    );
  }
}

import { Component, callback } from "@liquefy/cascade.component";
import { div, text, flipAnimationContainer } from "@liquefy/cascade.dom";
import { card, iconButton, dropdown, drawers, drawerPanel, themeColor } from "@liquefy/cascade.ui";
import { pageActions } from "../../components/pageActions.js";
import { animationControls } from "../../components/animationControls.js";
import { fullPage } from "../../components/layout.js";
import { vault, folderPath, folderForPath, filesIn, splitBySubFolders, sorted, sortOrders, fileInto } from "./model.js";
import "./demoData.js";
import { PathBar } from "./PathBar.js";
import { FolderTree } from "./FolderTree.js";
import { FileDetails } from "./FileDetails.js";
import { fileArea, splitLine } from "./FileGrid.js";
import { border } from "./parts.js";
import source from "./FileSystemPage.js?raw";

// What this page's information button shows (see ../../components/pageActions.js).
const information = {
  summary: "A file system of tags and folders - ported from a React Native proof of concept (erobwen/filesystem).",
  points: [
    "Files have categories - tags. A folder is a filter: it shows the files that have its category, and those of the folders above it. A file can be in many folders at once.",
    "The path bar shows the path - the categories intersected. Type in it to search: a search is just a path, and a path that's a folder's shows that folder.",
    "Show unsorted: the files of a folder that none of its folders shows - the ones that need more categories. Give them one in the details, or drag them onto a folder, and watch them move.",
    "Make the window narrower: the details go into a drawer, then the folders do, until all that's left is the search, with the files.",
  ],
};

const sortChoices = Object.entries(sortOrders).map(([value, order]) => ({ value, label: order.label }));

// Wide enough for the folders, the files and the details side by side - or
// for the folders and the files. Narrower, only the files - and the path
// bar, searching them.
const FULL = 1000;
const TWO = 700;
const FOLDERS_WIDTH = 250;
const DETAILS_WIDTH = 290;

/**
 * File System - the page. Everything shown follows from its state:
 *
 *  - path: the categories shown (the path bar's) - and folder, the folder
 *    picked, when its path is that: of two folders with the same path,
 *    the one picked is the one shown as picked.
 *  - selectedIds: the files selected.
 *  - sortOrder, showUnsorted: how the files are shown.
 *  - foldersOpen, detailsOpen: the drawers, when the folders or the
 *    details don't fit beside the files.
 *  - dragging: the files being dragged onto a folder.
 *
 * Laid out by the room it has - its own width, measured where it's placed
 * (the app's work area - see ApplicationMenuFrame).
 */
export class FileSystemPage extends Component {
  initialState() {
    return {
      path: [], folder: vault.root, selectedIds: [], sortOrder: "name", showUnsorted: false,
      foldersOpen: false, detailsOpen: false, dragging: null,
      animate: true, speed: 1,
    };
  }

  // The layout for the room there is: "full", "two" or "search".
  layout() {
    const width = this.fromTarget("width");
    if (typeof(width) !== "number" || width >= FULL) return "full";
    return width >= TWO ? "two" : "search";
  }

  selectFolder(folder) {
    this.folder = folder;
    this.path = folderPath(folder);
    this.selectedIds = [];
    this.foldersOpen = false;
  }

  // A path typed is a folder's, if one has it: that folder is shown - the
  // folders above it opened, so it's seen to be.
  setPath(path) {
    this.path = path;
    this.folder = folderForPath(path, this.folder);
    for (let above = this.folder && this.folder.parent; above; above = above.parent) above.open = true;
    this.selectedIds = [];
  }

  clickFile(file, event) {
    if (event.ctrlKey || event.metaKey) {
      this.selectedIds = this.selectedIds.includes(file.id)
        ? this.selectedIds.filter((id) => id !== file.id)
        : [...this.selectedIds, file.id];
    } else {
      this.selectedIds = [file.id];
    }
    this.detailsOpen = this.selectedIds.length > 0;
  }

  // Dragging a file drags the selection - or just it, if it's not selected.
  dragFile(file) {
    if (!this.selectedIds.includes(file.id)) this.selectedIds = [file.id];
    this.dragging = [...this.selectedIds];
  }

  drop(target) {
    const ids = this.dragging || [];
    this.dragging = null;
    for (const file of vault.files) if (ids.includes(file.id)) fileInto(file, target);
  }

  build() {
    const layout = this.layout();
    const current = folderForPath(this.path, this.folder);
    const selected = vault.files.filter((file) => this.selectedIds.includes(file.id));

    const folders = new FolderTree({
      key: "folders",
      current,
      dragging: this.dragging,
      onSelect: callback("selectFolder", (folder) => this.selectFolder(folder)),
      onDrop: callback("drop", (folder) => this.drop(folder)),
    });
    const details = new FileDetails({ key: "details", files: selected });

    // What doesn't fit beside the files: in drawers, over them - below the
    // path bar, which stays usable.
    const panels = [];
    if (layout === "search") {
      panels.push(drawerPanel(
        { side: "left", open: this.foldersOpen, close: callback("closeFolders", () => { this.foldersOpen = false; }), title: "Folders", size: FOLDERS_WIDTH },
        folders,
      ));
    }
    if (layout !== "full") {
      panels.push(drawerPanel(
        { side: "right", open: this.detailsOpen && selected.length > 0, close: callback("closeDetails", () => { this.detailsOpen = false; }), title: "Details", size: Math.min(DETAILS_WIDTH, 340) },
        details,
      ));
    }

    const content = div(
      { key: "content", style: { flex: "1 1 auto", minWidth: 0, display: "flex", flexDirection: "column" } },
      this.buildPathBar(layout, current),
      div(
        { style: { flex: "1 1 auto", minHeight: 0, position: "relative", display: "flex", flexDirection: "column" } },
        this.buildFiles(layout, current),
        panels.length > 0 ? drawers({ key: "drawers", modal: layout === "search", animate: this.animate, speed: this.speed }, panels) : null,
      ),
    );

    return fullPage(
      pageActions({ information, source, fileName: "src/pages/fileSystem/FileSystemPage.js" }),
      animationControls({
        animate: this.animate,
        speed: this.speed,
        onAnimate: callback("animate", (animate) => { this.animate = animate; }),
        onSpeed: callback("speed", (speed) => { this.speed = speed; }),
      }),
      card(
        { style: { flex: "1 1 auto", minHeight: 0, padding: 0, position: "relative", overflow: "hidden", display: "flex" } },
        layout !== "search"
          ? div({ key: "folderPanel", style: { flex: "none", width: FOLDERS_WIDTH + "px", borderRight: border, minHeight: 0 } }, folders)
          : null,
        content,
        layout === "full"
          ? div({ key: "detailsPanel", style: { flex: "none", width: DETAILS_WIDTH + "px", borderLeft: border, overflowY: "auto" } }, details)
          : null,
      ),
    );
  }

  // The path - and, before it, a button opening the folders when they're
  // in a drawer; after it, how the files are shown.
  buildPathBar(layout, current) {
    const canSplit = !!current && current.children.length > 0;
    return new PathBar({
      key: "pathBar",
      path: this.path,
      onPath: callback("path", (path) => this.setPath(path)),
      leading: layout === "search"
        ? [iconButton({ key: "openFolders", icon: "folder", title: "Folders", onClick: callback("openFolders", () => { this.foldersOpen = true; }) })]
        : [],
      trailing: [
        iconButton({
          key: "unsorted",
          icon: "rule_folder",
          title: canSplit ? (this.showUnsorted ? "Show all together" : "Show unsorted - what none of the folders in this one shows") : "No folders in this one to sort into",
          disabled: !canSplit,
          style: this.showUnsorted && canSplit ? { color: themeColor.accent, background: themeColor.accentSoft } : {},
          onClick: callback("toggleUnsorted", () => { this.showUnsorted = !this.showUnsorted; }),
        }),
        dropdown({
          key: "sortOrder",
          title: "Sort by",
          options: sortChoices,
          value: this.sortOrder,
          onSelect: callback("sortOrder", (order) => { this.sortOrder = order; }),
        }),
      ],
    });
  }

  // The files of the path - sorted; or split in two: those none of the
  // folder's own folders shows, above those some of them does.
  buildFiles(layout, current) {
    const size = layout === "search" ? 96 : 120;
    const common = {
      size,
      selectedIds: this.selectedIds,
      onClickFile: (file, event) => this.clickFile(file, event),
      onClickEmpty: callback("clearSelection", () => { this.selectedIds = []; }),
      onDragFile: (file) => this.dragFile(file),
      onDragEnd: callback("dragEnd", () => { this.dragging = null; }),
    };
    let areas;
    if (this.showUnsorted && current && current.children.length > 0) {
      const { unsorted, sorted: sortedFiles } = splitBySubFolders(current, this.path);
      const names = current.children.map((child) => child.name).join(", ");
      areas = [
        fileArea({
          ...common, key: "unsortedFiles", title: "Unsorted", note: "in none of " + names,
          files: sorted(unsorted, this.sortOrder),
          empty: "Every file here is in one of its folders.",
        }),
        fileArea({
          ...common, key: "sortedFiles", title: "Sorted", note: "in " + names, style: splitLine,
          files: sorted(sortedFiles, this.sortOrder),
          empty: "None of the files here is in any of its folders yet.",
        }),
      ];
    } else {
      areas = [fileArea({
        ...common, key: "allFiles",
        files: sorted(filesIn(this.path), this.sortOrder),
        empty: "No file has all of these categories.",
      })];
    }
    // Animated: a file given a category moves from Unsorted to Sorted -
    // the same element - and files coming and going fade.
    const style = { flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column" };
    return this.animate
      ? flipAnimationContainer({ key: "animated", speed: this.speed, confine: true, style }, areas)
      : div({ key: "still", style }, areas);
  }
}

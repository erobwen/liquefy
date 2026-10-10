import { callback } from "@liquefy/cascade.component";
import { div, img, text } from "@liquefy/cascade.dom";
import { themeColor } from "@liquefy/cascade.ui";
import { border } from "./parts.js";

/**
 * The files shown: thumbnails in a grid, wrapping - in one area, or (the
 * split view) in two, each scrolling on its own. Functions, not
 * components: the page builds them, so every thumbnail is keyed by its file
 * in one build - a file moving from one area to the other (tagged into a
 * sub-folder, say) is the same element, which the page's animation then
 * moves.
 *
 *  - fileArea({ key, title, files, ... }): an area - a title, if any, and
 *    the thumbnails, or `empty` when there are none.
 *  - thumbnail(file, ...): a file - its picture and name - selected or
 *    not, clickable, and draggable onto a folder.
 */

export function fileArea({ key, title, note, files, empty, size, selectedIds, onClickFile, onClickEmpty, onDragFile, onDragEnd, style }) {
  return div(
    {
      key,
      onclick: onClickEmpty,
      style: { flex: "1 1 0", minHeight: 0, overflowY: "auto", boxSizing: "border-box", padding: "12px 16px 16px", ...style },
    },
    title
      ? div(
        { key: key + "Title", style: { display: "flex", alignItems: "baseline", gap: "8px", margin: "0 0 10px", fontSize: "13px", color: themeColor.textSoft } },
        div({ style: { fontWeight: "bold", color: themeColor.text } }, text(title)),
        note ? div(text(note)) : null,
      )
      : null,
    files.length === 0
      ? div({ key: key + "Empty", style: { padding: "16px 0", color: themeColor.textSoft } }, text(empty))
      : div(
        { key: key + "Grid", style: { display: "flex", flexWrap: "wrap", gap: "10px", alignContent: "flex-start" } },
        files.map((file) => thumbnail(file, { size, selected: selectedIds.includes(file.id), onClickFile, onDragFile, onDragEnd })),
      ),
  );
}

export function thumbnail(file, { size, selected, onClickFile, onDragFile, onDragEnd }) {
  return div(
    {
      key: file.id,
      title: file.name,
      draggable: true,
      onclick: callback("click" + file.id, (event) => {
        event.stopPropagation();
        onClickFile(file, event);
      }),
      ondragstart: callback("drag" + file.id, (event) => {
        event.dataTransfer.effectAllowed = "copy";
        event.dataTransfer.setData("text/plain", file.name);
        onDragFile(file);
      }),
      ondragend: onDragEnd,
      style: {
        display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", width: size + 16 + "px",
        padding: "6px", boxSizing: "border-box", borderRadius: "8px", cursor: "pointer", userSelect: "none",
        background: selected ? themeColor.accentSoft : "transparent",
        border: "1px solid " + (selected ? themeColor.accent : "transparent"),
      },
    },
    img({
      src: file.image,
      alt: file.name,
      draggable: false,
      style: { width: size + "px", height: size * 0.8 + "px", objectFit: "contain", display: "block", pointerEvents: "none" },
    }),
    div(
      { style: { width: "100%", fontSize: "12px", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
      text(file.name),
    ),
  );
}

// The line between the two areas of the split view.
export const splitLine = { borderTop: border };

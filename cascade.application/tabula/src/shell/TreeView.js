import { Component, callback, frozen } from "@liquefy/cascade.component";
import { div, span, text } from "@liquefy/cascade.dom";
import { documentType, documentName } from "./documents.js";

/**
 * TreeView - the tree mode: the whole root (see documents.js) as a tree, as
 * a file explorer shows folders: the sequence, if there is one, the
 * documents in it, and what's in each - as its plugin tells
 * (`outline(model)`, see documents.js): a structured text's sections and
 * paragraphs, say. Folders open and close; a row is selected by clicking
 * it. Only looking, for now.
 *
 *   treeView({ documents, services, zoom })
 */
export class TreeView extends Component {
  setProperties({ documents, services, zoom = 1 }) {
    this.documents = documents;
    this.services = services;
    this.zoom = zoom;
  }

  initialState() {
    // closed: the folders closed, by path. selected: the row selected.
    return { closed: frozen({}), selected: null };
  }

  // The root as nodes - { label, icon, children } - the documents' own from
  // their plugins.
  nodes() {
    const documents = this.documents.map((document) => {
      const type = document.documentType && documentType(this.services, document.documentType.name);
      if (!type) return { label: documentName(document) + " - no plugin for it", icon: "help", children: [] };
      const title = type.title ? type.title(document.model) : "";
      return {
        label: type.label + (title ? " - " + title : ""),
        icon: type.icon || "description",
        children: type.outline ? type.outline(document.model) : [],
      };
    });
    return documents.length > 1 ? [{ label: "Sequence", icon: "view_agenda", children: documents }] : documents;
  }

  build() {
    const rows = [];
    const add = (nodes, depth, at) => nodes.forEach((node, index) => {
      const path = at === "" ? String(index) : at + "." + index;
      const open = !this.closed[path];
      rows.push({ node, depth, path, open });
      if (open) add(node.children, depth + 1, path);
    });
    add(this.nodes(), 0, "");
    return div(
      { style: { zoom: this.zoom } },
      div(
        { style: sheetStyle },
        // Keyed: rows come and go as folders open and close.
        rows.map(({ node, depth, path, open }) => this.row(node, depth, path, open)),
      ),
    );
  }

  row(node, depth, path, open) {
    const folder = node.children.length > 0;
    const selected = this.selected === path;
    return div(
      {
        key: path,
        onclick: callback("select" + path, () => { this.selected = path; }),
        style: {
          display: "flex", alignItems: "center", gap: "6px", padding: "3px 12px 3px " + (12 + depth * 20) + "px",
          cursor: "default", whiteSpace: "nowrap", fontSize: "14px",
          background: selected ? "#d3e3fd" : "transparent", color: "#1f1f1f",
        },
      },
      span(
        {
          class: "material-symbols-outlined",
          onclick: callback("toggle" + path, (event) => {
            if (!folder) return;
            event.stopPropagation();
            this.closed = frozen({ ...this.closed, [path]: open });
          }),
          style: { fontSize: "18px", width: "18px", color: "#5f6368", cursor: folder ? "pointer" : "default", visibility: folder ? "visible" : "hidden" },
        },
        text(open ? "expand_more" : "chevron_right"),
      ),
      span({ class: "material-symbols-outlined", style: { fontSize: "18px", color: folder ? "#c9a227" : "#5f6368" } }, text(folder && node.icon === "folder" && open ? "folder_open" : node.icon)),
      span({ style: { overflow: "hidden", textOverflow: "ellipsis" } }, text(node.label)),
    );
  }
}

const sheetStyle = {
  width: "100%", boxSizing: "border-box", background: "white", borderRadius: "8px", border: "1px solid #dadce0",
  boxShadow: "0 1px 4px rgba(0, 0, 0, 0.08)", padding: "8px 0", overflow: "hidden",
};

export const treeView = (...parameters) => new TreeView(...parameters);

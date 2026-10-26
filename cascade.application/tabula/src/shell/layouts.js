import { Component, callback } from "@liquefy/cascade.component";
import { div, span, text, button as htmlButton } from "@liquefy/cascade.dom";
import { card, iconButton, fitContainerStyle, drawers, drawerPanel, drawerBarSize } from "@liquefy/cascade.ui";
import { infoButton } from "../InfoButton.js";
import { contextMenuSlot } from "./contextMenus.js";

/**
 * The layouts - what each mode makes of the app as a whole (see
 * TabulaApp.js). The app has the same standard parts whatever the mode,
 * and hands them to the mode's layout, which places them where it likes:
 *
 *  - `actions`: what can be done with the document - new, open, save,
 *    print - each `{ icon, label, title, onClick, disabled }`.
 *  - `settings`: what's set up - the plugins in use (components).
 *  - `modes`, `mode`, `onMode(name)`: the mode selector.
 *  - `content`: the documents, as the mode shows them.
 *  - `menus`: the context menus of whatever has the focus (see
 *    contextMenus.js) - the root's and the focused leaf's, in two slots.
 *  - `fileName`, `message`: what's open, and what went wrong last.
 *
 * Two of them:
 *
 *  - PaperLayout - for paper: nothing around the papers but cards floating
 *    over them - the file's top left, the context menus top right (the
 *    root's above the leaf's), the mode's and the zoom's bottom right. Zoom is paper's alone (`zoom`, `onZoom(steps)`; null when
 *    there's nothing to zoom).
 *  - AppLayout - for the web, JSON and the tree: an application's frame - a
 *    drawer on the left (the file and the settings; a bar of shortcuts when
 *    closed), a bar along the bottom (what's open, the mode), and the
 *    context menus in a column on the right, while something has the focus -
 *    the content between them.
 */

// The modes, as buttons - icons only, or icons with labels.
function modeButtons({ modes, mode, onMode, labels }) {
  return modes.map((each) => {
    const active = each.name === mode;
    if (!labels) {
      return iconButton({
        icon: each.icon,
        title: each.label,
        onClick: () => onMode(each.name),
        style: active ? activeStyle : {},
      });
    }
    return htmlButton(
      {
        title: each.label,
        onclick: () => onMode(each.name),
        style: {
          display: "flex", alignItems: "center", gap: "6px", padding: "6px 12px", border: "none", borderRadius: "999px",
          font: "inherit", fontSize: "13px", cursor: "pointer", color: active ? activeStyle.color : "#3c4043",
          background: active ? activeStyle.background : "transparent",
        },
      },
      span({ class: "material-symbols-outlined", style: { fontSize: "20px" } }, text(each.icon)),
      text(each.label),
    );
  });
}

const activeStyle = { background: "#d3e3fd", color: "#0b57d0" };

export class PaperLayout extends Component {
  setProperties({ actions, settings, modes, mode, onMode, content, menus, fileName, message, zoom, onZoom }) {
    Object.assign(this, { actions, settings, modes, mode, onMode, content, menus, fileName, message, zoom, onZoom });
  }

  build() {
    return div(
      { style: { ...fitContainerStyle, position: "relative" } },
      this.content,
      card(
        { style: { ...floatingStyle, top: "12px", left: "12px", flexDirection: "column", alignItems: "stretch", gap: "2px" } },
        div(
          { style: { display: "flex", alignItems: "center", gap: "2px" } },
          this.actions.map((action) => iconButton({ icon: action.icon, title: action.title, disabled: action.disabled, onClick: action.onClick })),
          infoButton({ key: "settings", icon: "settings", title: "Settings", details: this.settings }),
        ),
        this.fileName ? note(this.fileName) : null,
        this.message ? errorNote(this.message) : null,
      ),
      // Top right: the context menus - the root's, then the leaf's - over
      // the papers, clear of the scroll bar and of the card below.
      div(
        { style: paperMenusStyle },
        contextMenuSlot({ menus: this.menus, which: "root" }),
        contextMenuSlot({ menus: this.menus, which: "focus" }),
      ),
      card(
        { style: { ...floatingStyle, right: "28px", bottom: "28px" } },
        div(
          { style: { display: "flex", alignItems: "center", gap: "2px", ...(this.zoom === null ? {} : { paddingRight: "8px", marginRight: "4px", borderRight: "1px solid #dadce0" }) } },
          modeButtons({ modes: this.modes, mode: this.mode, onMode: this.onMode, labels: false }),
        ),
        // Nothing to zoom, with no document.
        this.zoom === null ? null : [
          iconButton({ icon: "zoom_out", title: "Zoom out", onClick: () => this.onZoom(-1) }),
          div({ style: { minWidth: "48px", textAlign: "center" } }, text(Math.round(this.zoom * 100) + "%")),
          iconButton({ icon: "zoom_in", title: "Zoom in", onClick: () => this.onZoom(1) }),
        ],
      ),
    );
  }
}

export class AppLayout extends Component {
  setProperties({ actions, settings, modes, mode, onMode, content, menus, fileName, message }) {
    Object.assign(this, { actions, settings, modes, mode, onMode, content, menus, fileName, message });
  }

  initialState() {
    return { drawerOpen: true };
  }

  build() {
    const open = this.drawerOpen;
    // The context menus' column, while something has the focus.
    const menus = this.menus.path().length > 0;
    return div(
      { style: { ...fitContainerStyle, position: "relative", background: appBackdrop } },
      // Above the bottom bar: the content, clear of the drawer - or its bar -
      // and the drawer, over it.
      div(
        { style: { position: "absolute", top: 0, left: 0, right: 0, bottom: bottomBarHeight + "px" } },
        div(
          { style: { position: "absolute", top: 0, right: (menus ? menuColumnWidth : 0) + "px", bottom: 0, left: (open ? drawerWidth : drawerBarSize) + "px", overflow: "auto", transition: "left 200ms ease-out" } },
          this.content,
        ),
        menus
          ? div(
            { style: appMenusStyle },
            contextMenuSlot({ menus: this.menus, which: "root", style: { boxShadow: "none", border: "1px solid #dadce0" } }),
            contextMenuSlot({ menus: this.menus, which: "focus", style: { boxShadow: "none", border: "1px solid #dadce0" } }),
          )
          : null,
        drawers(
          { modal: false },
          drawerPanel(
            {
              side: "left", size: drawerWidth, title: this.fileName || "Untitled", collapsed: "bar",
              open, close: callback("close", () => { this.drawerOpen = false; }), onOpen: callback("open", () => { this.drawerOpen = true; }),
              // Closed, the actions as shortcuts.
              bar: open ? null : this.actions.map((action) => iconButton({ icon: action.icon, title: action.title, disabled: action.disabled, onClick: action.onClick })),
            },
            open ? this.panel() : div(),
          ),
        ),
      ),
      this.bottomBar(),
    );
  }

  // The drawer, open: the actions, with their names - and the settings.
  panel() {
    return div(
      { style: { display: "flex", flexDirection: "column", gap: "2px", padding: "4px 8px 16px" } },
      this.actions.map((action) => htmlButton(
        {
          title: action.title,
          disabled: action.disabled,
          onclick: action.onClick,
          style: {
            display: "flex", alignItems: "center", gap: "12px", padding: "8px 10px", border: "none", borderRadius: "8px",
            background: "transparent", font: "inherit", fontSize: "14px", textAlign: "left", color: "#1f1f1f",
            cursor: action.disabled ? "default" : "pointer", opacity: action.disabled ? 0.4 : 1,
          },
        },
        span({ class: "material-symbols-outlined", style: { fontSize: "20px", color: "#5f6368" } }, text(action.icon)),
        text(action.label),
      )),
      div({ style: { borderTop: "1px solid #e0e0e0", margin: "8px 0" } }),
      div({ style: { display: "flex", flexDirection: "column", gap: "6px", padding: "0 10px" } }, this.settings.flat(Infinity)),
    );
  }

  // Along the bottom: what's open - and what went wrong - and the mode.
  bottomBar() {
    return div(
      {
        style: {
          position: "absolute", left: 0, right: 0, bottom: 0, height: bottomBarHeight + "px", boxSizing: "border-box",
          display: "flex", alignItems: "center", gap: "12px", padding: "0 12px 0 16px",
          background: "white", borderTop: "1px solid #dadce0",
        },
      },
      div(
        { style: { flex: "1 1 auto", minWidth: 0, display: "flex", alignItems: "center", gap: "12px", fontSize: "13px", color: "#5f6368", overflow: "hidden", whiteSpace: "nowrap" } },
        text(this.fileName || "Not saved yet"),
        this.message ? span({ style: { color: "#b3261e", overflow: "hidden", textOverflow: "ellipsis" } }, text(this.message)) : null,
      ),
      div({ style: { display: "flex", alignItems: "center", gap: "2px" } }, modeButtons({ modes: this.modes, mode: this.mode, onMode: this.onMode, labels: true })),
    );
  }
}

// The web layout's document: a card as wide as the content - a header
// with what it is, and its remove button in a sequence - and the
// document's own view in it.
export function documentCard({ key, icon, label, title, onRemove, body }) {
  return div(
    { key, style: { background: "white", borderRadius: "12px", border: "1px solid #dadce0", overflow: "hidden" } },
    div(
      { style: { display: "flex", alignItems: "center", gap: "8px", padding: "6px 8px 6px 16px", borderBottom: "1px solid #ececec", color: "#5f6368", fontSize: "13px", minHeight: "40px", boxSizing: "border-box" } },
      span({ class: "material-symbols-outlined", style: { fontSize: "18px" } }, text(icon || "description")),
      span({ style: { fontWeight: 600, color: "#3c4043" } }, text(label)),
      title ? span({ style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, text(title)) : null,
      div({ style: { flex: "1 1 auto" } }),
      onRemove ? iconButton({ icon: "close", title: "Remove it from the sequence", onClick: onRemove }) : null,
    ),
    div({ style: { padding: "24px 32px 28px" } }, body),
  );
}

export const paperLayout = (...parameters) => new PaperLayout(...parameters);
export const appLayout = (...parameters) => new AppLayout(...parameters);

export const appBackdrop = "#f1f3f4";
const menuColumnWidth = 300;
const paperMenusStyle = {
  position: "absolute", top: "12px", right: "28px", bottom: "92px", width: "260px",
  display: "flex", flexDirection: "column", gap: "12px", overflowY: "auto", pointerEvents: "none",
};
const appMenusStyle = {
  position: "absolute", top: 0, right: 0, bottom: 0, width: menuColumnWidth + "px", boxSizing: "border-box",
  padding: "16px 12px", display: "flex", flexDirection: "column", gap: "12px", overflowY: "auto",
  background: "white", borderLeft: "1px solid #dadce0",
};
const drawerWidth = 260;
const bottomBarHeight = 52;
const floatingStyle = {
  position: "absolute", display: "flex", flexDirection: "row", alignItems: "center",
  padding: "6px 10px", boxShadow: "0 4px 16px rgba(0, 0, 0, 0.18)",
};
const note = (words) => div({ style: { opacity: 0.7, fontSize: "12px" } }, text(words));
const errorNote = (words) => div({ style: { fontSize: "12px", color: "#b3261e", maxWidth: "260px" } }, text(words));

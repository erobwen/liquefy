import { Component, callback } from "@liquefy/cascade.component";
import { div, span, text, button as htmlButton, flipAnimationContainer } from "@liquefy/cascade.dom";
import { card, iconButton, fitContainerStyle, drawers, drawerPanel, drawerBarSize } from "@liquefy/cascade.ui";
import { contextAccordion, menuNote } from "./contextMenus.js";
import { icon } from "./appStyle.js";
import { scrollColumn, gutterWidth, gutterEasing } from "./ScrollColumn.js";

/**
 * The layouts - what each mode makes of the app as a whole (see
 * TabulaApp.js). The app has the same standard parts whatever the mode,
 * and hands them to the mode's layout, which places them where it likes:
 *
 *  - `actions`: what can be done with the document - new, open, save,
 *    print, the settings (a modal dialog, see settingsDialog.js) - each
 *    `{ icon, label, title, onClick, disabled }`.
 *  - `creations`: what can be created where the focus is - an image, a
 *    table - each as an action.
 *  - `modes`, `mode`, `onMode(name)`: what the documents are shown on -
 *    the view, at the top of the context accordion (viewEntry()).
 *  - `content`: the documents, as the mode shows them.
 *  - `menus`: the context menus of whatever has the focus (see
 *    contextMenus.js) - the whole path, from the root down to the focused
 *    leaf, in an accordion under the view's.
 *  - `fileName`, `message`: what's open, and what went wrong last.
 *
 * Two of them:
 *
 *  - PaperLayout - for paper: nothing around the papers but cards floating
 *    over them - the file's top left, the creation menu under it, as wide;
 *    the context accordion top right, alone in its column, scrolling when
 *    it's taller than the window - from the window's very top to its very
 *    bottom, the cards dissolving as they near either edge - its scroll bar
 *    its own (see ScrollColumn.js), easing open beside the cards when
 *    there's something to scroll, closed when there isn't: the cards never
 *    change width, they move aside. Zoom is paper's alone (`zoom`,
 *    `onZoom(steps)`; null when there's nothing to zoom) - not the
 *    accordion's: a small card of its own, at the bottom right of the
 *    window - its right edge the accordion's - while there's room for it
 *    under the accordion; once the accordion grows to need that room,
 *    beside it, bottom left of it - moving from the one place to the
 *    other, as the accordion's cards open and close, in a
 *    FlipAnimationContainer.
 *  - AppLayout - for the web, JSON and the tree: an application's frame - a
 *    drawer on the left (the actions and the creation menu; a bar of
 *    shortcuts when closed), a bar along the bottom (what's open), and the
 *    context accordion in a column on the right - the content between them.
 */

// The view - what the documents are shown on - as the accordion's first
// entry: the root of everything in it, the whole of what's shown its
// subject.
function viewEntry({ modes, mode, onMode }) {
  const current = modes.find((each) => each.name === mode) || modes[0];
  return {
    key: "view",
    icon: current.icon,
    title: current.label,
    details: () => [menuNote("What the documents are shown on: their papers, a web page, their JSON as it's saved, a tree of what's in them.")],
    build: () => [
      div(
        { key: "modes", style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px" } },
        modes.map((each) => htmlButton(
          {
            key: "mode" + each.name,
            title: each.label,
            onclick: () => onMode(each.name),
            style: { ...modeStyle, ...(each.name === mode ? activeStyle : {}) },
          },
          icon(each.icon),
          text(each.label),
        )),
      ),
    ],
  };
}

const activeStyle = { background: "#d3e3fd", color: "#0b57d0" };
const modeStyle = {
  display: "flex", alignItems: "center", gap: "6px", padding: "5px 10px", border: "none", borderRadius: "999px",
  font: "inherit", fontSize: "13px", cursor: "pointer", color: "#3c4043", background: "transparent",
};

export class PaperLayout extends Component {
  setProperties({ actions, creations, modes, mode, onMode, content, menus, fileName, message, zoom, onZoom }) {
    Object.assign(this, { actions, creations: creations || [], modes, mode, onMode, content, menus, fileName, message, zoom, onZoom });
  }

  initialState() {
    // crowded: the accordion filling its column - the zoom moved out of it.
    // scrolls: the accordion's scroll bar there, beside its cards - the
    // zoom under them easing aside with them, to line up.
    return { crowded: false, scrolls: false };
  }

  initialUnobservables() {
    return { stopMeasuring: null };
  }

  // Whether the accordion leaves room under it for the zoom, followed as
  // the window and the accordion change size.
  onEstablish() {
    super.onEstablish();
    if (typeof(document) === "undefined" || typeof(ResizeObserver) === "undefined") return;
    let observer = null;
    let frame = null;
    const measure = () => {
      const area = document.querySelector("[data-menu-area]");
      const content = document.querySelector("[data-menu-content]");
      if (!area || !content) return false;
      const zoom = document.querySelector("[data-zoom]");
      // The cards and the room around them, and the zoom under them, the
      // room under it.
      const needed = content.offsetHeight + edgeTop * 2 + (zoom ? zoom.offsetHeight : 32) + edgeBottom;
      const crowded = needed > area.clientHeight;
      if (crowded !== this.crowded) this.crowded = crowded;
      if (!observer) {
        observer = new ResizeObserver(() => measure());
        observer.observe(area);
        observer.observe(content);
      }
      return true;
    };
    const find = () => { frame = measure() ? null : requestAnimationFrame(find); };
    find();
    this.unobservable.stopMeasuring = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      if (observer) observer.disconnect();
    };
  }

  onDispose() {
    if (this.unobservable.stopMeasuring) this.unobservable.stopMeasuring();
    super.onDispose();
  }

  build() {
    const zoom = this.zoomCard();
    const crowded = this.crowded;
    return div(
      { style: { ...fitContainerStyle, position: "relative" } },
      this.content,
      // Top left: the file's card, and the creation menu under it - as wide.
      div(
        { style: { position: "absolute", top: "12px", left: "12px", display: "flex", flexDirection: "column", alignItems: "stretch", gap: "12px" } },
        card(
          { style: { ...floatingStyle, position: "static", flexDirection: "column", alignItems: "stretch", gap: "2px", padding: "4px 6px" } },
          div(
            { style: { display: "flex", alignItems: "center", gap: "0" } },
            this.actions.map((action) => iconButton({ icon: action.icon, title: action.title, disabled: action.disabled, onClick: action.onClick })),
          ),
          this.fileName ? note(this.fileName) : null,
          this.message ? errorNote(this.message) : null,
        ),
        this.creations.length > 0
          ? card(
            { style: { ...floatingStyle, position: "static", flexDirection: "column", alignItems: "stretch", gap: "0", padding: "6px 4px" } },
            div({ style: { fontWeight: "bold", fontSize: "13px", padding: "0 8px 4px" } }, text("Create")),
            this.creations.map(creationButton),
          )
          : null,
      ),
      // Right: the accordion, alone in its column - the zoom under it, or
      // beside it when it's full.
      div(
        { "data-menu-area": "", style: menuAreaStyle },
        flipAnimationContainer(
          { style: { display: "flex", flexDirection: "row", alignItems: "flex-start", gap: "8px", height: "100%", pointerEvents: "none" } },
          div({ key: "aside", style: { alignSelf: "flex-end", display: "flex", pointerEvents: "auto" } }, crowded ? zoom : null),
          div(
            { key: "column", style: { display: "flex", flexDirection: "column", alignItems: "flex-end", height: "100%" } },
            scrollColumn(
              {
                key: "scroll",
                style: { flex: "0 1 auto", pointerEvents: "auto" },
                scrollStyle: { ...menuScrollStyle, paddingBottom: (crowded ? edgeBottom : edgeTop) + "px" },
                onScrolls: callback("scrolls", (scrolls) => { this.scrolls = scrolls; }),
              },
              div(
                { key: "content", "data-menu-content": "", style: { display: "flex", flexDirection: "column", gap: "8px" } },
                contextAccordion({ menus: this.menus, entries: [viewEntry(this), ...this.menus.path()] }),
              ),
            ),
            // Between them, the room left: the zoom at the bottom.
            div({ key: "room", style: { flex: "1 1 0", minHeight: 0 } }),
            // Its place under the cards: their right edge - inside the room
            // around them, and the scroll bar's, easing as it does. The slot's,
            // always there: flying in from beside the cards, the zoom lands
            // where it's to be, not where an easing of its own would start.
            div(
              { key: "zoomSlot", style: { display: "flex", pointerEvents: "none", paddingRight: cardsInset + (this.scrolls ? gutterWidth : 0) + "px", transition: "padding-right " + gutterEasing } },
              crowded ? null : zoom,
            ),
          ),
        ),
      ),
    );
  }

  // The zoom: small, out of the way - nothing to zoom, no document, none.
  zoomCard() {
    if (this.zoom === null) return null;
    return div(
      {
        key: "zoom",
        "data-zoom": "",
        style: {
          display: "flex", pointerEvents: "auto", flex: "none", marginBottom: edgeBottom + "px",
        },
      },
      card(
        { style: { ...floatingStyle, position: "static", padding: "2px 4px", gap: "0" } },
        iconButton({ icon: "zoom_out", title: "Zoom out", onClick: () => this.onZoom(-1) }),
        div({ style: { minWidth: "40px", textAlign: "center", fontSize: "12px" } }, text(Math.round(this.zoom * 100) + "%")),
        iconButton({ icon: "zoom_in", title: "Zoom in", onClick: () => this.onZoom(1) }),
      ),
    );
  }
}

export class AppLayout extends Component {
  setProperties({ actions, creations, modes, mode, onMode, content, menus, fileName, message }) {
    Object.assign(this, { actions, creations: creations || [], modes, mode, onMode, content, menus, fileName, message });
  }

  initialState() {
    return { drawerOpen: true };
  }

  build() {
    const open = this.drawerOpen;
    return div(
      { style: { ...fitContainerStyle, position: "relative", background: appBackdrop } },
      // Above the bottom bar: the content, clear of the drawer - or its bar -
      // and of the accordion's column, and the drawer, over it.
      div(
        { style: { position: "absolute", top: 0, left: 0, right: 0, bottom: bottomBarHeight + "px" } },
        div(
          { style: { position: "absolute", top: 0, right: menuColumnWidth + "px", bottom: 0, left: (open ? drawerWidth : drawerBarSize) + "px", overflow: "auto", transition: "left 200ms ease-out" } },
          this.content,
        ),
        flipAnimationContainer(
          { style: appMenusStyle },
          contextAccordion({ menus: this.menus, entries: [viewEntry(this), ...this.menus.path()], flat: true }),
        ),
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

  // The drawer, open: the actions, with their names - and the creation
  // menu.
  panel() {
    return div(
      { style: { display: "flex", flexDirection: "column", gap: "2px", padding: "4px 8px 16px" } },
      this.actions.map((action) => actionRow(action)),
      this.creations.length > 0
        ? [
          div({ style: { borderTop: "1px solid #e0e0e0", margin: "8px 0 4px" } }),
          div({ style: { fontWeight: "bold", fontSize: "13px", padding: "4px 10px" } }, text("Create")),
          this.creations.map(creationButton),
        ]
        : null,
    );
  }

  // Along the bottom: what's open - and what went wrong.
  bottomBar() {
    return div(
      {
        style: {
          position: "absolute", left: 0, right: 0, bottom: 0, height: bottomBarHeight + "px", boxSizing: "border-box",
          display: "flex", alignItems: "center", gap: "12px", padding: "0 12px 0 16px",
          background: "white", borderTop: "1px solid #dadce0", fontSize: "13px", color: "#5f6368", whiteSpace: "nowrap", overflow: "hidden",
        },
      },
      text(this.fileName || "Not saved yet"),
      this.message ? span({ style: { color: "#b3261e", overflow: "hidden", textOverflow: "ellipsis" } }, text(this.message)) : null,
    );
  }
}

// The web layout's document: a card as wide as the content - a header
// with what it is, and its remove button in a sequence - and the
// document's own view in it.
export function documentCard({ key, icon: iconName, label, title, onRemove, body }) {
  return div(
    { key, style: { background: "white", borderRadius: "12px", border: "1px solid #dadce0", overflow: "hidden" } },
    div(
      { style: { display: "flex", alignItems: "center", gap: "8px", padding: "6px 8px 6px 16px", borderBottom: "1px solid #ececec", color: "#5f6368", fontSize: "13px", minHeight: "40px", boxSizing: "border-box" } },
      icon(iconName || "description"),
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
const menuWidth = 280;
const menuColumnWidth = 300;
// The accordion's column runs the whole height: what keeps the cards off
// the window's edges at rest is room inside it - `edgeTop`, `edgeBottom` -
// so, scrolled, they go all the way, fading out over the last `fade` px.
// The scroll bar's room is kept whether it's there or not (a thin one).
const edgeTop = 12;
const edgeBottom = 16;
const fade = 10;
// The room either side of the cards, for their shadows - the column pushed
// that much further right, the cards where they'd be without it.
const cardsInset = 6;
const menuAreaStyle = { position: "absolute", top: 0, right: 16 - cardsInset + "px", bottom: 0, pointerEvents: "none" };
const fadedEdges = `linear-gradient(to bottom, transparent 0, black ${fade}px, black calc(100% - ${fade}px), transparent 100%)`;
const menuScrollStyle = {
  width: menuWidth + 2 * cardsInset + "px", padding: edgeTop + "px " + cardsInset + "px 0",
  maskImage: fadedEdges, WebkitMaskImage: fadedEdges,
};
const appMenusStyle = {
  position: "absolute", top: 0, right: 0, bottom: 0, width: menuColumnWidth + "px", boxSizing: "border-box",
  padding: "12px", display: "flex", flexDirection: "column", gap: "8px", overflowY: "auto", scrollbarGutter: "stable",
  background: "white", borderLeft: "1px solid #dadce0",
};
const drawerWidth = 260;
const bottomBarHeight = 40;
const floatingStyle = {
  position: "absolute", display: "flex", flexDirection: "row", alignItems: "center",
  padding: "6px 10px", boxShadow: "0 2px 10px rgba(0, 0, 0, 0.16)",
};
// An action, its icon and its name, in a row of its own.
function actionRow(action, extra = {}) {
  return htmlButton(
    {
      title: action.title,
      disabled: action.disabled,
      onclick: action.onClick,
      ...extra,
      style: {
        display: "flex", alignItems: "center", gap: "10px", padding: "6px 10px", border: "none", borderRadius: "8px",
        background: "transparent", font: "inherit", fontSize: "14px", textAlign: "left", color: "#1f1f1f",
        cursor: action.disabled ? "default" : "pointer", opacity: action.disabled ? 0.4 : 1,
      },
    },
    icon(action.icon, { color: "#5f6368" }),
    text(action.label),
  );
}

// Something to create, where the focus is: pressed, the text keeps the
// keyboard - and the caret. Or, where it can be dragged to its place,
// dragged.
const creationButton = (creation) => creation.onDragStart
  ? actionRow(creation, { draggable: true, ondragstart: (event) => { event.dataTransfer.setData("text/plain", creation.label); creation.onDragStart(); } })
  : actionRow(creation, { onmousedown: (event) => event.preventDefault() });

const note = (words) => div({ style: { opacity: 0.7, fontSize: "12px", padding: "0 4px" } }, text(words));
const errorNote = (words) => div({ style: { fontSize: "12px", color: "#b3261e", maxWidth: "260px", padding: "0 4px" } }, text(words));

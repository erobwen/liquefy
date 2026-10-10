import { Component, callback, frozen } from "@liquefy/cascade.component";
import { div, text, flipAnimationContainer } from "@liquefy/cascade.dom";
import { iconButton } from "./widgets.js";
import { modalBackdropColor } from "./Modal.js";
import { themeColor } from "./colorScheme.js";

/**
 * Drawers - panels that slide in from the edges of whatever they're placed
 * in, over what's there, and out again. One:
 *
 *   drawer({ open: this.filtersOpen, close, side: "right", title: "Filters" }, ...content)
 *
 * or several at once, one per edge - a navigation on the left and an
 * inspector on the right, say, each opened and closed on its own:
 *
 *   drawers({ modal: false },
 *     drawerPanel({ side: "left", open: this.navigationOpen, close: closeNavigation, title: "Pages" }, ...),
 *     drawerPanel({ side: "right", open: this.inspectorOpen, close: closeInspector, title: "Properties" }, ...))
 *
 * They cover their nearest positioned ancestor (`position: absolute`, the
 * whole of it), so that's what they slide over - a page's work area, a
 * card, the whole app. Wherever they're placed, they're best placed last,
 * so they're drawn above what comes before them.
 *
 * drawers({ modal, animate, speed }, ...panels):
 *
 *  - modal: a dimmed backdrop behind them while any is open, which closes
 *    every open one when clicked - for panels the user deals with before
 *    going on. Off by default: what's beside them stays usable, and each is
 *    closed by its button.
 *  - animate: whether they slide (default true). Off, they're just there,
 *    or not. `speed`: how fast, as FlipAnimationContainer's (see
 *    cascade.dom).
 *
 * drawerPanel({ open, close, onOpen, side, size, header, title, collapsed, bar, style }, ...content)
 * - one of them. Whether it's open is its owner's (`open`), changed by
 * whoever opens it - and by `close`, which it calls when the user closes
 * it: its chevron button, the backdrop, Escape.
 *
 *  - open: whether it's open.
 *  - close(): called when the user closes it.
 *  - onOpen(): called when the user opens it - from its handle or its bar
 *    (below).
 *  - side: "left" (the default), "right", "top" or "bottom" - the edge it
 *    slides in from. One panel per edge: a second on the same one is left
 *    out.
 *  - size: its width (from the left or right) or height (from the top or
 *    bottom) - pixels, or any CSS length ("80%"). 300 by default. Never
 *    more than the room it has.
 *  - header: a header with `title` and a chevron button that closes it (the
 *    default). With `header: false`, the content is the whole panel - a
 *    panel of its own, which closes it itself (calling `close`).
 *  - title: the header's title.
 *  - collapsed: what's left of it while it's closed.
 *     - "nothing" (the default): nothing at all.
 *     - "handle": a tab on its inner edge - a chevron that opens it
 *       (`onOpen`), and closes it again.
 *     - "bar": a thin bar along the edge (drawerBarSize wide) - the panel
 *       collapsed. At its start, a chevron that opens it; after that,
 *       `bar`. Opening it, the bar grows into the panel: what's in the bar
 *       and not in the panel fades out, what's in the panel and not in the
 *       bar fades in - and what's in both moves (see below).
 *    The bar covers a strip along the edge of what the drawers are over:
 *    leave room for it there (drawerBarSize).
 *  - bar: what's in the bar, after its chevron - shortcuts to what's in
 *    the panel, say: icon buttons, one under the other (one after the
 *    other, at the top or bottom). Shown only while it's closed, as the
 *    content is only while it's open.
 *
 *    Shared: a component the app puts in the bar while it's closed, and in
 *    the content while it's open - the same one, keyed - moves from one
 *    place to the other: a category's icon, in the bar, flies to its place
 *    beside the category's heading in the panel, and back. (It's in one or
 *    the other, never both: built where `open` says.) So does the chevron,
 *    from the bar to the header. To do that, what's in a panel collapsing
 *    to a bar isn't placed as one piece (see below): the container sees -
 *    and animates - every element in it, and a change in its structure
 *    places the whole of what it covers again.
 *  - style: the panel's own (its background, shadow, ...).
 *
 * drawer({ modal, animate, speed, ...panel }, ...content) is drawers() with
 * that one panel.
 *
 * How they move: a FlipAnimationContainer (see cascade.dom), around a
 * sheet per edge - all four always there, shown at their edge when open,
 * just past it when closed. Opening and closing is a sheet moving from one
 * place to the other, which the container animates - a spring, so closing
 * one halfway through opening turns it round smoothly. The backdrop comes
 * and goes, and fades as it does.
 *
 * A panel moving to another edge isn't carried across: the sheet it leaves
 * closes - looking as it did, but for its content, which fades out as it
 * goes - and the one it comes to opens with it, if it's open. The content
 * is the same - the components the app gave it, their state kept - shown
 * in another sheet.
 *
 * Closed, a panel is still there - built, its state kept (a scroll
 * position, a half-filled field), but inert: nothing in it can be clicked
 * or focused, and it's hidden from assistive technology.
 *
 * What's in a panel is animated by nothing: it's placed as one piece (an
 * island - see cascade.dom's DOMPlacingContainer), rendered as it would be
 * anywhere else - so changes in there are its own business, as efficient
 * as anywhere else. It fills the panel's body, and scrolls when it's
 * larger. Except in a panel collapsing to a bar: that doesn't slide, it
 * grows out of its bar, and what's in it is placed element by element, so
 * what it shares with the bar can move (see `collapsed`). A panel like
 * that moved to another edge while open has what's in it fly across.
 */
export function drawers(...parameters) {
  return new Drawers(...parameters);
}

export function drawerPanel(...parameters) {
  return new DrawerPanel(...parameters);
}

export function drawer(...parameters) {
  return new Drawer(...parameters);
}

// Per side: which of top/right/bottom/left it's placed by, whether its
// size is a width, and its chevrons - "close" pointing at its edge, "open"
// away from it. In the order their sheets are drawn: a later one over an
// earlier one, where they overlap.
const sides = {
  left: { edge: "left", horizontal: true, close: "chevron_left", open: "chevron_right" },
  right: { edge: "right", horizontal: true, close: "chevron_right", open: "chevron_left" },
  top: { edge: "top", horizontal: false, close: "expand_less", open: "expand_more" },
  bottom: { edge: "bottom", horizontal: false, close: "expand_more", open: "expand_less" },
};
const sideNames = Object.keys(sides);

const coverAll = { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", boxSizing: "border-box" };

// The panel's shadow - only while it's open: closed, it lies just past the
// edge, and its shadow would show along it.
const drawerShadow = "0 0 16px rgba(0, 0, 0, 0.25)";

// The handle's size: how far it sticks out, and how long it is.
const HANDLE_DEPTH = 28;
const HANDLE_LENGTH = 48;

// How thick a bar is (see `collapsed`) - the room to leave for it.
export const drawerBarSize = 48;

const collapsedModes = ["nothing", "handle", "bar"];

/**
 * One panel of a drawers() - what it shows, and how. Built by the app,
 * shown by the drawers() it's given to: it's never rendered itself.
 */
export class DrawerPanel extends Component {
  setProperties({ open, close, onOpen, side, size, header, title, collapsed, bar, style, children }) {
    this.open = !!open;
    this.close = close || null;
    this.onOpen = onOpen || null;
    this.side = sides[side] ? side : "left";
    this.size = typeof(size) === "number" ? size + "px" : (size || "300px");
    this.header = header !== false;
    this.title = title || "";
    this.collapsed = collapsedModes.includes(collapsed) ? collapsed : "nothing";
    this.bar = bar || null;
    this.style = frozen(style || null);
    this.panelChildren = frozen(children || []);
  }

  build() {
    return null;
  }
}

export class Drawers extends Component {
  setProperties({ modal, animate, speed, children }) {
    this.modal = !!modal;
    this.animate = animate !== false;
    this.speed = typeof(speed) === "number" ? speed : null;
    this.panels = frozen(children || []);
  }

  // How each edge's panel looked last - its sheet still does, once the
  // panel has gone elsewhere, while it closes (see sheetLook()).
  initialUnobservables() {
    return { looks: {} };
  }

  // The panel at each edge, now - the first one there.
  panelsBySide() {
    const result = {};
    for (const panel of this.panels) {
      if (!(panel instanceof DrawerPanel)) {
        throw new Error("drawers() takes drawerPanel()s only.");
      }
      if (result[panel.side]) {
        console.warn("drawers(): two panels on the " + panel.side + " edge - the second is left out.");
        continue;
      }
      result[panel.side] = panel;
    }
    return result;
  }

  build() {
    const panels = this.panelsBySide();
    const anyOpen = sideNames.some((side) => panels[side] && panels[side].open);
    // Each edge's: its sheet's handle and its bar both use it - named once.
    const toggles = {};
    for (const side of sideNames) toggles[side] = this.toggleCallback(side);
    // Every open one - as they are when it's clicked.
    const closeAll = callback("closeAll", () => {
      const now = this.panelsBySide();
      for (const side of sideNames) {
        const panel = now[side];
        if (panel && panel.open && panel.close) panel.close();
      }
    });

    return flipAnimationContainer(
      {
        enabled: this.animate,
        speed: this.speed,
        // The backdrop fades in where it lies, below the panels - never
        // lifted above them.
        confine: true,
        // What's in a panel is the app's, placed as one piece - an island
        // - but for one collapsing to a bar (see buildSheet()).
        isUnit: isDrawerContent,
        style: { ...coverAll, overflow: "hidden", pointerEvents: "none" },
      },
      // Below the sheets: a bar is usable over it.
      div({
        key: "backdrop",
        onclick: closeAll,
        style: { ...coverAll, pointerEvents: "auto", background: modalBackdropColor },
      }).showIf(this.modal && anyOpen),
      sideNames.map((side) => this.buildSheet(side, panels[side] || null, toggles[side])),
    );
  }

  // Opens the panel at `side` if it's closed, closes it if it's open.
  toggleCallback(side) {
    return callback(side + "Toggle", () => {
      const now = this.panelsBySide()[side];
      if (now) this.call(side, now.open ? "close" : "onOpen");
    });
  }

  // How an edge's sheet looks: as its panel says - or, with none there
  // now, as the last one did (it's closing, or closed), so a panel moving
  // elsewhere leaves a sheet that closes as it was.
  sheetLook(side, panel) {
    const u = this.unobservable;
    if (panel) {
      u.looks[side] = { size: panel.size, header: panel.header, title: panel.title, style: panel.style };
    }
    return u.looks[side] || { size: "300px", header: false, title: "", style: null };
  }

  // Calls the panel at `side` - as it is when called - has, if it has it.
  call(side, name) {
    const panel = this.panelsBySide()[side];
    if (panel && panel[name]) panel[name]();
  }

  // An edge's sheet: what moves - and in it, the panel and its handle.
  // Keyed by its edge, as everything in it: each is the same element,
  // whatever else comes and goes.
  //
  // Most panels slide: at the edge when open, just past it when closed.
  // One collapsing to a bar doesn't: it's always at the edge, and grows
  // from the bar into the panel - showing, closed, the bar (a chevron, and
  // the app's `bar`), and open, the panel (its header - with that same
  // chevron - and its content). Nothing in it is an island, so the
  // container sees every element in it: what the app moves from the bar
  // into the content (the same component - keyed) flies to its new place,
  // and what's only in one fades in or out.
  buildSheet(side, panel, toggle) {
    const geometry = sides[side];
    const look = this.sheetLook(side, panel);
    const open = !!(panel && panel.open);
    const collapsed = panel ? panel.collapsed : "nothing";
    const handle = collapsed === "handle";
    const morphing = collapsed === "bar";
    const showingBar = morphing && !open;
    // Usable: open, or showing its bar.
    const usable = open || showingBar;

    // Along its whole edge, as deep as its size - or its bar - and, sliding,
    // just past the edge when closed: by its handle's depth more, when it
    // has none - then nothing at all shows of it.
    const depth = showingBar ? drawerBarSize + "px" : look.size;
    const across = geometry.horizontal
      ? { top: 0, height: "100%", width: depth, maxWidth: "100%" }
      : { left: 0, width: "100%", height: depth, maxHeight: "100%" };
    const past = handle ? "0px" : HANDLE_DEPTH + "px";
    const placed = {
      position: "absolute", boxSizing: "border-box", pointerEvents: "none", ...across,
      [geometry.edge]: open || morphing ? "0px" : `calc(0px - ${look.size} - ${past})`,
      // A stacking context of its own: its handle goes under its panel.
      zIndex: 0,
    };

    // Opens and closes it: in the header when open, at the start of the
    // bar when collapsed to it - the same button, moving between them. (A
    // sliding panel's is only ever seen open.)
    const chevronOpen = open || !morphing;
    const chevron = iconButton({
      key: side + "Chevron",
      icon: chevronOpen ? geometry.close : geometry.open,
      title: chevronOpen ? "Close" : "Open",
      onClick: toggle,
      style: { flex: "none" },
    });

    const inner = { left: "Right", right: "Left", top: "Bottom", bottom: "Top" }[side];
    const sheetPanel = div(
      {
        inert: !usable,
        "aria-hidden": usable ? undefined : "true",
        onkeydown: callback(side + "Keydown", (event) => {
          if (event.key !== "Escape" || !open) return;
          event.stopPropagation();
          this.call(side, "close");
        }),
        style: {
          ...coverAll, display: "flex", overflow: "hidden",
          background: themeColor.surface, color: themeColor.text,
          boxShadow: open ? drawerShadow : "none", transition: "box-shadow 0.3s",
          pointerEvents: usable ? "auto" : "none",
          ...(showingBar
            // The bar: the chevron and the app's shortcuts, one under the
            // other - or, along the top or the bottom, one after the other.
            ? {
              flexDirection: geometry.horizontal ? "column" : "row", alignItems: "center", gap: "4px",
              padding: geometry.horizontal ? "6px 0" : "0 6px", ["border" + inner]: "1px solid " + themeColor.border,
            }
            : { flexDirection: "column" }),
          ...look.style,
        },
      },
      showingBar ? chevron : null,
      showingBar && panel.bar ? this.buildBarItems(side, panel) : null,
      showingBar ? null : this.buildHeader(side, look, chevron).showIf(look.header),
      showingBar ? null : this.buildBody(side, panel, morphing),
    );

    return div(
      { key: side + "Sheet", style: placed },
      sheetPanel,
      this.buildHandle(side, open, toggle).showIf(handle),
    );
  }

  // A title, and the chevron at the end nearest the edge (the start, for
  // one on the right), pointing there.
  buildHeader(side, look, chevron) {
    const title = div({ style: { flex: "1 1 auto", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, text(look.title));
    return div(
      {
        key: side + "Header",
        style: {
          display: "flex", alignItems: "center", gap: "8px", flex: "none", minHeight: "48px", boxSizing: "border-box",
          padding: side === "right" ? "6px 16px 6px 6px" : "6px 6px 6px 16px",
          background: themeColor.chromeDark, color: themeColor.onChrome, fontWeight: "bold",
        },
      },
      ...(side === "right" ? [chevron, title] : [title, chevron]),
    );
  }

  // The panel's content. A grid of one cell: what's in it fills the body -
  // its own height, 100%, is the body's - and the body scrolls when it's
  // larger.
  //
  // Placed as one piece - an island, this edge's own: a panel coming here
  // from another edge is shown in a new one, appearing in this sheet, not
  // carried across. But morphing from and into a bar, it's placed element
  // by element, so what it shares with the bar moves between them.
  buildBody(side, panel, morphing) {
    const children = panel ? panel.panelChildren : [];
    return div(
      { key: side + "Body", style: { flex: "1 1 auto", minHeight: 0, overflow: "auto", display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gridTemplateRows: "1fr" } },
      morphing
        ? div({ key: side + "Morphing" }, children)
        : new DrawerContent({ key: side + "Content", children }).showIf(!!panel),
    );
  }

  // The app's shortcuts in the bar, after a line under the chevron.
  buildBarItems(side, panel) {
    const horizontal = sides[side].horizontal;
    return [
      div({
        key: side + "BarLine",
        style: { flex: "none", background: themeColor.border, ...(horizontal ? { width: "60%", height: "1px", margin: "2px 0" } : { height: "60%", width: "1px", margin: "0 2px" }) },
      }),
      div(
        { key: side + "BarItems", style: { display: "flex", flexDirection: horizontal ? "column" : "row", alignItems: "center", gap: "4px" } },
        [].concat(panel.bar),
      ),
    ];
  }

  // A tab sticking out of the panel's inner edge, at its middle - not
  // transformed into place: the container animating it owns its transform.
  buildHandle(side, open, toggle) {
    const geometry = sides[side];
    const middle = `calc(50% - ${HANDLE_LENGTH / 2}px)`;
    const corners = { left: "0 8px 8px 0", right: "8px 0 0 8px", top: "0 0 8px 8px", bottom: "8px 8px 0 0" }[side];
    const placement = geometry.horizontal
      ? { top: middle, width: HANDLE_DEPTH + "px", height: HANDLE_LENGTH + "px", [side]: "100%" }
      : { left: middle, height: HANDLE_DEPTH + "px", width: HANDLE_LENGTH + "px", [side]: "100%" };
    return div(
      {
        key: side + "Handle",
        style: {
          position: "absolute", ...placement, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center",
          borderRadius: corners, background: themeColor.surface, color: themeColor.text, boxShadow: drawerShadow, pointerEvents: "auto",
          // Its shadow under the panel's: it's part of it.
          zIndex: -1,
        },
      },
      iconButton({
        icon: open ? geometry.close : geometry.open,
        title: open ? "Close" : "Open",
        onClick: toggle,
        style: { flex: "none", width: "100%", height: "100%", padding: 0, minWidth: 0 },
      }),
    );
  }
}

// drawers() with one panel - see the module doc.
export class Drawer extends Component {
  setProperties({ modal, animate, speed, children, ...panel }) {
    this.modal = !!modal;
    this.animate = animate !== false;
    this.speed = typeof(speed) === "number" ? speed : null;
    this.panel = frozen(panel);
    this.drawerChildren = frozen(children || []);
  }

  build() {
    return drawers(
      { modal: this.modal, animate: this.animate, speed: this.speed },
      drawerPanel({ ...this.panel, children: this.drawerChildren }),
    );
  }
}

// The same function every build - a new one would count as a change.
const isDrawerContent = (component) => component instanceof DrawerContent;

// What's in a drawer's panel - placed as one piece (see Drawers.build()).
class DrawerContent extends Component {
  setProperties({ children }) {
    this.contentChildren = frozen(children || []);
  }

  build() {
    return this.contentChildren;
  }
}

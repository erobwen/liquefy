import { Component } from "@liquefy/cascade.component";
import { div, button, contextContainer, DOMElementBoundsProvider } from "@liquefy/cascade.dom";
import { overlayFrame } from "@liquefy/cascade.ui";

const MENU_WIDTH = 220;
const TOP_BAR_HEIGHT = 48;

/**
 * ApplicationMenuFrame - replaces the demo's previous Toolbar/MenuFrame/
 * MainFrame/HamburgerButton split (see this file's own git history) with
 * a single component, faithfully replicating flow.application/demo's own
 * ApplicationMenuFrame layout: a left drawer (docked, or - below
 * MENU_WIDTH*3 wide - a modal overlay) beside a column of [top bar
 * (hamburger + toolbar content, one row), work area]. The hamburger now
 * lives *inside* the top bar row, not absolutely positioned below it -
 * that was the actual visual bug this restructuring fixes.
 *
 * Built with cascade.ui's overlayFrame() (see cascade.ui/src/OverlayFrame.js),
 * using its `overlayContent` property directly rather than the separate
 * Overlay/inherit("overlayFrame") path - matching flow's own
 * `overlayContent: this.menuOpen && menuIsModal ? this.buildModalMenuDrawer() : null`.
 * There's no cross-component lookup to do here: the component that owns
 * `menuOpen` (this one) is the same one that owns the OverlayFrame.
 *
 * This component only implements build() (see cascade.component/README.md's
 * "most components should only implement build()" - render() is meant to
 * stay the exception, mostly implemented by cascade.DOM-level components,
 * not application code like this one): the real, imperative measurement
 * that used to force a custom render() here - getBoundingClientRect(),
 * deciding menuIsModal and how much space the work area has - now lives in
 * DOMElementBoundsProvider (cascade.dom), which also owns the one window
 * resize listener that measurement needs. build() below wraps this frame's
 * actual layout in one of those, as ApplicationMenuFrameLayout - the direct
 * child that reads the measurement back out via `this.renderContext` (see
 * Component.js's own renderOnto(), which sets that unconditionally on every
 * component from whatever context it was actually renderOnto()'d with).
 * That "direct child" placement isn't incidental: bounds measured this way
 * only mean anything one hop down from where they were measured, which is
 * exactly the render()-per-hop, RenderContext-based propagation gives you -
 * unlike a named inherit()/provide() lookup, which would keep resolving to
 * this same DOMElementBoundsProvider regardless of how many further layout
 * boundaries a deeper descendant sits behind.
 *
 * This is the frame's own root, rendered directly by index.js, which hands
 * it a DOMTarget-based context to begin with - so DOMElementBoundsProvider's
 * own div ends up as a *direct* child of #application, no unstyled
 * intermediate div for a percentage height to get lost in (see this file's
 * own git history for the bug that came from exactly that, when this frame
 * still routed through an intermediate bridging div here).
 *
 * The work area's own page content (Introduction/ProgrammaticReactiveLayout)
 * is reached via contextContainer() (see cascade.DOM/src/DOMContextContainer.js),
 * which owns `workArea`'s own real, styled div and hands the page a fresh
 * context extended with usableWidth/usableHeight - not a bridge between two
 * different target abstractions (there's only DOMTarget now), just a
 * container that adds situational context for what it renders.
 */
export class ApplicationMenuFrame extends Component {
  setProperties({ pages }) {
    this.pages = pages;
  }

  // Which page is showing and whether the modal menu is open are *state*
  // (see cascade.component/README.md): established once here, changed only
  // by the user - choose(), the hamburger and the backdrop (see
  // ApplicationMenuFrameLayout below) are all event handlers, outside any
  // repeater - and never reset by a rebuild.
  initializeState() {
    return { chosen: this.pages[0].key, menuOpen: false };
  }

  choose(key) {
    this.chosen = key;
    this.menuOpen = false;
  }

  currentPage() {
    return this.pages.find((page) => page.key === this.chosen);
  }

  build() {
    return new DOMElementBoundsProvider({
      key: "bounds",
      className: "application-menu-frame",
      style: { position: "relative", boxSizing: "border-box", height: "100%", overflow: "hidden" },
      child: new ApplicationMenuFrameLayout({ key: "layout", frame: this }),
    });
  }
}

// The direct child of the DOMElementBoundsProvider ApplicationMenuFrame
// builds above - the one place entitled to read the measured bounds back
// out of `this.renderContext` (see ApplicationMenuFrame's own class doc).
// Everything state-related (chosen page, menu open/closed) still belongs to
// `frame`, reached the same way MenuList already reaches it below.
class ApplicationMenuFrameLayout extends Component {
  setProperties({ frame }) {
    this.frame = frame;
  }

  build() {
    const { frame } = this;
    const bounds = this.renderContext;
    if (!bounds || typeof(bounds.width) !== "number") {
      throw new Error("ApplicationMenuFrameLayout requires bounds from a DOMElementBoundsProvider ancestor.");
    }

    const menuIsModal = bounds.width < MENU_WIDTH * 3;
    const workAreaWidth = (menuIsModal ? bounds.width : bounds.width - MENU_WIDTH) - 32;
    const workAreaHeight = bounds.height - TOP_BAR_HEIGHT - 32;

    // Going wide closes an open modal menu - the drawer is docked now, so
    // there's nothing for `menuOpen` to mean. That's a *state* change on
    // `frame`, caused by the user resizing rather than by the pipeline
    // recomputing - setState() (rather than a plain assignment) is what
    // makes writing it from here, inside this component's own build()
    // repeater, sanctioned (same shape as cascade.ui's OverlayFrame.
    // showOverlay(), called from Overlay.render()).
    if (!menuIsModal) frame.setState({ menuOpen: false });

    const page = frame.currentPage();

    const topBar = div(
      { key: "topBar", style: {
        height: TOP_BAR_HEIGHT + "px", boxSizing: "border-box", display: "flex", alignItems: "center",
        gap: "12px", padding: "0 16px", background: "#2c3e50", color: "white", flex: "none",
      } },
      button({
        key: "hamburger",
        onclick: () => { frame.menuOpen = !frame.menuOpen; },
        style: {
          width: "32px", height: "32px", border: "none", borderRadius: "4px",
          background: "#1a252f", color: "white", cursor: "pointer", flex: "none", fontSize: "16px",
        },
      }, "☰").show(menuIsModal && !frame.menuOpen),
      div({ key: "label" }, "Toolbar"),
    );

    const workArea = contextContainer({
      key: "workArea",
      child: page.component,
      style: {
        flex: "1 1 auto", minHeight: 0, boxSizing: "border-box", padding: "16px",
        background: "#ecf0f1", overflow: "auto",
      },
      context: { usableWidth: workAreaWidth, usableHeight: workAreaHeight },
    });

    const column = div(
      { key: "column", style: { display: "flex", flexDirection: "column", flex: "1 1 auto", minWidth: 0, height: "100%" } },
      topBar,
      workArea,
    );

    const drawer = menuIsModal ? null : new MenuList({
      key: "menu", frame,
      style: { width: MENU_WIDTH + "px", flex: "none", height: "100%" },
    });

    return overlayFrame(
      "overlayFrame",
      drawer,
      column,
      {
        style: { display: "flex", flexDirection: "row", width: "100%", height: "100%", boxSizing: "border-box", overflow: "hidden" },
        overlayContent: frame.menuOpen && menuIsModal ? buildModalMenuDrawer(frame) : null,
      },
    );
  }
}

// pointerEvents: "auto" on the backdrop and the drawer itself - OverlayFrame's
// own modalSubFrame wrapper (see cascade.ui/src/OverlayFrame.js) sets
// pointerEvents: "none" on *itself*, deliberately, so clicks pass through
// whatever part of its own area nothing here is using - but that's
// inherited by everything nested inside it too, including the parts that
// *are* in use, unless explicitly opted back in here. A real bug found via
// this exact demo: without this, neither the backdrop nor the menu items
// inside the drawer ever receive clicks at all - matches flow.application's
// own ApplicationMenuFrame, which sets this on both for the same reason.
function buildModalMenuDrawer(frame) {
  return div(
    { key: "modalDrawer", class: "modal-drawer", style: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "auto" } },
    div({
      key: "backdrop",
      class: "Foo",
      className: "backdrop",
      onclick: () => { frame.menuOpen = false; },
      style: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.3)" },
    }),
    new MenuList({
      key: "drawerMenu", frame,
      style: { position: "relative", width: MENU_WIDTH + "px", height: "100%", boxShadow: "2px 0 8px rgba(0,0,0,0.3)" },
    }),
  );
}

// The menu's own list of pages - build()-based (unlike the old,
// DOMTargetElement-based Menu it replaces), so it can be composed fresh in
// either of two structurally distinct places (the docked drawer or the
// modal drawer) - matching flow's own declarative menuDrawer(), rebuilt
// wherever it's needed rather than reparented between them. It carries no
// state worth preserving across such a move (no scroll position, no
// focus), so recreating it is harmless - unlike the page components in
// the work area, which is why those go through contextContainer() instead,
// keeping the same component (and its own state) across such a move.
class MenuList extends Component {
  // Both plain properties, passed in fresh on every rebuild. (A dropped
  // MenuList's stale, still-queued rerun once read `frame` back as
  // undefined here - now prevented by Component.onDispose() retracting a
  // dropped component the moment its build identity vanishes, rather than
  // by repositioning this write.)
  setProperties({ frame, style }) {
    this.frame = frame;
    this.style = style || null;
  }

  build() {
    const { frame } = this;
    return div(
      { key: "list", style: { boxSizing: "border-box", padding: "16px", background: "#34495e", color: "white", overflow: "auto", ...this.style } },
      ...frame.pages.map((page) => {
        const active = page.key === frame.chosen;
        return div({
          key: page.key,
          onclick: () => frame.choose(page.key),
          style: {
            padding: "10px 12px", marginBottom: "4px", borderRadius: "4px", cursor: "pointer",
            background: active ? "rgba(255,255,255,0.2)" : "transparent",
            fontWeight: active ? "bold" : "normal",
          },
        }, page.title);
      }),
    );
  }
}

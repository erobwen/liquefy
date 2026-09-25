import { Component, callback } from "@liquefy/cascade.component";
import { a, div, img, text, contextContainer, elementBoundsProvider } from "@liquefy/cascade.dom";
import { overlayFrame, iconButton, portal } from "@liquefy/cascade.ui";
import menuBarLogo from "../../../cascade/images/menu-bar-logo.png";

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
 * it a DOMElementTarget-based context to begin with - so DOMElementBoundsProvider's
 * own div ends up as a *direct* child of #application, no unstyled
 * intermediate div for a percentage height to get lost in (see this file's
 * own git history for the bug that came from exactly that, when this frame
 * still routed through an intermediate bridging div here).
 *
 * The work area's own page content (Introduction/ProgrammaticReactiveLayout)
 * is reached via contextContainer() (see cascade.DOM/src/DOMContextContainer.js),
 * which owns `workArea`'s own real, styled div and hands the page a fresh
 * context extended with usableWidth/usableHeight - not a bridge between two
 * different target abstractions (there's only DOMElementTarget now), just a
 * container that adds situational context for what it renders.
 */
export class ApplicationMenuFrame extends Component {
  // rootServiceLocator: provided to the whole app from here (provide()'s
  // default is the component itself, so any field can be inherited) - the
  // one way a component can change the app's services, by
  // inherit("rootServiceLocator"). See src/services.js.
  //
  // location: the browser's location (cascade.dom's browserLocation()) -
  // which page is shown is the URL's: its first path segment is the page's
  // key, none at all the first page. So back and forward, a reload or a
  // link to a page all just work, as in Flow's demo. What's left of the
  // path is the page's own business: it's handed down in the page's render
  // context (see ApplicationMenuFrameLayout's workArea), and the location
  // itself is found by inherit("location") (a field is all it takes).
  setProperties({ pages, rootServiceLocator, location }) {
    this.pages = pages;
    this.rootServiceLocator = rootServiceLocator || null;
    this.location = location;
  }

  // Whether the modal menu is open is *state* (see
  // cascade.component/README.md): established once here, changed only by the
  // user - the hamburger and the backdrop (see ApplicationMenuFrameLayout
  // below) are event handlers, outside any repeater - and never reset by a
  // rebuild.
  initializeState() {
    return { menuOpen: false };
  }

  // The top bar's portal, where the page shown puts its own buttons (see
  // src/components/pageActions.js). Created here, once, and owned by this
  // frame - not built in a build() and referenced as well (see
  // cascade.component/README.md) - and placed by ApplicationMenuFrameLayout
  // as a plain child reference.
  initialUnobservables() {
    return {
      ...super.initialUnobservables(),
      topBarPortal: portal({ key: "topBarPortal", style: { display: "flex", alignItems: "center", gap: "4px", flex: "none" } }),
    };
  }

  // Provided for inherit("topBarPortal") (provide()'s default is the
  // component itself, so a getter is all it takes).
  get topBarPortal() {
    return this.unobservable.topBarPortal;
  }

  // A page's path: the first page is the app's own root.
  pathOf(page) {
    return page === this.pages[0] ? [] : [page.key];
  }

  choose(key) {
    this.location.navigate(this.pathOf(this.pages.find((page) => page.key === key)));
    this.menuOpen = false;
  }

  // The page the URL names - or, for a path that names none, the first
  // page, with the URL corrected to match (replacing it, not adding to the
  // history). That's a navigation, not something a build may do while it
  // runs - so, as in Flow's demo, it's done right after.
  currentPage() {
    const key = this.location.path[0];
    const page = key === undefined ? this.pages[0] : this.pages.find((each) => each.key === key);
    if (page) return page;
    const u = this.unobservable;
    if (!u.correctingPath) {
      u.correctingPath = true;
      setTimeout(() => {
        u.correctingPath = false;
        this.location.navigate([], { replace: true });
      });
    }
    return this.pages[0];
  }

  build() {
    return elementBoundsProvider({
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
      iconButton({
        key: "hamburger",
        icon: "menu",
        title: "Menu",
        onClick: callback("toggleMenu", () => { frame.menuOpen = !frame.menuOpen; }),
        style: { color: "white" },
      }).show(menuIsModal && !frame.menuOpen),
      // The shown page's own buttons - information, code - just before its
      // title (see src/components/pageActions.js).
      frame.topBarPortal,
      div({ key: "label", style: { fontWeight: "bold" } }, page.title),
    );

    const workArea = contextContainer({
      key: "workArea",
      child: page.component,
      style: {
        flex: "1 1 auto", minHeight: 0, boxSizing: "border-box", padding: "16px",
        background: "#ecf0f1", overflow: "auto",
      },
      // The page's own pixel budget - and the whole app's size, for what
      // covers the whole app (a full-screen dialog, say). And its part of
      // the URL: `path`, what's left after the page's own segment - for
      // whatever in the page picks it up, as the next segment down - and
      // `basePath`, the page's own, to navigate relative to. Both strings,
      // so they only count as changed when they are.
      context: {
        usableWidth: workAreaWidth, usableHeight: workAreaHeight, appWidth: bounds.width, appHeight: bounds.height,
        basePath: frame.pathOf(page).join("/"),
        path: frame.location.path.slice(frame.pathOf(page).length).join("/"),
      },
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
      onclick: callback("closeMenu", () => { frame.menuOpen = false; }),
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
      logo(),
      ...frame.pages.map((page) => {
        const active = page === frame.currentPage();
        // A real link, to the page's URL - opening it in a new tab, or
        // copying it, works as for any link. A plain click navigates here
        // instead of loading the page anew.
        return a({
          key: page.key,
          href: frame.location.href(frame.pathOf(page)),
          onclick: callback(page.key + "Choose", (event) => {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            frame.choose(page.key);
          }),
          style: {
            display: "block", padding: "10px 12px", marginBottom: "4px", borderRadius: "4px", cursor: "pointer",
            color: "inherit", textDecoration: "none",
            background: active ? "rgba(255,255,255,0.2)" : "transparent",
            fontWeight: active ? "bold" : "normal",
          },
        }, text({ key: page.key + "Title", text: page.title }));
      }),
    );
  }
}

// The Cascade logotype, at the top of the menu. The image has a wide
// margin of plain background (the menu's own color) around the logo
// itself - cropped here by showing only the middle band of it: the image a
// little wider than the menu, shifted up and left inside a box as tall as
// the logo. (Percentage margins are fractions of the box's width.)
function logo() {
  return div(
    { key: "logo", style: { overflow: "hidden", aspectRatio: "3.5", margin: "0 0 12px 0", flex: "none" } },
    img({
      key: "logoImage",
      src: menuBarLogo,
      alt: "Cascade",
      // The logo spans 6-95% of the image across, 31-67% down: at 106% of
      // the box wide, shifted 3% left, it spans about 3-98% of the box -
      // its glow included.
      style: { display: "block", width: "106%", marginLeft: "-3%", marginTop: "-20%" },
    }),
  );
}

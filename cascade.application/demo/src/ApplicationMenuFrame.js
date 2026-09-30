import { Component, callback } from "@liquefy/cascade.component";
import { a, button, div, img, span, text, providingElement, elementBoundsProvider } from "@liquefy/cascade.dom";
import { overlayFrame, iconButton, portal, currentColorScheme, themeColor } from "@liquefy/cascade.ui";
import menuBarLogo from "../../../cascade/images/menu-bar-logo.svg";
import { versionNotice, showVersionNotice } from "./versionNotice.js";

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
 * child, placed on its measured element, which reads the size from build()
 * with this.fromTarget(). The work area's own room is handed on to the
 * pages as `usableWidth`/`usableHeight`, provided by name.
 *
 * This is the frame's own root, rendered directly by index.js, which hands
 * it a DOMElementTarget to begin with - so DOMElementBoundsProvider's
 * own div ends up as a *direct* child of #application, no unstyled
 * intermediate div for a percentage height to get lost in (see this file's
 * own git history for the bug that came from exactly that, when this frame
 * still routed through an intermediate bridging div here).
 *
 * The work area's own page content (Introduction/ProgrammaticReactiveLayout)
 * is reached via providingElement() (see cascade.DOM/src/DOMProvidingElement.js),
 * which owns `workArea`'s own real, styled div and hands the page a fresh
 * context providing usableWidth/usableHeight - not a bridge between two
 * different target abstractions (there's only DOMElementTarget now), just a
 * container that adds situational context for what it renders.
 */
export class ApplicationMenuFrame extends Component {
  // rootServiceLocator: provided to the whole app from here (see provide())
  // - the one way a component can change the app's services, by
  // inherit("rootServiceLocator"). See src/services.js.
  //
  // location: the browser's location (cascade.dom's browserLocation()) -
  // which page is shown is the URL's: its first path segment is the page's
  // key, none at all the first page. So back and forward, a reload or a
  // link to a page all just work, as in Flow's demo. What's left of the
  // path is the page's own business: it's handed down in the page's render
  // context (see ApplicationMenuFrameLayout's workArea), and the location
  // itself is found by inherit("location").
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
  initialState() {
    return { menuOpen: false };
  }

  // The top bar's portal, where the page shown puts its own buttons (see
  // src/components/pageActions.js). Created here, once, and owned by this
  // frame - not built in a build() and referenced as well (see
  // cascade.component/README.md) - and placed by ApplicationMenuFrameLayout
  // as a plain child reference. Owned, so established here and disposed of
  // with the frame (see Component.establish()).
  initialUnobservables() {
    return {
      ...super.initialUnobservables(),
      topBarPortal: portal({ key: "topBarPortal", style: { display: "flex", alignItems: "center", gap: "4px", flex: "none" } }).establish(),
    };
  }

  onDispose() {
    this.unobservable.topBarPortal.dispose();
    super.onDispose();
  }

  get topBarPortal() {
    return this.unobservable.topBarPortal;
  }

  // What the whole app inherits from here - its root services, the
  // location, and the top bar's portal. Getters: they follow the frame.
  provide() {
    const frame = this;
    return {
      get rootServiceLocator() { return frame.rootServiceLocator; },
      get location() { return frame.location; },
      get topBarPortal() { return frame.topBarPortal; },
    };
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

  // The app's colors: its theme's color scheme, as CSS variables on its
  // outermost element - everything in the app uses them (see cascade.ui's
  // colorScheme.js). Picking another color rewrites these, and nothing
  // else is built again.
  build() {
    const scheme = currentColorScheme();
    return elementBoundsProvider({
      key: "bounds",
      className: "application-menu-frame",
      style: { ...(scheme ? scheme.variables() : {}), position: "relative", boxSizing: "border-box", height: "100%", overflow: "hidden" },
      child: new ApplicationMenuFrameLayout({ key: "layout", frame: this }),
    });
  }
}

// The direct child of the DOMElementBoundsProvider ApplicationMenuFrame
// builds above - placed on its measured element, whose size it reads (see
// ApplicationMenuFrame's own class doc).
// Everything state-related (chosen page, menu open/closed) still belongs to
// `frame`, reached the same way MenuList already reaches it below.
class ApplicationMenuFrameLayout extends Component {
  setProperties({ frame }) {
    this.frame = frame;
  }

  build() {
    const { frame } = this;
    const bounds = { width: this.fromTarget("width"), height: this.fromTarget("height") };
    // Not measured - its element not in the page (yet): nothing to lay
    // out.
    if (typeof(bounds.width) !== "number") return null;

    const menuIsModal = bounds.width < MENU_WIDTH * 3;
    // The room inside a page's margins (16px each side - see
    // components/layout.js's pagePadding).
    const workAreaWidth = (menuIsModal ? bounds.width : bounds.width - MENU_WIDTH) - 32;
    const workAreaHeight = bounds.height - TOP_BAR_HEIGHT - 32;

    // Wide, the drawer is docked, and `menuOpen` means nothing - so it's
    // only ever read together with menuIsModal, never reset from here:
    // state is changed by the user, not by a build.
    const page = frame.currentPage();

    const topBar = div(
      { key: "topBar", style: {
        height: TOP_BAR_HEIGHT + "px", boxSizing: "border-box", display: "flex", alignItems: "center",
        gap: "12px", padding: "0 16px", background: themeColor.chromeDark, color: themeColor.onChrome, flex: "none",
      } },
      iconButton({
        key: "hamburger",
        icon: "menu",
        title: "Menu",
        onClick: callback("toggleMenu", () => { frame.menuOpen = !frame.menuOpen; }),
        style: { color: "white" },
      }).showIf(menuIsModal && !frame.menuOpen),
      // The shown page's own buttons - information, code - just before its
      // title (see src/components/pageActions.js).
      frame.topBarPortal,
      div({ key: "label", style: { fontWeight: "bold" } }, page.title),
      versionNoticeButton({ marginLeft: "auto" }),
    );

    const workArea = providingElement({
      key: "workArea",
      child: page.component,
      style: {
        // Never scrolls: each page owns its scrolling, and its margins (see
        // components/layout.js).
        flex: "1 1 auto", minHeight: 0, boxSizing: "border-box",
        background: themeColor.page, color: themeColor.text, overflow: "hidden",
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
// the work area, which is why those go through providingElement() instead,
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
    const items = [];
    let previousGroup = null;
    for (const page of frame.pages) {
      // Pages grouped together (see index.js - `group`) get a header above
      // them, and a gap after them, before the next page on its own.
      const group = page.group || null;
      const startsGroup = group !== null && group !== previousGroup;
      const endsGroup = group === null && previousGroup !== null;
      if (startsGroup) items.push(groupHeader(group));
      items.push(this.pageLink(page, endsGroup, group !== null));
      previousGroup = group;
    }
    return div(
      { key: "list", style: { boxSizing: "border-box", padding: "16px", background: themeColor.chrome, color: themeColor.onChrome, overflow: "auto", ...this.style } },
      logo(),
      ...items,
    );
  }

  // A page's link in the menu - in a group, indented under its header; after
  // a group, set apart from it.
  pageLink(page, afterGroup, inGroup) {
    const { frame } = this;
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
        display: "flex", alignItems: "center", gap: "8px", padding: "10px 12px", marginBottom: "4px", borderRadius: "4px", cursor: "pointer",
        ...(afterGroup ? { marginTop: "16px" } : {}),
        ...(inGroup ? { marginLeft: "16px" } : {}),
        color: "inherit", textDecoration: "none",
        background: active ? "rgba(255,255,255,0.2)" : "transparent",
        fontWeight: active ? "bold" : "normal",
      },
    },
    span({ key: page.key + "Title", style: { flex: "1 1 auto" } }, text({ key: page.key + "TitleText", text: page.title })),
    // A page's own icon, if it has one (see index.js), to the right - in
    // the menu's own text color, and the same whatever the theme: the
    // icon font's glyph itself, not the theme's icon widget.
    page.icon ? span({ key: page.key + "Icon", class: "material-symbols-outlined", style: { fontSize: "20px", lineHeight: "1", flex: "none", userSelect: "none" } }, text({ key: page.key + "IconName", text: page.icon })) : null);
  }
}

// A group's header in the menu: small, and quieter than the pages under it.
function groupHeader(name) {
  return div(
    {
      key: "group" + name,
      style: {
        padding: "0 12px", margin: "16px 0 6px 0", fontSize: "12px", fontWeight: "bold",
        letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.6,
      },
    },
    text({ key: "group" + name + "Text", text: name }),
  );
}

// A small warning sign, at the top bar's right end, showing the version notice
// again (see versionNotice.js) - while it's dismissed, where there is one.
function versionNoticeButton(style) {
  if (!versionNotice.available || versionNotice.shown) return null;
  return button(
    {
      key: "versionNotice",
      type: "button",
      title: "This demo may not match your installed version",
      onclick: callback("showVersionNotice", () => showVersionNotice()),
      style: {
        display: "flex", alignItems: "center", justifyContent: "center", width: "24px", height: "24px", padding: 0, flex: "none",
        border: "none", borderRadius: "4px", background: "transparent", color: "#ffc940", cursor: "pointer",
        ...style,
      },
    },
    span({ key: "versionNoticeIcon", class: "material-symbols-outlined", style: { fontSize: "20px", lineHeight: "1", userSelect: "none" } },
      text({ key: "versionNoticeIconName", text: "warning" })),
  );
}

// The Cascade logotype, at the top of the menu - a vector drawing with a
// snug bounding box, on a transparent background: it sits on the menu as it
// is, with room around it given here.
function logo() {
  return img({
    key: "logo",
    src: menuBarLogo,
    alt: "Cascade",
    style: { display: "block", width: "100%", boxSizing: "border-box", padding: "10px 8px", margin: "0 0 12px 0", flex: "none" },
  });
}

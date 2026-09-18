import { Component, RenderContext, postponeInvalidations, continueInvalidations, accessInitialValues } from "@liquefy/cascade.component";
import { div, button, DOMTarget, bridgeToDOMTargetElement } from "@liquefy/cascade.dom";
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
 * Measurement (real getBoundingClientRect calls, to decide menuIsModal and
 * how much space the work area actually has) is imperative and ordering-
 * sensitive, so render() is overridden directly here rather than relying
 * on the default build()-then-renderOnto flow (see Component.js's own
 * render() doc) - the same reason the old MainFrame did. build() is still
 * used underneath for the declarative part (top bar/drawer/overlay
 * content), called explicitly from render() via reactiveBuildEquivalent()
 * only after every measurement it needs is already written to `this` as
 * plain observable properties - ordinary forward (parent-writes-before-
 * child-reads) dataflow, the same shape WorkArea/MenuFrame already relied
 * on via RenderContext fields before this restructuring, not the "reach
 * back" shape flush()/accessInitialValues() exist for. See
 * Component.js's own reactiveBuildEquivalent() doc for why it - not a
 * bare, repeater-less build() call (an earlier, abandoned attempt at
 * this same interleaving - see git history) - is what's actually needed
 * here: reconciling a keyed child (like the overlayFrame() call below)
 * only resolves correctly once the repeater that constructed it finishes
 * its own refresh(), and reactiveBuildEquivalent() is what guarantees
 * that happens before this method's own renderOnto() call below ever
 * sees the result.
 *
 * Menu/WorkArea's previous DOMTargetElement-based children (Introduction/
 * ProgrammaticReactiveLayout) are unchanged - reached here via
 * bridgeToDOMTargetElement() (see cascade.DOM/src/DOMTargetElementBridge.js),
 * the boundary between this now build()-based, DOMTarget-based frame and
 * that still-DOMTargetElement-based page content.
 */
export class ApplicationMenuFrame extends Component {
  setProperties({ pages }) {
    this.pages = pages;
    this.chosen = pages[0].key;
    this.menuOpen = false;
  }

  choose(key) {
    this.chosen = key;
    this.menuOpen = false;
  }

  currentPage() {
    return this.pages.find((page) => page.key === this.chosen);
  }

  render(context) {
    const u = this.unobservable;
    if (!u.el) u.el = context.target.createChild("div");
    const el = u.el.element;
    el.className = "application-menu-frame";
    el.style.cssText = "position: relative; box-sizing: border-box; height: 100%; overflow: hidden;";
    if (!u.innerContext) u.innerContext = new RenderContext(DOMTarget.forElement(el));

    const totalRect = el.getBoundingClientRect();
    const menuIsModal = totalRect.width < MENU_WIDTH * 3;

    // Plain observable properties, not RenderContext fields - build()
    // (called below) reads `this.X` directly, not a context argument (see
    // Component.build()'s own signature - it takes none).
    postponeInvalidations();
    this.menuIsModal = menuIsModal;
    this.workAreaWidth = (menuIsModal ? totalRect.width : totalRect.width - MENU_WIDTH) - 32;
    this.workAreaHeight = totalRect.height - TOP_BAR_HEIGHT - 32;
    continueInvalidations();

    const equivalent = this.reactiveBuildEquivalent();
    equivalent.renderOnto(u.innerContext);
  }

  build() {
    const menuIsModal = this.menuIsModal;
    const page = this.currentPage();

    const topBar = div(
      { key: "topBar", style: {
        height: TOP_BAR_HEIGHT + "px", boxSizing: "border-box", display: "flex", alignItems: "center",
        gap: "12px", padding: "0 16px", background: "#2c3e50", color: "white", flex: "none",
      } },
      button({
        key: "hamburger",
        onclick: () => { this.menuOpen = !this.menuOpen; },
        style: {
          width: "32px", height: "32px", border: "none", borderRadius: "4px",
          background: "#1a252f", color: "white", cursor: "pointer", flex: "none", fontSize: "16px",
        },
      }, "☰").show(menuIsModal && !this.menuOpen),
      div({ key: "label" }, "Toolbar"),
    );

    const workArea = bridgeToDOMTargetElement({
      key: "workArea",
      child: page.component,
      style: {
        flex: "1 1 auto", minHeight: 0, boxSizing: "border-box", padding: "16px",
        background: "#ecf0f1", overflow: "auto",
      },
      context: { usableWidth: this.workAreaWidth, usableHeight: this.workAreaHeight },
    });

    const column = div(
      { key: "column", style: { display: "flex", flexDirection: "column", flex: "1 1 auto", minWidth: 0, height: "100%" } },
      topBar,
      workArea,
    );

    const drawer = menuIsModal ? null : new MenuList({
      key: "menu", frame: this,
      style: { width: MENU_WIDTH + "px", flex: "none", height: "100%" },
    });

    return overlayFrame(
      "overlayFrame",
      drawer,
      column,
      {
        style: { display: "flex", flexDirection: "row", width: "100%", height: "100%", boxSizing: "border-box", overflow: "hidden" },
        overlayContent: this.menuOpen && menuIsModal ? this.buildModalMenuDrawer() : null,
      },
    );
  }

  buildModalMenuDrawer() {
    // pointerEvents: "auto" on the backdrop and the drawer itself -
    // OverlayFrame's own modalSubFrame wrapper (see cascade.ui/src/OverlayFrame.js)
    // sets pointerEvents: "none" on *itself*, deliberately, so clicks pass
    // through whatever part of its own area nothing here is using - but
    // that's inherited by everything nested inside it too, including the
    // parts that *are* in use, unless explicitly opted back in here. A
    // real bug found via this exact demo: without this, neither the
    // backdrop nor the menu items inside the drawer ever receive clicks
    // at all - matches flow.application's own ApplicationMenuFrame,
    // which sets this on both for the same reason.
    return div(
      { key: "modalDrawer", style: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "auto" } },
      div({
        key: "backdrop",
        onclick: () => { this.menuOpen = false; },
        style: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.3)" },
      }),
      new MenuList({
        key: "drawerMenu", frame: this,
        style: { position: "relative", width: MENU_WIDTH + "px", height: "100%", boxShadow: "2px 0 8px rgba(0,0,0,0.3)" },
      }),
    );
  }
}

// The menu's own list of pages - build()-based (unlike the old,
// DOMTargetElement-based Menu it replaces), so it can be composed fresh in
// either of two structurally distinct places (the docked drawer or the
// modal drawer) - matching flow's own declarative menuDrawer(), rebuilt
// wherever it's needed rather than reparented between them. It carries no
// state worth preserving across such a move (no scroll position, no
// focus), so recreating it is harmless - unlike the page components in
// the work area, which is why those go through a stable bridge instead.
class MenuList extends Component {
  setProperties({ frame, style }) {
    // accessInitialValues(), not a plain write - a real bug found via
    // this exact demo: MenuList's own buildRepeater reads `this.frame`,
    // but a plain write here lands positioned within whichever repeater
    // happened to be executing ApplicationMenuFrame.build() right now -
    // ApplicationMenuFrame's own buildRepeater. Every resize disposes and
    // rebuilds that repeater, which unlinks *all* of its own prior run's
    // writings, `frame`'s included - and that unlinking itself invalidates
    // MenuList's own buildRepeater, queuing it for a rerun even on a
    // resize where MenuList (docked -> modal) is the one being dropped
    // from the tree entirely. Since MenuList is genuinely retracted (not
    // relinked) only once something further up its own render-parent
    // chain (OverlayFrame's own "frame" div) actually reruns to notice it
    // - which can happen *after* this queued, stale rerun is processed -
    // build() runs at least once more with `frame` already unlinked,
    // reading undefined. accessInitialValues() writes at the baseline
    // position instead - not tied to ApplicationMenuFrame's own
    // buildRepeater's partial at all, so disposing that repeater can
    // never unlink it.
    accessInitialValues(() => { this.frame = frame; });
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

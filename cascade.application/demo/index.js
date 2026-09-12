import { RenderContext, Component, postponeInvalidations, continueInvalidations } from "@liquefy/cascade.component";
import { DOMTargetElement } from "@liquefy/cascade.dom";

/**
 * Benchmark for the real-time renderOnto model, replicating flow's own
 * demo app one piece at a time: a top toolbar, a left menu, and a main
 * work area - each level measuring the real DOM and handing usable space
 * down to what's below it via a RenderContext (usableWidth/usableHeight),
 * rather than building an abstract tree first and reconciling bounds in a
 * second pass (see flow.application/demo/src/ApplicationMenuFrame.js for
 * the shape being replicated).
 *
 * Built on plain Component + DOMTargetElement rather than DOMComponent +
 * DOMTarget - each component owns the DOMTargetElement(s) it creates
 * directly (see cascade.DOM/src/DOMTargetElement.js), instead of every
 * sibling sharing one DOMTarget's single observable `lastChild`. That
 * matters here specifically: a shared, observable position property's
 * dependency, once established at a component's first creation, never
 * gets a chance to clear (same-value writes are deduped without a real
 * rerun to shed it) - so writing it again later for an unrelated reason
 * (the menu/work-area breakpoint below reorders its own two children)
 * could spuriously invalidate a long-dormant sibling. Direct ownership
 * plus an imperative insertChild() sidesteps that whole class of bug
 * instead of needing to work around it.
 *
 * The menu also replicates ApplicationMenuFrame's responsive breakpoint:
 * docked as a side panel when there's enough width, or hidden behind a
 * hamburger toggle and shown as an overlay when the window is narrow.
 * Crossing that breakpoint is a genuinely structural change - the menu is
 * a docked child one moment, entirely un-rendered (retracted, including
 * its real DOM element - see Menu.onRetract() below) the next - not just
 * a CSS visibility toggle.
 */

const MENU_WIDTH = 220;

class Toolbar extends Component {
  render(context) {
    const u = this.unobservable;
    if (!u.el) u.el = context.target.createChild("div");
    const el = u.el.element;
    el.className = "toolbar";
    el.textContent = "Toolbar";
    el.style.cssText =
      "height: 48px; box-sizing: border-box; display: flex; align-items: center; " +
      "padding: 0 16px; background: #2c3e50; color: white; flex: none;";
  }
}

class Menu extends Component {
  render(context) {
    const u = this.unobservable;
    if (!u.el) u.el = context.target.createChild("div");
    const el = u.el.element;
    el.className = "menu";
    el.textContent = "Menu";
    el.style.cssText =
      "width: " + MENU_WIDTH + "px; box-sizing: border-box; padding: 16px; " +
      "background: #34495e; color: white; height: 100%;";
    if (context.menuIsOverlay) {
      el.style.position = "absolute";
      el.style.top = "0";
      el.style.left = "0";
      el.style.zIndex = "10";
      el.style.boxShadow = "2px 0 8px rgba(0,0,0,0.3)";
    } else {
      el.style.position = "static";
      el.style.boxShadow = "none";
      el.style.flex = "none";
    }
  }

  // Retracted (not rendered at all) when modal and closed - remove the
  // real element, same responsibility DOMComponent's own onRetract had.
  onRetract() {
    this.unobservable.el.element.remove();
  }

  // Relinked after a real retraction - put the element back somewhere in
  // the current target; MenuFrame's own render always reasserts the
  // exact desired order right after calling renderOnto() on this, so the
  // precise position here doesn't matter.
  onReattach(context) {
    context.target.element.appendChild(this.unobservable.el.element);
  }
}

class WorkArea extends Component {
  render(context) {
    const u = this.unobservable;
    if (!u.el) u.el = context.target.createChild("div");
    const el = u.el.element;
    el.className = "work-area";
    el.style.cssText =
      "box-sizing: border-box; padding: 16px; background: #ecf0f1; overflow: auto;";
    el.style.width = context.usableWidth + "px";
    el.style.height = context.usableHeight + "px";
    el.textContent =
      "Usable area, measured for real: " + Math.round(context.usableWidth) +
      " x " + Math.round(context.usableHeight) + "px. Resize the window to see it update.";
  }
}

class HamburgerButton extends Component {
  constructor(onClick) {
    super();
    this.onClick = onClick;
  }

  render(context) {
    const u = this.unobservable;
    if (!u.el) u.el = context.target.createChild("button");
    const el = u.el.element;
    el.textContent = "☰";
    el.style.cssText =
      "position: absolute; top: 8px; left: 8px; z-index: 20; width: 32px; height: 32px; " +
      "border: none; border-radius: 4px; background: #2c3e50; color: white; cursor: pointer;";
    el.onclick = this.onClick;
  }

  onRetract() {
    this.unobservable.el.element.remove();
  }

  onReattach(context) {
    context.target.element.appendChild(this.unobservable.el.element);
  }
}

class MenuFrame extends Component {
  constructor(menu, workArea) {
    super();
    this.menu = menu;
    this.workArea = workArea;
    this.menuOpen = false;
    this.hamburger = new HamburgerButton(() => { this.menuOpen = !this.menuOpen; });
  }

  render(context) {
    const u = this.unobservable;
    if (!u.el) u.el = context.target.createChild("div");
    const el = u.el.element;
    el.className = "menu-frame";
    el.style.cssText = "position: relative; display: flex; flex-direction: row; box-sizing: border-box; overflow: hidden;";
    el.style.width = context.usableWidth + "px";
    el.style.height = context.usableHeight + "px";

    if (!u.innerContext) {
      u.innerContext = new RenderContext(u.el);
    }

    // Real measurement drives the breakpoint decision, same as everywhere
    // else in this demo - not a CSS media query.
    const menuIsModal = context.usableWidth < MENU_WIDTH * 3;

    // usableWidth/usableHeight/menuIsOverlay are read together by our
    // children (workArea reads both size fields; menu reads the overlay
    // flag) - but each write below is itself observable, and a write can
    // synchronously rerun an already-linked dependent right then and
    // there (see cascade.js's repeaterDirty -> refreshAllDirtyRepeaters).
    // Without postponing, a child can rerun in between two of these
    // writes and see a torn mix of this pass's new value and the last
    // pass's stale one - postponing defers every dependent's rerun until
    // all of this pass's writes (and the renderOnto calls that depend on
    // them) are in, so children only ever see a fully-consistent context.
    postponeInvalidations();
    u.innerContext.menuIsOverlay = menuIsModal;
    // Menu's width is a fixed CSS constant (never actually measured, or
    // needs to be) - using it directly here, rather than measuring
    // menu's own element, avoids a real hazard: that element can be
    // sitting retracted-and-detached from a previous pass until
    // menu.renderOnto() (below) reattaches it, so measuring it beforehand
    // can silently read 0, and measuring it afterward would force
    // menu.renderOnto() to run before workArea - see the position
    // comment below for why that specifically breaks things.
    u.innerContext.usableWidth = menuIsModal ? context.usableWidth : context.usableWidth - MENU_WIDTH;
    u.innerContext.usableHeight = context.usableHeight;

    // workArea is always attached here, in the very same relative
    // position regardless of which branch below runs - this matters
    // structurally, not just stylistically: cascade.reactive reconciles
    // a rerun against the previous one by *position* (see
    // docs/plan-partial-repeaters.md's "Rerun: partials get reused in
    // place"), and the previous code called hamburger before workArea
    // while modal but menu before workArea while docked - two different
    // children occupying the same slot the moment the branch flips. That
    // positional mismatch breaks reconciliation for everything from that
    // point on (repeater.reconciling goes false), which left workArea's
    // own dependency on the writes just above orphaned instead of
    // updated in place - the concrete symptom was workArea reading
    // context.usableWidth as undefined right after a docked/modal
    // transition. Keeping workArea's own position fixed sidesteps the
    // whole class of bug; hamburger/menu (whichever ends up varying
    // between branches) can safely move since nothing downstream depends
    // on writes made after them.
    this.workArea.renderOnto(u.innerContext);

    if (menuIsModal) {
      this.hamburger.renderOnto(u.innerContext);
      if (this.menuOpen) {
        this.menu.renderOnto(u.innerContext);
      }
      // else: not rendered at all this pass - retracted (real DOM element
      // removed too) if it was previously docked or previously open.
    } else {
      // Hamburger not needed docked - never rendered, or retracted if it
      // was previously rendered while modal.
      this.menu.renderOnto(u.innerContext);
      // A reused element is only ever inserted once, at creation (or
      // re-inserted somewhere on reattachment after a real retraction -
      // see Menu.onReattach) - an ordinary rerun never repositions it, and
      // (as of the workArea reordering above) call order and visual order
      // are no longer even the same thing. So the desired *visual* order
      // is always explicitly reasserted here, every render, via
      // insertChild - see DOMTargetElement.
      u.el.insertChild(this.menu.unobservable.el, null);
    }
    continueInvalidations();
  }
}

class MainFrame extends Component {
  constructor(toolbar, menuFrame) {
    super();
    this.toolbar = toolbar;
    this.menuFrame = menuFrame;
  }

  render(context) {
    const u = this.unobservable;
    if (!u.el) u.el = context.target.createChild("div");
    const el = u.el.element;
    el.className = "main-frame";
    el.style.cssText = "display: flex; flex-direction: column; height: 100%;";

    // Both the inner target and the context wrapping it must persist
    // across reruns - a relinked child (its own inputs unchanged) never
    // re-executes render(), so it can never see a brand new context
    // object; only a property write on one it's already depending on can
    // invalidate and rerun it. See cascade.component/src/RenderContext.js.
    if (!u.innerContext) {
      u.innerContext = new RenderContext(u.el);
    }

    this.toolbar.renderOnto(u.innerContext);

    const toolbarHeight = this.toolbar.unobservable.el.element.getBoundingClientRect().height;
    const totalRect = el.getBoundingClientRect();

    // See MenuFrame.render's own comment on postponeInvalidations:
    // usableWidth and usableHeight must land together, or menuFrame (and
    // whatever it renders in turn) can rerun in between the two writes and
    // see one of this pass's new values alongside the other one's stale
    // leftover from last time.
    postponeInvalidations();
    u.innerContext.usableWidth = totalRect.width;
    u.innerContext.usableHeight = totalRect.height - toolbarHeight;
    this.menuFrame.renderOnto(u.innerContext);
    continueInvalidations();
  }
}

const root = DOMTargetElement.forElement(document.getElementById("application"));
const context = new RenderContext(root);
const mainFrame = new MainFrame(new Toolbar(), new MenuFrame(new Menu(), new WorkArea()));
mainFrame.renderOnto(context);

// Proves the reactivity is real, not just a one-time snapshot: resizing
// the window re-measures at every level, writes a (likely) different
// usableWidth/usableHeight into the same persistent context objects, and
// only whichever descendants actually depend on a value that changed
// rerun and re-render - ordinary reactive invalidation, not a special
// "notify children" call. This is also what drives the modal/docked
// breakpoint - shrink the window below 660px to see the menu retract
// behind the hamburger button, then grow it back to see it dock again.
window.addEventListener("resize", () => {
  mainFrame.unobservable.repeater.restart();
});

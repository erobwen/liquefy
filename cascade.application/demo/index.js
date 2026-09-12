import { RenderContext } from "@liquefy/cascade.component";
import { DOMTarget, DOMComponent } from "@liquefy/cascade.dom";

/**
 * Benchmark for the real-time renderOnto model, replicating flow's own
 * demo app one piece at a time: a top toolbar, a left menu, and a main
 * work area - each level measuring the real DOM and handing usable space
 * down to what's below it via a RenderContext (usableWidth/usableHeight),
 * rather than building an abstract tree first and reconciling bounds in a
 * second pass (see flow.application/demo/src/ApplicationMenuFrame.js for
 * the shape being replicated, and cascade.DOM/src/test/menuFrame.js /
 * menuFrameModal.js for the jsdom-based proof of the same mechanisms).
 *
 * The menu also replicates ApplicationMenuFrame's responsive breakpoint:
 * docked as a side panel when there's enough width, or hidden behind a
 * hamburger toggle and shown as an overlay when the window is narrow.
 * Crossing that breakpoint is a genuinely structural change - the menu is
 * a docked child one moment, entirely un-rendered (retracted, including
 * its real DOM element - see DOMComponent.onRetract()) the next - not
 * just a CSS visibility toggle.
 */

const MENU_WIDTH = 220;

class Toolbar extends DOMComponent {
  renderElement(context, existingElement) {
    const el = existingElement || context.target.appendElement("div");
    el.className = "toolbar";
    el.textContent = "Toolbar";
    el.style.cssText =
      "height: 48px; box-sizing: border-box; display: flex; align-items: center; " +
      "padding: 0 16px; background: #2c3e50; color: white; flex: none;";
    return el;
  }
}

class Menu extends DOMComponent {
  renderElement(context, existingElement) {
    const el = existingElement || context.target.appendElement("div");
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
    return el;
  }
}

class WorkArea extends DOMComponent {
  renderElement(context, existingElement) {
    const el = existingElement || context.target.appendElement("div");
    el.className = "work-area";
    el.style.cssText =
      "box-sizing: border-box; padding: 16px; background: #ecf0f1; overflow: auto;";
    el.style.width = context.usableWidth + "px";
    el.style.height = context.usableHeight + "px";
    el.textContent =
      "Usable area, measured for real: " + Math.round(context.usableWidth) +
      " x " + Math.round(context.usableHeight) + "px. Resize the window to see it update.";
    return el;
  }
}

class HamburgerButton extends DOMComponent {
  constructor(onClick) {
    super();
    this.onClick = onClick;
  }

  renderElement(context, existingElement) {
    const el = existingElement || context.target.appendElement("button");
    el.textContent = "☰";
    el.style.cssText =
      "position: absolute; top: 8px; left: 8px; z-index: 20; width: 32px; height: 32px; " +
      "border: none; border-radius: 4px; background: #2c3e50; color: white; cursor: pointer;";
    el.onclick = this.onClick;
    return el;
  }
}

class MenuFrame extends DOMComponent {
  constructor(menu, workArea) {
    super();
    this.menu = menu;
    this.workArea = workArea;
    this.menuOpen = false;
    this.hamburger = new HamburgerButton(() => { this.menuOpen = !this.menuOpen; });
  }

  renderElement(context, existingElement) {
    const u = this.unobservable;
    const el = existingElement || context.target.appendElement("div");
    el.className = "menu-frame";
    el.style.cssText = "position: relative; display: flex; flex-direction: row; box-sizing: border-box; overflow: hidden;";
    el.style.width = context.usableWidth + "px";
    el.style.height = context.usableHeight + "px";

    if (!u.innerContext) {
      u.innerContext = new RenderContext(DOMTarget.forElement(el));
    }

    // Real measurement drives the breakpoint decision, same as everywhere
    // else in this demo - not a CSS media query.
    const menuIsModal = context.usableWidth < MENU_WIDTH * 3;
    u.innerContext.menuIsOverlay = menuIsModal;

    if (menuIsModal) {
      this.hamburger.renderOnto(u.innerContext);
      u.innerContext.usableWidth = context.usableWidth;
      u.innerContext.usableHeight = context.usableHeight;
      this.workArea.renderOnto(u.innerContext);
      if (this.menuOpen) {
        this.menu.renderOnto(u.innerContext);
      }
      // else: not rendered at all this pass - retracted (real DOM element
      // removed too) if it was previously docked or previously open.
    } else {
      // Hamburger not needed docked - never rendered, or retracted if it
      // was previously rendered while modal.
      this.menu.renderOnto(u.innerContext);
      const menuWidth = this.menu.unobservable.element.getBoundingClientRect().width;
      u.innerContext.usableWidth = context.usableWidth - menuWidth;
      u.innerContext.usableHeight = context.usableHeight;
      this.workArea.renderOnto(u.innerContext);
    }

    return el;
  }
}

class MainFrame extends DOMComponent {
  constructor(toolbar, menuFrame) {
    super();
    this.toolbar = toolbar;
    this.menuFrame = menuFrame;
  }

  renderElement(context, existingElement) {
    const u = this.unobservable;
    const el = existingElement || context.target.appendElement("div");
    el.className = "main-frame";
    el.style.cssText = "display: flex; flex-direction: column; height: 100%;";

    // Both the inner target and the context wrapping it must persist
    // across reruns - a relinked child (its own inputs unchanged) never
    // re-executes render(), so it can never see a brand new context
    // object; only a property write on one it's already depending on can
    // invalidate and rerun it. See cascade.component/src/RenderContext.js.
    if (!u.innerContext) {
      u.innerContext = new RenderContext(DOMTarget.forElement(el));
    }

    this.toolbar.renderOnto(u.innerContext);

    const toolbarHeight = this.toolbar.unobservable.element.getBoundingClientRect().height;
    const totalRect = el.getBoundingClientRect();
    u.innerContext.usableWidth = totalRect.width;
    u.innerContext.usableHeight = totalRect.height - toolbarHeight;

    this.menuFrame.renderOnto(u.innerContext);

    return el;
  }
}

const target = new DOMTarget(document.getElementById("application"));
const context = new RenderContext(target);
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

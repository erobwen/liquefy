import { JSDOM } from "jsdom";
import assert from "assert";
import { RenderContext } from "@liquefy/cascade.component";
import { DOMTarget } from "../DOMTarget.js";
import { DOMNodeComponent } from "../DOMNodeComponent.js";

// Responsive breakpoint behavior from flow's ApplicationMenuFrame, scoped
// down: the menu docks as a side panel when there's enough width, or goes
// "modal" - hidden by default, opened as an overlay on demand - when the
// frame is narrower than some multiple of the menu's own width. The
// interesting mechanism here isn't the breakpoint arithmetic, it's that
// crossing it is a genuinely *structural* change (the menu is a docked
// child one moment, entirely un-rendered - retracted, not just hidden -
// the next), which is exactly the retract/reconcile machinery already
// proven in cascade.reactive/src/test/renderOnto.js's case 3 and
// cascade.DOM's own domTarget.js tests, just driven by a measurement
// instead of an explicit boolean.
describe("MenuFrame modal/docked breakpoint", function () {
  const MENU_WIDTH = 220;

  let container;

  beforeEach(function () {
    const dom = new JSDOM("<!DOCTYPE html><body></body>");
    global.document = dom.window.document;
    container = document.createElement("div");
  });

  class Menu extends DOMNodeComponent {
    renderElement(context, existingElement) {
      const el = existingElement || context.target.appendElement("div");
      el.className = "menu";
      el.dataset.overlay = context.menuIsOverlay ? "true" : "false";
      return el;
    }
  }

  class WorkArea extends DOMNodeComponent {
    renderElement(context, existingElement) {
      const el = existingElement || context.target.appendElement("div");
      el.className = "work-area";
      el.dataset.usableWidth = context.usableWidth;
      return el;
    }
  }

  class MenuFrame extends DOMNodeComponent {
    constructor(menu, workArea) {
      super();
      this.menu = menu;
      this.workArea = workArea;
      this.menuOpen = false;
    }

    renderElement(context, existingElement) {
      const u = this.unobservable;
      const el = existingElement || context.target.appendElement("div");
      el.className = "menu-frame";
      if (!u.innerContext) {
        u.innerContext = new RenderContext(DOMTarget.forElement(el));
      }

      const menuIsModal = context.usableWidth < MENU_WIDTH * 3;
      u.innerContext.menuIsOverlay = menuIsModal;

      if (menuIsModal) {
        u.innerContext.usableWidth = context.usableWidth;
        this.workArea.renderOnto(u.innerContext);
        if (this.menuOpen) {
          this.menu.renderOnto(u.innerContext);
        }
        // else: not rendered at all this pass - retracted automatically
        // if it was previously docked or previously open as an overlay.
      } else {
        this.menu.renderOnto(u.innerContext);
        u.innerContext.usableWidth = context.usableWidth - MENU_WIDTH;
        this.workArea.renderOnto(u.innerContext);
      }

      return el;
    }
  }

  it("docks the menu when there's enough width", function () {
    const context = new RenderContext(new DOMTarget(container));
    const menuFrame = new MenuFrame(new Menu(), new WorkArea());

    context.usableWidth = 1000; // >= MENU_WIDTH * 3 (660)
    menuFrame.renderOnto(context);

    assert.ok(container.querySelector(".menu"));
    assert.equal(container.querySelector(".menu").dataset.overlay, "false");
    assert.equal(container.querySelector(".work-area").dataset.usableWidth, "780");
  });

  it("goes modal and retracts the menu when width is narrow", function () {
    const context = new RenderContext(new DOMTarget(container));
    const menuFrame = new MenuFrame(new Menu(), new WorkArea());

    context.usableWidth = 1000;
    menuFrame.renderOnto(context);
    assert.ok(container.querySelector(".menu")); // docked initially

    context.usableWidth = 500; // < 660 -> modal, and menuOpen is false
    menuFrame.unobservable.repeater.restart();

    assert.ok(!container.querySelector(".menu")); // retracted, not just hidden
    assert.equal(container.querySelector(".work-area").dataset.usableWidth, "500"); // full width
  });

  it("opens the menu as an overlay on request while modal, and retracts it again on close", function () {
    const context = new RenderContext(new DOMTarget(container));
    const menuFrame = new MenuFrame(new Menu(), new WorkArea());

    context.usableWidth = 500; // modal from the start
    menuFrame.renderOnto(context);
    assert.ok(!container.querySelector(".menu"));

    menuFrame.menuOpen = true;
    assert.ok(container.querySelector(".menu"));
    assert.equal(container.querySelector(".menu").dataset.overlay, "true");
    assert.equal(container.querySelector(".work-area").dataset.usableWidth, "500"); // still full width - menu overlays, doesn't claim space

    menuFrame.menuOpen = false;
    assert.ok(!container.querySelector(".menu")); // retracted again
  });

  it("re-docks correctly after having gone modal - the element is reattached, not left orphaned", function () {
    const context = new RenderContext(new DOMTarget(container));
    const menuFrame = new MenuFrame(new Menu(), new WorkArea());

    context.usableWidth = 1000;
    menuFrame.renderOnto(context);
    const originalMenuElement = menuFrame.menu.unobservable.element;
    assert.ok(container.querySelector(".menu"));

    context.usableWidth = 500; // modal - menu retracted, element removed
    menuFrame.unobservable.repeater.restart();
    assert.ok(!container.querySelector(".menu"));

    context.usableWidth = 1000; // back to docked
    menuFrame.unobservable.repeater.restart();

    assert.ok(container.querySelector(".menu")); // reattached, not missing
    assert.equal(container.querySelector(".menu"), originalMenuElement); // same element, not a new one
    assert.equal(container.querySelectorAll(".menu").length, 1); // not duplicated either
    // Retraction clears this component's own read dependencies entirely
    // (removeAllSources) - so a relink alone can't be trusted as "nothing
    // changed since". This needs a real rerun against current context
    // values, not just a reattached element carrying stale attributes
    // from the last time it actually executed.
    assert.equal(container.querySelector(".menu").dataset.overlay, "false");
  });

  it("reopening the overlay after closing it also reattaches its element correctly", function () {
    const context = new RenderContext(new DOMTarget(container));
    const menuFrame = new MenuFrame(new Menu(), new WorkArea());
    context.usableWidth = 500;
    menuFrame.renderOnto(context);

    menuFrame.menuOpen = true;
    const originalMenuElement = menuFrame.menu.unobservable.element;
    menuFrame.menuOpen = false;
    assert.ok(!container.querySelector(".menu"));

    menuFrame.menuOpen = true;

    assert.ok(container.querySelector(".menu"));
    assert.equal(container.querySelector(".menu"), originalMenuElement);
    assert.equal(container.querySelectorAll(".menu").length, 1);
  });

  it("a reused element reflects the current context, not a stale value from before it was retracted", function () {
    // Specifically the shape the earlier two tests could each pass
    // without catching: docked (menuIsOverlay=false, rendered), then
    // modal+closed (never rendered - retracted with its dependency on
    // menuIsOverlay wiped, while the context's actual value flips to
    // true), then opened as an overlay. The stale value from its last
    // real execution (false) differs from the current one (true) - only
    // a real rerun on reattachment, not just relinking, gets this right.
    const context = new RenderContext(new DOMTarget(container));
    const menuFrame = new MenuFrame(new Menu(), new WorkArea());

    context.usableWidth = 1000; // docked - menu renders with menuIsOverlay=false
    menuFrame.renderOnto(context);
    const originalMenuElement = menuFrame.menu.unobservable.element;
    assert.equal(container.querySelector(".menu").dataset.overlay, "false");

    context.usableWidth = 500; // modal, closed - menu retracted without ever seeing menuIsOverlay=true
    menuFrame.unobservable.repeater.restart();
    assert.ok(!container.querySelector(".menu"));

    menuFrame.menuOpen = true; // opened as an overlay - reuses the same element

    assert.equal(container.querySelector(".menu"), originalMenuElement); // same element, not recreated
    assert.equal(container.querySelector(".menu").dataset.overlay, "true"); // current value, not the stale "false"
  });

});

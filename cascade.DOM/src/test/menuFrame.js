import { JSDOM } from "jsdom";
import assert from "assert";
import { RenderContext } from "@liquefy/cascade.component";
import { DOMElementTarget } from "../DOMElementTarget.js";
import { DOMNodeComponent } from "../DOMNodeComponent.js";

// Side-by-side sibling of the toolbar/main-frame demo: a menu claims a
// fixed share of the frame's *width* (rather than the toolbar's height),
// and the work area sees exactly what's left. Same mechanism, different
// axis - the point of this test is a different design detail: usable
// space is written as two separate scalar context fields (usableWidth/
// usableHeight), not one {width, height} object literal, so cascade's
// same-value dedup still works. A fresh object literal would always
// compare as "changed" by reference, even when the numbers inside it
// are identical - forcing the work area to rerun on every menu frame
// rebuild, structural or not.
describe("MenuFrame (side-by-side layout, real width measurement)", function () {
  let container;
  let workAreaRenderCount;
  let seenUsableWidth;
  let seenUsableHeight;

  beforeEach(function () {
    const dom = new JSDOM("<!DOCTYPE html><body></body>");
    global.document = dom.window.document;
    container = document.createElement("div");
    workAreaRenderCount = 0;
    seenUsableWidth = undefined;
    seenUsableHeight = undefined;
  });

  class Menu extends DOMNodeComponent {
    renderNode(target, existingElement) {
      const el = existingElement || target.appendElement("div");
      el.className = "menu";
      return el;
    }
  }

  class WorkArea extends DOMNodeComponent {
    renderNode(target, existingElement) {
      workAreaRenderCount++;
      seenUsableWidth = target.usableWidth;
      seenUsableHeight = target.usableHeight;
      const el = existingElement || target.appendElement("div");
      el.className = "work-area";
      return el;
    }
  }

  class MenuFrame extends DOMNodeComponent {
    constructor(menu, workArea) {
      super();
      this.menu = menu;
      this.workArea = workArea;
    }

    renderNode(target, existingElement) {
      const u = this.unobservable;
      const el = existingElement || target.appendElement("div");
      el.className = "menu-frame";
      if (!u.childTarget) {
        u.childTarget = DOMElementTarget.forElement(el);
      }

      this.menu.renderOnto(u.childTarget);

      // jsdom does no real layout, so these stand in for real
      // getBoundingClientRect() measurements (see cascade.application/demo
      // for the version measuring an actual browser). The point being
      // proven is the dedup behavior below, not the measurement itself.
      u.childTarget.usableWidth = this.unobservable.simulatedFrameWidth - this.unobservable.simulatedMenuWidth;
      u.childTarget.usableHeight = this.unobservable.simulatedFrameHeight;

      this.workArea.renderOnto(u.childTarget);

      return el;
    }
  }

  it("passes real usable bounds down to the work area after measuring the menu", function () {
    const root = new DOMElementTarget(container);
    const menuFrame = new MenuFrame(new Menu(), new WorkArea());
    menuFrame.unobservable.simulatedFrameWidth = 1000;
    menuFrame.unobservable.simulatedFrameHeight = 700;
    menuFrame.unobservable.simulatedMenuWidth = 220;

    menuFrame.renderOnto(root);

    assert.equal(seenUsableWidth, 780);
    assert.equal(seenUsableHeight, 700);
    assert.equal(workAreaRenderCount, 1);
  });

  it("an unrelated rebuild that produces the same usable bounds does not rerun the work area", function () {
    const root = new DOMElementTarget(container);
    const menuFrame = new MenuFrame(new Menu(), new WorkArea());
    menuFrame.unobservable.simulatedFrameWidth = 1000;
    menuFrame.unobservable.simulatedFrameHeight = 700;
    menuFrame.unobservable.simulatedMenuWidth = 220;
    menuFrame.renderOnto(root);
    assert.equal(workAreaRenderCount, 1);

    menuFrame.unobservable.repeater.restart(); // same measurements every time

    assert.equal(workAreaRenderCount, 1); // reconciled quietly, no rerun
  });

  it("a genuinely different measurement reruns the work area with the new bounds", function () {
    const root = new DOMElementTarget(container);
    const menuFrame = new MenuFrame(new Menu(), new WorkArea());
    menuFrame.unobservable.simulatedFrameWidth = 1000;
    menuFrame.unobservable.simulatedFrameHeight = 700;
    menuFrame.unobservable.simulatedMenuWidth = 220;
    menuFrame.renderOnto(root);
    assert.equal(workAreaRenderCount, 1);

    menuFrame.unobservable.simulatedFrameWidth = 800; // window resized narrower
    menuFrame.unobservable.repeater.restart();

    assert.equal(seenUsableWidth, 580);
    assert.equal(workAreaRenderCount, 2);
  });

});

import { JSDOM } from "jsdom";
import assert from "assert";
import { Component, RenderContext, postponeInvalidations, continueInvalidations } from "@liquefy/cascade.component";
import { DOMTargetElement } from "../DOMTargetElement.js";

// DOMTargetElement is the alternative to DOMNodeComponent's "everything must
// expand into one primitive component to touch the real DOM" model - an
// ordinary Component can build a whole subtree of real elements directly
// in render(context) by calling context.target.createChild(...) and
// keeping the result, without ever being a DOMNodeComponent itself. See the
// class's own comment in ../DOMTargetElement.js for why this doesn't use
// DOMTarget's shared, observable `lastChild` - ownership (whoever calls
// createChild keeps the result and reuses it) sidesteps that whole class
// of stale-dependency bug instead of needing to patch around it.
describe("DOMTargetElement", function () {
  let container;

  beforeEach(function () {
    const dom = new JSDOM("<!DOCTYPE html><body></body>");
    global.document = dom.window.document;
    container = document.createElement("div");
  });

  it("createChild appends real elements in call order, each wrapped in its own DOMTargetElement", function () {
    const root = DOMTargetElement.forElement(container);
    const a = root.createChild("div");
    const b = root.createChild("span");

    assert.equal(container.children.length, 2);
    assert.equal(container.children[0], a.element);
    assert.equal(container.children[1], b.element);
    assert.equal(container.children[0].tagName, "DIV");
    assert.equal(container.children[1].tagName, "SPAN");
  });

  it("insertChild repositions an already-owned child without recreating or duplicating it", function () {
    const root = DOMTargetElement.forElement(container);
    const a = root.createChild("div");
    const b = root.createChild("div");
    a.element.dataset.id = "a";
    b.element.dataset.id = "b";

    assert.deepEqual([...container.children].map((c) => c.dataset.id), ["a", "b"]);

    root.insertChild(b, null); // move b to the front

    assert.equal(container.children.length, 2); // same two elements, not duplicated
    assert.deepEqual([...container.children].map((c) => c.dataset.id), ["b", "a"]);
    assert.equal(container.children[0], b.element); // literally the same node, not a new one
  });

  it("an ordinary Component (not DOMNodeComponent) can build and own several DOMTargetElements directly in render()", function () {
    class Row extends Component {
      render(context) {
        const u = this.unobservable;
        if (!u.label) {
          u.label = context.target.createChild("span");
          u.value = context.target.createChild("span");
        }
        u.label.element.textContent = "label:";
        u.value.element.textContent = String(this.count);
      }
    }

    const context = new RenderContext(DOMTargetElement.forElement(container));
    const row = new Row();
    row.count = 1;
    row.renderOnto(context);

    assert.equal(container.children.length, 2);
    assert.equal(container.children[0].textContent, "label:");
    assert.equal(container.children[1].textContent, "1");

    row.count = 2; // a plain observable write - reruns render() normally

    assert.equal(container.children.length, 2, "rerunning must reuse the same two elements, not add more");
    assert.equal(container.children[1].textContent, "2");
  });

  it("reordering two owned children across several passes never leaves a stale value behind (the bug DOMTarget's lastChild had)", function () {
    // The exact shape that broke DOMTarget's shared lastChild: a parent
    // that reorders two independently-rerunning children depending on its
    // own state, where one child's element was created while in one
    // relative position and needs to end up in another later. With
    // ownership + a direct insertChild call (no observable property in
    // the middle), there is no dependency for a later, unrelated write to
    // spuriously trip - so this must settle correctly on every pass, not
    // just the first.
    class Leaf extends Component {
      constructor(className) {
        super();
        this.causality.className = className; // plain, non-reactive - just a label for assertions
      }

      render(context) {
        const u = this.unobservable;
        if (!u.el) u.el = context.target.createChild("div");
        u.el.element.textContent = this.causality.className + ":" + this.value;
      }
    }

    class Frame extends Component {
      constructor(first, second) {
        super();
        this.first = first;
        this.second = second;
      }

      initializeState() {
        return { firstOnTop: true };
      }

      render(context) {
        this.first.renderOnto(context);
        this.second.renderOnto(context);
        // Always assert the current desired order (rather than only
        // patching when it flips one particular way) - the same
        // "reassert every render, don't rely on last time's leftover
        // position" discipline the DOM-order fix in
        // cascade.application/demo's own MenuFrame needed.
        if (this.firstOnTop) {
          context.target.insertChild(this.first.unobservable.el, null);
        } else {
          context.target.insertChild(this.second.unobservable.el, null);
        }
      }
    }

    const root = DOMTargetElement.forElement(container);
    const context = new RenderContext(root);
    const a = new Leaf("a");
    const b = new Leaf("b");
    a.value = 1;
    b.value = 1;
    const frame = new Frame(a, b);
    frame.renderOnto(context);

    function order() {
      return [...container.children].map((c) => c.textContent);
    }

    assert.deepEqual(order(), ["a:1", "b:1"]);

    for (let i = 2; i <= 4; i++) {
      frame.firstOnTop = !frame.firstOnTop;
      a.value = i;
      b.value = i;

      if (frame.firstOnTop) {
        assert.deepEqual(order(), [`a:${i}`, `b:${i}`], `pass ${i}: a on top`);
      } else {
        assert.deepEqual(order(), [`b:${i}`, `a:${i}`], `pass ${i}: b on top`);
      }
    }
  });

  it("a shared child sees a sibling's fresh write even after a branch swap breaks positional reconciliation", function () {
    // Found via cascade.application/demo's real menu/work-area breakpoint:
    // hamburger occupies the position right before a shared write while
    // narrow; menu (a *different*, independently pre-existing repeater -
    // opened once already, not created fresh here) occupies that same
    // position while wide. cascade.reactive reconciles a rerun against
    // the previous one by *position* (see
    // cascade.reactive/docs/plan-partial-repeaters.md's "Rerun: partials
    // get reused in place"); a different child at that position breaks
    // reconciliation for the rest of this run (repeater.reconciling goes
    // false). workArea sits right after the write, unaffected in
    // principle - but this used to leave its own dependency on that
    // write orphaned instead of updated in place (it read stale/undefined
    // values instead of the fresh one) because its own chain position,
    // last set whenever it actually ran, could easily end up numerically
    // *behind* the freshly-inserted write it needed to see. Fixed at the
    // cascade.reactive engine level (attachToCurrentParent's
    // movePartialToCurrentPosition) - see
    // cascade.reactive/src/test/reconciliation-position-staleness.js for
    // the isolated engine-level test; this is the same shape one layer up,
    // through real Component/DOMTargetElement usage.
    class Hamburger extends Component {
      render(context) {
        const u = this.unobservable;
        if (!u.el) u.el = context.target.createChild("button");
      }
      onRetract() { this.unobservable.el.element.remove(); }
      onReattach(context) { context.target.element.appendChild(this.unobservable.el.element); }
    }

    class Menu extends Component {
      render(context) {
        const u = this.unobservable;
        if (!u.el) u.el = context.target.createChild("div");
      }
    }

    class WorkArea extends Component {
      render(context) {
        const u = this.unobservable;
        if (!u.el) u.el = context.target.createChild("div");
        u.el.element.dataset.usableWidth = context.usableWidth;
      }
    }

    class Frame extends Component {
      constructor(hamburger, menu, workArea) {
        super();
        this.hamburger = hamburger;
        this.menu = menu;
        this.workArea = workArea;
      }

      initializeState() {
        return { narrow: true, menuOpen: false };
      }

      render(context) {
        const u = this.unobservable;
        if (!u.innerTarget) u.innerTarget = context.target.createChild("div");
        if (!u.innerContext) u.innerContext = new RenderContext(u.innerTarget);

        postponeInvalidations();
        if (this.narrow) {
          this.hamburger.renderOnto(u.innerContext);
          u.innerContext.usableWidth = 500;
          this.workArea.renderOnto(u.innerContext);
          if (this.menuOpen) {
            this.menu.renderOnto(u.innerContext);
          }
        } else {
          this.menu.renderOnto(u.innerContext); // occupies hamburger's old position
          u.innerContext.usableWidth = 1000;
          this.workArea.renderOnto(u.innerContext);
        }
        continueInvalidations();
      }
    }

    const root = DOMTargetElement.forElement(container);
    const context = new RenderContext(root);
    const workArea = new WorkArea();
    const frame = new Frame(new Hamburger(), new Menu(), workArea);
    frame.renderOnto(context);

    function workAreaWidth() {
      return workArea.unobservable.el.element.dataset.usableWidth;
    }

    assert.equal(workAreaWidth(), "500");

    // Open the menu while still narrow - it's now a real, independently
    // pre-existing repeater, not something the docked branch below would
    // create fresh.
    frame.menuOpen = true;
    frame.unobservable.repeater.restart();

    // Cross the breakpoint: hamburger gets retracted, menu (already
    // alive) takes over its old position - the exact divergence that
    // breaks positional reconciliation.
    frame.narrow = false;
    frame.unobservable.repeater.restart();
    assert.equal(workAreaWidth(), "1000", "workArea must see the fresh write, not fall through to a stale/missing value");

    // And it must keep working on subsequent round trips too.
    frame.narrow = true;
    frame.unobservable.repeater.restart();
    assert.equal(workAreaWidth(), "500");

    frame.narrow = false;
    frame.unobservable.repeater.restart();
    assert.equal(workAreaWidth(), "1000");
  });
});

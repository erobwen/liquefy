import { JSDOM } from "jsdom";
import assert from "assert";
import { Component, RenderContext, postponeInvalidations, continueInvalidations } from "@liquefy/cascade.component";
import { DOMTargetElement } from "../DOMTargetElement.js";

// DOMTargetElement is the alternative to DOMComponent's "everything must
// expand into one primitive component to touch the real DOM" model - an
// ordinary Component can build a whole subtree of real elements directly
// in render(context) by calling context.target.createChild(...) and
// keeping the result, without ever being a DOMComponent itself. See the
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

  it("an ordinary Component (not DOMComponent) can build and own several DOMTargetElements directly in render()", function () {
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
        this.firstOnTop = true;
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

  it("a shared child kept at a stable call position survives a branch whose *other* children vary in count/identity", function () {
    // Found via cascade.application/demo's real menu/work-area breakpoint:
    // a parent whose two branches call a *shared* child (workArea) at
    // *different* relative positions - one branch calls it right after an
    // "extra" child (hamburger) that the other branch doesn't call at all -
    // corrupts that shared child's own reconciliation the moment the
    // branch flips. cascade.reactive reconciles a rerun against the
    // previous one by position (see
    // cascade.reactive/docs/plan-partial-repeaters.md's "Rerun: partials
    // get reused in place"); a *different* child occupying the position
    // the shared one used to occupy breaks reconciliation for everything
    // from that point on (repeater.reconciling goes false), so the shared
    // child's own dependency on the parent's just-written context field
    // gets orphaned instead of updated in place - it reads `undefined` on
    // the very next render instead of the fresh value. The fix demonstrated
    // here: call the shared child (workArea) at the *same* relative
    // position in both branches - only the extra, branch-specific child
    // (hamburger) moves - which keeps its own reconciliation intact no
    // matter how many extra children come after it.
    class Hamburger extends Component {
      render(context) {
        const u = this.unobservable;
        if (!u.el) u.el = context.target.createChild("button");
      }
      onRetract() { this.unobservable.el.element.remove(); }
      onReattach(context) { context.target.element.appendChild(this.unobservable.el.element); }
    }

    class WorkArea extends Component {
      render(context) {
        const u = this.unobservable;
        if (!u.el) u.el = context.target.createChild("div");
        u.el.element.dataset.usableWidth = context.usableWidth;
      }
    }

    class Frame extends Component {
      constructor(hamburger, workArea) {
        super();
        this.hamburger = hamburger;
        this.workArea = workArea;
        this.narrow = true;
      }

      render(context) {
        const u = this.unobservable;
        if (!u.innerTarget) u.innerTarget = context.target.createChild("div");
        if (!u.innerContext) u.innerContext = new RenderContext(u.innerTarget);

        postponeInvalidations();
        u.innerContext.usableWidth = this.narrow ? 500 : 1000;

        // workArea always called first, at the same position in both
        // branches - the fix. hamburger (present only while narrow) is
        // called after it, so its own varying position/absence can never
        // disturb workArea's reconciliation.
        this.workArea.renderOnto(u.innerContext);
        if (this.narrow) {
          this.hamburger.renderOnto(u.innerContext);
        }
        continueInvalidations();
      }
    }

    const root = DOMTargetElement.forElement(container);
    const context = new RenderContext(root);
    const workArea = new WorkArea();
    const frame = new Frame(new Hamburger(), workArea);
    frame.renderOnto(context);

    function workAreaWidth() {
      return workArea.unobservable.el.element.dataset.usableWidth;
    }

    assert.equal(workAreaWidth(), "500");

    for (let i = 0; i < 3; i++) {
      frame.narrow = !frame.narrow;
      frame.unobservable.repeater.restart();
      assert.equal(workAreaWidth(), frame.narrow ? "500" : "1000", `pass ${i}: narrow=${frame.narrow}`);
    }
  });
});

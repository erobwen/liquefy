import { JSDOM } from "jsdom";
import assert from "assert";
import { Component, RenderContext } from "@liquefy/cascade.component";
import { DOMTarget } from "../DOMTarget.js";
import { DOMNodeRenderComponent } from "../DOMNodeRenderComponent.js";

// Same toolbar/main-frame shape as cascade.component's own vertical-slice
// test, but rendering real DOM elements this time - proving the mechanism
// (renderOnto/render/unobservable, plus the target's own lastChild
// versioning) generalizes from a plain number (spaceLeft) to an actual
// side effect (a DOM node existing, in a specific position).
describe("DOMTarget (real-time DOM renderOnto)", function () {
  let container;

  beforeEach(function () {
    const dom = new JSDOM("<!DOCTYPE html><body></body>");
    global.document = dom.window.document;
    container = document.createElement("div");
  });

  class Toolbar extends DOMNodeRenderComponent {
    constructor(label) {
      super();
      this.label = label;
    }

    renderElement(context, existingElement) {
      const el = existingElement || context.target.appendElement("div");
      el.className = "toolbar";
      el.textContent = this.label;
      return el;
    }
  }

  class ContentArea extends DOMNodeRenderComponent {
    renderElement(context, existingElement) {
      const el = existingElement || context.target.appendElement("div");
      el.className = "content";
      return el;
    }
  }

  class MainFrame extends DOMNodeRenderComponent {
    constructor(toolbar, contentArea) {
      super();
      this.toolbar = toolbar;
      this.contentArea = contentArea;
    }

    renderElement(context, existingElement) {
      const u = this.unobservable;
      const el = existingElement || context.target.appendElement("div");
      el.className = "main-frame";
      // Both the inner target and the context wrapping it have to persist
      // across reruns, the same way `el` does - otherwise a relinked child
      // (whose render() never re-executes) would either lose its
      // lastChild tracking or simply never see a freshly-constructed
      // context object at all (relinking can't - see RenderContext.js).
      if (!u.innerContext) {
        u.innerContext = new RenderContext(DOMTarget.forElement(el));
      }
      this.toolbar.renderOnto(u.innerContext);
      this.contentArea.renderOnto(u.innerContext);
      return el;
    }
  }

  it("renders real DOM elements in tree order into the container", function () {
    const context = new RenderContext(new DOMTarget(container));
    const toolbar = new Toolbar("Toolbar");
    const contentArea = new ContentArea();
    const mainFrame = new MainFrame(toolbar, contentArea);

    mainFrame.renderOnto(context);

    assert.equal(container.children.length, 1);
    const frameElement = container.children[0];
    assert.equal(frameElement.className, "main-frame");
    assert.equal(frameElement.children.length, 2);
    assert.equal(frameElement.children[0], toolbar.unobservable.element);
    assert.equal(frameElement.children[1], contentArea.unobservable.element);
    assert.equal(frameElement.children[0].className, "toolbar");
    assert.equal(frameElement.children[0].textContent, "Toolbar");
    assert.equal(frameElement.children[1].className, "content");
  });

  it("relinking without structural change leaves the real DOM untouched (no duplicate elements)", function () {
    const context = new RenderContext(new DOMTarget(container));
    const toolbar = new Toolbar("Toolbar");
    const contentArea = new ContentArea();
    const mainFrame = new MainFrame(toolbar, contentArea);
    mainFrame.renderOnto(context);

    const originalFrameElement = mainFrame.unobservable.element;
    const originalToolbarElement = toolbar.unobservable.element;

    mainFrame.unobservable.repeater.restart();

    assert.equal(container.children.length, 1);
    assert.equal(container.children[0], originalFrameElement); // reused in place, not recreated
    assert.equal(container.children[0].children.length, 2);
    assert.equal(container.children[0].children[0], originalToolbarElement); // toolbar relinked, not rerun - same element
  });

  it("a component's own rerun replaces its element in place, without duplicating or reordering siblings", function () {
    const context = new RenderContext(new DOMTarget(container));
    const toolbar = new Toolbar("Toolbar v1");
    const contentArea = new ContentArea();
    const mainFrame = new MainFrame(toolbar, contentArea);
    mainFrame.renderOnto(context);

    const frameElement = mainFrame.unobservable.element;
    const originalContentElement = contentArea.unobservable.element;

    toolbar.label = "Toolbar v2"; // toolbar's own input changes

    assert.equal(frameElement.children.length, 2); // still exactly 2, no duplicate
    assert.equal(frameElement.children[0].textContent, "Toolbar v2"); // replaced in place
    assert.equal(frameElement.children[0], toolbar.unobservable.element);
    assert.equal(frameElement.children[1], originalContentElement); // content area untouched, same element
  });

  it("passes a real measurement down to the content area, and reruns it when a re-measurement changes the value", function () {
    const context = new RenderContext(new DOMTarget(container));
    const toolbar = new Toolbar("Toolbar");

    let seenSpaceLeft;
    let renderCount = 0;
    class MeasuringContentArea extends DOMNodeRenderComponent {
      renderElement(childContext, existingElement) {
        renderCount++;
        seenSpaceLeft = childContext.spaceLeft;
        const el = existingElement || childContext.target.appendElement("div");
        el.className = "content";
        return el;
      }
    }
    const contentArea = new MeasuringContentArea();

    class MeasuringMainFrame extends DOMNodeRenderComponent {
      constructor(toolbar, contentArea) {
        super();
        this.toolbar = toolbar;
        this.contentArea = contentArea;
      }

      renderElement(parentContext, existingElement) {
        const u = this.unobservable;
        const el = existingElement || parentContext.target.appendElement("div");
        el.className = "main-frame";
        if (!u.innerContext) {
          u.innerContext = new RenderContext(DOMTarget.forElement(el));
        }
        this.toolbar.renderOnto(u.innerContext);
        // jsdom does no real layout, so this stands in for a real
        // getBoundingClientRect() measurement - the point being proven is
        // that writing a *different* value into the same, persistent
        // context object is what invalidates the child, same as any other
        // reactive write - not the renderOnto() call itself.
        u.innerContext.spaceLeft = this.unobservable.simulatedSpaceLeft;
        this.contentArea.renderOnto(u.innerContext);
        return el;
      }
    }
    const mainFrame = new MeasuringMainFrame(toolbar, contentArea);
    mainFrame.unobservable.simulatedSpaceLeft = 300;

    mainFrame.renderOnto(context);
    assert.equal(seenSpaceLeft, 300);
    assert.equal(renderCount, 1);

    // Same measurement again - reconciles quietly, content area untouched.
    mainFrame.unobservable.repeater.restart();
    assert.equal(renderCount, 1);

    // A genuinely different measurement - content area reruns and sees it,
    // purely through the ordinary reactive write above, not a special
    // "notify children" call.
    mainFrame.unobservable.simulatedSpaceLeft = 250;
    mainFrame.unobservable.repeater.restart();
    assert.equal(seenSpaceLeft, 250);
    assert.equal(renderCount, 2);
  });

  it("reattachElement is a plain, idempotent reposition primitive: a no-op move is skipped, a real one still happens", function () {
    // Direct check of the primitive itself (see domElementNode.js's own
    // "a sibling added after an unrelated rerun still lands after it, not
    // before" for the end-to-end version, through real components): calling
    // reattachElement again for an element that's already exactly where
    // target.lastChild says it belongs must not touch the real DOM at all;
    // calling it for one that genuinely needs to move still must.
    const target = new DOMTarget(container);
    const a = document.createElement("div");
    const b = document.createElement("div");
    target.reattachElement(a);
    target.reattachElement(b);
    assert.deepEqual(Array.from(container.children), [a, b]);

    let moveCount = 0;
    const originalInsertBefore = container.insertBefore.bind(container);
    container.insertBefore = (...args) => { moveCount++; return originalInsertBefore(...args); };

    // b is already target.lastChild, already last - reconfirming it (the
    // way a rerun that reuses its element, but didn't move it, still does
    // every time - see DOMElementComponent.renderElement()'s own comment) must
    // not move it again.
    target.reattachElement(b);
    assert.equal(moveCount, 0, "b was already exactly where it belongs");
    assert.deepEqual(Array.from(container.children), [a, b]);

    // A real reorder still works, and still moves exactly the node that
    // needs it.
    target.reattachElement(a); // a moves to right after b
    assert.equal(moveCount, 1);
    assert.deepEqual(Array.from(container.children), [b, a]);
  });

  it("reordering two owned children needs no manual repositioning - a parent that just renders them in the desired order is enough", function () {
    // The DOMTarget-based counterpart to domTargetElement.js's own
    // "reordering two owned children" test - that one needs an explicit
    // insertChild() call every render, specifically *because*
    // DOMTargetElement has no lastChild of its own to reposition against
    // (see its own class comment on why, and cascade.reactive's own
    // structural-order-verifier.js/reconciliation-position-staleness.js
    // for the engine-level fix this now relies on: a repeater found to
    // have moved to a different position among its own siblings gets its
    // own stale dependency on a moved-away predecessor's writing correctly
    // invalidated, not left silently stale - see cascade.js's own
    // attachToCurrentParent()/flagOverlapWithMovedPredecessor()). With
    // that fixed, a DOMTarget-based parent needs to do nothing more than
    // call its children in whichever order it wants *this* render - no
    // "reach back in and rearrange" step at all: each child's own
    // reattachElement() call reads target.lastChild and positions itself
    // relative to whatever actually ran immediately before it, and now
    // correctly re-examines that reading whenever its own position (not
    // just its own value) has genuinely changed.
    class Leaf extends DOMNodeRenderComponent {
      setProperties({ label }) {
        this.label = label;
      }
      renderElement(context, existingElement) {
        const element = existingElement || context.target.appendElement("div");
        if (existingElement) context.target.reattachElement(existingElement);
        element.textContent = this.label;
        return element;
      }
    }

    class Frame extends Component {
      setProperties({ first, second }) {
        this.first = first;
        this.second = second;
      }
      initializeState() {
        return { firstOnTop: true };
      }
      render(context) {
        // No after-the-fact insertChild/reattachElement reassertion here -
        // just render whichever child comes first this time, then the
        // other one.
        if (this.firstOnTop) {
          this.first.renderOnto(context);
          this.second.renderOnto(context);
        } else {
          this.second.renderOnto(context);
          this.first.renderOnto(context);
        }
      }
    }

    const a = new Leaf({ label: "a" });
    const b = new Leaf({ label: "b" });
    const frame = new Frame({ first: a, second: b });
    frame.renderOnto(new RenderContext(new DOMTarget(container)));

    function order() {
      return [...container.children].map((c) => c.textContent);
    }

    assert.deepEqual(order(), ["a", "b"]);

    for (let i = 0; i < 4; i++) {
      frame.firstOnTop = !frame.firstOnTop;
      assert.deepEqual(order(), frame.firstOnTop ? ["a", "b"] : ["b", "a"], `pass ${i}`);
    }
  });

  it("reordering two owned children across several passes never leaves a stale value behind, with both also rerunning for their own reasons every pass", function () {
    // Same shape as the test above, but each Leaf's own displayed value
    // also genuinely changes on every pass (this is the exact shape that
    // used to live in domTargetElement.js, built on DOMTargetElement's own
    // direct insertChild() call instead - see domTargetElement.js's own
    // note on why it moved here). Proves the fix holds up across repeated
    // reorders, not just a single flip and flip-back.
    class Leaf extends DOMNodeRenderComponent {
      setProperties({ label, value }) {
        this.label = label;
        this.value = value;
      }
      renderElement(context, existingElement) {
        const element = existingElement || context.target.appendElement("div");
        if (existingElement) context.target.reattachElement(existingElement);
        element.textContent = this.label + ":" + this.value;
        return element;
      }
    }

    class Frame extends Component {
      setProperties({ first, second }) {
        this.first = first;
        this.second = second;
      }
      initializeState() {
        return { firstOnTop: true };
      }
      render(context) {
        if (this.firstOnTop) {
          this.first.renderOnto(context);
          this.second.renderOnto(context);
        } else {
          this.second.renderOnto(context);
          this.first.renderOnto(context);
        }
      }
    }

    const a = new Leaf({ label: "a", value: 1 });
    const b = new Leaf({ label: "b", value: 1 });
    const frame = new Frame({ first: a, second: b });
    frame.renderOnto(new RenderContext(new DOMTarget(container)));

    function order() {
      return [...container.children].map((c) => c.textContent);
    }

    assert.deepEqual(order(), ["a:1", "b:1"]);

    for (let i = 2; i <= 4; i++) {
      frame.firstOnTop = !frame.firstOnTop;
      a.value = i;
      b.value = i;

      assert.deepEqual(
        order(),
        frame.firstOnTop ? [`a:${i}`, `b:${i}`] : [`b:${i}`, `a:${i}`],
        `pass ${i}`
      );
    }
  });

  it("resizing a build()-composed, keyed grid only reruns cells whose own position actually changed - not the whole grid", function () {
    // The efficiency question behind DOMTargetElement's own class comment
    // ("a same-value write is deduped... so writing it again later for an
    // unrelated reason can spuriously invalidate a long-dormant sibling"):
    // does a shared, reactive lastChild cause *unrelated* cells to rerun
    // when a grid resizes, or does the reorder-detection fix (see
    // cascade.reactive's own attachToCurrentParent()/
    // flagOverlapWithMovedPredecessor()) stay properly scoped to just the
    // cells actually affected? Built()-composed and keyed (row/col derives
    // each cell's own key), the idiomatic shape - not hand-cached inside
    // render() (a real, different bug found via exactly that shape: a
    // property set while constructing a child positions that write in the
    // *parent's* own partial, which the parent's own next dispose() then
    // unlinks regardless of which object it was actually setting a
    // property on - see cascade.component's own README.md on properties vs.
    // state, and this file's own git history).
    class Cell extends DOMNodeRenderComponent {
      setProperties({ row, col }) {
        this.row = row;
        this.col = col;
      }
      renderElement(context, existingElement) {
        const key = `r${this.row}c${this.col}`;
        renderCounts[key] = (renderCounts[key] || 0) + 1;
        const element = existingElement || context.target.appendElement("div");
        if (existingElement) context.target.reattachElement(existingElement);
        element.textContent = key;
        return element;
      }
    }

    class Grid extends Component {
      setProperties({ rows, cols }) {
        this.rows = rows;
        this.cols = cols;
      }
      build() {
        const cells = [];
        for (let row = 0; row < this.rows; row++) {
          for (let col = 0; col < this.cols; col++) {
            cells.push(new Cell({ key: `r${row}c${col}`, row, col }));
          }
        }
        return cells;
      }
    }

    let renderCounts;
    // Zero out every key seen *so far* (rather than starting from a fresh
    // empty object) so a cell that stays clean this phase shows up
    // explicitly as 0, not simply absent - deepEqual below must see every
    // still-live cell accounted for, not just the ones that reran.
    const resetCounts = () => {
      for (const key in renderCounts) renderCounts[key] = 0;
    };
    renderCounts = {};
    const grid = new Grid({ rows: 3, cols: 3 });
    grid.renderOnto(new RenderContext(new DOMTarget(container)));
    assert.deepEqual(renderCounts, {
      r0c0: 1, r0c1: 1, r0c2: 1, r1c0: 1, r1c1: 1, r1c2: 1, r2c0: 1, r2c1: 1, r2c2: 1,
    });

    // Shrink to 3x2 (drop the last column, r0c2/r1c2/r2c2): only the cell
    // *immediately following* a dropped one, within its own row, needs to
    // recheck its own position - r1c0 (follows the now-gone r0c2) and r2c0
    // (follows the now-gone r1c2). r0c0 (nothing before it changed) and
    // every c1 cell (its own predecessor is untouched) stay clean - a
    // clean relink, not a rerun.
    resetCounts();
    grid.cols = 2;
    // r0c2/r1c2/r2c2 are simply no longer built at all this pass (still
    // present in renderCounts, at whatever resetCounts() just left them,
    // since nothing touched them) - included here for a complete picture,
    // not because they're expected to do anything.
    assert.deepEqual(renderCounts, {
      r0c0: 0, r0c1: 0, r0c2: 0, r1c0: 1, r1c1: 0, r1c2: 0, r2c0: 1, r2c1: 0, r2c2: 0,
    });
    assert.deepEqual(
      [...container.children].map((c) => c.textContent),
      ["r0c0", "r0c1", "r1c0", "r1c1", "r2c0", "r2c1"]
    );

    // Shrinking off a whole trailing row instead - a clean truncation,
    // nothing left "after" the removal at all - needs no rerun anywhere.
    resetCounts();
    grid.rows = 2;
    assert.deepEqual(renderCounts, {
      r0c0: 0, r0c1: 0, r0c2: 0, r1c0: 0, r1c1: 0, r1c2: 0, r2c0: 0, r2c1: 0, r2c2: 0,
    });
  });

});

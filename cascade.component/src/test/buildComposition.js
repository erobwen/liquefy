import { observable } from "../Cascade.js";
import { Component } from "../Component.js";
import assert from "assert";

// Same toolbar/main-frame shape as toolbarMainFrame.js, but MainFrame
// composes its children via build() (keyed) instead of hardcoding them as
// fields - proving cascade.reactive's own buildId reconciliation
// (observable(target, buildId), already exercised by
// cascade.reactive/src/test/rebuild.js) correctly discards each freshly
// constructed child in favor of the established one from the previous
// build, merging in whatever changed.
describe("build()-based composition with key reconciliation", function () {

  class Toolbar extends Component {
    constructor(key, height) {
      super(key);
      this.height = height;
    }

    render(target) {
      this.unobservable.renderCount = (this.unobservable.renderCount || 0) + 1;
      target.remainingHeight -= this.height;
    }
  }

  class ContentArea extends Component {
    render(target) {
      this.unobservable.renderCount = (this.unobservable.renderCount || 0) + 1;
      this.unobservable.seenAvailableHeight = target.remainingHeight;
    }

    onDispose() {
      super.onDispose();
      this.unobservable.disposed = true;
    }
  }

  class MainFrame extends Component {
    constructor(key, toolbarHeight, showContent) {
      super(key);
      this.toolbarHeight = toolbarHeight;
      this.showContent = showContent;
    }

    build() {
      const children = [new Toolbar("toolbar", this.toolbarHeight)];
      if (this.showContent) children.push(new ContentArea("content"));
      return children;
    }
  }

  it("reconciles a fresh build() against the previous one via key: the same underlying child instance persists", function () {
    const target = observable({ remainingHeight: 400 });
    const mainFrame = new MainFrame("main", 50, true);

    mainFrame.renderOnto(target);
    const [toolbar1, contentArea1] = mainFrame.newBuild;

    assert.equal(contentArea1.unobservable.seenAvailableHeight, 350);
    assert.equal(toolbar1.unobservable.renderCount, 1);
    assert.equal(contentArea1.unobservable.renderCount, 1);

    // MainFrame's own build() inputs change - build() constructs BRAND NEW
    // Toolbar/ContentArea JS objects every time it runs, but key-based
    // reconciliation should discard them in favor of the same established
    // instances from the first build.
    mainFrame.toolbarHeight = 80;

    const [toolbar2, contentArea2] = mainFrame.newBuild;
    assert.equal(toolbar2, toolbar1); // same identity, not a fresh instance
    assert.equal(contentArea2, contentArea1); // same identity
    assert.equal(toolbar1.height, 80); // new constructor arg merged onto the established instance
    assert.equal(toolbar1.unobservable.renderCount, 2); // reran - its own height changed
    assert.equal(contentArea1.unobservable.renderCount, 2); // depends on toolbar's write, so it reran too
    assert.equal(contentArea1.unobservable.seenAvailableHeight, 320);
  });

  it("a child no longer returned by build() is disposed", function () {
    const target = observable({ remainingHeight: 400 });
    const mainFrame = new MainFrame("main", 50, true);
    mainFrame.renderOnto(target);
    const [, contentArea] = mainFrame.newBuild;

    mainFrame.showContent = false; // content area no longer built at all

    assert.equal(mainFrame.newBuild.length, 1);
    assert.ok(contentArea.unobservable.disposed);
  });

});

// A real bug found while migrating a demo page (see
// cascade.application/demo/src/pages/IntroductionPage.js): a build()-based
// component that gets retracted (simply not renderOnto()'d for a run or
// more - e.g. swapped out of a page switcher, or crossing a responsive
// breakpoint) and later renderOnto()'d again threw when its own
// build()-composed content was rendered, because reactiveBuildEquivalent()
// handed back `undefined` instead of the rebuilt tree.
describe("build()-based composition surviving retraction (reactiveBuildEquivalent() itself, not just render())", function () {

  class Leaf extends Component {
    render(target) {
      // Deliberately not delegating to Component's own default render()
      // (which would renderOnto() the result) - this test is specifically
      // about what reactiveBuildEquivalent() itself hands back, not about
      // rendering a further tree underneath it.
      this.unobservable.lastEquivalent = this.reactiveBuildEquivalent();
    }

    build() {
      const count = (this.unobservable.buildCount || 0) + 1;
      this.unobservable.buildCount = count;
      return { marker: "built-" + count };
    }
  }

  class Parent extends Component {
    constructor(key, showLeaf) {
      super(key);
      this.showLeaf = showLeaf;
      this.leaf = new Leaf();
    }

    render(target) {
      if (this.showLeaf) this.leaf.renderOnto(target);
      // else: leaf simply isn't renderOnto()'d this pass - retracted,
      // buildRepeater included (it's a child of leaf's own render-repeater).
    }
  }

  it("buildRepeater's own retraction is recovered from, not just the outer render-repeater's", function () {
    const target = observable({});
    const parent = new Parent("parent", true);
    parent.renderOnto(target);

    assert.equal(parent.leaf.unobservable.lastEquivalent.marker, "built-1");

    parent.showLeaf = false; // leaf (and its own buildRepeater) retracted
    parent.showLeaf = true; // renderOnto()'d again - relinked and reattached

    assert.equal(
      parent.leaf.unobservable.lastEquivalent.marker,
      "built-2",
      "build() must actually rerun once reattached after a real retraction, not hand back undefined from a writing that retraction already unlinked"
    );
  });

});

// A second real bug, found while restructuring cascade.application/demo's
// own top-level frame (ApplicationMenuFrame): a component (Grandparent)
// whose render() is overridden directly (not the default build()-then-
// renderOnto() flow) to write one of build()'s own inputs on itself and
// then immediately need build()'s fresh result, synchronously - measure,
// write, build off the fresh measurement, all in tree order, in one
// render() call (see RenderContext.js's own doc on this exact shape) -
// where build() constructs a *component* (Parent) that itself gets
// renderOnto()'d right there, in the same call, and which itself further
// builds and renders a component of its own (GC).
//
// linkRepeater() only guarantees a flagged buildRepeater's *disposal*
// happens inline; a genuine rerun it finds is deliberately left for the
// heap to run later (see linkRepeater's own comment). An abandoned first
// fix attempt (Component.js's own buildOnce(), since removed - see git
// history) sidestepped that by calling build() directly, with no separate
// repeater at all - but that broke something subtler than the deferred-
// refresh symptom it was fixing: reconciling a keyed child sets the
// *established* object's own forwardTo to point at the freshly
// constructed, about-to-be-discarded twin, and every read of anything but
// its causality/timelines meta gets transparently redirected through
// forwardTo until finishRebuilding() clears it - which only happens once
// whichever repeater did the constructing finishes its own refresh(). A
// bare, repeater-less build() call means that never happens until
// Grandparent's *own* enclosing render-repeater finishes - too late, if
// build()'s result gets renderOnto()'d before then, in that same call:
// Parent.renderOnto() reads Parent's own .unobservable while it's still
// mid-forwardTo, finds its temporary twin's own, empty unobservable bag
// instead of the established one's, and creates a redundant new render-
// repeater instead of relinking the real one - orphaning Parent's whole
// previously-established subtree (GC included), silently, with no
// exception anywhere. See Component.js's own reactiveBuildEquivalent()
// for the actual fix: keep the separate buildRepeater (so
// finishRebuilding() runs promptly, before this method's own caller ever
// sees the result) but force its refresh to complete synchronously
// (clear workStatus, call refresh() directly) rather than leaving it for
// the heap.
describe("reactiveBuildEquivalent(), nested two levels deep through components it itself constructs and renders", function () {

  // Grandchild: reads a property Parent's own build() sets fresh each run.
  class GC extends Component {
    setProperties({ marker }) {
      this.marker = marker;
    }
    render() {
      this.unobservable.lastSeenMarker = this.marker;
    }
  }

  // Parent: the default build()-then-renderOnto() flow (reactiveBuildEquivalent()),
  // reconstructed fresh every time Grandparent's own build() runs.
  class Parent extends Component {
    setProperties({ items }) {
      this.items = items;
    }
    build() {
      const gc = new GC({ key: "gc", marker: this.items.join(",") });
      this.unobservable.lastGC = gc;
      return gc;
    }
  }

  // Grandparent: overrides render() directly (measure/write, then
  // reactiveBuildEquivalent()) - ApplicationMenuFrame's own shape.
  class Grandparent extends Component {
    build() {
      const parent = new Parent({ key: "parent", items: [this.n] });
      this.unobservable.lastParent = parent;
      return parent;
    }

    render(target) {
      this.n = "run" + ((this.unobservable.renderCount = (this.unobservable.renderCount || 0) + 1));
      const equivalent = this.reactiveBuildEquivalent();
      equivalent.renderOnto(target);
    }
  }

  it("Parent (and its own child GC, one level further) reconciles to the same instance, with correct properties, across a scheduler-driven restart() of Grandparent's own render-repeater", function () {
    const target = {};
    const gp = new Grandparent();
    gp.renderOnto(target);

    const parent1 = gp.unobservable.lastParent;
    const gc1 = parent1.unobservable.lastGC;
    assert.equal(gc1.marker, "run1");
    assert.equal(gc1.unobservable.lastSeenMarker, "run1");

    gp.unobservable.repeater.restart();

    const parent2 = gp.unobservable.lastParent;
    assert.equal(parent2, parent1, "Parent reconciles to the same instance");

    const gc2 = parent2.unobservable.lastGC;
    assert.equal(gc2, gc1, "GC reconciles to the same instance too, one level further");
    assert.equal(gc2.marker, "run2", "GC's own property must reflect the fresh build, not fall through to undefined/stale");
    assert.equal(gc2.unobservable.lastSeenMarker, "run2", "GC's own render() must actually have rerun to see the fresh marker");
  });

});

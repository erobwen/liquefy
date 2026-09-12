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

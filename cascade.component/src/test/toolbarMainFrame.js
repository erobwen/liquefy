import { observable } from "../Cascade.js";
import { Component } from "../Component.js";
import assert from "assert";

// First vertical slice of cascade.component's "real-time render" model: a
// toolbar claims a fixed share of a shared target's remaining height, and
// the content area underneath it sees whatever's left - proving
// responsive, programmatic top-down layout works through the generalized
// Component base class (renderOnto/render/unobservable), not just the toy
// Leaf/Panel classes in cascade.reactive/src/test/renderOnto.js this is
// built from.
describe("toolbar/main-frame layout (real-time renderOnto)", function () {

  class Toolbar extends Component {
    constructor(height) {
      super();
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
  }

  class MainFrame extends Component {
    constructor(toolbar, contentArea) {
      super();
      this.toolbar = toolbar;
      this.contentArea = contentArea;
    }

    render(target) {
      this.unobservable.renderCount = (this.unobservable.renderCount || 0) + 1;
      this.toolbar.renderOnto(target);
      this.contentArea.renderOnto(target);
    }
  }

  it("passes remaining space top-down: the content area sees space left after the toolbar claims its share", function () {
    const target = observable({ remainingHeight: 400 });
    const toolbar = new Toolbar(50);
    const contentArea = new ContentArea();
    const mainFrame = new MainFrame(toolbar, contentArea);

    mainFrame.renderOnto(target);

    assert.equal(contentArea.unobservable.seenAvailableHeight, 350);
    assert.equal(toolbar.unobservable.renderCount, 1);
    assert.equal(contentArea.unobservable.renderCount, 1);
    assert.equal(mainFrame.unobservable.renderCount, 1);
  });

  it("changing the toolbar's own height reruns only the toolbar and the content area, not the main frame", function () {
    const target = observable({ remainingHeight: 400 });
    const toolbar = new Toolbar(50);
    const contentArea = new ContentArea();
    const mainFrame = new MainFrame(toolbar, contentArea);
    mainFrame.renderOnto(target);

    toolbar.height = 80; // toolbar's own input changes - no structural change to main frame

    assert.equal(toolbar.unobservable.renderCount, 2);
    assert.equal(contentArea.unobservable.renderCount, 2);
    assert.equal(contentArea.unobservable.seenAvailableHeight, 320); // 400 - 80
    assert.equal(mainFrame.unobservable.renderCount, 1); // main frame itself never touched
  });

  it("main frame rebuilding for an unrelated reason relinks toolbar and content area without rerunning them", function () {
    const target = observable({ remainingHeight: 400 });
    const toolbar = new Toolbar(50);
    const contentArea = new ContentArea();
    const mainFrame = new MainFrame(toolbar, contentArea);
    mainFrame.renderOnto(target);

    mainFrame.unobservable.repeater.restart();

    assert.equal(mainFrame.unobservable.renderCount, 2);
    assert.equal(toolbar.unobservable.renderCount, 1); // relinked, not rerun
    assert.equal(contentArea.unobservable.renderCount, 1); // relinked, not rerun
    assert.equal(target.remainingHeight, 350); // unchanged, reconciled quietly
  });

});

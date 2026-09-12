import { JSDOM } from "jsdom";
import assert from "assert";
import { DOMTarget } from "../DOMTarget.js";
import { DOMComponent } from "../DOMComponent.js";

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

  class Toolbar extends DOMComponent {
    constructor(label) {
      super();
      this.label = label;
    }

    renderElement(target, existingElement) {
      const el = existingElement || target.appendElement("div");
      el.className = "toolbar";
      el.textContent = this.label;
      return el;
    }
  }

  class ContentArea extends DOMComponent {
    renderElement(target, existingElement) {
      const el = existingElement || target.appendElement("div");
      el.className = "content";
      return el;
    }
  }

  class MainFrame extends DOMComponent {
    constructor(toolbar, contentArea) {
      super();
      this.toolbar = toolbar;
      this.contentArea = contentArea;
    }

    renderElement(target, existingElement) {
      const u = this.unobservable;
      const el = existingElement || target.appendElement("div");
      el.className = "main-frame";
      // The inner target (and its lastChild tracking) has to persist
      // across reruns too, the same way `el` does - otherwise a relinked
      // child (whose render() never re-executes) would leave a fresh
      // target's lastChild pointing at nothing, even though el's real
      // children are all still exactly where they were.
      if (!u.innerTarget) {
        u.innerTarget = DOMTarget.forElement(el);
      }
      this.toolbar.renderOnto(u.innerTarget);
      this.contentArea.renderOnto(u.innerTarget);
      return el;
    }
  }

  it("renders real DOM elements in tree order into the container", function () {
    const target = new DOMTarget(container);
    const toolbar = new Toolbar("Toolbar");
    const contentArea = new ContentArea();
    const mainFrame = new MainFrame(toolbar, contentArea);

    mainFrame.renderOnto(target);

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
    const target = new DOMTarget(container);
    const toolbar = new Toolbar("Toolbar");
    const contentArea = new ContentArea();
    const mainFrame = new MainFrame(toolbar, contentArea);
    mainFrame.renderOnto(target);

    const originalFrameElement = mainFrame.unobservable.element;
    const originalToolbarElement = toolbar.unobservable.element;

    mainFrame.unobservable.repeater.restart();

    assert.equal(container.children.length, 1);
    assert.equal(container.children[0], originalFrameElement); // reused in place, not recreated
    assert.equal(container.children[0].children.length, 2);
    assert.equal(container.children[0].children[0], originalToolbarElement); // toolbar relinked, not rerun - same element
  });

  it("a component's own rerun replaces its element in place, without duplicating or reordering siblings", function () {
    const target = new DOMTarget(container);
    const toolbar = new Toolbar("Toolbar v1");
    const contentArea = new ContentArea();
    const mainFrame = new MainFrame(toolbar, contentArea);
    mainFrame.renderOnto(target);

    const frameElement = mainFrame.unobservable.element;
    const originalContentElement = contentArea.unobservable.element;

    toolbar.label = "Toolbar v2"; // toolbar's own input changes

    assert.equal(frameElement.children.length, 2); // still exactly 2, no duplicate
    assert.equal(frameElement.children[0].textContent, "Toolbar v2"); // replaced in place
    assert.equal(frameElement.children[0], toolbar.unobservable.element);
    assert.equal(frameElement.children[1], originalContentElement); // content area untouched, same element
  });

});

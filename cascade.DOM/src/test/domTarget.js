import { JSDOM } from "jsdom";
import assert from "assert";
import { RenderContext } from "@liquefy/cascade.component";
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

});

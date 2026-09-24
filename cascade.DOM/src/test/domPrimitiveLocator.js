import { JSDOM } from "jsdom";
import assert from "assert";
import { Component, RenderContext } from "@liquefy/cascade.component";
import { DOMElementTarget } from "../DOMElementTarget.js";
import { DOMPrimitiveLocator } from "../DOMPrimitiveLocator.js";
import { div, span } from "../HTMLTags.js";
import { text } from "../DOMTextComponent.js";

// The primitive locator travels with the render context (owned by the
// root DOMElementTarget, forwarded by every nested one), and HTMLTags
// resolves it from the currently-building component's own render context.
// The shared default locator behaves identically to any tree's own, so
// every other DOM test would still pass if resolution silently fell back
// to it - this one uses a locator that records what it built.
describe("DOMPrimitiveLocator (reached through the render context)", function () {
  let container;

  beforeEach(function () {
    const dom = new JSDOM("<!DOCTYPE html><body></body>");
    global.document = dom.window.document;
    container = document.createElement("div");
  });

  class RecordingLocator extends DOMPrimitiveLocator {
    constructor() {
      super();
      this.built = [];
    }
    build(tag, properties) {
      this.built.push(tag);
      return super.build(tag, properties);
    }
  }

  it("every tag built anywhere in the tree - including in nested components' own build() - goes through the root target's own locator", function () {
    class Inner extends Component {
      build() {
        return span({ key: "inner" }, text("inner"));
      }
    }

    class Outer extends Component {
      build() {
        return div({ key: "outer" }, new Inner({ key: "innerComponent" }));
      }
    }

    const locator = new RecordingLocator();
    const outer = new Outer();
    outer.renderOnto(new RenderContext(new DOMElementTarget(container, locator)));

    assert.deepEqual(locator.built, ["div", "span"]);
    assert.equal(container.querySelector("span").textContent, "inner");
  });

  it("two trees with different locators each use their own", function () {
    class Leaf extends Component {
      build() {
        return div({ key: "leaf" });
      }
    }

    const first = new RecordingLocator();
    const second = new RecordingLocator();
    new Leaf().renderOnto(new RenderContext(new DOMElementTarget(container, first)));
    new Leaf().renderOnto(new RenderContext(new DOMElementTarget(document.createElement("div"), second)));

    assert.deepEqual(first.built, ["div"]);
    assert.deepEqual(second.built, ["div"]);
  });
});

import { JSDOM } from "jsdom";
import assert from "assert";
import { Component, RenderContext } from "@liquefy/cascade.component";
import { DOMTarget } from "../DOMTarget.js";
import { DOMNodeComponent } from "../DOMNodeComponent.js";
import { div, p } from "../HTMLTags.js";
import { text } from "../DOMTextNode.js";

// DOMNodeComponent (abstract) vs DOMNodeRenderComponent (the render-owning
// primitive DOMElementNode/DOMTextNode/DOMTargetElementBridge extend
// directly): this one is for a build()-composed component that should still
// count as "one real DOM node" to anything upstream - checked here, not
// left to surface later as a mysterious failure wherever that guarantee was
// assumed to hold.
describe("DOMNodeComponent (abstract build()-composed real-node guarantee)", function () {
  let container;

  beforeEach(function () {
    const dom = new JSDOM("<!DOCTYPE html><body></body>");
    global.document = dom.window.document;
    container = document.createElement("div");
  });

  it("renders normally when build() returns exactly one DOMNodeRenderComponent", function () {
    class Card extends DOMNodeComponent {
      setProperties({ label }) {
        this.label = label;
      }
      build() {
        return div({ key: "card" }, p({ key: "label" }, text(this.label)));
      }
    }

    const card = new Card({ label: "hello" });
    card.renderOnto(new RenderContext(new DOMTarget(container)));

    assert.equal(container.children.length, 1);
    assert.equal(container.children[0].textContent, "hello");
  });

  it("throws if build() returns an array instead of a single DOMNodeRenderComponent", function () {
    class BrokenMultiple extends DOMNodeComponent {
      build() {
        return [div({ key: "a" }), div({ key: "b" })];
      }
    }

    const broken = new BrokenMultiple();
    assert.throws(
      () => broken.renderOnto(new RenderContext(new DOMTarget(container))),
      /BrokenMultiple\.build\(\) must return exactly one DOMNodeRenderComponent, not an array of 2/
    );
  });

  it("throws if build() returns null", function () {
    class BrokenNull extends DOMNodeComponent {
      build() {
        return null;
      }
    }

    const broken = new BrokenNull();
    assert.throws(
      () => broken.renderOnto(new RenderContext(new DOMTarget(container))),
      /BrokenNull\.build\(\) must return exactly one DOMNodeRenderComponent, not null/
    );
  });

  it("throws if build() returns an ordinary Component that isn't itself a DOMNodeRenderComponent", function () {
    class NotARealNode extends Component {
      build() {
        return [];
      }
    }

    class BrokenWrongType extends DOMNodeComponent {
      build() {
        return new NotARealNode();
      }
    }

    const broken = new BrokenWrongType();
    assert.throws(
      () => broken.renderOnto(new RenderContext(new DOMTarget(container))),
      /BrokenWrongType\.build\(\) must return exactly one DOMNodeRenderComponent, not NotARealNode/
    );
  });
});

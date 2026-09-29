import { JSDOM } from "jsdom";
import assert from "assert";
import { Component, RenderContext } from "@liquefy/cascade.component";
import { DOMElementTarget } from "../DOMElementTarget.js";
import { SingleNodeComponent } from "../SingleNodeComponent.js";
import { div, p } from "../HTMLTags.js";
import { text } from "../DOMTextComponent.js";

// SingleNodeComponent (abstract) vs DOMNodeComponent (the render-owning
// base DOMElementComponent/DOMTextComponent/DOMProvidingElement extend
// directly): this one is for a build()-composed component that should still
// count as "one real DOM node" to anything upstream - checked here, not
// left to surface later as a mysterious failure wherever that guarantee was
// assumed to hold.
describe("SingleNodeComponent (abstract build()-composed real-node guarantee)", function () {
  let container;

  beforeEach(function () {
    const dom = new JSDOM("<!DOCTYPE html><body></body>");
    global.document = dom.window.document;
    container = document.createElement("div");
  });

  it("renders normally when build() returns exactly one DOMNodeComponent", function () {
    class Card extends SingleNodeComponent {
      setProperties({ label }) {
        this.label = label;
      }
      build() {
        return div({ key: "card" }, p({ key: "label" }, text(this.label)));
      }
    }

    const card = new Card({ label: "hello" });
    card.renderOnto(new DOMElementTarget(container));

    assert.equal(container.children.length, 1);
    assert.equal(container.children[0].textContent, "hello");
  });

  it("throws if build() returns an array instead of a single DOMNodeComponent", function () {
    class BrokenMultiple extends SingleNodeComponent {
      build() {
        return [div({ key: "a" }), div({ key: "b" })];
      }
    }

    const broken = new BrokenMultiple();
    assert.throws(
      () => broken.renderOnto(new DOMElementTarget(container)),
      /BrokenMultiple\.build\(\) must return exactly one DOMNodeComponent, not an array of 2/
    );
  });

  it("throws if build() returns null", function () {
    class BrokenNull extends SingleNodeComponent {
      build() {
        return null;
      }
    }

    const broken = new BrokenNull();
    assert.throws(
      () => broken.renderOnto(new DOMElementTarget(container)),
      /BrokenNull\.build\(\) must return exactly one DOMNodeComponent, not null/
    );
  });

  it("throws if build() returns an ordinary Component that isn't itself a DOMNodeComponent", function () {
    class NotARealNode extends Component {
      build() {
        return [];
      }
    }

    class BrokenWrongType extends SingleNodeComponent {
      build() {
        return new NotARealNode();
      }
    }

    const broken = new BrokenWrongType();
    assert.throws(
      () => broken.renderOnto(new DOMElementTarget(container)),
      /BrokenWrongType\.build\(\) must return exactly one DOMNodeComponent, not NotARealNode/
    );
  });
});

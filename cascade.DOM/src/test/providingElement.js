import { JSDOM } from "jsdom";
import assert from "assert";
import { Component, RenderContext, observable } from "@liquefy/cascade.component";
import { DOMElementTarget } from "../DOMElementTarget.js";
import { DOMProvidingElement } from "../DOMProvidingElement.js";

// providingElement(): an element of its own, its child rendered into it, and
// the fields of its `context` provided to everything below it - following
// the context as it changes: a value changed, a key dropped.
describe("providingElement()", function () {
  beforeEach(function () {
    const dom = new JSDOM("<!DOCTYPE html><body></body>");
    global.document = dom.window.document;
  });

  it("provides its context's fields below it - a changed value, and a key dropped", function () {
    const seen = [];
    class Reader extends Component {
      build() {
        seen.push(this.inherit("a"));
        return null;
      }
    }
    const model = observable({ context: { a: 1 } });
    const reader = new Reader();
    class Root extends Component {
      build() {
        return new DOMProvidingElement({ child: reader, context: model.context });
      }
    }
    new Root().renderOnto(new DOMElementTarget(document.createElement("div")), new RenderContext({ a: "outer" }));
    model.context = { a: 2 };
    model.context = {};
    assert.deepEqual(seen, [1, 2, "outer"]);
  });
});

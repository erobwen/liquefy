import { JSDOM } from "jsdom";
import assert from "assert";
import { Component, RenderContext, CompoundServiceLocator, callback } from "@liquefy/cascade.component";
import { DOMElementTarget } from "../DOMElementTarget.js";
import { DOMServiceLocator, hydrate } from "../DOMServiceLocator.js";
import { jsx, jsxs, Fragment, serviceQueries } from "../jsx-runtime.js";

// The JSX runtime, called the way compiled JSX calls it: `<p>Hi</p>` is
// jsx("p", { children: "Hi" }), `<li key={k}>` jsx("li", props, k).
describe("JSX runtime (tags compiled to service queries)", function () {
  let container;

  beforeEach(function () {
    const dom = new JSDOM("<!DOCTYPE html><body></body>");
    global.document = dom.window.document;
    container = document.createElement("div");
  });

  const render = (component) =>
    component.renderOnto(new DOMElementTarget(container), new RenderContext({ serviceLocator: new CompoundServiceLocator(new DOMServiceLocator()) }));

  it("makes a lowercase tag an htmlElement query, the key a property", function () {
    assert.deepEqual(jsx("li", { children: "one" }, "first"), { type: "htmlElement", name: "li", properties: { children: ["one"], key: "first" } });
  });

  it("flattens children, drops conditions that didn't hold, joins adjacent text", function () {
    const query = jsxs("p", { children: ["Count is ", 3, false, null, [jsx("b", { children: "x" }), undefined], jsx(Fragment, { children: ["y", "z"] })] });
    assert.deepEqual(query.properties.children, ["Count is 3", { type: "htmlElement", name: "b", properties: { children: ["x"] } }, "yz"]);
  });

  it("makes a namespaced tag whatever its function returns", function () {
    const widget = serviceQueries("widget");
    assert.deepEqual(jsx(widget.button, { variant: "filled" }), { type: "widget", name: "button", properties: { variant: "filled" } });
  });

  it("makes a Component class a query naming the class - constructed when hydrated", function () {
    class Box extends Component {
      setProperties({ label }) { this.label = label; }
    }
    const query = jsx(Box, { label: "a" });
    assert.equal(query.type, "component");
    assert.equal(query.componentClass, Box);
    const box = hydrate(query);
    assert.ok(box instanceof Box);
    assert.equal(box.label, "a");
  });

  it("a Component tag's own JSX children are hydrated too - nested, or at the root", function () {
    class Box extends Component {
      setProperties({ children }) { this.boxChildren = children || []; }
      build() { return hydrate(jsx("div", { className: "box", children: this.boxChildren })); }
    }
    class Page extends Component {
      build() {
        return hydrate(jsx("section", { children: jsx(Box, { children: jsx("span", { children: "hi" }) }) }));
      }
    }
    render(new Page());
    assert.equal(container.querySelector("section > div.box > span").textContent, "hi");

    container.innerHTML = "";
    class Root extends Component {
      build() { return hydrate(jsx(Box, { children: jsx("b", { children: "root" }) })); }
    }
    render(new Root());
    assert.equal(container.querySelector(".box b").textContent, "root");
  });

  it("carries a callback from the tag to the element, and hydrates the whole document", function () {
    class Counter extends Component {
      initialState() {
        return { count: 0 };
      }
      build() {
        return hydrate(jsxs("div", { children: [
          jsxs("span", { children: ["Count is ", this.count] }),
          jsx("button", { onClick: callback("count", () => { this.count++; }), children: "More" }),
        ] }));
      }
    }
    render(new Counter());
    const button = container.querySelector("button");
    button.onclick();
    button.onclick();
    assert.equal(container.querySelector("span").textContent, "Count is 2");
    assert.equal(container.querySelector("button"), button, "the same element, rebuilt in place");
  });
});

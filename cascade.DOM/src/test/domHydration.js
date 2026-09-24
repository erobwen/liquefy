import { JSDOM } from "jsdom";
import assert from "assert";
import { Component, RenderContext, CompoundServiceLocator, ObservableCompoundServiceLocator, observable, isServiceQuery } from "@liquefy/cascade.component";
import { DOMElementTarget } from "../DOMElementTarget.js";
import { DOMServiceLocator, DOMDebugServiceLocator, hydrate } from "../DOMServiceLocator.js";

// Hydration: a document - a tree of plain service queries - handed to a
// service locator, which builds the whole tree of components from it,
// children first (see cascade.component's ServiceLocator.js).
describe("hydration (a document of service queries, built into components)", function () {
  let container;
  let originalWarn;

  beforeEach(function () {
    const dom = new JSDOM("<!DOCTYPE html><body></body>");
    global.document = dom.window.document;
    container = document.createElement("div");
    originalWarn = console.warn;
    console.warn = () => {};
  });

  afterEach(function () {
    console.warn = originalWarn;
  });

  const el = (name, properties) => ({ type: "htmlElement", name, properties });

  const article = (title) => el("div", {
    style: { maxWidth: 720 },
    children: [
      el("h1", { children: [title] }),
      el("p", { children: ["Lorem ipsum ", el("b", { children: ["dolor"] }), " sit amet."] }),
      el("ul", { children: [el("li", { children: ["one"] }), el("li", { children: ["two"] })] }),
      el("p", { children: el("i", { children: ["a single child, not in an array"] }) }),
    ],
  });

  class Page extends Component {
    initializeState() {
      return { title: "Hydrated" };
    }
    build() {
      return hydrate(article(this.title));
    }
  }

  const render = (component, serviceLocator) =>
    component.renderOnto(new RenderContext(new DOMElementTarget(container), { serviceLocator }));

  it("recognizes service queries: plain objects with a string type", function () {
    assert.ok(isServiceQuery(el("div", {})));
    assert.ok(!isServiceQuery({ name: "div" }), "no type");
    assert.ok(!isServiceQuery([el("div", {})]), "an array");
    assert.ok(!isServiceQuery("div"));
    assert.ok(!isServiceQuery(observable({ type: "htmlElement" })), "an observable (a component, a model)");
  });

  it("builds the whole tree, children first, strings as text", function () {
    render(new Page(), new CompoundServiceLocator(new DOMServiceLocator()));
    const root = container.firstChild;
    assert.equal(root.tagName, "DIV");
    assert.equal(root.style.maxWidth, "720px");
    assert.deepEqual(Array.from(root.children).map((c) => c.tagName), ["H1", "P", "UL", "P"]);
    assert.equal(root.children[0].textContent, "Hydrated");
    assert.equal(root.children[1].textContent, "Lorem ipsum dolor sit amet.");
    assert.equal(root.children[1].firstElementChild.tagName, "B");
    assert.deepEqual(Array.from(root.children[2].children).map((li) => li.textContent), ["one", "two"]);
    assert.equal(root.children[3].firstElementChild.tagName, "I");
  });

  it("gives unkeyed nodes positional keys, so a rebuild reuses every element", function () {
    const page = new Page();
    render(page, new CompoundServiceLocator(new DOMServiceLocator()));
    const before = Array.from(container.querySelectorAll("*"));

    page.title = "Hydrated again";
    const after = Array.from(container.querySelectorAll("*"));
    assert.equal(after.length, before.length);
    after.forEach((element, i) => assert.equal(element, before[i], "element " + i + " reused"));
    assert.equal(container.querySelector("h1").textContent, "Hydrated again");
  });

  it("a node's own key wins over its positional one", function () {
    const seen = [];
    const recording = { locate: (query) => { seen.push(query.properties.key); return new DOMServiceLocator().locate(query); } };
    class Keyed extends Component {
      build() {
        return hydrate(el("div", { key: "root", children: [el("span", {}), el("span", { key: "named", children: [el("b", {})] })] }));
      }
    }
    render(new Keyed(), new CompoundServiceLocator(recording));
    assert.deepEqual(seen, ["root.0", "named.0", "named", "root"], "children first; positional keys extend the nearest key");
  });

  it("a query nobody provides becomes a placeholder, still holding its hydrated children", function () {
    class WithUnknown extends Component {
      build() {
        return hydrate(el("div", { children: [{ type: "widget", name: "chart", properties: { children: [el("em", { children: ["data"] })] } }] }));
      }
    }
    render(new WithUnknown(), new ObservableCompoundServiceLocator(new DOMServiceLocator(), new DOMDebugServiceLocator()));
    const placeholder = container.querySelector("[title='Unresolved service: widget chart']");
    assert.ok(placeholder);
    assert.equal(placeholder.querySelector("em").textContent, "data");
  });

  it("a locator can hydrate a document outside any build(), too", function () {
    const tree = new CompoundServiceLocator(new DOMServiceLocator()).hydrate(article("Standalone"));
    tree.renderOnto(new RenderContext(new DOMElementTarget(container)));
    assert.equal(container.querySelector("h1").textContent, "Standalone");
  });
});

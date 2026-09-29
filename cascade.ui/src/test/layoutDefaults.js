import { JSDOM } from "jsdom";
import assert from "assert";
import { RenderContext, Component, CompoundServiceLocator } from "@liquefy/cascade.component";
import { DOMElementTarget, DOMServiceLocator, div, text } from "@liquefy/cascade.dom";
import { basicTheme, button, row, column, filler, zStack, keyAsLabel } from "../index.js";

// Defaults a newcomer meets first: layout containers that don't clip, a
// zStack that stacks its own children, and a button that can do with just
// a key.
describe("layout and widget defaults", function () {
  let container;

  beforeEach(function () {
    const dom = new JSDOM("<!DOCTYPE html><head></head><body></body>");
    global.document = dom.window.document;
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  const render = (build) => {
    class Page extends Component {
      build() {
        return build();
      }
    }
    new Page().renderOnto(new DOMElementTarget(container), new RenderContext({ serviceLocator: new CompoundServiceLocator(new DOMServiceLocator(), basicTheme) }));
  };

  it("row, column and filler don't clip - but still shrink below their content", function () {
    render(() => row({ key: "row" }, column({ key: "column" }, text({ key: "t", text: "x" })), filler({ key: "filler" })));
    for (const element of container.querySelectorAll("div")) {
      assert.equal(element.style.overflow, "", "no overflow: hidden");
      assert.equal(element.style.userSelect, "", "text can be selected");
      assert.equal(element.style.minWidth, "0px");
      assert.equal(element.style.minHeight, "0px");
    }
  });

  it("a zStack stacks its own children - a child's own style still wins", function () {
    render(() => zStack({ key: "stack", className: "mine" }, div({ key: "under" }), div({ key: "over", style: { top: "10px" } })));
    const stack = container.firstChild;
    assert.equal(stack.style.position, "relative");
    assert.ok(stack.classList.contains("cascade-z-stack"));
    assert.ok(stack.classList.contains("mine"), "and its own class too");
    const rule = [...document.querySelectorAll("style")].map((each) => each.textContent).join("\n");
    assert.ok(/\.cascade-z-stack > \* \{[^}]*position: absolute/.test(rule), "a rule places every direct child");
    assert.equal(stack.children[1].style.top, "10px");
  });

  it("a button given only a key shows it as its label, in words", function () {
    render(() => div({ key: "d" }, button("save", () => {}), button("openDialog"), button({ key: "given" }, text({ key: "t", text: "Given" }))));
    const labels = [...container.querySelectorAll("button")].map((each) => each.textContent);
    assert.deepEqual(labels, ["Save", "Open dialog", "Given"]);
  });

  it("keyAsLabel", function () {
    assert.equal(keyAsLabel("save"), "Save");
    assert.equal(keyAsLabel("openDialog"), "Open dialog");
    assert.equal(keyAsLabel("add-luggage"), "Add luggage");
    assert.equal(keyAsLabel("addHTML5"), "Add html5");
  });
});

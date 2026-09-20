import { JSDOM } from "jsdom";
import assert from "assert";
import { Component, RenderContext } from "@liquefy/cascade.component";
import { DOMTarget } from "../DOMTarget.js";
import { div, h1, p, ul, li } from "../HTMLTags.js";
import { text as textNode } from "../DOMTextNode.js";

// Exercises the tag-builder layer (HTMLTags -> taggedElement ->
// DOMElementNode/DOMTextNode) the way a real component actually uses it:
// build() returning a tree of div/h1/p/ul/li/loose-string-children, the
// same style flow.application/demo/src/pages/introductionPage.js is
// written in - see cascade.application/demo/src/pages/IntroductionPage.js
// for the real, migrated component this proves out.
//
// Note the explicit keys and text(...) wrapping below, and *why*: a
// leading loose string passed alone becomes an *implicit key*, not text
// content, whenever it starts with a lowercase letter (see
// implicitProperties.js's own canBeKey) - faithfully ported from flow's
// own convention, not a bug here. `li("first")` would silently end up
// keyed "first" with no children at all; text("first") sidesteps that
// (an observable component instance is never mistaken for key content),
// and an explicit `key` on each element is what actually lets its own
// real DOM element identity survive a rebuild (see the third test).
describe("DOMElementNode/HTMLTags (build()-composed real DOM elements)", function () {
  let container;

  beforeEach(function () {
    const dom = new JSDOM("<!DOCTYPE html><body></body>");
    global.document = dom.window.document;
    container = document.createElement("div");
  });

  class Page extends Component {
    initializeState() {
      return { heading: "Hello", highlighted: false };
    }

    build() {
      return div(
        h1({ key: "heading" }, this.heading),
        p({ key: "intro", style: this.highlighted ? { backgroundColor: "yellow" } : {} }, "A paragraph with a "),
        ul({ key: "list" },
          li({ key: "item1" }, textNode("first")),
          li({ key: "item2" }, textNode("second")),
        ),
        { key: "root", style: { margin: 10 } },
      );
    }
  }

  it("renders a real DOM tree matching the built structure, including loose string children as text nodes", function () {
    const page = new Page();
    page.renderOnto(new RenderContext(new DOMTarget(container)));

    const rootDiv = container.children[0];
    assert.equal(rootDiv.tagName, "DIV");
    assert.equal(rootDiv.style.margin, "10px");

    const h1El = rootDiv.children[0];
    assert.equal(h1El.tagName, "H1");
    assert.equal(h1El.textContent, "Hello");

    const pEl = rootDiv.children[1];
    assert.equal(pEl.tagName, "P");
    assert.equal(pEl.textContent, "A paragraph with a ");

    const ulEl = rootDiv.children[2];
    assert.equal(ulEl.tagName, "UL");
    assert.equal(ulEl.children.length, 2);
    assert.equal(ulEl.children[0].textContent, "first");
    assert.equal(ulEl.children[1].textContent, "second");
  });

  it("diffs attributes/style on a rerun: a style that's no longer set is cleared, not just left stale", function () {
    const page = new Page();
    const context = new RenderContext(new DOMTarget(container));
    page.renderOnto(context);

    const pEl = container.children[0].children[1];
    assert.equal(pEl.style.backgroundColor, "");

    page.highlighted = true;
    assert.equal(pEl.style.backgroundColor, "yellow");

    page.highlighted = false;
    assert.equal(pEl.style.backgroundColor, "", "a style property removed on rerun must be cleared from the real element, not left over from before");
  });

  it("a rerun that changes an unrelated leaf's own text does not recreate the whole tree's real elements", function () {
    const page = new Page();
    const context = new RenderContext(new DOMTarget(container));
    page.renderOnto(context);

    const rootDivBefore = container.children[0];
    const ulElBefore = rootDivBefore.children[2];

    page.heading = "Hello again"; // triggers a rerun on its own - an observable write, same as any other

    assert.equal(container.children[0], rootDivBefore, "the root div's own element identity must survive a rerun");
    assert.equal(container.children[0].children[2], ulElBefore, "an unrelated sibling's element must survive too");
    assert.equal(container.children[0].children[0].textContent, "Hello again");
  });
});

import { JSDOM } from "jsdom";
import assert from "assert";
import { Component, RenderContext, observable } from "@liquefy/cascade.component";
import { DOMElementTarget } from "../DOMElementTarget.js";
import { contextContainer } from "../DOMContextContainer.js";
import { div } from "../HTMLTags.js";
import { text } from "../DOMTextComponent.js";

// contextContainer(): an element of its own, handing its child a render
// context rooted at it - and, with scrollToTopOnNewChild, starting each new
// child from its top.
describe("contextContainer", function () {
  let root;

  beforeEach(function () {
    const dom = new JSDOM("<!DOCTYPE html><body></body>");
    global.document = dom.window.document;
    root = document.createElement("div");
    document.body.appendChild(root);
  });

  class Page extends Component {
    setProperties({ title }) {
      this.title = title;
    }
    build() {
      return div({ key: "page" }, text({ key: "title", text: this.title }));
    }
  }

  // An app showing one of two pages in a scrolling work area.
  function setup(scrollToTopOnNewChild) {
    const pages = { first: new Page({ title: "First" }), second: new Page({ title: "Second" }) };
    const shown = observable({ page: "first", version: 0 });
    class App extends Component {
      build() {
        shown.version; // rebuilt without changing its page, too
        return contextContainer({ key: "workArea", child: pages[shown.page], scrollToTopOnNewChild });
      }
    }
    new App().renderOnto(new RenderContext(DOMElementTarget.forElement(root), {}));
    return { shown, workArea: root.firstChild };
  }

  it("scrollToTopOnNewChild: a different child starts from the top - the same one keeps its place", function () {
    const { shown, workArea } = setup(true);
    assert.equal(workArea.textContent, "First");
    workArea.scrollTop = 300;
    shown.version++;
    assert.equal(workArea.scrollTop, 300, "the same page, built again: where it was");
    shown.page = "second";
    assert.equal(workArea.textContent, "Second");
    assert.equal(workArea.scrollTop, 0, "another page: from its top");
  });

  it("without it, the scroll position is left alone", function () {
    const { shown, workArea } = setup(false);
    workArea.scrollTop = 300;
    shown.page = "second";
    assert.equal(workArea.textContent, "Second");
    assert.equal(workArea.scrollTop, 300);
  });
});

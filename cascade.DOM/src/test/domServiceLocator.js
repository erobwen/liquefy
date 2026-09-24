import { JSDOM } from "jsdom";
import assert from "assert";
import {
  Component, RenderContext, CompoundServiceLocator, ObservableCompoundServiceLocator, serviceProvider, observable,
} from "@liquefy/cascade.component";
import { DOMElementTarget } from "../DOMElementTarget.js";
import { DOMServiceLocator, DOMDebugServiceLocator } from "../DOMServiceLocator.js";
import { div, span, button, h1, h2, element } from "../HTMLTags.js";
import { text } from "../DOMTextComponent.js";

// The service locator travels in the render context (RenderContext.derive()
// forwards it to every nested context), and HTMLTags asks it for
// `{ type: "htmlElement", name, properties }` from whichever component's
// build() is running.
describe("DOM service locators (reached through the render context)", function () {
  let container;
  let warnings;
  let originalWarn;

  beforeEach(function () {
    const dom = new JSDOM("<!DOCTYPE html><body></body>");
    global.document = dom.window.document;
    container = document.createElement("div");
    warnings = [];
    originalWarn = console.warn;
    console.warn = (message) => warnings.push(message);
  });

  afterEach(function () {
    console.warn = originalWarn;
  });

  class RecordingDOMServiceLocator extends DOMServiceLocator {
    constructor() {
      super();
      this.asked = [];
    }
    locate(query) {
      this.asked.push(query.type + ":" + query.name);
      return super.locate(query);
    }
  }

  // Answers only `button` elements - a stand-in for a theme restyling one
  // HTML element across the whole app.
  class RedButtons {
    locate(query) {
      if (query.type !== "htmlElement" || query.name !== "button") return undefined;
      const { style, ...rest } = query.properties;
      return new DOMServiceLocator().locate({ ...query, properties: { ...rest, style: { ...style, color: "red" } } });
    }
  }

  const contextWith = (serviceLocator, target) =>
    new RenderContext(target || new DOMElementTarget(container), { serviceLocator });

  it("every tag built anywhere in the tree - nested components included - goes through the render context's own locator", function () {
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

    const locator = new RecordingDOMServiceLocator();
    new Outer().renderOnto(contextWith(locator));

    assert.deepEqual(locator.asked, ["htmlElement:div", "htmlElement:span"]);
    assert.equal(container.querySelector("span").textContent, "inner");
  });

  it("a context with no locator falls back to the DOM default", function () {
    class Plain extends Component {
      build() {
        return div({ key: "plain" }, text("works"));
      }
    }
    new Plain().renderOnto(new RenderContext(new DOMElementTarget(container)));
    assert.equal(container.textContent, "works");
    assert.deepEqual(warnings, []);
  });

  it("locators earlier in a compound answer first - a theme can restyle an HTML element everywhere", function () {
    class Buttons extends Component {
      build() {
        return div({ key: "row" }, button({ key: "save" }, text("Save")), span({ key: "note" }, text("note")));
      }
    }
    const locator = new CompoundServiceLocator(new RedButtons(), new DOMServiceLocator());
    new Buttons().renderOnto(contextWith(locator));

    assert.equal(container.querySelector("button").style.color, "red");
    assert.equal(container.querySelector("span").style.color, "");
  });

  it("nothing provides a query: the debug locator renders a marked placeholder and warns once", function () {
    class Unknown extends Component {
      build() {
        return div({ key: "row" }, element("x-missing", { key: "a" }), element("x-missing", { key: "b" }));
      }
    }
    const nothingButDebug = new CompoundServiceLocator(
      { locate: (query) => query.name === "div" ? new DOMServiceLocator().locate(query) : undefined },
      new DOMDebugServiceLocator(),
    );
    new Unknown().renderOnto(contextWith(nothingButDebug));

    assert.equal(container.querySelectorAll("[title='Unresolved service: htmlElement x-missing']").length, 2);
    assert.ok(container.textContent.includes("[htmlElement x-missing]"));
    assert.equal(warnings.length, 1, "warned once, not per placeholder");
  });

  it("an observable compound swaps services at runtime - rebuilding what used them", function () {
    class Buttons extends Component {
      build() {
        this.unobservable.buildCount = (this.unobservable.buildCount || 0) + 1;
        return div({ key: "row" }, button({ key: "save" }, text("Save")));
      }
    }
    const locator = new ObservableCompoundServiceLocator(new DOMServiceLocator());
    const buttons = new Buttons();
    buttons.renderOnto(contextWith(locator));
    assert.equal(container.querySelector("button").style.color, "");

    locator.locators.unshift(new RedButtons());
    assert.equal(buttons.unobservable.buildCount, 2);
    assert.equal(container.querySelector("button").style.color, "red");
    assert.equal(container.querySelectorAll("button").length, 1);

    locator.locators.shift();
    assert.equal(container.querySelector("button").style.color, "");
  });

  it("a plain compound records no dependency on its locators", function () {
    class Buttons extends Component {
      build() {
        this.unobservable.buildCount = (this.unobservable.buildCount || 0) + 1;
        return button({ key: "save" }, text("Save"));
      }
    }
    const locator = new CompoundServiceLocator(new DOMServiceLocator());
    const buttons = new Buttons();
    buttons.renderOnto(contextWith(locator));

    locator.locators.unshift(new RedButtons()); // not observable: nothing reacts
    assert.equal(buttons.unobservable.buildCount, 1);
    assert.equal(container.querySelector("button").style.color, "");
  });

  it("serviceProvider() gives a subtree its own services, in front of the surrounding ones", function () {
    class Section extends Component {
      build() {
        return div({ key: "section" }, button({ key: "b" }, text(this.label)));
      }
    }
    class App extends Component {
      build() {
        return div(
          { key: "app" },
          new Section({ key: "plain", label: "plain" }),
          serviceProvider({ key: "themed", serviceLocator: new RedButtons(), child: new Section({ key: "red", label: "red" }) }),
        );
      }
    }
    const root = contextWith(new DOMServiceLocator());
    root.usableWidth = 300;
    new App().renderOnto(root);

    const [plain, red] = container.querySelectorAll("button");
    assert.equal(plain.textContent, "plain");
    assert.equal(plain.style.color, "");
    assert.equal(red.textContent, "red");
    assert.equal(red.style.color, "red");
    // Same target, no element of its own: both sections are siblings.
    assert.equal(plain.parentNode.parentNode, red.parentNode.parentNode);
  });

  it("a reconciled element whose tag changes gets a new element in the same place, keeping its children", function () {
    const model = observable({ big: true, title: "Title" });
    class Heading extends Component {
      build() {
        const tag = model.big ? h1 : h2;
        return div({ key: "page" }, span({ key: "before" }), tag({ key: "title" }, text({ key: "titleText", text: model.title })), span({ key: "after" }));
      }
    }
    new Heading().renderOnto(new RenderContext(new DOMElementTarget(container)));
    const page = container.firstChild;
    const oldTitle = page.children[1];
    const textNode = oldTitle.firstChild;
    const id = oldTitle.id;
    assert.equal(oldTitle.tagName, "H1");

    model.big = false;
    const newTitle = page.children[1];
    assert.equal(newTitle.tagName, "H2");
    assert.notEqual(newTitle, oldTitle);
    assert.equal(newTitle.firstChild, textNode, "the same Text node, moved over");
    assert.equal(newTitle.id, id);
    assert.equal(page.children.length, 3);
    assert.deepEqual(Array.from(page.children).map((el) => el.tagName), ["SPAN", "H2", "SPAN"]);

    // A later rerun that doesn't change the tag again must keep rendering
    // the children into the new element, not the old, detached one.
    model.title = "Renamed";
    assert.equal(page.children[1], newTitle);
    assert.equal(newTitle.textContent, "Renamed");
    assert.equal(newTitle.firstChild, textNode);

    model.big = true;
    assert.deepEqual(Array.from(page.children).map((el) => el.tagName), ["SPAN", "H1", "SPAN"]);
    assert.equal(page.children[1].textContent, "Renamed");
  });
});

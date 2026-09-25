import { JSDOM } from "jsdom";
import assert from "assert";
import { RenderContext, Component, ObservableCompoundServiceLocator } from "@liquefy/cascade.component";
import { DOMElementTarget, DOMServiceLocator, div, text, element, flipAnimationContainer } from "@liquefy/cascade.dom";
import { portal, portalContents, button, basicTheme } from "../index.js";

// portal()/portalContents(): a page putting its own buttons into the app's
// top bar, rendered before it - the shape the demo uses them in. Every leaf
// string goes through text(), away from the implicit-key convention.
describe("portals", function () {
  let container;

  beforeEach(function () {
    const dom = new JSDOM("<!DOCTYPE html><body></body>");
    global.document = dom.window.document;
    container = document.createElement("div");
  });

  // Which page is shown, a top bar with the portal first, then the page.
  // The portal is the app's own (created by it, provided for inherit()).
  class App extends Component {
    setProperties({ pages }) {
      this.pages = pages;
    }
    initializeState() {
      return { chosen: 0 };
    }
    initialUnobservables() {
      return { topBar: portal({ key: "topBarPortal" }, text({ key: "empty", text: "(nothing)" })) };
    }
    get topBarPortal() {
      return this.unobservable.topBar;
    }
    build() {
      return div(
        { key: "app" },
        div({ key: "topBar" }, this.unobservable.topBar),
        div({ key: "workArea" }, this.pages[this.chosen]),
      );
    }
  }

  class Page extends Component {
    setProperties({ name }) {
      this.name = name;
    }
    initializeState() {
      return { label: this.name + " action", clicks: 0 };
    }
    build() {
      return div(
        { key: "page" },
        text({ key: "content", text: this.name + " content" }),
        portalContents(
          { key: "actions", portal: this.inherit("topBarPortal") },
          new Counter({ key: "counter", label: this.label }),
        ),
      );
    }
  }

  class Counter extends Component {
    setProperties({ label }) {
      this.label = label;
    }
    initializeState() {
      return { count: 0 };
    }
    build() {
      return text({ key: "counterText", text: this.label + " " + this.count });
    }
  }

  const topBar = () => container.querySelector("[id*='(topBar)']").textContent;
  const workArea = () => container.querySelector("[id*='(workArea)']").textContent;
  const setup = () => {
    const pages = [new Page({ key: "first", name: "first" }), new Page({ key: "second", name: "second" })];
    const app = new App({ pages });
    app.renderOnto(new RenderContext(new DOMElementTarget(container)));
    return { app, pages };
  };

  it("shows the contents in the portal - rendered before them - and nothing where they stand", function () {
    setup();
    assert.equal(topBar(), "first action 0");
    assert.equal(workArea(), "first content");
  });

  it("switching pages swaps the contents; each page's own come back with their state", function () {
    const { app, pages } = setup();
    const counterOf = (page) => page.newBuild.children[1].portalChildren[0];
    counterOf(pages[0]).count = 5;
    assert.equal(topBar(), "first action 5");

    app.chosen = 1;
    assert.equal(workArea(), "second content");
    assert.equal(topBar(), "second action 0");

    app.chosen = 0;
    assert.equal(topBar(), "first action 5", "the first page's counter, still counting");
  });

  it("follows its contents as they change", function () {
    const { pages } = setup();
    pages[0].label = "renamed";
    assert.equal(topBar(), "renamed 0");
  });

  it("taken back when no longer rendered, leaving the portal's own default", function () {
    const { app, pages } = setup();
    app.pages = [pages[0], div({ key: "noActions" }, text({ key: "plain", text: "plain page" }))];
    app.chosen = 1;
    assert.equal(workArea(), "plain page");
    assert.equal(topBar(), "(nothing)");
  });

  it("two contents rendered at once: the last one rendered wins, and neither keeps rerunning the other", function () {
    class Both extends Component {
      initialUnobservables() {
        return { shared: portal({ key: "shared" }) };
      }
      build() {
        const target = this.unobservable.shared;
        return div(
          { key: "both" },
          this.unobservable.shared,
          portalContents({ key: "a", portal: target }, text({ key: "aText", text: "A" })),
          portalContents({ key: "b", portal: target }, text({ key: "bText", text: "B" })),
        );
      }
    }
    new Both().renderOnto(new RenderContext(new DOMElementTarget(container)));
    assert.equal(container.textContent, "B");
  });

  it("contents with themed widgets in them survive a theme switch - they're rebuilt with their properties", function () {
    // A theme switch rebuilds everything that asked for a widget: the page
    // (which constructs the contents) and the contents themselves - which
    // are rendered in the portal, before the page.
    const fancyTheme = {
      locate(query) {
        if (query.type !== "widget" || query.name !== "button") return undefined;
        const { onClick, children, ...rest } = query.properties;
        return element("fancy-button", { ...rest, ...(onClick ? { onclick: onClick } : {}), children });
      },
    };
    class Labelled extends Component {
      setProperties({ labels }) {
        this.labels = labels;
      }
      build() {
        return button({ key: "button" }, this.labels.map((label) => text({ key: label, text: label })));
      }
    }
    class ThemedPage extends Component {
      build() {
        return div(
          { key: "page" },
          button({ key: "pageButton" }, text({ key: "pageButtonText", text: "page" })),
          portalContents({ key: "actions", portal: this.inherit("topBarPortal") }, new Labelled({ key: "labelled", labels: ["a", "b"] })),
        );
      }
    }
    const services = new ObservableCompoundServiceLocator(new DOMServiceLocator(), basicTheme);
    const app = new App({ pages: [new ThemedPage({ key: "themed" })] });
    app.renderOnto(new RenderContext(new DOMElementTarget(container), { serviceLocator: services }));
    assert.equal(topBar(), "ab");

    services.locators.splice(1, 1, fancyTheme);
    assert.equal(topBar(), "ab");
    assert.ok(container.querySelector("[id*='(topBar)'] fancy-button"), "rebuilt with the new theme");
  });

  it("inside a FlipAnimationContainer: contents placed like anything else - no box of their own - and an item moved into the portal is the same element", function () {
    // A store: the items not chosen in the middle, the chosen ones in the
    // cart - a portal in a bar the list knows nothing else about.
    class Bar extends Component {
      initialUnobservables() {
        return { cart: portal({ key: "cart" }) };
      }
      build() {
        return div({ key: "bar" }, this.unobservable.cart);
      }
    }
    class Store extends Component {
      initializeState() {
        return { chosen: [] };
      }
      initialUnobservables() {
        return { bar: new Bar({ key: "bar" }) };
      }
      get cart() {
        return this.unobservable.bar.unobservable.cart;
      }
      build() {
        const item = (name) => div({ key: name }, text({ key: name + "Text", text: name }));
        const all = ["apple", "pear", "plum"];
        return flipAnimationContainer(
          { key: "flip" },
          div({ key: "shelf" }, all.filter((name) => !this.chosen.includes(name)).map(item)),
          portalContents({ key: "chosen", portal: this.inherit("cart") }, this.chosen.map(item)),
          this.unobservable.bar,
        );
      }
    }
    const store = new Store();
    store.renderOnto(new RenderContext(new DOMElementTarget(container)));
    const shelf = () => container.querySelector("[id*='(shelf)']");
    const cart = () => container.querySelector("[id*='(cart)']");
    const pear = Array.from(shelf().children).find((each) => each.textContent === "pear");
    assert.equal(container.querySelector("[data-flip-island]"), null, "no island box for the contents");
    assert.equal(cart().textContent, "");

    store.chosen = ["pear"];
    assert.equal(shelf().textContent, "appleplum");
    assert.equal(cart().textContent, "pear");
    assert.equal(cart().firstElementChild, pear, "the same element, moved into the cart");

    store.chosen = [];
    assert.equal(shelf().textContent, "applepearplum");
    assert.equal(cart().textContent, "");
  });

  it("a page that renders itself - owning its contents, created in initialization with the portal's name - swaps in like any other", function () {
    // Created outside any repeater (created in render() instead, its
    // properties would be the render's own writings - gone after its next
    // run, which doesn't construct it again).
    class RenderedPage extends Component {
      initialUnobservables() {
        return { actions: portalContents({ key: "actions", portal: "topBarPortal" }, text({ key: "renderedText", text: "rendered action" })) };
      }
      render(context) {
        this.unobservable.actions.renderOnto(context);
      }
    }
    const pages = [new Page({ key: "first", name: "first" }), new RenderedPage({ key: "rendered" })];
    const app = new App({ pages });
    app.renderOnto(new RenderContext(new DOMElementTarget(container)));
    assert.equal(topBar(), "first action 0");

    app.chosen = 1;
    assert.equal(topBar(), "rendered action");
    app.chosen = 0;
    assert.equal(topBar(), "first action 0");
    app.chosen = 1;
    assert.equal(topBar(), "rendered action");
  });
});

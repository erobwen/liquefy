import { JSDOM } from "jsdom";
import assert from "assert";
import { RenderContext, Component, ObservableCompoundServiceLocator } from "@liquefy/cascade.component";
import { DOMElementTarget, DOMServiceLocator, DOMDebugServiceLocator, element, div, text } from "@liquefy/cascade.dom";
import { button, basicTheme, row, column } from "../index.js";

// Themed widgets: `button(...)` asks the render context's service locator
// for `{ type: "widget", name: "button", properties }` - whichever theme is
// in there answers.
describe("themed widgets", function () {
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

  // A second theme, built on a custom element - the shape of the Material
  // theme (mdui-button), without needing mdui itself in node.
  const fancyTheme = {
    locate(query) {
      if (query.type !== "widget" || query.name !== "button") return undefined;
      const { onClick, children, ...rest } = query.properties;
      return element("fancy-button", { ...rest, ...(onClick ? { onclick: onClick } : {}), children });
    },
  };

  class Counter extends Component {
    initializeState() {
      return { count: 0 };
    }
    build() {
      return div(
        { key: "counter" },
        text({ key: "label", text: "Count: " + this.count }),
        button({ key: "increment" }, text("Increment"), () => { this.count = this.count + 1; }),
      );
    }
  }

  const render = (component, serviceLocator) =>
    component.renderOnto(new RenderContext(new DOMElementTarget(container), { serviceLocator }));

  it("the basic theme provides a plain, styled HTML button; a loose function is its onClick", function () {
    const counter = new Counter();
    render(counter, new ObservableCompoundServiceLocator(new DOMServiceLocator(), basicTheme));

    const htmlButton = container.querySelector("button");
    assert.ok(htmlButton);
    assert.equal(htmlButton.textContent, "Increment");
    assert.ok(htmlButton.classList.contains("cb-button"), "styled by the theme's stylesheet");
    assert.ok(document.querySelector("style[data-cascade-theme=basic]"), "which is in the document");

    htmlButton.click();
    htmlButton.click();
    assert.equal(counter.count, 2);
    assert.ok(container.textContent.includes("Count: 2"));
  });

  it("swapping the theme at runtime replaces the widget - same place, same app state, still working", function () {
    const services = new ObservableCompoundServiceLocator(new DOMServiceLocator(), basicTheme);
    const counter = new Counter();
    render(counter, services);
    container.querySelector("button").click();

    services.locators[1] = fancyTheme;
    assert.equal(container.querySelector("button"), null);
    const fancy = container.querySelector("fancy-button");
    assert.ok(fancy);
    assert.equal(fancy.textContent, "Increment");
    assert.equal(fancy.previousSibling.textContent, "Count: 1", "in the same place, after the label");
    assert.equal(counter.count, 1, "the app's own state is untouched by the swap");

    fancy.click();
    assert.equal(counter.count, 2);

    services.locators[1] = basicTheme;
    assert.equal(container.querySelector("fancy-button"), null);
    container.querySelector("button").click();
    assert.equal(counter.count, 3);
  });

  it("switching the theme from a button inside the app, reached through inherit(), rebuilds cleanly", function () {
    // The demo's own shape (ThemesPage/ThemedServiceLocator): a switch found
    // through inherit() - whose walk up the component hierarchy reads
    // renderParent/equivalentCreator along the way, written by both render
    // and build pipelines - clicked from inside the app, writing the theme's
    // name and then the theme itself. Found in the browser: a build
    // invalidated by the switch had its writings (the properties of
    // everything it built) retracted, and an element it had built was
    // rendered before the build reran, reading its own tagName back as
    // undefined. A component's build repeater is now only ever run when its
    // render repeater pulls it (see Component.js / cascade.reactive's
    // scheduleThroughPuller()), so it's always rebuilt first.
    class NamedThemeServiceLocator extends ObservableCompoundServiceLocator {
      constructor() {
        super(new DOMServiceLocator(), basicTheme);
        this.themes = { basic: basicTheme, fancy: fancyTheme };
        this.themeName = "basic";
      }
      select(name) {
        this.themeName = name;
        this.locators[1] = this.themes[name];
      }
    }
    class Switch extends Component {
      build() {
        const services = this.inherit("services");
        const next = services.themeName === "basic" ? "fancy" : "basic";
        return row(
          { key: "switch" },
          text({ key: "current", text: "Theme: " + services.themeName }),
          button({ key: "toggle" }, text({ key: "toggleText", text: "Switch" }), () => services.select(next)),
        );
      }
    }
    class Page extends Component {
      build() {
        return column(
          { key: "page" },
          new Switch({ key: "themeSwitch" }),
          button({ key: "other" }, text({ key: "otherText", text: "Other" })),
        );
      }
    }
    class Root extends Component {
      setProperties({ services }) {
        this.services = services; // provided to everything below (provide() is the component itself)
      }
      build() {
        return div({ key: "root" }, new Page({ key: "page" }));
      }
    }
    const services = new NamedThemeServiceLocator();
    render(new Root({ services }), services);

    container.querySelector("button").click();
    assert.ok(container.textContent.includes("Theme: fancy"), container.textContent);
    assert.equal(container.querySelectorAll("fancy-button").length, 2);

    container.querySelector("fancy-button").click();
    assert.ok(container.textContent.includes("Theme: basic"), container.textContent);
    assert.equal(container.querySelectorAll("button").length, 2);
  });

  it("no theme providing a widget degrades to a visible placeholder, with a warning", function () {
    render(new Counter(), new ObservableCompoundServiceLocator(new DOMServiceLocator(), new DOMDebugServiceLocator()));
    const placeholder = container.querySelector("[title='Unresolved service: widget button']");
    assert.ok(placeholder);
    assert.ok(placeholder.textContent.includes("Increment"), "keeps the widget's own children");
    assert.equal(warnings.length, 1);
  });
});

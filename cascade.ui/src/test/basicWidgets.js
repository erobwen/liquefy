import { JSDOM } from "jsdom";
import assert from "assert";
import { RenderContext, Component, CompoundServiceLocator } from "@liquefy/cascade.component";
import { DOMElementTarget, DOMServiceLocator, element, div, text } from "@liquefy/cascade.dom";
import { basicTheme, icon, iconButton, card, alert, listItem, dialog, popover, overlayFrame, alertSeverities } from "../index.js";

// The basic theme's widgets beyond button (see widgets.js for their
// contracts), and popover(). Every leaf string goes through text(), away
// from the implicit-key convention (a lone lowercase string is a key).
describe("basic theme widgets", function () {
  let container;

  beforeEach(function () {
    const dom = new JSDOM("<!DOCTYPE html><body></body>");
    global.document = dom.window.document;
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  const services = (...themes) => new CompoundServiceLocator(new DOMServiceLocator(), ...themes);
  const render = (component, serviceLocator = services(basicTheme)) => {
    component.renderOnto(new RenderContext(new DOMElementTarget(container), { serviceLocator }));
    return component;
  };
  // A page building whatever `build` returns, with state it can change.
  const page = (build, state = {}) => {
    class Page extends Component {
      initializeState() {
        return state;
      }
      build() {
        return build(this);
      }
    }
    return new Page();
  };

  it("icon draws a Material Symbols ligature; iconButton is a button showing one, with its onClick", function () {
    let clicks = 0;
    render(page(() => div({ key: "page" },
      icon({ key: "info", name: "info", style: { fontSize: "40px" } }),
      iconButton({ key: "close", icon: "close", title: "Close" }, () => { clicks++; }),
    )));
    const [info, close] = container.querySelectorAll(".material-symbols-outlined");
    assert.equal(info.textContent, "info");
    assert.equal(info.style.fontSize, "40px");
    assert.equal(close.textContent, "close");
    const button = container.querySelector("button");
    assert.equal(button.title, "Close");
    assert.ok(button.contains(close));
    button.click();
    assert.equal(clicks, 1);
  });

  it("many icons built by one build keep their names across rebuilds - no key collision between them", function () {
    const shown = render(page((self) => div(
      { key: "page" },
      ["home", "search", "settings"].map((name) => icon({ key: name, name, style: { fontSize: self.version > 0 ? "30px" : "24px" } })),
    ), { version: 0 }));
    const names = () => Array.from(container.querySelectorAll(".material-symbols-outlined")).map((each) => each.textContent);
    assert.deepEqual(names(), ["home", "search", "settings"]);
    shown.version = 1;
    assert.deepEqual(names(), ["home", "search", "settings"], "after a rebuild");
    shown.version = 2;
    assert.deepEqual(names(), ["home", "search", "settings"]);
    assert.equal(container.querySelector(".material-symbols-outlined").style.lineHeight, "1", "unitless");
  });

  it("card: a surface per variant, its style merged over the variant's", function () {
    render(page(() => div({ key: "page" },
      card({ key: "elevated" }, text("elevated")),
      card({ key: "outlined", variant: "outlined", style: { padding: "2px" } }, text("outlined")),
    )));
    const [elevated, outlined] = container.firstChild.children;
    assert.notEqual(elevated.style.boxShadow, "");
    assert.equal(elevated.textContent, "elevated");
    assert.ok(outlined.style.border.includes("solid"));
    assert.equal(outlined.style.padding, "2px");
  });

  it("alert: its severity's icon and colors around the message - and two on one page don't collide", function () {
    const shown = render(page((self) => div({ key: "page" },
      alert({ key: "first", severity: self.firstSeverity }, text("Careful")),
      alert({ key: "second" }, text("Just so you know")),
    ), { firstSeverity: "success" }));
    shown.firstSeverity = "warning"; // rebuilt: every key inside is matched against the last build
    const [first, second] = container.firstChild.children;
    assert.equal(first.querySelector(".material-symbols-outlined").textContent, alertSeverities.warning.icon);
    assert.ok(first.textContent.endsWith("Careful"));
    assert.equal(second.querySelector(".material-symbols-outlined").textContent, alertSeverities.info.icon, "info by default");
    assert.ok(second.textContent.endsWith("Just so you know"));
    assert.notEqual(first.style.background, second.style.background);
  });

  it("widgets inside widgets come from whatever theme is in the context", function () {
    const svgIcons = {
      locate(query) {
        if (query.type !== "widget" || query.name !== "icon") return undefined;
        return element("svg-icon", { key: query.properties.key, title: query.properties.name });
      },
    };
    render(page(() => alert({ key: "alert", severity: "error" }, text("Broken"))), services(svgIcons, basicTheme));
    assert.equal(container.querySelector("svg-icon").title, "error");
  });

  it("listItem: marked while active, clickable", function () {
    const list = render(page((self) => div({ key: "list" },
      ["one", "two"].map((name) => listItem({ key: name, active: self.chosen === name }, text({ key: name + "Text", text: name }), () => { self.chosen = name; })),
    ), { chosen: "one" }));
    const items = () => Array.from(container.firstChild.children);
    assert.equal(items()[0].style.fontWeight, "bold");
    assert.equal(items()[1].style.fontWeight, "normal");
    items()[1].click();
    assert.equal(list.chosen, "two");
    assert.equal(items()[1].style.fontWeight, "bold");
    assert.equal(items()[0].style.fontWeight, "normal");
  });

  it("dialog: title bar with a close button, and the body - its elements kept across rebuilds", function () {
    const shown = render(page((self) => dialog({ key: "dialog", title: "src/pages/file.js", close: () => { self.open = false; } },
      text({ key: "body", text: "Count " + self.count }),
    ), { open: true, count: 0 }));
    const box = container.firstChild;
    assert.ok(box.textContent.startsWith("src/pages/file.js"), "a lowercase title is just text");
    assert.ok(box.textContent.endsWith("Count 0"));
    const closeButton = box.querySelector("button");

    shown.count = 1;
    assert.equal(container.firstChild, box, "same element");
    assert.equal(box.querySelector("button"), closeButton, "same close button");
    assert.ok(box.textContent.endsWith("Count 1"));

    closeButton.click();
    assert.equal(shown.open, false);
  });

  it("popover: shown over everything by the overlay frame, beside its anchor, closed by a click outside it", function () {
    const view = document.defaultView;
    view.innerWidth = 1000;
    view.innerHeight = 800;
    const app = render(page((self) => overlayFrame(
      { key: "frame" },
      popover({ key: "popover", anchor: self.anchor, showing: self.open, close: () => { self.open = false; } },
        card({ key: "info" }, text({ key: "infoText", text: "More about this" })),
      ),
    ), { open: false, anchor: null }));
    const content = () => Array.from(container.querySelectorAll("div")).find((each) => each.style.position === "fixed");
    assert.equal(content(), undefined, "not shown yet");

    app.anchor = { left: 100, top: 50, right: 140, bottom: 90 };
    app.open = true;
    assert.equal(content().textContent, "More about this");
    assert.equal(content().style.top, 90 + 6 + "px", "below an anchor in the upper half");
    assert.equal(content().style.left, "100px", "from its left edge, in the left half");

    app.open = false;
    app.anchor = { left: 900, top: 700, right: 940, bottom: 740 };
    app.open = true;
    assert.equal(content().style.bottom, 800 - 700 + 6 + "px", "above an anchor in the lower half");
    assert.equal(content().style.right, 1000 - 940 + "px", "to its right edge, in the right half");

    const outside = Array.from(container.querySelectorAll("div")).find((each) => each.style.pointerEvents === "auto" && each !== content());
    outside.dispatchEvent(new view.MouseEvent("mousedown"));
    assert.equal(app.open, false);
    assert.equal(content(), undefined);
  });
});

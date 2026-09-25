import { JSDOM } from "jsdom";
import assert from "assert";
import { RenderContext, Component, CompoundServiceLocator } from "@liquefy/cascade.component";
import { DOMElementTarget, DOMServiceLocator, div, text } from "@liquefy/cascade.dom";
import { button, icon, iconButton, listItem, alert, dialog, card } from "@liquefy/cascade.ui";
import { materialTheme } from "../MaterialTheme.js";

// The Material theme answers the same widget queries as cascade.ui's basic
// theme, with mdui web components. (Only the element structure is
// checkable here - the components themselves only register in a browser,
// via this package's index.js.)
describe("Material theme", function () {
  let container;

  beforeEach(function () {
    const dom = new JSDOM("<!DOCTYPE html><body></body>");
    global.document = dom.window.document;
    container = document.createElement("div");
  });

  it("provides button as an mdui-button, with its onClick and children", function () {
    let clicks = 0;
    class Page extends Component {
      build() {
        return div({ key: "page" }, button({ key: "save", variant: "tonal" }, text("Save"), () => { clicks++; }));
      }
    }
    new Page().renderOnto(new RenderContext(new DOMElementTarget(container), {
      serviceLocator: new CompoundServiceLocator(new DOMServiceLocator(), materialTheme),
    }));

    const mduiButton = container.querySelector("mdui-button");
    assert.ok(mduiButton);
    assert.equal(mduiButton.textContent, "Save");
    assert.equal(mduiButton.variant, "tonal");
    mduiButton.click();
    assert.equal(clicks, 1);
  });

  const render = (build) => {
    class Page extends Component {
      build() {
        return build();
      }
    }
    new Page().renderOnto(new RenderContext(new DOMElementTarget(container), {
      serviceLocator: new CompoundServiceLocator(new DOMServiceLocator(), materialTheme),
    }));
  };

  it("provides icon, iconButton and listItem as their mdui components", function () {
    let clicks = 0;
    render(() => div({ key: "page" },
      icon({ key: "info", name: "info" }),
      iconButton({ key: "close", icon: "close" }, () => { clicks++; }),
      listItem({ key: "item", active: true }, text("Item")),
    ));
    assert.equal(container.querySelector("mdui-icon").name, "info");
    const closeButton = container.querySelector("mdui-button-icon");
    assert.equal(closeButton.icon, "close");
    closeButton.click();
    assert.equal(clicks, 1);
    const item = container.querySelector("mdui-list-item");
    assert.equal(item.active, true);
    assert.equal(item.textContent, "Item");
  });

  it("alert, card and dialog are built from mdui's design tokens, with mdui icons and icon buttons inside", function () {
    render(() => div({ key: "page" },
      alert({ key: "alert", severity: "warning" }, text("Careful")),
      card({ key: "card" }, text("On a card")),
      dialog({ key: "dialog", title: "Title", close: () => {} }, text("Body")),
    ));
    const [alertBox, cardBox, dialogBox] = container.firstChild.children;
    assert.equal(alertBox.querySelector("mdui-icon").name, "warning");
    assert.ok(cardBox.style.boxShadow.includes("--mdui-elevation"));
    assert.ok(dialogBox.style.background.includes("--mdui-color"));
    assert.equal(dialogBox.querySelector("mdui-button-icon").icon, "close");
    assert.ok(dialogBox.textContent.includes("Title") && dialogBox.textContent.includes("Body"));
  });

  it("answers widget queries only", function () {
    assert.equal(materialTheme.locate({ type: "htmlElement", name: "button", properties: {} }), undefined);
    assert.equal(materialTheme.locate({ type: "widget", name: "no-such-widget", properties: {} }), undefined);
  });
});

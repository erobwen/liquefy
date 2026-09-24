import { JSDOM } from "jsdom";
import assert from "assert";
import { RenderContext, Component, CompoundServiceLocator } from "@liquefy/cascade.component";
import { DOMElementTarget, DOMServiceLocator, div, text } from "@liquefy/cascade.dom";
import { button } from "@liquefy/cascade.ui";
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

  it("answers widget queries only", function () {
    assert.equal(materialTheme.locate({ type: "htmlElement", name: "button", properties: {} }), undefined);
    assert.equal(materialTheme.locate({ type: "widget", name: "no-such-widget", properties: {} }), undefined);
  });
});

import { JSDOM } from "jsdom";
import assert from "assert";
import { Component } from "@liquefy/cascade.component";
import { DOMElementTarget } from "../DOMElementTarget.js";
import { div, label, input } from "../HTMLTags.js";
import { defaultToPx } from "../applyStyle.js";

// How what an element is given reaches the real element: its style (a bare
// number is a length - unless the property takes a plain number), and its
// attributes (as the element's own property where it has one, as an
// attribute otherwise - and gone again when no longer given).
describe("element attributes and style", function () {
  let container;

  beforeEach(function () {
    const dom = new JSDOM("<!DOCTYPE html><body></body>");
    global.document = dom.window.document;
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  // Renders whatever `make(state)` builds, again whenever state changes.
  function render(make, initial) {
    class Holder extends Component {
      initialState() {
        return { values: initial };
      }
      build() {
        return make(this.values);
      }
    }
    const holder = new Holder();
    holder.renderOnto(new DOMElementTarget(container));
    return holder;
  }

  it("a bare number is a length in px - unless the property takes a plain number", function () {
    render(() => div({ key: "d", style: { width: 120, opacity: 0.5, zIndex: 2, flexGrow: 1, fontWeight: 700, lineHeight: 1.5 } }), null);
    const style = container.firstChild.style;
    assert.equal(style.width, "120px");
    assert.equal(style.opacity, "0.5");
    assert.equal(style.zIndex, "2");
    assert.equal(style.flexGrow, "1");
    assert.equal(style.fontWeight, "700");
    assert.equal(style.lineHeight, "1.5");
  });

  it("a custom property's number is left as it is", function () {
    assert.equal(defaultToPx(3, "--columns"), "3");
    assert.equal(defaultToPx(3, "margin"), "3px");
    assert.equal(defaultToPx(3), "3px", "without a property: a length");
  });

  it("class, className, aria-* and data-* reach the element as attributes - and are removed again", function () {
    const holder = render((values) => div({ key: "d", ...values }), { class: "a", "aria-label": "Close", "data-kind": "x" });
    const element = container.firstChild;
    assert.equal(element.getAttribute("class"), "a");
    assert.equal(element.getAttribute("aria-label"), "Close");
    assert.equal(element.getAttribute("data-kind"), "x");

    holder.values = { className: "b" };
    assert.equal(element.getAttribute("class"), "b", "className is the class attribute");
    assert.equal(element.hasAttribute("aria-label"), false, "no longer given: removed");
    assert.equal(element.hasAttribute("data-kind"), false);

    holder.values = {};
    assert.equal(element.hasAttribute("class"), false, "a class no longer given is removed - not left stuck");
  });

  it("htmlFor is the for attribute; a boolean attribute is present when true, absent when false", function () {
    const holder = render((values) => div({ key: "d" }, label({ key: "l", htmlFor: "name" }), div({ key: "x", hidden: values.hidden, tabIndex: 3 })), { hidden: true });
    assert.equal(container.querySelector("label").getAttribute("for"), "name");
    const x = container.firstChild.children[1];
    assert.equal(x.hidden, true);
    assert.equal(x.getAttribute("tabindex"), "3");
    holder.values = { hidden: false };
    assert.equal(x.hidden, false);
  });

  it("an element's own properties stay live properties - and are reset when no longer given", function () {
    let clicks = 0;
    const onClick = () => { clicks++; };
    const holder = render((values) => input({ key: "i", ...values }), { value: "typed", disabled: true, onClick });
    const element = container.firstChild;
    assert.equal(element.value, "typed");
    assert.equal(element.disabled, true);
    element.click();
    assert.equal(clicks, 0, "disabled");

    holder.values = { onClick };
    assert.equal(element.disabled, false, "no longer disabled");
    element.click();
    assert.equal(clicks, 1);

    holder.values = {};
    element.click();
    assert.equal(clicks, 1, "the handler is gone");
  });

  it("a property given as undefined or null is cleared - not set to the text \"undefined\"", function () {
    const holder = render((values) => input({ key: "i", ...values }), { title: "tip", placeholder: "Name", value: "typed" });
    const element = container.firstChild;
    assert.equal(element.title, "tip");

    holder.values = { title: undefined, placeholder: null, value: undefined };
    assert.equal(element.title, "");
    assert.equal(element.hasAttribute("title"), false);
    assert.equal(element.placeholder, "");
    assert.equal(element.value, "");

    holder.values = { title: "again" };
    assert.equal(element.title, "again", "and set again when given again");
  });

  it("a property the element only has a getter for (input's list) is set as an attribute", function () {
    const holder = render((values) => input({ key: "i", ...values }), { list: "profiles" });
    const element = container.firstChild;
    assert.equal(element.getAttribute("list"), "profiles");

    holder.values = {};
    assert.equal(element.hasAttribute("list"), false, "and removed again");
  });
});

import { JSDOM } from "jsdom";
import assert from "assert";
import { RenderContext, Component } from "@liquefy/cascade.component";
import { DOMTarget, text } from "@liquefy/cascade.dom";
import { row, column, center, filler, fitContainerStyle, fillerStyle, zStack } from "../index.js";

describe("Layout (flow.ui/basic/src/Layout.js's own style kit, ported)", function () {
  let container;

  beforeEach(function () {
    const dom = new JSDOM("<!DOCTYPE html><body></body>");
    global.document = dom.window.document;
    container = document.createElement("div");
  });

  it("row()/column()/filler() apply their own default flex style with no style property given", function () {
    class Frame extends Component {
      build() {
        return row({ key: "r" }, column({ key: "c" }, filler({ key: "f" }, text("content"))));
      }
    }
    new Frame().renderOnto(new RenderContext(new DOMTarget(container)));

    const rowEl = container.querySelector("div");
    assert.equal(rowEl.style.display, "flex");
    assert.equal(rowEl.style.flexDirection, "row");
    assert.equal(rowEl.style.justifyContent, "flex-start");

    const columnEl = rowEl.children[0];
    assert.equal(columnEl.style.flexDirection, "column");

    const fillerEl = columnEl.children[0];
    assert.equal(fillerEl.style.flexGrow, "1");
    assert.equal(fillerEl.style.flexShrink, "1");
    // jsdom's CSSOM (like a real browser's) normalizes a bare "0" to "0px"
    // when serializing flex-basis back out - fillerStyle's own "0" is still
    // exactly what was set.
    assert.equal(fillerEl.style.flexBasis, "0px");
    assert.equal(fillerEl.textContent, "content");
  });

  it("a caller-supplied style property always wins over the container's own default (the whole point of every component taking `style`)", function () {
    class Frame extends Component {
      build() {
        return row({ key: "r", style: { justifyContent: "flex-end", background: "red" } });
      }
    }
    new Frame().renderOnto(new RenderContext(new DOMTarget(container)));

    const rowEl = container.querySelector("div");
    // Overridden - caller wins.
    assert.equal(rowEl.style.justifyContent, "flex-end");
    // Untouched default still present alongside the override.
    assert.equal(rowEl.style.display, "flex");
    // Not part of rowStyle at all - purely the caller's own addition.
    assert.equal(rowEl.style.background, "red");
  });

  it("center() centers along the main axis; fitContainerStyle/fillerStyle differ (absolute 100% vs flex share)", function () {
    class Frame extends Component {
      build() {
        return center({ key: "centered", style: { ...fitContainerStyle } });
      }
    }
    new Frame().renderOnto(new RenderContext(new DOMTarget(container)));

    const el = container.querySelector("div");
    assert.equal(el.style.justifyContent, "center");
    // fitContainerStyle's own width/height, spread in via `style`, on top
    // of center()'s own defaults.
    assert.equal(el.style.width, "100%");
    assert.equal(el.style.height, "100%");
    assert.equal(fillerStyle.flexBasis, "0", "fillerStyle stays flex-based, not the same object as fitContainerStyle");
  });

  it("zStack() gives its own div `position: relative` for absolutely-positioned children to stack against", function () {
    class Frame extends Component {
      build() {
        return zStack({ key: "stack" });
      }
    }
    new Frame().renderOnto(new RenderContext(new DOMTarget(container)));

    const el = container.querySelector("div");
    assert.equal(el.style.position, "relative");
  });
});

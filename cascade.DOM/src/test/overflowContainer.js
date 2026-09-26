import { JSDOM } from "jsdom";
import assert from "assert";
import { Component, RenderContext } from "@liquefy/cascade.component";
import { DOMElementTarget } from "../DOMElementTarget.js";
import { OverflowContainer, DOMElementSlot } from "../OverflowContainer.js";
import { div, span } from "../HTMLTags.js";
import { text } from "../DOMTextComponent.js";

// OverflowContainer: its children placed one at a time, in its own row,
// for as long as they fit - the rest in an overflow slot, the ellipsis last
// in the row. jsdom has no layout, so a fake one stands in: the row (the
// container's own element) is as wide as the test says, and every element
// in it as wide as its title says, one after the other with a gap of 2.
describe("OverflowContainer", function () {
  let container;
  let layout;
  let rowElement;

  // The container - its element known to the fake layout as the row.
  class RowContainer extends OverflowContainer {
    renderElement(context, existingElement) {
      rowElement = super.renderElement(context, existingElement);
      return rowElement;
    }
  }

  beforeEach(function () {
    const dom = new JSDOM("<!DOCTYPE html><body></body>");
    global.document = dom.window.document;
    container = document.createElement("div");
    document.body.appendChild(container);
    rowElement = null;
    layout = { rowWidth: 1000, gap: 2 };
    dom.window.Element.prototype.getBoundingClientRect = function () {
      if (this === rowElement) return { left: 0, right: layout.rowWidth, width: layout.rowWidth, top: 0, bottom: 20, height: 20 };
      if (this.parentElement !== rowElement) return { left: 0, right: 0, width: 0, top: 0, bottom: 0, height: 0 };
      let left = 0;
      for (const sibling of rowElement.children) {
        const width = Number(sibling.title) || 0;
        if (sibling === this) return { left, right: left + width, width, top: 0, bottom: 20, height: 20 };
        left += width + layout.gap;
      }
    };
  });

  // A toolbar: tools of the given widths, an ellipsis 30 wide, a slot for
  // what doesn't fit - the count reported, as a toolbar would show it.
  function setup(widths, rowWidth) {
    layout.rowWidth = rowWidth;
    const context = new RenderContext(new DOMElementTarget(container), { width: rowWidth });
    const reported = [];
    class Toolbar extends Component {
      initialUnobservables() {
        return { slot: new DOMElementSlot({ key: "slot" }) };
      }
      build() {
        const tools = widths.map((width, index) =>
          div({ key: "tool" + index, title: String(width) }, span({ key: "label" + index }, text({ key: "text" + index, text: "t" + index }))));
        return new RowContainer({
          key: "row",
          children: tools,
          ellipsis: div({ key: "ellipsis", title: "30" }, text({ key: "dots", text: "..." })),
          overflowSlot: this.unobservable.slot,
          onOverflow: (count) => reported.push(count),
        });
      }
    }
    const toolbar = new Toolbar();
    toolbar.renderOnto(context);
    const names = (element) => Array.from(element.children).map((each) => each.textContent);
    return {
      context, reported,
      inRow: () => names(rowElement),
      inSlot: () => names(toolbar.unobservable.slot.ensureNode()),
    };
  }

  it("with room for all: every child in the row, no ellipsis, nothing overflowing", function () {
    const { inRow, inSlot, reported } = setup([40, 60, 40], 1000);
    assert.deepEqual(inRow(), ["t0", "t1", "t2"]);
    assert.deepEqual(inSlot(), []);
    assert.deepEqual(reported, []);
  });

  it("without: those that fit - leaving room for the ellipsis - then the ellipsis; the rest in the slot, whole", function () {
    // 40 + 2 + 60 + 2 + 30 (ellipsis) = 134 <= 150; with the next 40, 176 > 150.
    const { inRow, inSlot, reported } = setup([40, 60, 40, 50], 150);
    assert.deepEqual(inRow(), ["t0", "t1", "..."]);
    assert.deepEqual(inSlot(), ["t2", "t3"], "with their own content");
    assert.deepEqual(reported, [2]);
  });

  it("the last child needs no room for an ellipsis", function () {
    // 40 + 2 + 60 + 2 + 40 = 144 <= 150: all three fit, no ellipsis needed.
    const { inRow, inSlot } = setup([40, 60, 40], 150);
    assert.deepEqual(inRow(), ["t0", "t1", "t2"]);
    assert.deepEqual(inSlot(), []);
  });

  it("follows its width: narrower, fewer - wider again, all back - the same elements throughout", function () {
    const { context, inRow, inSlot, reported } = setup([40, 60, 40, 50], 1000);
    const first = Array.from(rowElement.children);
    layout.rowWidth = 150;
    context.width = 150;
    assert.deepEqual(inRow(), ["t0", "t1", "..."]);
    assert.deepEqual(inSlot(), ["t2", "t3"]);
    layout.rowWidth = 1000;
    context.width = 1000;
    assert.deepEqual(inRow(), ["t0", "t1", "t2", "t3"]);
    assert.deepEqual(Array.from(rowElement.children), first, "the very same elements");
    assert.deepEqual(reported, [2, 0]);
  });

  it("not even the first fits: only the ellipsis, everything in the slot", function () {
    const { inRow, inSlot, reported } = setup([80, 80], 50);
    assert.deepEqual(inRow(), ["..."]);
    assert.deepEqual(inSlot(), ["t0", "t1"]);
    assert.deepEqual(reported, [2]);
  });
});

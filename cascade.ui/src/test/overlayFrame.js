import { JSDOM } from "jsdom";
import assert from "assert";
import { RenderContext, Component } from "@liquefy/cascade.component";
import { DOMElementTarget, div, text } from "@liquefy/cascade.dom";
import { overlayFrame, overlay } from "../index.js";

// Both tests below use text(...) explicitly for every leaf string
// (rather than a bare loose string), sidestepping the implicit-key
// gotcha documented in cascade.component's own implicitProperties.js -
// not relevant to what's being tested here, so worth routing around
// cleanly rather than working around per string.
describe("OverlayFrame/Overlay (recursive modal frame)", function () {
  let container;

  beforeEach(function () {
    const dom = new JSDOM("<!DOCTYPE html><body></body>");
    global.document = dom.window.document;
    container = document.createElement("div");
  });

  it("shows an overlay's content inside the frame's own modal sub-frame only while showing is true", function () {
    const modal = overlay(div({ key: "content" }, text("hello")));

    class Frame extends Component {
      build() {
        return overlayFrame("root", div({ key: "static" }, text("static")), modal);
      }
    }

    const frame = new Frame();
    frame.renderOnto(new RenderContext(new DOMElementTarget(container)));

    const frameEl = container.children[0];
    assert.equal(frameEl.children.length, 1, "nothing shown yet - just the static content");

    modal.showing = true;

    assert.equal(frameEl.children.length, 2, "a modal sub-frame element should now be present");
    assert.equal(frameEl.children[1].textContent, "hello");

    modal.showing = false;

    assert.equal(frameEl.children.length, 1, "modal sub-frame removed again once closed");
  });

  it("an overlay shown inside another overlay's own content finds the nearest frame, stacking correctly - not the page's root one", function () {
    const innerModal = overlay(div({ key: "innerContent" }, text("inner")));
    // The outer modal's own content includes the inner overlay - so when
    // the inner one is shown, it must find the *outer* modal's own
    // modalSubFrame as its nearest OverlayFrame, not the page's root frame.
    const outerModal = overlay(div({ key: "outerContent" }, text("outer"), innerModal));

    class Frame extends Component {
      build() {
        return overlayFrame("root", div({ key: "static" }, text("static")), outerModal);
      }
    }

    const frame = new Frame();
    frame.renderOnto(new RenderContext(new DOMElementTarget(container)));

    const rootFrameEl = container.children[0];
    assert.equal(rootFrameEl.children.length, 1, "nothing shown yet");

    outerModal.showing = true;

    assert.equal(rootFrameEl.children.length, 2, "outer modal's own sub-frame now present, at the root frame level");
    const outerSubFrameEl = rootFrameEl.children[1];
    assert.ok(outerSubFrameEl.textContent.includes("outer"));
    assert.equal(outerSubFrameEl.children.length, 1, "just the outer modal's own content so far - inner not shown yet");

    innerModal.showing = true;

    // The decisive check: the inner modal's content must appear nested
    // *inside* the outer modal's own sub-frame, not as a third sibling
    // at the root frame level - that's what proves inherit("overlayFrame")
    // found the outer modal's frame, not the page's root one.
    assert.equal(rootFrameEl.children.length, 2, "still just static + outer modal sub-frame at the root - inner did not get appended there");
    assert.equal(outerSubFrameEl.children.length, 2, "outer modal's own sub-frame now also holds the inner modal's own sub-frame");
    assert.ok(outerSubFrameEl.textContent.includes("inner"), "inner modal's content lives inside the outer modal's own sub-frame");

    outerModal.showing = false;

    assert.equal(rootFrameEl.children.length, 1, "closing the outer modal removes its whole sub-frame - inner modal included, recursively");
  });

});

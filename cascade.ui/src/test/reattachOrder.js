import { JSDOM } from "jsdom";
import assert from "assert";
import { RenderContext, Component, CompoundServiceLocator } from "@liquefy/cascade.component";
import { DOMElementTarget, DOMServiceLocator, text } from "@liquefy/cascade.dom";
import { basicTheme, dialog, overlay, overlayFrame, wrapper, centerMiddle } from "../index.js";

// A component shown again - reattached - is rendered right away, at its
// place in the tree, as a first render is: not whenever the scheduler gets
// to it, after its later siblings have already positioned themselves (see
// Component.renderOnto()). Found via the demo's hybrid modal dialog,
// resized slowly past its full-screen threshold: the dialog moves from a
// modal window into a full-screen one (its whole subtree reattached) and
// shows its back button (a composite, in the basic theme) in the same
// step - and on the next resize the title, rerendering on its own, moved
// in front of it.
describe("a component shown again keeps its place", function () {
  it("a dialog going full screen keeps its back arrow first, however slowly the window is resized", function () {
    const dom = new JSDOM("<!DOCTYPE html><body></body>");
    global.document = dom.window.document;
    const container = document.createElement("div");
    class Page extends Component {
      initializeState() {
        return { width: 610 };
      }
      build() {
        const fullScreen = this.width < 600;
        const shown = dialog(
          { key: "dialog", title: "Title", fullScreen, close: () => {}, style: fullScreen ? {} : { width: "360px" } },
          text({ key: "body", text: "body" }),
        );
        const presentation = fullScreen
          ? wrapper({ key: "fullScreenPresentation" }, shown)
          : wrapper({ key: "modalPresentation" }, centerMiddle({ key: "centered" }, shown));
        return overlayFrame(
          { key: "frame" },
          wrapper({ key: "static" }, text({ key: "width", text: "width " + this.width })),
          overlay({ key: "overlay", showing: true }, presentation),
        );
      }
    }
    const page = new Page();
    page.renderOnto(new RenderContext(new DOMElementTarget(container), {
      serviceLocator: new CompoundServiceLocator(new DOMServiceLocator(), basicTheme),
    }));
    const titleBar = () => Array.from(container.querySelector("[id*='(titleBar)']").children).map((each) => each.title || each.textContent).join(",");

    // A pixel at a time, back and forth across the threshold, three times.
    for (let round = 0; round < 3; round++) {
      for (let width = 610; width >= 590; width--) {
        page.width = width;
        assert.equal(titleBar(), width < 600 ? "Back,Title" : "Title,Close", "narrowing, at " + width + ", round " + round);
      }
      for (let width = 590; width <= 610; width++) {
        page.width = width;
        assert.equal(titleBar(), width < 600 ? "Back,Title" : "Title,Close", "widening, at " + width + ", round " + round);
      }
    }
  });
});

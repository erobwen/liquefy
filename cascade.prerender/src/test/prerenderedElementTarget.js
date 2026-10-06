import { JSDOM } from "jsdom";
import assert from "assert";
import { RenderContext } from "@liquefy/cascade.component";
import { DOMElementTarget, div, text } from "@liquefy/cascade.dom";
import { PrerenderedElementTarget } from "../PrerenderedElementTarget.js";

// PrerenderedElementTarget: a prerendered page's snapshot giving way to the
// live app.
describe("PrerenderedElementTarget", function () {
  beforeEach(function () {
    const dom = new JSDOM("<!DOCTYPE html><head></head><body></body>");
    global.document = dom.window.document;
  });

  it("a prerendered root gives up its snapshot, and its style sheets, to the live app", function () {
    document.head.insertAdjacentHTML("beforeend", "<style data-prerendered>.x{}</style><style>.kept{}</style>");
    document.body.innerHTML = "<div id=\"application\" data-prerendered><p>Snapshot</p></div>";
    const application = document.getElementById("application");
    const target = PrerenderedElementTarget.forElement(application);
    assert.ok(target instanceof DOMElementTarget);
    div(text("Live")).renderOnto(target, new RenderContext());
    assert.equal(application.children.length, 1);
    assert.equal(application.textContent, "Live");
    assert.ok(!application.hasAttribute("data-prerendered"));
    assert.equal(document.head.querySelectorAll("style").length, 1, "the app's own style sheets stay");
  });

  it("a root that wasn't prerendered is taken as it is", function () {
    document.body.innerHTML = "<div id=\"application\"><p>Loading</p></div>";
    const application = document.getElementById("application");
    PrerenderedElementTarget.forElement(application);
    assert.equal(application.textContent, "Loading");
  });
});

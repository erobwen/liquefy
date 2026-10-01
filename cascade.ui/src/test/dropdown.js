import { JSDOM } from "jsdom";
import assert from "assert";
import { RenderContext, CompoundServiceLocator, Component } from "@liquefy/cascade.component";
import { DOMElementTarget, DOMServiceLocator } from "@liquefy/cascade.dom";
import { overlayFrame, dropdown, basicTheme } from "../index.js";

// A dropdown shows its choice on a button; clicking it opens the list of
// all the options, clicking one chooses it and closes the list.
describe("dropdown", function () {
  let window;

  beforeEach(function () {
    const dom = new JSDOM("<!DOCTYPE html><body></body>");
    window = dom.window;
    global.document = window.document;
  });

  const options = [
    { value: "a", label: "Alpha" },
    { value: "b", label: "Beta", style: { fontWeight: 700 } },
    { value: "c", label: "Gamma" },
  ];

  function show(properties) {
    class App extends Component {
      initialState() {
        return { value: "a", chosen: [], disabled: false };
      }
      build() {
        return overlayFrame(dropdown({
          options,
          value: this.value,
          disabled: this.disabled,
          onSelect: (value) => {
            this.chosen = [...this.chosen, value];
            this.value = value;
          },
          ...properties,
        }));
      }
    }
    const host = document.createElement("div");
    document.body.appendChild(host);
    const app = new App();
    app.renderOnto(new DOMElementTarget(host), new RenderContext({ serviceLocator: new CompoundServiceLocator(new DOMServiceLocator(), basicTheme) }));
    return { app, host };
  }

  const toggleButton = (host) => host.querySelector("button");
  const listed = (host) => [...host.querySelectorAll(".cb-list-item")];

  it("shows the choice made, and lists every option when clicked", function () {
    const { host } = show();
    assert.ok(toggleButton(host).textContent.includes("Alpha"));
    assert.equal(listed(host).length, 0);
    toggleButton(host).click();
    assert.deepEqual(listed(host).map((item) => item.textContent), ["Alpha", "Beta", "Gamma"]);
    assert.ok(listed(host)[0].classList.contains("cb-active"));
    // Each option's own style previews it.
    assert.equal(listed(host)[1].querySelector("span").style.fontWeight, "700");
  });

  it("chooses an option clicked, and closes the list", function () {
    const { app, host } = show();
    toggleButton(host).click();
    listed(host)[2].click();
    assert.deepEqual(app.chosen, ["c"]);
    assert.equal(listed(host).length, 0);
    assert.ok(toggleButton(host).textContent.includes("Gamma"));
  });

  it("doesn't open while disabled", function () {
    const { host } = show({ disabled: true });
    assert.ok(toggleButton(host).disabled);
    toggleButton(host).click();
    assert.equal(listed(host).length, 0);
  });

  it("closes when disabled while open - and stays closed when enabled again", function () {
    const { app, host } = show();
    app.disabled = false;
    toggleButton(host).click();
    assert.equal(listed(host).length, 3);
    app.disabled = true;
    assert.equal(listed(host).length, 0);
    app.disabled = false;
    assert.equal(listed(host).length, 0);
    // And opens again when clicked.
    toggleButton(host).click();
    assert.equal(listed(host).length, 3);
  });
});

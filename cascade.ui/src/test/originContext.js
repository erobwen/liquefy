import { JSDOM } from "jsdom";
import assert from "assert";
import { Component, observable } from "@liquefy/cascade.component";
import { DOMElementTarget, div, text, flipAnimationContainer } from "@liquefy/cascade.dom";
import { portal, portalContents, overlayFrame, overlay } from "../index.js";

// What's shown somewhere other than where it comes from - through a portal,
// or in an overlay - inherits from where it came from (see
// Component.enteredContext(), ContextScope): the context of where its
// entrance stands, what the entrance provides included - not the context
// of where it ends up.
describe("content shown elsewhere keeps the context it came from", function () {
  let container;

  beforeEach(function () {
    const dom = new JSDOM("<!DOCTYPE html><body></body>");
    global.document = dom.window.document;
    container = document.createElement("div");
  });

  // Provides `values` to what it builds - build-only, so it's expanded
  // through like anything else.
  class Provide extends Component {
    setProperties({ values, child }) {
      this.values = values;
      this.child = child;
    }
    provide() {
      return this.values;
    }
    build() {
      return this.child;
    }
  }

  // Shows the tone it inherits.
  class Toned extends Component {
    build() {
      return div({ key: "toned" }, text({ key: "tone", text: "tone:" + this.inherit("tone") }));
    }
  }

  const tones = () => Array.from(container.querySelectorAll("[id*='(toned)']")).map((each) => each.textContent);

  for (const animated of [false, true]) {
    it("through a portal: from where it was put in - the entrance's own provisions included" + (animated ? " (in a FlipAnimationContainer)" : ""), function () {
      class App extends Component {
        initialUnobservables() {
          return { bar: portal({ key: "bar" }).establish() };
        }
        provide() {
          return { bar: this.unobservable.bar };
        }
        build() {
          const content = [
            // Around the portal: the bar's own tone.
            new Provide({ key: "barTone", values: { tone: "bar" }, child: div({ key: "barArea" }, this.unobservable.bar) }),
            // The page: its tone - and, at the entrance, one for what it
            // puts through.
            new Provide({
              key: "page",
              values: { tone: "page" },
              child: div(
                { key: "pageArea" },
                new Toned({ key: "onPage" }),
                portalContents({ key: "entrance", portal: "bar" }, new Toned({ key: "throughPortal" })),
              ),
            }),
          ];
          return animated ? flipAnimationContainer({ key: "flip" }, content) : div({ key: "app" }, content);
        }
      }
      new App().renderOnto(new DOMElementTarget(container));
      assert.deepEqual(tones(), ["tone:page", "tone:page"], "the one in the bar inherits from the page, not the bar");
      const inBar = container.querySelector("[id*='(barArea)'] [id*='(toned)']");
      assert.ok(inBar, "shown in the bar");
    });
  }

  it("through a portal: what the entrance itself provides reaches what passes through", function () {
    class Entrance extends Component {
      setProperties({ children }) {
        this.entranceChildren = children;
      }
      provide() {
        return { tone: "entrance" };
      }
      build() {
        return portalContents({ key: "contents", portal: "bar" }, this.entranceChildren);
      }
    }
    class App extends Component {
      initialUnobservables() {
        return { bar: portal({ key: "bar" }).establish() };
      }
      provide() {
        return { bar: this.unobservable.bar, tone: "app" };
      }
      build() {
        return div(
          { key: "app" },
          div({ key: "barArea" }, this.unobservable.bar),
          new Entrance({ key: "entrance" }, new Toned({ key: "throughPortal" })),
        );
      }
    }
    new App().renderOnto(new DOMElementTarget(container));
    assert.deepEqual(tones(), ["tone:entrance"]);
  });

  it("in an overlay: a dialog inherits from where it's opened - and one opened from inside it still stacks on its own frame", function () {
    const state = observable({ first: true, second: false });
    class Dialog extends Component {
      build() {
        return div(
          { key: "dialog" },
          new Toned({ key: "dialogTone" }),
          // Opened from inside the first dialog - found its own frame.
          overlay({ key: "second", showing: state.second }, div({ key: "secondDialog" }, new Toned({ key: "secondTone" }))),
        );
      }
    }
    class App extends Component {
      build() {
        return overlayFrame(
          { key: "root" },
          new Provide({ key: "frameTone", values: { tone: "app" }, child: div({ key: "static" }, text("static")) }),
          new Provide({
            key: "page",
            values: { tone: "page" },
            child: overlay({ key: "first", showing: state.first }, new Dialog({ key: "dialog" })),
          }),
        );
      }
    }
    new App().renderOnto(new DOMElementTarget(container));
    assert.deepEqual(tones(), ["tone:page"], "the dialog inherits from the page, where it was opened");

    state.second = true;
    assert.deepEqual(tones(), ["tone:page", "tone:page"]);
    const second = container.querySelector("[id*='(secondDialog)']");
    const first = container.querySelector("[id*='(dialog)']");
    assert.ok(first.closest(".overlay-frame").contains(second), "stacked inside the first dialog's own frame");
    assert.notEqual(second.closest(".overlay-frame"), first.closest(".overlay-frame"), "on a frame of its own, on top of the first");
  });
});

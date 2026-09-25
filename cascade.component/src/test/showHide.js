import assert from "assert";
import { Component } from "../Component.js";
import { RenderContext } from "../RenderContext.js";

// onShow()/onHide(): told when a component starts and stops being shown -
// by rendering itself (first render, retraction, reattachment), with no
// rendering mechanics attached, so a component that places others itself
// can make the same calls for them (see cascade.DOM's FlipAnimationContainer).
describe("onShow / onHide", function () {
  const context = () => new RenderContext({ name: "target" });

  // Records its own notifications; renders nothing.
  class Watched extends Component {
    initialUnobservables() {
      return { events: [] };
    }
    render() {}
    onShow() {
      this.unobservable.events.push("show");
    }
    onHide() {
      this.unobservable.events.push("hide");
    }
  }

  // Renders `watched` while `showing`, and keeps it as a plain child
  // reference throughout (so it's the same component when it comes back).
  class Parent extends Component {
    constructor(watched) {
      super();
      this.watched = watched;
    }
    initializeState() {
      return { showing: true };
    }
    render(renderContext) {
      if (this.showing) this.watched.renderOnto(renderContext);
    }
  }

  it("shown on its first render, hidden when no longer rendered, shown again when it comes back", function () {
    const watched = new Watched();
    const parent = new Parent(watched);
    parent.renderOnto(context());
    assert.deepEqual(watched.unobservable.events, ["show"]);

    parent.showing = false;
    assert.deepEqual(watched.unobservable.events, ["show", "hide"]);

    parent.showing = true;
    assert.deepEqual(watched.unobservable.events, ["show", "hide", "show"]);
  });

  it("an ordinary rerun is neither", function () {
    class Counting extends Watched {
      initializeState() {
        return { count: 0 };
      }
      render() {
        this.count;
      }
    }
    const watched = new Counting();
    new Parent(watched).renderOnto(context());
    watched.count = 1;
    watched.count = 2;
    assert.deepEqual(watched.unobservable.events, ["show"]);
  });

  it("onRetract()/onReattach() call them by default - an override keeps that through super", function () {
    class WithMechanics extends Watched {
      onRetract() {
        this.unobservable.events.push("retract");
        super.onRetract();
      }
      onReattach(renderContext) {
        this.unobservable.events.push("reattach");
        super.onReattach(renderContext);
      }
    }
    const watched = new WithMechanics();
    const parent = new Parent(watched);
    parent.renderOnto(context());
    parent.showing = false;
    parent.showing = true;
    assert.deepEqual(watched.unobservable.events, ["show", "retract", "hide", "reattach", "show"]);
  });
});

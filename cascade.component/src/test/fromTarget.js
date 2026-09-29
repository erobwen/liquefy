import assert from "assert";
import { observable } from "../Cascade.js";
import { Component } from "../Component.js";

// fromTarget(): the one thing of its target a build may read - its timeless
// side (`target.timeless`), never what's temporal about it.
describe("Component.fromTarget()", function () {
  const measuredTarget = (width) => observable({ lastChild: null, timeless: observable({ width }) });

  class Reader extends Component {
    initialUnobservables() {
      return { seen: [] };
    }
    build() {
      this.unobservable.seen.push(this.fromTarget("width"));
      return null;
    }
  }

  it("reads the timeless side of the target it's placed on - and follows it, and a move to another target", function () {
    const a = measuredTarget(100);
    const b = measuredTarget(300);
    const state = observable({ onA: true });
    const reader = new Reader();
    class Parent extends Component {
      render() {
        reader.renderOnto(state.onA ? a : b);
      }
    }
    new Parent().renderOnto({ name: "root" });
    a.timeless.width = 120;
    state.onA = false;
    assert.deepEqual(reader.unobservable.seen, [100, 120, 300]);
  });

  it("undefined on a target with no timeless side", function () {
    const reader = new Reader();
    reader.renderOnto({ name: "plain" });
    assert.deepEqual(reader.unobservable.seen, [undefined]);
  });
});

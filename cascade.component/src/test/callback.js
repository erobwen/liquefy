import assert from "assert";
import { observable } from "../Cascade.js";
import { Component } from "../Component.js";
import { RenderContext } from "../RenderContext.js";
import { frozen } from "../frozen.js";
import { callback } from "../callback.js";

// callback(key, fn): a named callback - one stable function across
// rebuilds (so passing it isn't a change), always calling the closure from
// the latest build. A plain closure stays a change every time.
describe("callback()", function () {
  function setup(makeHandler) {
    const model = observable({ version: 0 });
    class Child extends Component {
      setProperties({ onPick, style }) {
        this.onPick = onPick;
        this.style = frozen(style);
      }
      initialUnobservables() {
        return { renders: 0 };
      }
      render() {
        this.unobservable.renders++;
        this.onPick;
        this.style;
      }
    }
    const picked = [];
    class Parent extends Component {
      build() {
        const version = model.version;
        return new Child({ key: "child", style: { color: "red" }, onPick: makeHandler(() => picked.push(version)) });
      }
    }
    const parent = new Parent();
    parent.renderOnto(new RenderContext({ name: "target" }));
    return { model, child: parent.newBuild, picked };
  }

  it("a named callback is the same function across rebuilds - and calls the closure from the latest one", function () {
    const { model, child, picked } = setup((fn) => callback("pick", fn));
    const first = child.onPick;
    model.version = 1;
    model.version = 2;
    assert.equal(child.onPick, first, "the same function");
    assert.equal(child.unobservable.renders, 1, "so the child didn't rerender for it");
    child.onPick();
    assert.deepEqual(picked, [2], "the latest closure - nothing stale");
  });

  it("a plain closure is a new function every build - a change every time", function () {
    const { model, child } = setup((fn) => fn);
    model.version = 1;
    model.version = 2;
    assert.equal(child.unobservable.renders, 3);
  });

  it("outside any build, it just returns the function", function () {
    const fn = () => {};
    assert.equal(callback("loose", fn), fn);
  });
});

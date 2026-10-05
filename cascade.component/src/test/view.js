import assert from "assert";
import { Component, observable, frozen, view } from "../../index.js";

// view(): a component from a build function - a class of its own, under
// its own name, with keys of its own.
describe("view()", function () {
  class Leaf extends Component {
    render() {}
  }

  // Renders what `make()` builds, again whenever what it read changes.
  function renderBuilt(make) {
    class Holder extends Component {
      build() {
        return make();
      }
    }
    const holder = new Holder();
    holder.renderOnto({});
    return holder;
  }

  it("builds from its properties, under its own name", function () {
    let built = null;
    const row = view("Row", ({ line }) => (built = line, new Leaf()));
    const holder = renderBuilt(() => row({ key: "first", line: "one" }));
    assert.equal(built, "one");
    assert.equal(holder.currentBuild.constructor.name, "Row");
    assert.ok(holder.currentBuild instanceof row.componentClass);
    assert.match(holder.currentBuild.toString(), /^Row:\d+\(first\)$/);
  });

  it("has keys of its own: the same keyed parts in two of them in one build", function () {
    const field = view("Field", () => [new Leaf({ key: "label" }), new Leaf({ key: "control" })]);
    assert.doesNotThrow(() => renderBuilt(() => [field({ key: "format" }), field({ key: "metadata" })]));
  });

  it("keeps its state through a rebuild of whoever built it", function () {
    const model = observable({ title: "one" });
    const counter = view("Counter", () => new Leaf(), {
      initialState() {
        return { count: 0 };
      },
    });
    const holder = renderBuilt(() => counter({ title: model.title }));
    const established = holder.currentBuild;
    established.count = 5;
    model.title = "two";
    assert.equal(holder.currentBuild, established);
    assert.equal(established.count, 5);
    assert.equal(established.title, "two");
  });

  it("methods can freeze a property - given an equal one again, it isn't rebuilt", function () {
    const model = observable({ unrelated: 1 });
    let builds = 0;
    const card = view("Card", ({ style }) => (builds++, new Leaf({ style })), {
      setProperties({ style }) {
        this.style = frozen(style);
      },
    });
    renderBuilt(() => (model.unrelated, card({ style: { padding: 4 } })));
    assert.equal(builds, 1);
    model.unrelated = 2;
    assert.equal(builds, 1, "an equal style in a new object is no change");
  });

  it("build is given as its own argument, not among the methods", function () {
    assert.throws(() => view("Odd", () => null, { build() {} }), /build is given as its own argument/);
  });
});

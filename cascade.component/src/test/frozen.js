import assert from "assert";
import { observable } from "../Cascade.js";
import { Component } from "../Component.js";
import { RenderContext } from "../RenderContext.js";
import { frozen } from "../frozen.js";

// Values as properties: frozen() in setProperties() makes a property a
// value - rebuilt with equal content, in new objects, it's unchanged (see
// cascade.reactive's mergeInto()); a property that isn't frozen is
// compared by identity, as always.
describe("frozen properties", function () {
  it("frozen() deep-freezes plain data, and stops at everything else", function () {
    class Thing {}
    const thing = new Thing();
    const live = observable({ a: 1 });
    const handler = () => {};
    const value = frozen({ style: { color: "red", margins: [1, 2] }, thing, live, handler });
    assert.ok(Object.isFrozen(value));
    assert.ok(Object.isFrozen(value.style) && Object.isFrozen(value.style.margins), "deeply");
    assert.ok(!Object.isFrozen(thing), "a class instance is a reference");
    live.a = 2;
    assert.equal(live.a, 2, "an observable stays live");
    assert.ok(!Object.isFrozen(handler));
    assert.equal(frozen(null), null);
    assert.equal(frozen(undefined), undefined);
  });

  // A parent rebuilding a child - keyed, so it's the same child - with
  // whatever `make` gives this time; the child counts its renders.
  function setup(make) {
    const model = observable({ version: 0 });
    class Child extends Component {
      setProperties({ value, raw }) {
        this.value = frozen(value);
        this.raw = raw;
      }
      initialUnobservables() {
        return { renders: 0 };
      }
      render() {
        this.unobservable.renders++;
        this.value;
        this.raw;
      }
    }
    class Parent extends Component {
      build() {
        return new Child({ key: "child", ...make(model.version) });
      }
    }
    const parent = new Parent();
    parent.renderOnto(new RenderContext({ name: "target" }));
    const child = parent.newBuild;
    return { model, child, renders: () => child.unobservable.renders };
  }

  it("rebuilt with an equal frozen value, in new objects: unchanged - its reader doesn't rerun", function () {
    const { model, child, renders } = setup(() => ({ value: { style: { color: "red" }, sizes: [1, 2] } }));
    const first = child.value;
    model.version = 1;
    model.version = 2;
    assert.equal(renders(), 1, "rendered once");
    assert.equal(child.value, first, "keeping the established value");
  });

  it("rebuilt with a different frozen value: changed", function () {
    const { model, child, renders } = setup((version) => ({ value: { style: { color: version > 0 ? "blue" : "red" } } }));
    model.version = 1;
    assert.equal(renders(), 2);
    assert.equal(child.value.style.color, "blue");
    model.version = 2;
    assert.equal(renders(), 2, "and equal again after that");
  });

  it("a frozen array of the same components is equal - the components compared by identity", function () {
    const shared = [observable({ name: "a" }), observable({ name: "b" })];
    const { model, renders } = setup((version) => ({ value: version < 2 ? [shared[0], shared[1]] : [shared[1], shared[0]] }));
    model.version = 1;
    assert.equal(renders(), 1, "same components, new array: equal");
    model.version = 2;
    assert.equal(renders(), 2, "reordered: changed");
  });

  it("a property that isn't frozen is compared by identity - equal content in a new object is a change", function () {
    const big = { rows: [1, 2, 3] };
    const { model, renders } = setup((version) => ({ raw: version < 2 ? big : { rows: [1, 2, 3] } }));
    model.version = 1;
    assert.equal(renders(), 1, "the same object: unchanged");
    model.version = 2;
    assert.equal(renders(), 2, "a new one: changed, whatever it holds - its identity stands for the whole");
  });
});

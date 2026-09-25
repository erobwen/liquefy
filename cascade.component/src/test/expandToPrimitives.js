import { observable } from "../Cascade.js";
import { Component } from "../Component.js";
import assert from "assert";

// Component.expandToPrimitives(): building a component all the way down to
// primitives, giving every component on the way its place in the tree
// (provideContext()) exactly as rendering it would - the basis for a
// container that places a whole subtree itself (see cascade.dom's
// FlipAnimationContainer).
describe("expandToPrimitives / provideContext", function () {
  class Primitive extends Component {
    setProperties({ label }) {
      this.label = label;
    }
    isPrimitive() {
      return true;
    }
    render() {}
  }

  // Can only be rendered, not built - an island to whoever is expanding.
  class Island extends Component {
    render() {}
  }

  const context = () => observable({ theme: "light" });

  it("expands through every build step down to primitives, flattening arrays and skipping nothing-children", function () {
    class Inner extends Component {
      build() {
        return [new Primitive({ key: "a", label: "a" }), null, new Primitive({ key: "b", label: "b" }), false];
      }
    }
    class Outer extends Component {
      build() {
        return new Inner({ key: "inner" });
      }
    }
    const outer = new Outer();
    const result = outer.expandToPrimitives(context(), null);
    assert.deepEqual(result.map((primitive) => primitive.label), ["a", "b"]);
    assert.ok(result.every((primitive) => primitive instanceof Primitive));
  });

  it("gives every component on the way the context and its render parent, as rendering would", function () {
    class Middle extends Component {
      build() {
        return new Primitive({ key: "leaf", label: "leaf" });
      }
    }
    class Top extends Component {
      build() {
        return new Middle({ key: "middle" });
      }
    }
    const renderContext = context();
    const owner = new Island();
    const top = new Top();
    const [leaf] = top.expandToPrimitives(renderContext, owner);
    const middle = top.newBuild;

    for (const component of [top, middle, leaf]) {
      assert.equal(component.renderContext, renderContext);
      assert.equal(component.unobservable.renderContext, renderContext);
    }
    assert.equal(top.renderParent, owner);
    assert.equal(middle.renderParent, top);
    assert.equal(leaf.renderParent, middle);
    assert.equal(top.unobservable.repeater, null, "provided a context, not rendered - no render repeater");
  });

  it("a build reads the provided context - and rebuilds when it changes", function () {
    class Themed extends Component {
      build() {
        return new Primitive({ key: "leaf", label: "theme:" + this.renderContext.theme });
      }
    }
    const renderContext = context();
    const themed = new Themed();
    assert.equal(themed.expandToPrimitives(renderContext, null)[0].label, "theme:light");
    renderContext.theme = "dark";
    assert.equal(themed.expandToPrimitives(renderContext, null)[0].label, "theme:dark");
  });

  it("stops at a component that can only be rendered, handing it back as an island", function () {
    class WithIsland extends Component {
      build() {
        return [new Primitive({ key: "p", label: "p" }), new Island({ key: "island" })];
      }
    }
    const result = new WithIsland().expandToPrimitives(context(), null);
    assert.ok(result[0] instanceof Primitive);
    assert.ok(result[1] instanceof Island);
    assert.ok(!result[1].isBuildComposed());
  });

  it("keyed children keep their identity and state across expansions", function () {
    const model = observable({ label: "one" });
    class Stateful extends Primitive {
      initializeState() {
        return { count: 0 };
      }
    }
    class Holder extends Component {
      build() {
        return new Stateful({ key: "stateful", label: model.label });
      }
    }
    const holder = new Holder();
    const [first] = holder.expandToPrimitives(context(), null);
    first.count = 3;
    model.label = "two";
    const [second] = holder.expandToPrimitives(context(), null);
    assert.equal(second, first);
    assert.equal(second.count, 3);
    assert.equal(second.label, "two");
  });
});

import { observable } from "../Cascade.js";
import { Component } from "../Component.js";
import assert from "assert";

// A component's build repeater is an *independent* repeater (see
// cascade.reactive's repeat({independent: true}) and Component.js's
// reactiveBuildEquivalent()): its own pipeline at the render's time level,
// not a child of the render repeater - so render pipeline operations never
// visit build repeaters. Render and build are parallel pipelines, each
// reading the other's latest writings; the build's lifecycle follows the
// render's by hand (retracted with it, rebuilt fresh on reattachment,
// retracted when the component is dropped).
describe("independent build repeaters", function () {
  const context = () => observable({ theme: "light" });

  function repeaterChildren(repeater) {
    const children = [];
    for (let node = repeater.children.first; node !== null; node = node.nextSibling) {
      if (node.type !== "partial") children.push(node);
    }
    return children;
  }

  class Leaf extends Component {
    render(renderContext) {
      this.unobservable.renderCount = (this.unobservable.renderCount || 0) + 1;
      this.unobservable.sawTheme = renderContext.theme;
    }
  }

  it("is its own pipeline - not among the render repeater's children, not in its partial chain", function () {
    class Parent extends Component {
      build() {
        return new Leaf({ key: "leaf" });
      }
    }
    const parent = new Parent();
    parent.renderOnto(context());

    const { repeater: render, buildRepeater: build } = parent.unobservable;
    assert.equal(build.parentRepeater, null);
    assert.notEqual(build.chainHead, render.chainHead);
    assert.equal(build.time(), render.time());
    // The render repeater's own children are just the leaf's render repeater.
    const children = repeaterChildren(render);
    assert.equal(children.length, 1);
    assert.equal(children[0], parent.newBuild.unobservable.repeater);
  });

  it("build() sees the render context's latest values, and a change there rebuilds and rerenders", function () {
    class Themed extends Component {
      build() {
        this.unobservable.buildCount = (this.unobservable.buildCount || 0) + 1;
        return new Leaf({ key: "leaf-" + this.renderContext.theme });
      }
    }
    const renderContext = context();
    const themed = new Themed();
    themed.renderOnto(renderContext);
    assert.equal(themed.newBuild.key, "leaf-light");

    renderContext.theme = "dark";
    assert.equal(themed.unobservable.buildCount, 2);
    assert.equal(themed.newBuild.key, "leaf-dark");
    assert.equal(themed.newBuild.unobservable.sawTheme, "dark");
  });

  it("a render rerun that doesn't change the build's inputs doesn't rebuild", function () {
    class Parent extends Component {
      build() {
        this.unobservable.buildCount = (this.unobservable.buildCount || 0) + 1;
        return new Leaf({ key: "leaf" });
      }
    }
    const parent = new Parent();
    parent.renderOnto(context());
    parent.unobservable.repeater.restart();
    parent.unobservable.repeater.restart();
    assert.equal(parent.unobservable.buildCount, 1);
  });

  it("is retracted along with the render repeater, stops rebuilding while hidden, and rebuilds fresh on reattachment", function () {
    const model = observable({ label: "a" });
    class Labelled extends Component {
      build() {
        this.unobservable.buildCount = (this.unobservable.buildCount || 0) + 1;
        return new Leaf({ key: "leaf-" + model.label });
      }
    }
    class Switch extends Component {
      initializeState() {
        return { show: true };
      }
      setProperties({ child }) {
        this.child = child;
      }
      render(renderContext) {
        if (this.show) this.child.renderOnto(renderContext);
      }
    }
    const labelled = new Labelled();
    const toggle = new Switch({ child: labelled });
    toggle.renderOnto(context());
    const firstBuild = labelled.unobservable.buildRepeater;
    assert.equal(labelled.unobservable.buildCount, 1);

    toggle.show = false;
    assert.ok(labelled.unobservable.repeater.retracted);
    assert.ok(firstBuild.retracted, "retracted with its render repeater");
    model.label = "b";
    assert.equal(labelled.unobservable.buildCount, 1, "no rebuilding while not rendered");

    toggle.show = true;
    assert.notEqual(labelled.unobservable.buildRepeater, firstBuild, "a fresh build repeater");
    assert.equal(labelled.unobservable.buildCount, 2);
    assert.equal(labelled.newBuild.key, "leaf-b", "built against what changed while hidden");
  });

  it("a dropped keyed component's build repeater is retracted too", function () {
    const model = observable({ label: "x" });
    class Inner extends Component {
      build() {
        this.unobservable.buildCount = (this.unobservable.buildCount || 0) + 1;
        return new Leaf({ key: "leaf-" + model.label });
      }
    }
    class Outer extends Component {
      initializeState() {
        return { includeInner: true };
      }
      build() {
        return this.includeInner ? new Inner({ key: "inner" }) : new Leaf({ key: "other" });
      }
    }
    const outer = new Outer();
    outer.renderOnto(context());
    const inner = outer.newBuild;
    assert.ok(inner instanceof Inner);

    outer.includeInner = false;
    assert.ok(inner.unobservable.buildRepeater.retracted);
    model.label = "y";
    assert.equal(inner.unobservable.buildCount, 1, "a dropped component never rebuilds again");
  });
});

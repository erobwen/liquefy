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

  it("survives the component being hidden: keyed children keep their identity and state; no rebuilding while hidden", function () {
    // Found via cascade.application/demo: leaving a page and coming back
    // reset every keyed child's state (the recursive demo's per-item values,
    // the hybrid dialog's counter). Hiding a component retracted its build
    // repeater too, and showing it again replaced that with a fresh one -
    // with an empty build-key map, so every keyed child was constructed
    // anew. The build repeater is now kept for the component's whole life:
    // left pending while hidden, revalidated - keys intact - when shown.
    const model = observable({ label: "a" });
    class Counter extends Component {
      initializeState() {
        return { count: 0 };
      }
      render() {}
    }
    class Labelled extends Component {
      build() {
        this.unobservable.buildCount = (this.unobservable.buildCount || 0) + 1;
        return new Counter({ key: "counter", label: model.label });
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
    const buildRepeater = labelled.unobservable.buildRepeater;
    const counter = labelled.newBuild;
    counter.count = 5;

    toggle.show = false;
    assert.ok(labelled.unobservable.repeater.retracted);
    assert.ok(!buildRepeater.retracted, "the build repeater is kept");
    model.label = "b";
    assert.equal(labelled.unobservable.buildCount, 1, "no rebuilding while not rendered");

    toggle.show = true;
    assert.equal(labelled.unobservable.buildRepeater, buildRepeater, "the same build repeater");
    assert.equal(labelled.unobservable.buildCount, 2, "revalidated once, when shown again");
    assert.equal(labelled.newBuild, counter, "the same keyed child object");
    assert.equal(counter.count, 5, "with its state");
    assert.equal(counter.label, "b", "and its properties rebuilt from what changed while hidden");
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

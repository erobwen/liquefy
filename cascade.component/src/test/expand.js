import { observable } from "../Cascade.js";
import { Component } from "../Component.js";
import { RenderContext } from "../RenderContext.js";
import assert from "assert";

// Component.expand(): building a component down to whatever the caller
// counts as a leaf, giving every component on the way its place in the
// tree (enterTree()) exactly as rendering it would - the basis for a
// container that places a whole subtree itself (see cascade.dom's
// FlipAnimationContainer).
describe("expand / enterTree", function () {
  // What these tests count as a leaf. Expandable itself (no render() of
  // its own) - it's only a leaf because the caller says so.
  class Leaf extends Component {
    setProperties({ label }) {
      this.label = label;
    }
    build() {
      return null;
    }
  }
  const isLeaf = (component) => component instanceof Leaf;

  // Can only be rendered, not built - an island to whoever is expanding.
  class Island extends Component {
    render() {}
  }

  const target = { name: "target" };
  const context = () => new RenderContext(observable({ theme: "light" }));

  it("expands through every build step down to the caller's leaves, flattening arrays and skipping nothing-children", function () {
    class Inner extends Component {
      build() {
        return [new Leaf({ key: "a", label: "a" }), null, new Leaf({ key: "b", label: "b" }), false];
      }
    }
    class Outer extends Component {
      build() {
        return new Inner({ key: "inner" });
      }
    }
    const outer = new Outer();
    const result = outer.expand(target, context(), null, isLeaf);
    assert.deepEqual(result.map((leaf) => leaf.label), ["a", "b"]);
    assert.ok(result.every((leaf) => leaf instanceof Leaf));
  });

  it("gives every component on the way the context and its render parent, as rendering would", function () {
    class Middle extends Component {
      build() {
        return new Leaf({ key: "leaf", label: "leaf" });
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
    const [leaf] = top.expand(target, renderContext, owner, isLeaf);
    const middle = top.newBuild;

    for (const component of [top, middle, leaf]) {
      assert.equal(component.renderContext, renderContext);
      assert.equal(component.unobservable.renderTarget, target);
    }
    assert.equal(top.unobservable.renderParent, owner);
    assert.equal(middle.unobservable.renderParent, top);
    assert.equal(leaf.unobservable.renderParent, middle);
    assert.equal(top.unobservable.repeater, null, "entered the tree, not rendered - no render repeater");
  });

  it("a build reads the provided context - and rebuilds when it changes", function () {
    class Themed extends Component {
      build() {
        return new Leaf({ key: "leaf", label: "theme:" + this.inherit("theme") });
      }
    }
    const renderContext = context();
    const themed = new Themed();
    assert.equal(themed.expand(target, renderContext, null, isLeaf)[0].label, "theme:light");
    renderContext.provided.theme = "dark";
    assert.equal(themed.expand(target, renderContext, null, isLeaf)[0].label, "theme:dark");
  });

  it("a provider on the way gives what's below it a context of its own, on top of the one it was given", function () {
    class Provider extends Component {
      provide() {
        return { shade: "deep" };
      }
      build() {
        return new Leaf({ key: "leaf", label: this.inherit("shade") + "/" + this.inherit("theme") });
      }
    }
    class Reader extends Component {
      build() {
        return new Leaf({ key: "leaf", label: this.inherit("shade") + "/" + this.inherit("theme") });
      }
    }
    class Top extends Component {
      build() {
        return new Provider({ key: "provider", child: null });
      }
    }
    const renderContext = context();
    const top = new Top();
    const [leaf] = top.expand(target, renderContext, null, isLeaf);
    const provider = top.newBuild;
    // Its own lookups see only what it was given.
    assert.equal(leaf.label, "undefined/light");
    assert.equal(provider.renderContext, renderContext);
    // What it builds sees what it provides.
    assert.notEqual(leaf.renderContext, renderContext);
    assert.equal(leaf.renderContext.parent, renderContext);
    assert.equal(leaf.inherit("shade"), "deep");
    assert.equal(leaf.inherit("theme"), "light");
    // A reader below it, expanded the same way, finds both.
    const [readLeaf] = new Reader().expand(target, leaf.renderContext, null, isLeaf);
    assert.equal(readLeaf.label, "deep/light");
  });

  it("stops at a component that can only be rendered, handing it back as an island", function () {
    class WithIsland extends Component {
      build() {
        return [new Leaf({ key: "p", label: "p" }), new Island({ key: "island" })];
      }
    }
    const result = new WithIsland().expand(target, context(), null, isLeaf);
    assert.ok(result[0] instanceof Leaf);
    assert.ok(result[1] instanceof Island);
    assert.ok(!result[1].isExpandable());
  });

  it("keyed children keep their identity and state across expansions", function () {
    const model = observable({ label: "one" });
    class Stateful extends Leaf {
      initialState() {
        return { count: 0 };
      }
    }
    class Holder extends Component {
      build() {
        return new Stateful({ key: "stateful", label: model.label });
      }
    }
    const holder = new Holder();
    const [first] = holder.expand(target, context(), null, isLeaf);
    first.count = 3;
    model.label = "two";
    const [second] = holder.expand(target, context(), null, isLeaf);
    assert.equal(second, first);
    assert.equal(second.count, 3);
    assert.equal(second.label, "two");
  });

  it("what counts as a leaf is up to the caller - the same tree expands differently for different callers", function () {
    class Card extends Component {
      build() {
        return [new Leaf({ key: "title", label: "title" }), new Leaf({ key: "body", label: "body" })];
      }
    }
    class Page extends Component {
      build() {
        return [new Card({ key: "first" }), new Card({ key: "second" })];
      }
    }
    const page = new Page();
    const labels = (result) => result.map((each) => each instanceof Card ? "card" : each.label);
    assert.deepEqual(labels(page.expand(target, context(), null, isLeaf)), ["title", "body", "title", "body"]);
    assert.deepEqual(labels(page.expand(target, context(), null, (component) => component instanceof Card)), ["card", "card"], "cards as units");
    assert.deepEqual(page.expand(target, context(), null).map((each) => each.label), [], "no leaves at all: all the way down, to nothing");
  });
});

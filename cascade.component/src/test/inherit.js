import { observable } from "../Cascade.js";
import { Component } from "../Component.js";
import { RenderContext } from "../RenderContext.js";
import assert from "assert";

// inherit() - the nearest value of a name provided above a component,
// found through the render context it's placed in: a chain with one link
// per component that provides something (see Component.provide(),
// RenderContext.js). Wherever it's placed from - built or hardcoded, in a
// build() or a render() - the chain follows where it's placed.
describe("Component.inherit() (through the render context chain)", function () {
  const target = { name: "target" };

  // Provides itself as "frame" to what's below it, and renders `child`.
  class Frame extends Component {
    constructor(child) {
      super();
      this.child = child;
    }
    provide() {
      return { frame: this };
    }
    render(target, context) {
      if (this.child) this.child.renderOnto(target, context);
    }
  }

  class Leaf extends Component {
    render() {
      this.unobservable.foundFrame = this.inherit("frame");
    }
  }

  it("finds what's provided above it - never what it provides itself", function () {
    const leaf = new Leaf();
    const frame = new Frame(leaf);
    frame.renderOnto(target);
    assert.equal(leaf.unobservable.foundFrame, frame);
    assert.equal(frame.inherit("frame"), undefined, "its own is for its children");
  });

  it("a lookup starting deep inside nested frames finds the nearest one, not an outer one - the recursive-modal-frame case", function () {
    const leaf = new Leaf();
    const innerFrame = new Frame(leaf);
    const outerFrame = new Frame(innerFrame);
    outerFrame.renderOnto(target);
    assert.equal(leaf.unobservable.foundFrame, innerFrame);
    assert.equal(innerFrame.inherit("frame"), outerFrame, "a frame itself finds the one around it");
  });

  it("only a provider adds a link: the rest pass on the context they were given", function () {
    class Plain extends Component {
      constructor(child) {
        super();
        this.child = child;
      }
      render(target, context) {
        this.child.renderOnto(target, context);
      }
    }
    const leaf = new Leaf();
    const plain = new Plain(leaf);
    const frame = new Frame(plain);
    frame.renderOnto(target);
    assert.equal(plain.renderContext, leaf.renderContext);
    assert.equal(leaf.renderContext.parent, RenderContext.empty);
    assert.equal(leaf.unobservable.foundFrame, frame);
  });

  it("through build() as well: what a provider builds inherits from it", function () {
    class Reader extends Component {
      build() {
        this.unobservable.found = this.inherit("frame");
        return null;
      }
    }
    class BuildingFrame extends Component {
      provide() {
        return { frame: this };
      }
      build() {
        return new Reader({ key: "reader" });
      }
    }
    const frame = new BuildingFrame();
    frame.renderOnto(target);
    assert.equal(frame.currentBuild.unobservable.found, frame);
  });

  it("a getter provided follows what it reads", function () {
    class Source extends Component {
      setProperties({ child }) {
        this.child = child;
      }
      initialState() {
        return { color: "red" };
      }
      provide() {
        const source = this;
        return { get color() { return source.color; } };
      }
      render(target, context) {
        this.child.renderOnto(target, context);
      }
    }
    class Reader extends Component {
      initialUnobservables() {
        return { seen: [] };
      }
      build() {
        this.unobservable.seen.push(this.inherit("color"));
        return null;
      }
    }
    const reader = new Reader();
    const source = new Source({ child: reader });
    source.renderOnto(target);
    source.color = "blue";
    assert.deepEqual(reader.unobservable.seen, ["red", "blue"]);
  });

  it("a provider removed upstream: the context below is re-pointed, not replaced - and only a different result is followed", function () {
    const data = observable({ withMiddle: true });
    class Reader extends Component {
      initialUnobservables() {
        return { builds: 0, found: null };
      }
      build() {
        this.unobservable.builds++;
        this.unobservable.found = this.inherit("frame");
        return null;
      }
    }
    // Provides something else - between the outer frame and what's below.
    class Middle extends Component {
      constructor(child) {
        super();
        this.child = child;
      }
      provide() {
        return { other: "value" };
      }
      render(target, context) {
        this.child.renderOnto(target, context);
      }
    }
    class Inner extends Component {
      constructor(child) {
        super();
        this.child = child;
      }
      provide() {
        return { inner: true };
      }
      render(target, context) {
        this.child.renderOnto(target, context);
      }
    }
    const reader = new Reader();
    const inner = new Inner(reader);
    const middle = new Middle(inner);
    class Root extends Component {
      provide() {
        return { frame: this };
      }
      render(target, context) {
        (data.withMiddle ? middle : inner).renderOnto(target, context);
      }
    }
    const root = new Root();
    root.renderOnto(target);
    const innerContext = inner.unobservable.ownContext;
    assert.equal(reader.unobservable.found, root);
    assert.equal(innerContext.parent, middle.unobservable.ownContext);
    assert.equal(reader.unobservable.builds, 1);

    data.withMiddle = false;
    assert.equal(inner.unobservable.ownContext, innerContext, "the same context");
    assert.equal(innerContext.parent, root.unobservable.ownContext, "re-pointed");
    assert.equal(reader.unobservable.found, root);
    assert.equal(reader.unobservable.builds, 1, "found the same frame - nothing to rebuild");
  });

  it("a nearer provider removed upstream: what's below finds the next one up, and follows", function () {
    const data = observable({ withMiddle: true });
    class Reader extends Component {
      initialUnobservables() {
        return { found: [] };
      }
      build() {
        this.unobservable.found.push(this.inherit("frame"));
        return null;
      }
    }
    class Inner extends Component {
      constructor(child) {
        super();
        this.child = child;
      }
      provide() {
        return { inner: true };
      }
      render(target, context) {
        this.child.renderOnto(target, context);
      }
    }
    const reader = new Reader();
    const inner = new Inner(reader);
    const middle = new Frame(inner);
    class Root extends Component {
      provide() {
        return { frame: this };
      }
      render(target, context) {
        (data.withMiddle ? middle : inner).renderOnto(target, context);
      }
    }
    const root = new Root();
    root.renderOnto(target);
    data.withMiddle = false;
    assert.deepEqual(reader.unobservable.found, [middle, root]);
    data.withMiddle = true;
    assert.deepEqual(reader.unobservable.found, [middle, root, middle]);
  });

  it("returns undefined when nothing provides it - and refuses before it's in the tree", function () {
    class Lonely extends Component {
      render() {}
    }
    const lonely = new Lonely();
    assert.throws(() => lonely.inherit("anything"), /not in the tree yet/);
    lonely.renderOnto(target);
    assert.equal(lonely.inherit("somethingNobodyProvides"), undefined);
  });

  it("the root context provides what it's given", function () {
    const leaf = new Leaf();
    leaf.renderOnto(target, new RenderContext({ frame: "root frame" }));
    assert.equal(leaf.unobservable.foundFrame, "root frame");
  });
});

describe("a disposed render context", function () {
  it("still answers lookups - uncached, starting no repeater that nothing would dispose of", function () {
    const root = new RenderContext({ frame: "root frame" });
    const context = new RenderContext({ other: 1 }, root);
    assert.equal(context.inherit("frame"), "root frame");
    const cached = context.causality.inheritCache.size;
    context.onDispose();
    assert.equal(context.inherit("frame"), "root frame");
    assert.equal(context.inherit("somethingElse"), undefined);
    assert.equal(context.causality.inheritCache, null, "nothing cached on it again");
    assert.ok(cached > 0);
  });

  it("a provider that throws once doesn't break inherit() for good", function () {
    let broken = true;
    const root = new RenderContext({ get v() { if (broken) throw new Error("not ready"); return 1; } });
    const child = new RenderContext({ other: 2 }, root);
    assert.throws(() => child.inherit("v"), /not ready/);
    broken = false;
    assert.equal(child.inherit("v"), 1, "tried again - not a half-made cache entry");
  });
});

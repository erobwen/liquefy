import { observable } from "../Cascade.js";
import { Component } from "../Component.js";
import assert from "assert";

// inherit() (ported from flow.core's Component.js - see its own
// inheritUncached) is the mechanism a recursive modal/overlay frame needs:
// "find the nearest ancestor that provides X," where "ancestor" has to
// mean something that actually works regardless of how a component was
// composed. Three separate hierarchies, tried in this exact order:
//
//  1. provide() - does this component provide the property itself?
//  2. equivalentCreator - whoever's build() produced this component.
//  3. renderParent - whoever actually renderOnto()'d this component as a
//     child (checked after equivalentCreator, for the same reason flow's
//     own version does - a hardcoded-child-reference component never
//     gets an equivalentCreator at all, so this is what actually reaches
//     it).
//  4. creator - whoever was executing its own build() when this
//     component was constructed - a fallback for something constructed
//     inside build() but never itself returned from it or rendered as
//     anyone's child.
describe("Component.inherit() (structural/build/creator ancestor lookup)", function () {

  it("finds a property a component provides on itself, without needing to walk anywhere", function () {
    class SelfProviding extends Component {
      constructor() {
        super();
        this.frame = this;
      }
      render() {}
    }

    const frame = new SelfProviding();
    frame.renderOnto(observable({}));

    assert.equal(frame.inherit("frame"), frame);
  });

  it("a hardcoded-child-reference component (no build() involved at all) inherits via renderParent", function () {
    class Frame extends Component {
      constructor(child) {
        super();
        this.frame = this;
        this.child = child;
      }
      render(target) {
        this.child.renderOnto(target);
      }
    }
    class Leaf extends Component {
      render() {
        this.unobservable.foundFrame = this.inherit("frame");
      }
    }

    const leaf = new Leaf();
    const frame = new Frame(leaf);
    frame.renderOnto(observable({}));

    assert.equal(leaf.unobservable.foundFrame, frame);
    assert.equal(leaf.equivalentCreator, undefined, "never built via anyone's build() - this path genuinely isn't involved here");
  });

  it("a lookup starting deep inside nested frames finds the nearest one, not an outer one - the recursive-modal-frame case", function () {
    class Frame extends Component {
      constructor(child) {
        super();
        this.frame = this;
        this.child = child;
      }
      render(target) {
        this.child.renderOnto(target);
      }
    }
    class Leaf extends Component {
      render() {
        this.unobservable.foundFrame = this.inherit("frame");
      }
    }

    const leaf = new Leaf();
    const innerFrame = new Frame(leaf);
    const outerFrame = new Frame(innerFrame);
    outerFrame.renderOnto(observable({}));

    assert.equal(leaf.unobservable.foundFrame, innerFrame);
    assert.notEqual(leaf.unobservable.foundFrame, outerFrame);
  });

  it("equivalentCreator (who built me) is checked before renderParent (who actually rendered me)", function () {
    // Deliberately makes the two differ: `frame` builds `leaf` via
    // build(), but hands the built result off to a separate wrapper to
    // actually renderOnto() - so leaf's renderParent ends up being that
    // wrapper, not `frame` itself, even though `frame` is what built it.
    class Wrapper extends Component {
      constructor(child) {
        super();
        this.child = child;
      }
      render(target) {
        this.child.renderOnto(target);
      }
    }
    class ProvidingFrame extends Component {
      constructor(childFactory) {
        super();
        this.frame = this;
        this.childFactory = childFactory;
      }
      build() {
        return this.childFactory();
      }
      render(target) {
        const built = this.reactiveBuildEquivalent();
        const wrapper = new Wrapper(built);
        this.unobservable.wrapper = wrapper;
        wrapper.renderOnto(target);
      }
    }
    class Leaf extends Component {
      render() {
        this.unobservable.foundFrame = this.inherit("frame");
      }
    }

    const leaf = new Leaf();
    const frame = new ProvidingFrame(() => leaf);
    frame.renderOnto(observable({}));

    assert.equal(leaf.equivalentCreator, frame);
    assert.notEqual(leaf.renderParent, frame, "renderParent should be the Wrapper, not frame itself");
    assert.equal(leaf.unobservable.foundFrame, frame, "found via equivalentCreator, proving it's checked before renderParent");
  });

  it("a component constructed inside build() but never itself built or rendered as anyone's child inherits via creator", function () {
    class SideLeaf extends Component {
      render() {}
    }
    class Placeholder extends Component {
      render() {}
    }
    class CreatorFrame extends Component {
      constructor() {
        super();
        this.frame = this;
      }
      build() {
        // Constructed here, inside build() - captures `this` as its
        // creator (see the constructor/reactiveBuildEquivalent's own
        // creators-stack push) - but stashed aside, never returned from
        // build() (so no equivalentCreator) and never renderOnto()'d by
        // anyone (so no renderParent) either.
        this.unobservable.sideConstructed = new SideLeaf();
        return new Placeholder();
      }
    }

    const frame = new CreatorFrame();
    frame.renderOnto(observable({}));
    const sideLeaf = frame.unobservable.sideConstructed;

    assert.equal(sideLeaf.creator, frame);
    assert.equal(sideLeaf.equivalentCreator, undefined);
    assert.equal(sideLeaf.renderParent, undefined);
    assert.equal(sideLeaf.inherit("frame"), frame);
  });

  it("returns undefined when nothing anywhere in any of the three hierarchies provides the property", function () {
    class Lonely extends Component {
      render() {}
    }

    const lonely = new Lonely();
    lonely.renderOnto(observable({}));

    assert.equal(lonely.inherit("somethingNobodyProvides"), undefined);
  });

});

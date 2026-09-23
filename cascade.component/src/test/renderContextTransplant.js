import assert from "assert";
import { Component } from "../Component.js";
import { RenderContext } from "../RenderContext.js";

// A component retracted from one parent and later renderOnto()'d by a
// *different* one - the "transplant" shape cascade.application/demo's
// HybridModalDialog relies on (one dialog instance moving between a docked
// slot and a modal overlay) - must render against the context it was most
// recently handed, not the one its repeater's callback happened to be
// created with. Found via that demo: renderOnto()'s repeater callback
// closed over its own first `context` argument, so a restart() after
// reattachment re-rendered against the original parent's target,
// appending fresh elements back under the old parent. Every existing
// reattach test (the menu breakpoint ones) reattaches under the *same*
// context, which is exactly why this never surfaced before.
describe("renderOnto() under a different context after retraction", function () {
  it("a component transplanted between two parents renders against the new parent's context, not the first one's", function () {
    const contextA = new RenderContext({ name: "a" });
    const contextB = new RenderContext({ name: "b" });

    class Leaf extends Component {
      initialUnobservables() {
        return { seenTarget: null, renderCount: 0 };
      }
      render(context) {
        const u = this.unobservable;
        u.renderCount++;
        u.seenTarget = context.target.name;
      }
    }

    class Parent extends Component {
      constructor(leaf) {
        super();
        this.leaf = leaf;
      }
      initializeState() {
        return { slot: "a" };
      }
      render() {
        if (this.slot === "a") {
          this.leaf.renderOnto(contextA);
        } else {
          this.leaf.renderOnto(contextB);
        }
      }
    }

    const leaf = new Leaf();
    const parent = new Parent(leaf);
    parent.renderOnto(new RenderContext({ name: "root" }));

    assert.equal(leaf.unobservable.seenTarget, "a");
    assert.equal(leaf.unobservable.renderCount, 1);

    // Move it: not rendered onto A this run (retracted), rendered onto B.
    parent.slot = "b";
    assert.equal(leaf.unobservable.seenTarget, "b", "must render against the context it was just handed, not the one it was first created with");
    assert.equal(leaf.unobservable.renderCount, 2);

    // And back again.
    parent.slot = "a";
    assert.equal(leaf.unobservable.seenTarget, "a");
    assert.equal(leaf.unobservable.renderCount, 3);
  });

  it("a component transplanted between two *different* parents - retracted by one, reattached by the other - renders against the new one's context and keeps its state", function () {
    // The demo's own shape exactly: a root with two sibling slots, each
    // of which renders the shared leaf only while it's "theirs". Moving
    // it means slot A stops reclaiming it (finalizeChildren retracts it)
    // and slot B renderOnto()s it afresh under a different context - the
    // retract/reattach path, not the same-parent relink the case above
    // exercises. Both must land on the new context.
    const contextA = new RenderContext({ name: "a" });
    const contextB = new RenderContext({ name: "b" });

    class Leaf extends Component {
      initializeState() {
        return { counter: 0 };
      }
      initialUnobservables() {
        return { seenTarget: null, retractions: 0 };
      }
      render(context) {
        this.unobservable.seenTarget = context.target.name;
      }
      onRetract() {
        this.unobservable.retractions++;
      }
    }

    class Slot extends Component {
      constructor(root, mine, leaf, context) {
        super();
        this.root = root;
        this.mine = mine;
        this.leaf = leaf;
        this.context = context;
      }
      render() {
        if (this.root.slot === this.mine) this.leaf.renderOnto(this.context);
      }
    }

    class Root extends Component {
      constructor(leaf) {
        super();
        this.slotA = new Slot(this, "a", leaf, contextA);
        this.slotB = new Slot(this, "b", leaf, contextB);
      }
      initializeState() {
        return { slot: "a" };
      }
      render(context) {
        this.slotA.renderOnto(context);
        this.slotB.renderOnto(context);
      }
    }

    const leaf = new Leaf();
    const root = new Root(leaf);
    root.renderOnto(new RenderContext({ name: "root" }));
    assert.equal(leaf.unobservable.seenTarget, "a");

    leaf.counter = 3; // state set while docked in A

    // Whether a move goes through retraction depends only on which slot
    // the scheduler reaches first: if the losing slot reruns first, it
    // retracts the leaf and the winner reattaches it; if the winning slot
    // reruns first, it claims the leaf straight from the other one (which
    // must then *not* retract it - see attachToCurrentParent()'s own
    // unlink-from-old-parent step). Both orders must end up the same, so
    // only the outcome is asserted, in both directions.
    root.slot = "b";
    assert.equal(leaf.unobservable.seenTarget, "b", "must render against slot B's context after moving there");
    assert.equal(leaf.counter, 3, "state lives on the component, and survives the move");

    root.slot = "a";
    assert.equal(leaf.unobservable.seenTarget, "a", "and back - the direction where the new owner claims it before the old one reruns");
    assert.equal(leaf.counter, 3);

    root.slot = "b";
    assert.equal(leaf.unobservable.seenTarget, "b");
    assert.equal(leaf.counter, 3);
  });
});

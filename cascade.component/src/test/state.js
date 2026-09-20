import { Component } from "../Component.js";
import assert from "assert";

// Component state (see README.md, "Component state and properties"):
// initializeState() declares it, a rebuild never resets it, setState()
// writes it from inside a pipeline - and a dropped component is retracted
// on dispose, before any stale rerun of it can run.
describe("Component state (initializeState/setState)", function () {

  class Counter extends Component {
    setProperties({ step }) {
      this.step = step;
    }
    initializeState() {
      // A default derived from a property - setProperties() has already run.
      return { count: this.step * 10 };
    }
    render() {
      this.unobservable.seen = this.count;
    }
  }

  class Owner extends Component {
    build() {
      return new Counter({ key: "counter", step: this.step });
    }
    render(target) {
      const counter = this.reactiveBuildEquivalent();
      this.unobservable.counter = counter;
      counter.renderOnto(target);
    }
  }

  it("state defaults may derive from properties, and survive a rebuild while properties are re-set", function () {
    const owner = new Owner();
    owner.step = 1;
    owner.renderOnto({});
    const counter = owner.unobservable.counter;
    assert.equal(counter.step, 1);
    assert.equal(counter.count, 10);

    counter.count = 42; // user interaction - outside any repeater

    owner.step = 2; // Owner's build() reruns -> Counter reconstructed and reconciled by key
    assert.equal(owner.unobservable.counter, counter, "same instance across the rebuild");
    assert.equal(counter.step, 2, "the property follows the fresh construction");
    assert.equal(counter.count, 42, "the state does not - the rebuild's default (20) is never copied back");
    assert.equal(counter.unobservable.seen, 42);
  });

  it("setState() writes state from inside another component's render(), and rejects undeclared properties", function () {
    class Frame extends Component {
      initializeState() { return { assigned: null }; }
      render() { this.unobservable.seen = this.assigned; }
    }
    class Opener extends Component {
      setProperties({ frame }) { this.frame = frame; }
      render() {
        if (this.open) this.frame.setState({ assigned: "content" });
      }
    }
    const frame = new Frame();
    const opener = new Opener({ frame });
    opener.open = false;
    frame.renderOnto({});
    opener.renderOnto({});
    assert.equal(frame.unobservable.seen, null);

    opener.open = true; // Opener reruns -> writes Frame's state from inside a repeater, via setState
    assert.equal(frame.unobservable.seen, "content");

    assert.throws(() => frame.setState({ notDeclared: 1 }), /not a state property/);
  });

});

// A real bug found in cascade.application/demo (a docked menu list dropped
// from the tree as the layout went modal, its build() rerunning against a
// property its own constructing repeater's dispose() had just unlinked):
// the child's stale, already-queued rerun raced - and beat - the retraction
// that should have stopped it. Component.onDispose() now retracts a
// component the moment its build identity vanishes, so the scheduler
// discards that queued rerun instead of running it.
describe("a dropped component is retracted on dispose, before any stale rerun of it", function () {

  class Sibling extends Component {
    setProperties({ owner }) {
      this.owner = owner; // a plain property, written into whoever's build() constructs this
    }
    build() {
      this.unobservable.builds = (this.unobservable.builds || 0) + 1;
      return { marker: this.owner.items.join(",") }; // throws if `owner` has been unlinked
    }
    render() {
      this.reactiveBuildEquivalent();
    }
  }

  class Other extends Component {
    render() {}
  }

  // The children-rendering loop, like DOMElementNode's own render() - what
  // would normally, eventually, retract a child it no longer relinks.
  class Wrapper extends Component {
    setProperties({ children }) { this.children = children; }
    render(target) {
      (this.children || []).forEach((child) => child.renderOnto(target));
    }
  }

  // Constructed fresh (and reconciled) on every Grandparent.build(), like OverlayFrame.
  class Middle extends Component {
    setProperties({ children }) { this.staticContent = children || []; }
    build() {
      return new Wrapper({ key: "wrapper", children: this.staticContent });
    }
  }

  class Grandparent extends Component {
    build() {
      const sibling = this.modal ? null : new Sibling({ key: "sibling", owner: this });
      const other = new Other({ key: "other" });
      this.unobservable.sibling = sibling || this.unobservable.sibling;
      return new Middle({ key: "middle", children: [sibling, other].filter(Boolean) });
    }
    render(target) {
      const n = (this.unobservable.renderCount = (this.unobservable.renderCount || 0) + 1);
      this.items = ["run" + n]; // unlinks the previous run's writings on dispose, `owner` included
      this.modal = n >= 2; // drops Sibling on the second run - the breakpoint flipping
      this.reactiveBuildEquivalent().renderOnto(target);
    }
  }

  it("Sibling's build() does not run again once Sibling is dropped, even though its stale rerun was already queued", function () {
    const gp = new Grandparent();
    gp.renderOnto({});
    const sibling = gp.unobservable.sibling;
    assert.equal(sibling.unobservable.builds, 1);

    gp.unobservable.repeater.restart(); // no throw, no stale build()

    assert.equal(sibling.unobservable.builds, 1, "a dropped component's stale rerun is discarded, not run");
    assert.ok(sibling.unobservable.repeater.retracted, "retracted on dispose, not left to whoever rendered it");
  });

});

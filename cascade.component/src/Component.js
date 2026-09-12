import { observable, repeat, linkRepeater } from "./Cascade.js";

/**
 * Component - the cascade.component base class.
 *
 * This is deliberately NOT flow.core's Component (build an abstract
 * primitive tree first via build()/reactiveBuildEquivalentPrimitive(),
 * then mount that tree separately). Instead, a component here renders
 * directly onto a live target in one pass: renderOnto(target) either
 * creates the component's repeater (first render) or relinks the existing
 * one (every later render - see linkRepeater(), which never itself forces
 * execution), and render(target) is where a subclass actually does its
 * work against the target - reading and writing it in real time, in tree
 * order, using the timeline/partial-chain machinery cascade.reactive
 * already provides.
 *
 * This is the productionized shape of the toy Leaf/Panel pattern proved
 * out in cascade.reactive/src/test/renderOnto.js - see that file for the
 * concrete before/after mechanics (padding/space-left example) this is
 * built from.
 *
 * A flow.core-style "build an abstract tree first, then render it" mode
 * still has a place (e.g. FLIP animation needs a before/after snapshot to
 * compute transforms from) but is out of scope for this base class - it
 * will live on a specific component that opts into it, not here.
 */
export class Component {
  get unobservable() {
    if (!this.causality.unobservable) {
      this.causality.unobservable = Object.assign({ repeater: null }, this.initialUnobservables());
    }
    return this.causality.unobservable;
  }

  // Override to seed additional non-observable bookkeeping fields (render
  // counters, cached measurements, ...) - anything that must survive a
  // rerun without itself being reactive. See docs/... in cascade.reactive
  // for why a plain observable property doesn't work for this (a fresh
  // read of it can fall through once retraction is involved, even though
  // the component's own identity hasn't changed).
  initialUnobservables() {
    return {};
  }

  constructor() {
    return observable(this);
  }

  // Override: do this component's own real-time work against `target` -
  // reading/writing it, and rendering any children onto it (or onto
  // whatever the component itself decides to pass down) via their own
  // renderOnto().
  render(target) {
    throw new Error(this.constructor.name + " must implement render(target)");
  }

  renderOnto(target) {
    const u = this.unobservable;
    if (u.repeater) {
      linkRepeater(u.repeater);
    } else {
      u.repeater = repeat(() => this.render(target));
    }
  }
}

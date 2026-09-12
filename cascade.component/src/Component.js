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

  // `key`, if given, is this component's *build identity* - see build()/
  // reactiveBuildEquivalent() below. It's cascade.reactive's own
  // observable(target, buildId) mechanism (already fully built - see
  // cascade.reactive/src/test/rebuild.js): constructing a component with a
  // key that matches one from the enclosing repeater's *previous* run
  // discards this freshly-constructed instance and returns the
  // established one instead (its own observable fields merged in from
  // this fresh one, but its identity - unobservable.repeater included -
  // completely untouched). A component with no key is never reconciled
  // this way; that's the hardcoded-child-reference style (see
  // cascade.component/src/test/toolbarMainFrame.js), still fully
  // supported as an alternative to build()/keys.
  constructor(key) {
    return observable(this, key);
  }

  // Override to compose this component from children - the alternative
  // to hardcoding child references as fields (see renderOnto.js's own
  // discussion of both styles). Return a child component (or an array of
  // them), each typically constructed with its own key so cascade can
  // tell across rebuilds which new one corresponds to which established
  // one - see reactiveBuildEquivalent() and the constructor's `key` docs
  // above. Not implemented by default; a component overrides this OR
  // render() (see the default render() below), not both.
  build() {
    throw new Error(this.constructor.name + " must implement build() or render(context)");
  }

  // Build this component's immediate equivalent - one step only, not all
  // the way down to something primitive (that's
  // reactiveBuildEquivalentPrimitive(), layered on top of this, for a
  // component like FlipAnimationContainer that specifically needs an
  // abstract tree built before rendering anything - out of scope here).
  // One step is what lets build and render interleave at every level
  // instead of needing two separate passes: a parent can build one child,
  // render it, take a real measurement, and only then build/render the
  // next with that measurement already in hand.
  //
  // Wrapped in its own repeater, so a rebuild only happens when this
  // component's own build() inputs actually change, not on every parent
  // rerun - the same reasoning as any other repeater boundary.
  //
  // The result is stashed on `this.newBuild` - an ordinary *observable*
  // property (matching flow.core's own naming), not something on
  // `unobservable`. That matters: buildRepeater is the sole writer and
  // render() (running in a *different* repeater) is the sole reader, so
  // this is a plain producer/consumer relationship - the same shape as
  // any pipeline stage reading another's output - not a repeater reading
  // back its own prior write, which is the shape that actually needs the
  // unobservable escape hatch. Storing it on unobservable here would just
  // make render() never notice a rebuild at all: linkRepeater() doesn't
  // force execution, and a non-observable read creates no dependency for
  // the rebuild to invalidate.
  reactiveBuildEquivalent() {
    const u = this.unobservable;
    if (!u.buildRepeater) {
      u.buildRepeater = repeat(() => {
        this.newBuild = this.build();
      });
    } else {
      linkRepeater(u.buildRepeater);
    }
    return this.newBuild;
  }

  // Override: do this component's own real-time work against `context` -
  // reading/writing its target, and rendering any children onto it (or
  // onto a context of the component's own construction - see
  // RenderContext) via their own renderOnto(). `context` is opaque to
  // this base class - by convention it's a RenderContext (a target plus
  // whatever situational information a parent chose to hand down), but
  // nothing here requires that shape; a bare target works too, if a
  // component has nothing extra to pass its children.
  //
  // Default implementation: build one step (see reactiveBuildEquivalent()
  // above) and renderOnto() each resulting child in turn, in order - the
  // build()-based composition style. Override render() directly instead
  // (skipping build() entirely) for the hardcoded-child-reference style,
  // or to interleave custom work (measurement, etc.) between children -
  // see cascade.DOM's DOMComponent-based demos for exactly that.
  render(context) {
    const equivalent = this.reactiveBuildEquivalent();
    const children = equivalent instanceof Array ? equivalent : [equivalent];
    for (const child of children) {
      child.renderOnto(context);
    }
  }

  renderOnto(context) {
    const u = this.unobservable;
    if (u.repeater) {
      linkRepeater(u.repeater);
    } else {
      u.repeater = repeat(() => this.render(context));
    }
  }
}

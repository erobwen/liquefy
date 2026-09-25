import { observable, repeat, linkRepeater, accessInitialValues, declareState, retractRepeater, refreshIfNeeded, withoutRecording } from "./Cascade.js";
import { toPropertiesWithChildren, extractProperty } from "./implicitProperties.js";

/**
 * Two separate stacks, both ported from flow.core's Component.js
 * (`creators`, plus the render-time half its own DOMNode/PrimitiveComponent
 * machinery tracked as `renderParent`) - see inherit() below for why both
 * exist rather than just one. Module-level, not on `state`: nothing
 * outside this file ever needs to read either stack directly, only
 * whichever single component happens to be on top when a constructor or
 * renderOnto() call is in progress - see getCreator()/getRenderParent().
 */
const creators = [];
export function getCreator() {
  return creators.length > 0 ? creators[creators.length - 1] : null;
}

const renderStack = [];
function getRenderParent() {
  return renderStack.length > 0 ? renderStack[renderStack.length - 1] : null;
}

// Ties a build()-composed child back to whoever's build() call produced
// it - see reactiveBuildEquivalent() below, and inherit()'s own use of
// `equivalentCreator`. `built` is whatever build() returned - a single
// component, an array of them, or null/undefined (nothing to tie back).
function assignEquivalentCreator(built, creator) {
  if (!built) return;
  const children = built instanceof Array ? built : [built];
  children.forEach((child) => {
    if (child) child.equivalentCreator = creator;
  });
}

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
  // Created on first access - which can be anywhere: inside some other
  // component's render, say. So initialUnobservables() runs at initial time
  // whenever that is (accessInitialValues()): a component created there (a
  // portal this one owns, its portalContents - see
  // cascade.component/README.md on creating a sub-component directly, in
  // initialization) has its properties as baseline values, not as the
  // writings of whichever repeater happened to touch this first - retracted
  // with it the moment that repeater is (a page hidden), and never
  // rewritten, since nothing constructs it again.
  get unobservable() {
    if (!this.causality.unobservable) {
      this.causality.unobservable = Object.assign({ repeater: null }, accessInitialValues(() => this.initialUnobservables()));
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

  // Declare state (see README.md, "Component state and properties").
  // Returns an object that will determine what will become state properties
  // for this component, with their defaults - for example {x: 42}. Runs in
  // the constructor right after setProperties(), so a default may derive
  // from a property (`{ chosen: this.pages[0].key }`). State variables are
  // set up so that they can only be written at initialization time, or
  // from outside any repeater (an event handler), or deliberately via
  // setState() below - a plain write from any repeater in the pipeline
  // throws. And a rebuild never resets them: whatever this returns for the
  // throwaway twin constructed during a rebuild is simply not copied onto
  // the established object (see cascade.reactive's declareState()).
  // Properties, by contrast, are re-set from the constructing context on
  // every rebuild - like a function's arguments. Components without state
  // leave this alone.
  initializeState() {
    return {};
  }

  // Write state from a place that isn't already at initial time - e.g.
  // from inside another component's render() (see cascade.ui's
  // OverlayFrame.showOverlay(), called from Overlay.render()). An event
  // handler running outside any repeater can just assign the property
  // directly; this is the equivalent for everywhere else, wrapping
  // accessInitialValues() so the write lands at the baseline position the
  // state property already lives at. Only declared state may be written
  // this way - anything else is a property, and a property written back
  // in time would be a bug hiding, not a feature.
  setState(values) {
    const declared = this.causality.stateProperties;
    for (const key in values) {
      if (!declared || !declared.has(key)) {
        throw new Error("setState(): '" + key + "' is not a state property of this component - declare it in initializeState().");
      }
    }
    accessInitialValues(() => {
      for (const key in values) this[key] = values[key];
    });
  }

  // Accepts flow.core's own mixed argument-list convention (see
  // implicitProperties.js, ported from flow.core/src/implicitProperties.js):
  // a leading loose string/number becomes the implicit key, other loose
  // arguments become implicit children, and a trailing plain object
  // becomes the properties bag - `div("someText", {style: ...}, childA)`
  // rather than a fixed parameter list. This is the actual prerequisite
  // for pulling a simple flow component over mostly unchanged: build()/
  // render() delegation (below) doesn't help on its own if the
  // constructor call site itself can't be parsed.
  //
  // `key`, once resolved, is this component's *build identity* - see
  // build()/reactiveBuildEquivalent() below. It's cascade.reactive's own
  // observable(target, buildId) mechanism (already fully built - see
  // cascade.reactive/src/test/rebuild.js): constructing a component with a
  // key that matches one from the enclosing repeater's *previous* run
  // discards this freshly-constructed instance and returns the
  // established one instead (its own observable fields merged in from
  // this fresh one, but its identity - unobservable.repeater included -
  // completely untouched). A component with no key is never reconciled
  // this way; that's the hardcoded-child-reference style (see
  // cascade.component/src/test/toolbarMainFrame.js), still fully
  // supported as an alternative to build()/keys - calling `super()` with
  // no arguments at all resolves to the exact same "no key, no
  // properties" case this always was.
  constructor(...parameters) {
    const properties = toPropertiesWithChildren(parameters);
    // Captured once, here, exactly like flow.core's own Component - see
    // inherit() below for what it's for. Deliberately *not* a stack push/
    // pop around this constructor itself: flow's own creator is "whoever
    // was executing its own build()/lifecycle callback when `new X()` ran",
    // not "whoever constructed me" in general - see reactiveBuildEquivalent(),
    // the actual push/pop site, and its own comment on why.
    this.creator = getCreator();
    this.key = extractProperty(properties, "key") || null;
    const me = observable(this, this.key);
    me.setProperties(properties);
    // Unconditionally - no attempt to detect a rebuild here. During one,
    // `me` is the established object but its writes are redirected to the
    // throwaway twin (see cascade.reactive's setHandlerObject/forwardTo),
    // and mergeInto() then skips state when copying the twin back - so
    // the gate lives there, in one place, not in every constructor.
    declareState(me, me.initializeState());
    return me;
  }

  // Override to interpret the properties bag resolved above - default is
  // flow.core's own convention, a plain assign (every property becomes an
  // observable field with that exact name). A subclass overriding this
  // can rename/validate/derive fields instead of accepting them verbatim.
  setProperties(properties) {
    Object.assign(this, properties);
  }

  // Override to hand inherit() (below) a different object to check for
  // "do I provide this myself" - default is flow.core's own: this
  // component's own fields directly, so a component "provides" a value
  // for some property just by having a same-named field (see e.g. a
  // ModalFrame-style component setting `this.modalFrame = this;` in its
  // own setProperties() - inherit("modalFrame") then finds it here,
  // before ever walking further up).
  provide() {
    return this;
  }

  // Ported from flow.core's Component.js (inheritUncached there) - walk
  // three separate hierarchies, in this exact order, until one of them
  // provides `property`:
  //
  //  1. This component itself (provide(), above) - the nearest possible
  //     answer always wins, which is what makes a recursive structure
  //     (a frame inside a frame inside a frame) resolve correctly: each
  //     one provides itself, so a lookup starting from deep inside stops
  //     at the *closest* one, never skipping past it to an outer one.
  //  2. equivalentCreator - whoever's build() produced this component
  //     (see reactiveBuildEquivalent() below).
  //  3. renderParent - whoever actually renderOnto()'d this component as
  //     a child (see renderOnto() below) - checked *after*
  //     equivalentCreator, not before, for the same reason flow's own
  //     version does: a component composed via a hardcoded child
  //     reference (never returned from anyone's build()) has no
  //     equivalentCreator at all, so this is what actually reaches it.
  //  4. creator - whoever was executing its own build() (or, once one
  //     exists, another lifecycle callback) when this component was
  //     constructed (see the constructor above) - a fallback for
  //     anything constructed but never actually built or rendered as a
  //     child of anyone (e.g. stored on a field and never returned from
  //     build() at all).
  //
  // No caching layer (flow's own inheritCached/invalidateOnChange) -
  // every read here already goes through cascade's own dependency
  // tracking directly, so a plain, uncached walk is still fully
  // reactive; add caching only if this ever turns out to be a hot path.
  inherit(property) {
    const providedValue = this.provide()[property];
    if (typeof(providedValue) !== "undefined") return providedValue;
    if (this.equivalentCreator) return this.equivalentCreator.inherit(property);
    if (this.renderParent) return this.renderParent.inherit(property);
    if (this.creator) return this.creator.inherit(property);
    return undefined;
  }

  // Override to compose this component from children - the alternative
  // to hardcoding child references as fields (see renderOnto.js's own
  // discussion of both styles). Return a child component (or an array of
  // them), each typically constructed with its own key so cascade can
  // tell across rebuilds which new one corresponds to which established
  // one - see reactiveBuildEquivalent() and the constructor's `key` docs
  // above. Not implemented by default; a component overrides this OR
  // render() (see the default render() below), not both.
  //
  // A keyed child's identity (and state) survives only as long as its own
  // key keeps being constructed, run after run - a key that drops out for
  // even one run is gone for good, not just for that run (see
  // README.md's own "A dropped keyed child is gone forever"). Guard a
  // child's *visibility*, not its construction, with .show(condition) to
  // keep it alive while hidden instead.
  build() {
    throw new Error(this.constructor.name + " must implement build() or render(context)");
  }

  // Build this component's immediate equivalent - one step only, not all
  // the way down (that's expand(), layered on top of this, for a component
  // like FlipAnimationContainer that needs a whole subtree built before
  // placing any of it).
  // One step is what lets build and render interleave at every level
  // instead of needing two separate passes: a parent can build one child,
  // render it, take a real measurement, and only then build/render the
  // next with that measurement already in hand.
  //
  // Wrapped in its own repeater, so a rebuild only happens when this
  // component's own build() inputs actually change, not on every parent
  // rerun - the same reasoning as any other repeater boundary.
  //
  // An *independent* repeater (see cascade.reactive's repeat()
  // {independent: true}): a pipeline of its own at the render's time
  // level, not a child of the render repeater that calls this. So none of
  // a render pipeline's own operations (partial chain, reconciliation,
  // scheduling) ever have to visit build repeaters. The two are parallel
  // pipelines (see compareWritingToReader() in cascade.reactive): build()
  // reads the latest value of anything render writes - fine, since what
  // flows from render to build (the render context, its target, its
  // service locator) is timeless - and render reads the build's latest
  // result.
  //
  // One build repeater per component, for the component's whole life -
  // never replaced, and never retracted just because the component isn't
  // being rendered for a while (hidden behind a page switch, say). It holds
  // which object each build key belongs to; a fresh one would have an empty
  // map, and every keyed child - with its state - would be constructed anew
  // the next time it's built. While the component isn't rendered, its build
  // repeater is simply left invalid if its inputs change (nothing is
  // pulling it - see scheduleThroughPuller()), and revalidated, keys intact,
  // when the render comes back and pulls it. Only a component dropped for
  // good has its build repeater stopped (see onDispose()).
  //
  // The result is stashed on `this.newBuild` - an ordinary *observable*
  // property (matching flow.core's own naming), not something on
  // `unobservable`: buildRepeater is the sole writer and render() the
  // reader, so a rebuild invalidates render() through that ordinary
  // dependency.
  reactiveBuildEquivalent() {
    const u = this.unobservable;
    u.pullingComponent = getRenderParent();
    // First time only: a repeat() call's first pass runs synchronously,
    // right here, which is what this method's caller needs - it uses the
    // result immediately. Its properties first, as for every later build
    // (see refreshCreatorBuild()): shown somewhere else, before its creator
    // (a page's buttons in a portal), a component can be built for the
    // first time just after its creator's build was invalidated - its
    // properties retracted with it.
    if (!u.buildRepeater) {
      this.refreshCreatorBuild();
      u.buildRepeater = repeat(() => {
        // Pushed/popped around build() specifically (not this whole
        // method, and not the constructor - see inherit()'s own comment
        // on creator) - matches flow.core's own creator-stack push site
        // exactly: a component constructed directly inside another's
        // build() call captures that component as its creator.
        creators.push(this);
        try {
          this.newBuild = this.build();
        } finally {
          // Same reasoning as renderStack's own push/pop in renderOnto()
          // below - `creators` is a single, module-level stack shared by
          // every component in the process, so a build() that throws
          // without this would leave a stale entry on it, corrupting
          // inherit()'s own creator walk for every component built
          // afterward.
          creators.pop();
        }
        assignEquivalentCreator(this.newBuild, this);
      }, {
        independent: true,
        // Only ever run when this component's render repeater pulls it
        // (refreshIfNeeded() below): invalidating it invalidates the render
        // repeater instead. So it's always rebuilt before anything rendered
        // from what it built - never read back mid-rebuild, with the
        // properties it wrote already retracted. See cascade.reactive's
        // scheduleThroughPuller(). Normally that's this component's own render
        // repeater; a component that's never rendered itself but expanded
        // by another (see expand()) is pulled by whoever is
        // expanding it - the component rendering when it was pulled.
        pulledBy: () => u.repeater || (u.pullingComponent && u.pullingComponent.unobservable.repeater),
      });
    } else {
      // Pull, don't wait: if the build is pending (its inputs changed, or
      // it was flagged), run it now - pushed onto the context stack above
      // this render, returning here with a fresh result - rather than
      // whenever the scheduler reaches its pipeline. The caller uses
      // `this.newBuild` immediately (e.g. a component that measures, writes
      // an input, then builds/renders off the result, all synchronously in
      // tree order - see cascade.application/demo's ApplicationMenuFrame).
      //
      // The build's refresh() completing synchronously here is also what
      // keeps reconciliation correct for whatever build() constructs, not
      // just the value returned: reconciling a keyed child
      // (observable(target, buildId)) points the *established* object's
      // forwardTo at the freshly-constructed, about-to-be-discarded one
      // until finishRebuilding() clears it at the end of that refresh.
      // Rendering the result before then would read the throwaway twin's
      // own empty unobservable bag, find no repeater there, and create a
      // redundant one instead of relinking the real one.
      //
      // Retracted only if this component was once dropped (onDispose()) and
      // is being rendered again anyway (someone kept a reference to it):
      // restart it rather than replace it, keeping its key map.
      if (u.buildRepeater.retracted) u.buildRepeater.restart();
      this.refreshCreatorBuild();
      refreshIfNeeded(u.buildRepeater);
    }
    return this.newBuild;
  }

  // A component's properties are written by its creator's build (the one
  // that constructed it) - and an invalidated build's writings are
  // retracted at once, until it reruns (see cascade.reactive's dispose()).
  // So before building, bring the creator's build up to date: otherwise a
  // component rendered *before* its creator's build reruns reads its
  // properties as undefined. Normally the order takes care of itself - a
  // component is rendered by its creator's own subtree, after the creator
  // has built - but not for one shown somewhere else, earlier in the tree:
  // a page's buttons in a top-bar portal, or a dialog in an overlay, when
  // a theme switch invalidates the page and them alike. Recursive - the
  // creator's own properties come from its creator. A creator whose build
  // is up to date, retracted, or running right now (it's the one pulling)
  // is left as it is.
  refreshCreatorBuild() {
    const creator = this.creator;
    if (!creator) return;
    const creatorBuild = creator.unobservable.buildRepeater;
    if (!creatorBuild || creatorBuild.retracted) return;
    creator.refreshCreatorBuild();
    refreshIfNeeded(creatorBuild);
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
  // see cascade.DOM's DOMNodeRenderComponent-based demos for exactly that.
  render(context) {
    const equivalent = this.reactiveBuildEquivalent();
    const children = equivalent instanceof Array ? equivalent : [equivalent];
    for (const child of children) {
      // null/undefined/false - typically another component's own
      // show(false) result (see that method's own doc) - simply isn't
      // renderOnto()'d this pass, same as build() no longer returning it
      // at all.
      if (child === null || typeof(child) === "undefined" || child === false) continue;
      child.renderOnto(context);
    }
  }

  // Give this component its place in the tree - the render context it's
  // rendered with, and who rendered it - without rendering it. renderOnto()
  // does this first, every time; a component that places others itself,
  // without calling their render() (see cascade.dom's
  // FlipAnimationContainer, which expands its subtree with
  // expand() below), does it instead - so builds find their
  // services (a theme, a platform - see ServiceLocator.js) and inherit()
  // walks the same hierarchy either way.
  //
  //  - renderParent: see inherit()'s own comment on why this (not
  //    equivalentCreator) is the one that actually, reliably reaches a
  //    hardcoded-child-reference component.
  //  - this.renderContext: readable from build() too (a plain property read,
  //    so build()'s own zero-argument signature never has to change). Set
  //    fresh on every call, relink included, so it always reflects the most
  //    recent context - matches RenderContext's own stable-identity-across-
  //    reruns requirement (see RenderContext.js), since a parent that wants
  //    its children to see a changed value mutates its cached instance in
  //    place rather than handing down a new one.
  //  - unobservable.renderContext: the same value again, as plain
  //    bookkeeping - what the render repeater renders against, and what
  //    service lookups read. Not this.renderContext itself: that's an
  //    observable property, written from the *parent's* partial, so a
  //    parent rerun's own dispose() retires that writing - and a child whose
  //    own rerun was already queued can run before the parent gets as far
  //    as writing it again, reading it back as undefined (the documented
  //    "property written at construction, unlinked by the parent's next
  //    dispose()" race - see cascade.reactive/docs/plan-flagged-scheduling.md).
  //    An unobservable field has neither problem: never retired, never a
  //    dependency, always whatever was most recently handed in.
  provideContext(context, renderParent) {
    this.renderParent = renderParent;
    this.renderContext = context;
    this.unobservable.renderContext = context;
  }

  // Whether this component can be expanded - composed purely through
  // build(), rendered by the default render() below, so building it is all
  // there is to it. A component that overrides render() does its own work
  // there (measuring, placing things itself, ...) and can only be rendered -
  // see expand().
  isExpandable() {
    return this.render === Component.prototype.render;
  }

  // Build this component not just one step (reactiveBuildEquivalent()) but
  // as far down as the caller wants: through whatever it builds, and
  // whatever that builds, until each component left is either a leaf -
  // whatever `isLeaf(component)` says it is - or can't be expanded (see
  // isExpandable()), which a caller then has to treat as opaque and render
  // normally. What counts as a leaf is the caller's business, not the
  // component's: it only means something to a particular consumer on a
  // particular platform (cascade.dom's FlipAnimationContainer stops at
  // components that can hand over their own DOM node, say). Every
  // component on the way is given its place in the tree first
  // (provideContext()), exactly as rendering it would have, so builds find
  // the same services either way. Returns a flat list: a build may return
  // several components (or none).
  //
  // Only this chain is expanded - a leaf's own children (a DOM element's,
  // say) are the caller's business too, since only it knows what they are.
  //
  // `visited`, when given, is a Set every component on the way is added
  // to - the leaves and everything in between - for a caller that needs to
  // know what it placed (to call onShow()/onHide() for them, say).
  expand(context, renderParent, isLeaf = () => false, visited = null) {
    this.provideContext(context, renderParent);
    if (visited) visited.add(this);
    if (isLeaf(this) || !this.isExpandable()) return [this];
    const built = this.reactiveBuildEquivalent();
    const children = built instanceof Array ? built : [built];
    const result = [];
    for (const child of children) {
      if (child === null || typeof(child) === "undefined" || child === false) continue;
      result.push(...child.expand(context, this, isLeaf, visited));
    }
    return result;
  }

  renderOnto(context) {
    const u = this.unobservable;
    // Captured synchronously, right here - correct regardless of whether
    // render() itself ends up running synchronously below or is deferred
    // (see the restart() call further down): this parent/child relationship
    // doesn't change just because the actual execution is scheduled for
    // slightly later. Unconditional, so no component can forget to record
    // its context or reach it via the wrong hook.
    const contextChanged = u.renderContext !== context;
    this.provideContext(context, getRenderParent());
    if (u.repeater) {
      // A repeater that was genuinely retracted (not renderOnto()'d some
      // prior run) stays fully intact and re-linkable - see
      // docs/plan-partial-repeaters.md - but relinking never re-executes
      // render(), so nothing else will redo whatever onRetract() undid.
      const wasRetracted = u.repeater.retracted;
      linkRepeater(u.repeater);
      if (wasRetracted) {
        // onReattach() is one missing half - the one moment to redo
        // whatever onRetract() undid, caught here before the retracted
        // flag itself gets cleared by the relink above.
        this.onReattach(context);
        // The other half: retraction clears this component's own read
        // dependencies entirely (removeAllSources, as part of the same
        // retraction that called onRetract()). Anything it used to depend
        // on could easily have changed while it wasn't watching - "just
        // relink, assume nothing changed" is only valid for a repeater
        // that was never actually retracted in between. So force a real
        // rerun rather than trust stale results computed against
        // whatever those dependencies happened to be last time.
        //
        // And run it right here, at its place in the tree, as a first
        // render would - not whenever the scheduler gets to it. Deferred,
        // this parent would go on rendering the children after it first:
        // they'd position themselves (target.lastChild) before this one
        // has, and its own position, recorded later, out of order, isn't
        // where they read it the next time they rerun on their own - a
        // shown-again button ending up after its sibling. (linkRepeater()
        // handles a flagged child the same way, on the spot.)
        u.repeater.restart();
        refreshIfNeeded(u.repeater);
      } else if (contextChanged) {
        // Not retracted - reclaimed by the same parent at the same
        // position - but handed a genuinely different context object
        // (a parent that owns two targets moving a child between them,
        // say). A clean relink never re-executes render(), so nothing
        // else would ever render this component against the new context
        // - its element would simply stay under the old target. Same
        // treatment as reattachment, minus onReattach(): the element was
        // never removed, and renderElement()'s own reattachElement() on
        // the new target is what moves it. The common case - the same
        // cached context object every time, per RenderContext's own
        // stable-identity rule - stays the free no-op it always was. Run
        // right here too, in tree order, as above.
        u.repeater.restart();
        refreshIfNeeded(u.repeater);
      }
    } else {
      // renderStack push/pop lives *inside* this callback, not wrapped
      // around the renderOnto() call above - the callback is what
      // actually runs render(), every time it runs, whether that's this
      // very first, synchronous pass or a later rerun (restart(), or an
      // ordinary reactive invalidation) that the scheduler may or may
      // not defer. Wrapping the outer call instead would pop this
      // component back off the stack before a deferred rerun ever
      // reaches it, leaving any child renderOnto()'d during that rerun
      // looking at whatever unrelated component happens to be on top at
      // that later moment.
      u.repeater = repeat(() => {
        renderStack.push(this);
        try {
          // this.renderContext, not the `context` argument this closure
          // was created with: that argument is whatever the *first*
          // renderOnto() call passed, forever. A component retracted and
          // later renderOnto()'d under a different parent (a dialog moving
          // between a docked slot and a modal overlay, say - see
          // cascade.application/demo's HybridModalDialog) is relinked and
          // restart()ed above with the new context, but this callback is
          // what restart() actually reruns - rendering against the stale
          // captured context put its fresh elements back under the old
          // parent's target. renderOnto() sets u.renderContext fresh on
          // every call, so it always names the current one - and see its
          // own comment there on why the unobservable copy rather than the
          // observable this.renderContext.
          this.render(u.renderContext);
        } finally {
          // Must run even if render() throws - renderStack is a single,
          // module-level stack shared by every component in the process,
          // not scoped to this repeater or this world, so a render() that
          // throws without this would leave a stale entry on it forever,
          // corrupting getRenderParent() for every component rendered
          // afterward, in any test or any part of the app, for the rest of
          // the process. Found via a DOMNodeComponent test that
          // deliberately throws from render() (see
          // cascade.DOM/src/test/domNodeComponent.js) to check its own
          // build()-result guard - that alone was enough to break unrelated
          // later tests in the same run.
          renderStack.pop();
        }
      }, { onRetract: () => this.onRetract() });
      this.onShow();
    }
  }

  // Override: called each time this component's repeater is genuinely
  // retracted - simply not renderOnto()'d some run (see the
  // retract/reconcile discussion in docs/plan-partial-repeaters.md,
  // cascade.reactive). Undo the rendering's own side effects the reactive
  // system has no visibility into - see cascade.DOM's DOMNodeRenderComponent
  // for the concrete case (removing its own element). Calls onHide() by
  // default - an override calls super.onRetract() to keep that. If it's
  // later renderOnto()'d again, retraction being fully reversible is
  // exactly the point (see onReattach() below) - this can fire more than
  // once over a component's lifetime.
  onRetract() {
    this.onHide();
  }

  // Override: the other half of onRetract() - called when this component
  // is renderOnto()'d again after having been retracted, right as it's
  // relinked (never on an ordinary rerun or a first-ever render). Redo
  // whatever onRetract() undid - see cascade.DOM's DOMNodeRenderComponent, which
  // re-inserts its own element (removed by onRetract()) since relinking
  // itself never re-executes render() to do it another way. Calls onShow()
  // by default - an override calls super.onReattach() to keep that.
  onReattach(context) {
    this.onShow();
  }

  // Override: this component is shown now - first rendered, rendered again
  // after being hidden, or placed by a component that places its subtree
  // itself (cascade.DOM's FlipAnimationContainer, which calls this
  // directly). onHide() is the other half: no longer shown - hidden, its
  // page switched away from, dropped. Unlike onRetract()/onReattach(),
  // these are only notifications, with no rendering mechanics attached, so
  // whoever places a component can make them for it - Flow's isVisible,
  // as two events. For whatever a component does only while it's visible:
  // cascade.ui's PortalContents shows its contents in its portal. Called
  // from inside whoever is rendering - reads here are recorded against
  // that render unless wrapped in withoutRecording(). No-ops by default.
  onShow() {}

  onHide() {}

  // Called by cascade.reactive (see finishRebuilding()) when this
  // component's build identity is gone: whoever's build() constructed it
  // with a key has rerun without constructing that key again, so this
  // component is dropped from the tree for good. Retract its own repeater
  // right here (cascading to its buildRepeater and everything rendered
  // underneath) rather than waiting for whatever renders it to rerun and
  // notice it wasn't relinked - that can come *after* a stale rerun of
  // this component, already queued by the very disposal that dropped it,
  // gets processed against properties that disposal has since unlinked
  // (see cascade.reactive's retractRepeater() for the full shape). A
  // subclass overriding this for its own cleanup must call super.onDispose().
  onDispose() {
    const u = this.unobservable;
    if (u.repeater) retractRepeater(u.repeater);
    // Gone for good (unlike a component that's merely not rendered for a
    // while - see reactiveBuildEquivalent()), so its build stops for good
    // too, instead of staying subscribed to whatever it read.
    if (u.buildRepeater) retractRepeater(u.buildRepeater);
  }

  // Ported from flow.core's Component.js verbatim - a conditional-
  // inclusion helper for a build() result: `parent(a, b.show(cond), c)`
  // includes `b` only if `cond` is true, `null` (dropped - see the
  // default render()'s own `equivalent instanceof Array` handling, and
  // implicitProperties.js's own null/undefined-skipping) otherwise. Not
  // to be confused with a component-specific "showing" concept some
  // subclass might define on itself (see cascade.ui's own Overlay,
  // which - like everything else here - inherits this too, but under a
  // different, narrower name for its own thing, precisely to avoid
  // colliding with this one).
  show(value) {
    return value ? this : null;
  }

  // Ported from flow.core's Component.js verbatim (getComponentTypeName()/
  // toString()) - a debug identity string, "ClassName:id(key)": `id` is
  // `this.causality.id` (see cascade.reactive's own observable(), the
  // same auto-incrementing counter every observable object gets, so this
  // is unique across the whole app, not just within one component type),
  // `key` is this component's own build identity if it has one. See
  // aggregateToString() below for what actually uses this.
  getComponentTypeName() {
    let result;
    withoutRecording(() => {
      result = this.componentTypeName ? this.componentTypeName : this.constructor.name;
    });
    return result;
  }

  toString() {
    // withoutRecording() - matching flow.core's own Component.js exactly:
    // this is a pure debug read, called from arbitrary places (here, from
    // the middle of another component's own render(), via
    // aggregateToString() below) that must never leave behind a reactive
    // dependency of its own - `key`/`componentTypeName` aren't meant to
    // invalidate whoever merely asked this component to describe itself.
    let result;
    withoutRecording(() => {
      result = this.getComponentTypeName() + ":" + this.causality.id + (this.key ? "(" + this.key + ")" : "");
    });
    return result;
  }
}

// Ported from flow.DOM's own DOMNode.js (aggregateToString()) - walks
// equivalentCreator (whoever's build() produced this component - see
// reactiveBuildEquivalent() above) from `component` up to the root,
// joining each one's own toString() with " | ". cascade.DOM writes this
// onto a freshly-created real element's own `id` attribute (see
// DOMElementNode.js) - unconditionally, no debug-mode flag, matching
// flow's own choice: open DevTools, click an element, read its id, and
// you have exactly which component (and which component built it, and
// which built *that*, ...) produced it, matched straight against the
// source - the same round-trip flow's own version gives for free.
export function aggregateToString(component) {
  const parts = [];
  withoutRecording(() => {
    let scan = component;
    while (scan) {
      parts.unshift(scan.toString());
      scan = scan.equivalentCreator;
    }
  });
  return parts.join(" | ");
}

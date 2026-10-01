import { observable, repeat, linkRepeater, accessInitialValues, declareState, retractRepeater, refreshIfNeeded, withoutRecording, establish as establishObject, dispose as disposeObject } from "./Cascade.js";
import { toPropertiesWithChildren, extractProperty } from "./implicitProperties.js";
import { RenderContext } from "./RenderContext.js";

/**
 * Two separate stacks, both ported from flow.core's Component.js
 * (`creators`, plus the render-time half its own DOMNode/PrimitiveComponent
 * machinery tracked as `renderParent`): whose build() is running (what a
 * component constructed right now is created by, and which render context
 * a service is looked up in - see ServiceLocator.js), and whose render() is
 * (what a component rendered right now is placed by). Module-level, not on `state`: nothing
 * outside this file ever needs to read either stack directly, only
 * whichever single component happens to be on top when a constructor or
 * renderOnto() call is in progress - see getCreator()/getRenderParent().
 */
const creators = [];
export function getCreator() {
  return creators.length > 0 ? creators[creators.length - 1] : null;
}

// What Component itself keeps in `unobservable` (and callback() in its
// creator's) - not to be used by a subclass's initialUnobservables().
const reservedUnobservables = new Set([
  "repeater", "buildRepeater", "pullingComponent", "renderTarget", "renderContext", "renderParent",
  "ownContext", "childContext", "renderTimeless", "callbacks", "callbackBuild", "hydratedInBuild", "hydrated",
]);

const renderStack = [];
function getRenderParent() {
  return renderStack.length > 0 ? renderStack[renderStack.length - 1] : null;
}

// repeat(), for one of a component's own repeaters (its build, its render),
// whose first run happens right here: if that run throws, the repeater
// repeat() made before running it is retracted, not left behind -
// subscribed to whatever the run read, rerunning on its own once that
// changes, while the component, never handed it, makes another next time
// (writing the same properties from another pipeline). The same as
// RenderContext's inherit() does for its lookups.
function startRepeater(action, options) {
  let started = null;
  try {
    return repeat((repeater) => {
      started = repeater;
      return action(repeater);
    }, options);
  } catch (error) {
    if (started) retractRepeater(started);
    throw error;
  }
}

// Ties what a build() returned - its roots - back to the component whose
// build returned them: `equivalentCreator`. Only the roots: an element
// deeper inside is part of what its root renders, not a stand-in for the
// component. Not the same as `creator` (whose build was running when a
// component was constructed): content one component constructs and
// another's build returns (a portal's contents, returned by its scope) is
// the root of the second one's build, not of the first's. What reads it:
// aggregateToString() below, for the debug ids on real elements - an id
// names every component an element stands in for. `built` is whatever
// build() returned - a single component, an array of them, or
// null/undefined (nothing to tie back).
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
  // portal this one owns, its portalSource - see
  // cascade.component/README.md on creating a sub-component directly, in
  // initialization) has its properties as baseline values, not as the
  // writings of whichever repeater happened to touch this first - retracted
  // with it the moment that repeater is (a page hidden), and never
  // rewritten, since nothing constructs it again.
  get unobservable() {
    if (!this.causality.unobservable) {
      const own = accessInitialValues(() => this.initialUnobservables());
      for (const name in own) {
        if (reservedUnobservables.has(name)) {
          throw new Error(this.constructor.name + ".initialUnobservables(): \"" + name + "\" is a name Component keeps its own bookkeeping under - use another.");
        }
      }
      this.causality.unobservable = Object.assign({ repeater: null }, own);
    }
    return this.causality.unobservable;
  }

  // Override to seed additional non-observable bookkeeping fields (render
  // counters, cached measurements, ...) - anything that must survive a
  // rerun without itself being reactive. A plain observable property
  // doesn't work for this: a fresh read of it can fall through once
  // retraction is involved, even though the component's own identity
  // hasn't changed.
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
  initialState() {
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
        throw new Error("setState(): '" + key + "' is not a state property of this component - declare it in initialState().");
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
  // build()/buildOneStep() below. It's cascade.reactive's own
  // observable(target, buildId) mechanism (already fully built - see
  // cascade.reactive/src/test/rebuild.js): constructing a component with a
  // key that matches one from the enclosing repeater's *previous* run
  // discards this freshly-constructed instance and returns the
  // established one instead (its own observable fields merged in from
  // this fresh one, but its identity - unobservable.repeater included -
  // completely untouched). A component with no key constructed in a
  // build() is reconciled too, by pattern matching instead - the same
  // class in the same place (see buildOneStep()'s
  // rebuildShapeAnalysis, and README.md's "Keys and pattern matching").
  // Outside any build (the hardcoded-child-reference style - see
  // cascade.component/src/test/toolbarMainFrame.js) there's nothing to
  // reconcile with: calling `super()` with no arguments at all is the
  // same "no key, no properties" case it always was.
  constructor(...parameters) {
    const properties = toPropertiesWithChildren(parameters);
    // Captured once, here, exactly like flow.core's own Component - see
    // inherit() below for what it's for. Deliberately *not* a stack push/
    // pop around this constructor itself: flow's own creator is "whoever
    // was executing its own build()/lifecycle callback when `new X()` ran",
    // not "whoever constructed me" in general - see buildOneStep(),
    // the actual push/pop site, and its own comment on why.
    this.creator = getCreator();
    this.key = extractProperty(properties, "key") || null;
    const me = observable(this, this.key);
    me.setProperties(properties);
    // Unconditionally - no attempt to detect a rebuild here. During one,
    // `me` is the established object but its writes are redirected to the
    // throwaway twin (see cascade.reactive's setHandlerObject/rebuildTwin),
    // and mergeInto() then skips state when copying the twin back - so
    // the gate lives there, in one place, not in every constructor.
    declareState(me, me.initialState());
    return me;
  }

  // Override to interpret the properties bag resolved above - default is
  // flow.core's own convention, a plain assign (every property becomes an
  // observable field with that exact name). A subclass overriding this
  // can rename/validate/derive fields instead of accepting them verbatim.
  setProperties(properties) {
    Object.assign(this, properties);
  }

  // Override to provide something to this component's subtree: return an
  // object whose fields are what's provided - plain values, getters (read
  // afresh at every lookup, so a getter over this component's own
  // properties follows them), or an observable object's fields. Its
  // subtree then finds each by name with inherit() (below). Called once,
  // when this component first enters the tree - its result is this
  // component's own render context (see RenderContext.js, and enterTree()
  // below), kept for its whole life: whether it provides, and what object
  // it provides, never changes; what that object holds may.
  //
  // Null - the default - provides nothing: no context of its own, and its
  // children are given the context this component was given itself. Never
  // the component itself: a component and its context are kept apart, so
  // nothing it merely has (a style, a label) is ever inherited by accident.
  provide() {
    return null;
  }

  // The nearest value of `name` provided above this component - found in
  // the render context it was given (see RenderContext.js): by whatever
  // provided it closest above where this component is placed. Never what
  // this component provides itself - that's for its children: a frame
  // inside a frame finds the outer one. Undefined if nothing does.
  //
  // Only once it has entered the tree (rendered, or expanded by a
  // container placing its subtree itself) - before that, it has no place
  // to inherit from at all. A tracked read, from build() or anywhere else:
  // placed somewhere else, a component that inherited something follows.
  inherit(name) {
    const context = this.renderContext;
    if (!context) {
      throw new Error(this.toString() + ".inherit(\"" + name + "\"): not in the tree yet - a component inherits from where it's placed, once it's rendered.");
    }
    return context.inherit(name);
  }

  // Override to compose this component from children - the alternative
  // to hardcoding child references as fields (see renderOnto.js's own
  // discussion of both styles). Return a child component (or an array of
  // them). Across rebuilds, each new one is matched to the established
  // one it corresponds to - by pattern (the same class in the same place),
  // or by key, for what can move, appear or disappear (see README.md,
  // "Keys and pattern matching", and buildOneStep()). Not implemented by default; a component overrides this OR
  // render() (see the default render() below), not both.
  //
  // A keyed child's identity (and state) survives only as long as its own
  // key keeps being constructed, run after run - a key that drops out for
  // even one run is gone for good, not just for that run (see
  // README.md's own "A dropped keyed child is gone forever"). Guard a
  // child's *visibility*, not its construction, with .showIf(condition) to
  // keep it alive while hidden instead.
  build() {
    throw new Error(this.constructor.name + " must implement build() or render(target, context)");
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
  // The result is stashed on `this.currentBuild` - an ordinary *observable*
  // property (matching flow.core's own naming), not something on
  // `unobservable`: buildRepeater is the sole writer and render() the
  // reader, so a rebuild invalidates render() through that ordinary
  // dependency.
  buildOneStep() {
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
      u.buildRepeater = startRepeater(() => {
        // Pushed/popped around build() specifically (not this whole
        // method, and not the constructor - see inherit()'s own comment
        // on creator) - matches flow.core's own creator-stack push site
        // exactly: a component constructed directly inside another's
        // build() call captures that component as its creator.
        creators.push(this);
        const u = this.unobservable;
        u.callbackBuild = (u.callbackBuild || 0) + 1;
        try {
          this.currentBuild = this.build();
          // Named callbacks this build no longer made are dropped (see
          // callback.js) - a list's per-item callbacks don't pile up.
          if (u.callbacks) {
            for (const [key, stable] of u.callbacks) {
              if (stable.build !== u.callbackBuild) u.callbacks.delete(key);
            }
          }
        } finally {
          // Same reasoning as renderStack's own push/pop in renderOnto()
          // below - `creators` is a single, module-level stack shared by
          // every component in the process, so a build() that throws
          // without this would leave a stale entry on it, corrupting
          // the creator of every component built
          // afterward.
          creators.pop();
        }
        assignEquivalentCreator(this.currentBuild, this);
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
        // Whoever pulled it *last*: rendered, that's this component itself
        // (it's on top of the render stack in its own render()); expanded,
        // the container. Not its own repeater first - a component rendered
        // for a while and then expanded again (a form in a plain column,
        // then in a FlipAnimationContainer again when animation is switched
        // back on) still has one, retracted, which would leave every
        // rebuild pending for good.
        pulledBy: () => (u.pullingComponent && u.pullingComponent.unobservable.repeater) || u.repeater,
        // Pattern matching (ported from flow.core's getShapeAnalysis()):
        // what a rebuild constructs without a key is matched to what the
        // previous build constructed in the same place - the same class
        // (and, for a DOM element, the same tag) - and keeps its identity,
        // its state and its DOM, just as a key would have kept them. So
        // static structure needs no keys; what can move, appear or
        // disappear among its siblings does. See cascade.reactive's
        // "Rebuild shape analysis" for how.
        rebuildShapeAnalysis: {
          shapeRoot: () => this.currentBuild,
          signature: (object) => (typeof(object.tagName) === "string" ? object.tagName.toLowerCase() : null),
          // The build, with every matched component replaced by the
          // established one it was matched to.
          setShapeRoot: (root) => { this.currentBuild = root; },
        },
      });
    } else {
      // Pull, don't wait: if the build is pending (its inputs changed, or
      // it was flagged), run it now - pushed onto the context stack above
      // this render, returning here with a fresh result - rather than
      // whenever the scheduler reaches its pipeline. The caller uses
      // `this.currentBuild` immediately (e.g. a component that measures, writes
      // an input, then builds/renders off the result, all synchronously in
      // tree order - see cascade.application/demo's ApplicationMenuFrame).
      //
      // The build's refresh() completing synchronously here is also what
      // keeps reconciliation correct for whatever build() constructs, not
      // just the value returned: reconciling a keyed child
      // (observable(target, buildId)) points the *established* object's
      // rebuildTwin at the freshly-constructed, about-to-be-discarded one
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
    return this.currentBuild;
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

  // Override: do this component's own real-time work against `target` -
  // reading/writing it (placing its own node on it, say), and rendering any
  // children onto it (or onto a target of its own - its own element, for
  // its children) via their own renderOnto(target, context). `target` is
  // opaque to this base class - cascade.dom's is a DOMElementTarget, but
  // nothing here requires a shape: it's whatever the platform renders onto,
  // and everything temporal (what's been placed on it so far this pass)
  // lives there. `context` is what its children are to be rendered with:
  // this component's own render context if it provides something (see
  // provide()), the one it was given otherwise - so passing it on is all a
  // render() has to do with it. (What this component itself inherits is
  // read through inherit() - from the context it was given.)
  //
  // Default implementation: build one step (see buildOneStep()
  // above) and renderOnto() each resulting child in turn, in order - the
  // build()-based composition style. Override render() directly instead
  // (skipping build() entirely) for the hardcoded-child-reference style,
  // or to interleave custom work (measurement, etc.) between children -
  // see cascade.DOM's DOMNodeComponent-based demos for exactly that.
  render(target, context) {
    const equivalent = this.buildOneStep();
    const children = equivalent instanceof Array ? equivalent : [equivalent];
    for (const child of children) {
      // null/undefined/false - typically another component's own
      // showIf(false) result (see that method's own doc) - simply isn't
      // renderOnto()'d this pass, same as build() no longer returning it
      // at all.
      if (child === null || typeof(child) === "undefined" || child === false) continue;
      child.renderOnto(target, context);
    }
  }

  // Override to enter the tree with another context than the one given -
  // for what is placed somewhere other than where it comes from: a portal's
  // contents, rendered on the portal's target but with the context of
  // where they were put into it (see ContextScope below, and cascade.ui's
  // Portal/OverlayFrame). Read when entering, so a change of what it
  // returns places the component again. Default: the context given.
  enteredContext(given) {
    return given;
  }

  // Entering the tree - the one step every component goes through at its
  // place in it, whether it's rendered (renderOnto()) or placed by a
  // container that expands its subtree itself (expand() - cascade.dom's
  // FlipAnimationContainer), so the two can never differ in what a
  // component gets:
  //
  //  - its target, kept as plain bookkeeping (unobservable.renderTarget):
  //    what the render repeater renders onto. Never readable reactively -
  //    a build has no business with the target, which is temporal.
  //  - the target's timeless side, if it has one (`target.timeless` - see
  //    fromTarget()): what a build may read of where it's placed. Written
  //    at the baseline, and only when it changes, like the context.
  //  - its context (this.renderContext): what it inherits from (see
  //    inherit()), readable from build(). Written at the baseline
  //    (accessInitialValues()), and only when it changes: a context is
  //    non-temporal, so the latest writing is always the right one, and a
  //    baseline writing is never retired by a parent's rerun - read back
  //    undefined by a child whose own rerun was already queued, as an
  //    ordinary writing from the parent's partial would be.
  //  - who placed it (unobservable.renderParent).
  //  - its own context, for its children, if it provides anything (see
  //    provide()): created the first time, and kept - only its parent link
  //    is re-pointed when it's placed under another context (a provider
  //    removed upstream, say), at the baseline too. Returned: the context
  //    its children are to be given - its own, or the one it was given.
  //
  // Visibility (onShow()/onHide()) is told by whoever places it: rendering
  // does (see renderOnto()/onRetract()), a placing container does (see
  // cascade.dom's DOMPlacingContainer.notifyPlaced()) - after this step, so
  // what it does when shown can already inherit.
  enterTree(target, context, renderParent) {
    const u = this.unobservable;
    context = this.enteredContext(context);
    u.renderTarget = target;
    u.renderParent = renderParent;
    const timeless = (target && withoutRecording(() => target.timeless)) || null;
    if (u.renderTimeless !== timeless) {
      u.renderTimeless = timeless;
      accessInitialValues(() => { this.renderTimeless = timeless; });
    }
    if (u.renderContext !== context) {
      u.renderContext = context;
      accessInitialValues(() => { this.renderContext = context; });
    }
    if (typeof(u.ownContext) === "undefined") {
      const provided = withoutRecording(() => this.provide());
      u.ownContext = provided ? new RenderContext(provided, context) : null;
    } else if (u.ownContext && withoutRecording(() => u.ownContext.parent) !== context) {
      accessInitialValues(() => { u.ownContext.parent = context; });
    }
    u.childContext = u.ownContext || context;
    return u.childContext;
  }

  // A timeless property of the target this component is placed on - the
  // one thing of the target a build may read. A target is temporal (what's
  // been placed on it so far this pass - see render()), but it may also
  // hold values with one value per pass about where things are placed, on
  // an object of their own: `target.timeless`. cascade.dom's
  // DOMElementTarget does, for an element whose size is measured - its
  // layout size, as `width`/`height` (see its observeBounds()). Undefined
  // if the target has no such property: placed somewhere that isn't
  // measured, say. A tracked read, from build() or anywhere else: placed
  // on another target, or the value changing, a build follows.
  fromTarget(name) {
    const timeless = this.renderTimeless;
    return timeless ? timeless[name] : undefined;
  }

  // Whether this component can be expanded - composed purely through
  // build(), rendered by the default render() below, so building it is all
  // there is to it. A component that overrides render() does its own work
  // there (measuring, placing things itself, ...) and can only be rendered -
  // see expand().
  isExpandable() {
    return this.render === Component.prototype.render;
  }

  // Build this component not just one step (buildOneStep()) but
  // as far down as the caller wants: through whatever it builds, and
  // whatever that builds, until each component left is either a leaf -
  // whatever `isLeaf(component)` says it is - or can't be expanded (see
  // isExpandable()), which a caller then has to treat as opaque and render
  // normally. What counts as a leaf is the caller's business, not the
  // component's: it only means something to a particular consumer on a
  // particular platform (cascade.dom's FlipAnimationContainer stops at
  // components that can hand over their own DOM node, say). Every
  // component on the way enters the tree first (enterTree()), exactly as
  // rendering it would have, so builds find the same context either way.
  // Returns a flat list: a build may return several components (or none).
  //
  // Only this chain is expanded - a leaf's own children (a DOM element's,
  // say) are the caller's business too, since only it knows what they are:
  // they're given the leaf's unobservable.childContext.
  //
  // `visited`, when given, is a Set every component on the way is added
  // to - the leaves and everything in between - for a caller that needs to
  // know what it placed (to call onShow()/onHide() for them, say).
  expand(target, context, renderParent, isLeaf = () => false, visited = null) {
    const childContext = this.enterTree(target, context, renderParent);
    if (visited) visited.add(this);
    if (isLeaf(this) || !this.isExpandable()) return [this];
    const built = this.buildOneStep();
    const children = built instanceof Array ? built : [built];
    const result = [];
    for (const child of children) {
      if (child === null || typeof(child) === "undefined" || child === false) continue;
      result.push(...child.expand(target, childContext, this, isLeaf, visited));
    }
    return result;
  }

  // Render this component onto `target` (see render()), with `context` -
  // what it inherits from (see RenderContext.js). Something rendered on
  // its own, at the root, can leave the context out: it then inherits
  // nothing.
  renderOnto(target, context = RenderContext.empty) {
    const u = this.unobservable;
    // Captured synchronously, right here - correct regardless of whether
    // render() itself ends up running synchronously below or is deferred
    // (see the restart() call further down): this parent/child relationship
    // doesn't change just because the actual execution is scheduled for
    // slightly later. Unconditional, so no component can forget to record
    // its place or reach it via the wrong hook.
    const previousTarget = u.renderTarget;
    const previousContext = u.renderContext;
    this.enterTree(target, context, getRenderParent());
    const placementChanged = u.renderTarget !== previousTarget || u.renderContext !== previousContext;
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
        this.onReattach(target);
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
      } else if (placementChanged) {
        // Not retracted - reclaimed by the same parent at the same
        // position - but handed a genuinely different target or context
        // (a parent that owns two targets moving a child between them,
        // say, or a provider upstream gone). A clean relink never
        // re-executes render(), so nothing else would ever render this
        // component in its new place - its element would simply stay
        // under the old target. Same treatment as reattachment, minus
        // onReattach(): the element was never removed, and
        // renderNode()'s own reattachElement() on the new target is
        // what moves it. The common case - the same cached target and
        // context every time - stays the free no-op it always was. Run
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
      u.repeater = startRepeater(() => {
        // Its properties first, as before building (see
        // refreshCreatorBuild()): a component that renders straight from
        // its properties - a DOM element - can have its render queued, and
        // reached, just after its creator's build was invalidated, its
        // properties retracted with it (a creator correcting itself with
        // setState() and flush() from its own render, say).
        this.refreshCreatorBuild();
        renderStack.push(this);
        try {
          // What enterTree() recorded, not the arguments this closure was
          // created with: those are whatever the *first* renderOnto() call
          // passed, forever. A component retracted and later renderOnto()'d
          // under a different parent (a dialog moving between a docked
          // slot and a modal overlay, say - see cascade.application/demo's
          // HybridModalDialog) is relinked and restart()ed above with its
          // new place, but this callback is what restart() actually reruns
          // - rendering against the stale captured target put its fresh
          // elements back under the old parent's. enterTree() records them
          // fresh on every call, so they always name the current ones.
          this.render(u.renderTarget, u.childContext);
        } finally {
          // Must run even if render() throws - renderStack is a single,
          // module-level stack shared by every component in the process,
          // not scoped to this repeater or this world, so a render() that
          // throws without this would leave a stale entry on it forever,
          // corrupting getRenderParent() for every component rendered
          // afterward, in any test or any part of the app, for the rest of
          // the process. Found via a SingleNodeComponent test that
          // deliberately throws from render() (see
          // cascade.DOM/src/test/singleNodeComponent.js) to check its own
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
  // system has no visibility into - see cascade.DOM's DOMNodeComponent
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
  // whatever onRetract() undid - see cascade.DOM's DOMNodeComponent, which
  // re-inserts its own element (removed by onRetract()) since relinking
  // itself never re-executes render() to do it another way. Calls onShow()
  // by default - an override calls super.onReattach() to keep that.
  onReattach(target) {
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
  // cascade.dom's PortalSource shows its contents in its portal. Called
  // from inside whoever is rendering - reads here are recorded against
  // that render unless wrapped in withoutRecording(). No-ops by default.
  onShow() {}

  onHide() {}

  // The lifecycle of a component its creator manages itself (see
  // README.md, "Building Sub Components" and its warning) -
  // one created in initialization and kept as an unobservable, say, rather
  // than constructed in a build(). A component built in a build() is
  // established and disposed by its creator's build (cascade.reactive's
  // finishRebuilding() calls onEstablish() and onDispose()); one created
  // any other way has nothing to do that for it, so whoever owns it does:
  // establish() once, where it's created, and dispose() once it's done
  // with it - in its own onDispose(), typically. Without dispose(), one
  // that reads data that never changes again is never invalidated, and so
  // never lets go of what it built and subscribed to.
  //
  //   initialUnobservables() {
  //     return { board: portal({ key: "board" }).establish() };
  //   }
  //
  //   onDispose() {
  //     this.unobservable.board.dispose();
  //     super.onDispose();
  //   }
  //
  // Both are cascade.reactive's own establish()/dispose() - the very
  // functions the rebuild establishes and disposes of built components
  // with - so an owned component's lifecycle is exactly a built one's:
  // the same flag, the same events, the same hooks. establish() does
  // nothing for a component already established, and returns the
  // component, so it can be called right on the construction.
  establish() {
    return establishObject(this);
  }

  dispose() {
    disposeObject(this);
  }

  // Override: this component is established - built for the first time
  // by its creator's build, or established by its owner (establish()
  // above). Where to acquire what it needs from outside, and let go of it
  // again in onDispose(). A subclass overriding this must call
  // super.onEstablish(). No-op by default.
  onEstablish() {}

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
    // Its own context goes with it - and whatever lookups are cached on it
    // (see RenderContext.js). Nothing below it is in the tree any more.
    if (u.ownContext) disposeObject(u.ownContext);
    // Gone for good (unlike a component that's merely not rendered for a
    // while - see buildOneStep()), so its build stops for good
    // too, instead of staying subscribed to whatever it read.
    if (u.buildRepeater) {
      retractRepeater(u.buildRepeater);
      // And so does everything its build constructed: their properties
      // were that build's writings, retracted with it. Not all of them are
      // underneath its render, to be retracted with that - one it built
      // but isn't showing (a closed drawer's contents, say) - and one whose
      // build is still alive, pulled by whatever expanded it (see
      // expand()), would otherwise build once more, reading its properties
      // as undefined. Everything it constructed, with a key or without
      // (matched by shape - see rebuildShapeAnalysis above).
      const built = u.buildRepeater.idObjectShapeMap || u.buildRepeater.buildIdObjectMap;
      if (built) {
        for (const key in built) {
          const object = built[key];
          if (object !== this) disposeObject(object);
        }
      }
    }
  }

  // Ported from flow.core's Component.js verbatim - a conditional-
  // inclusion helper for a build() result: `parent(a, b.showIf(cond), c)`
  // includes `b` only if `cond` is true, `null` (dropped - see the
  // default render()'s own `equivalent instanceof Array` handling, and
  // implicitProperties.js's own null/undefined-skipping) otherwise. Not
  // to be confused with a component-specific "showing" concept some
  // subclass might define on itself (see cascade.ui's own Overlay,
  // which - like everything else here - inherits this too, but under a
  // different, narrower name for its own thing, precisely to avoid
  // colliding with this one).
  showIf(value) {
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
// equivalentCreator (whose build() returned this component as one of its
// roots - see assignEquivalentCreator() above) from `component` up,
// joining each one's own toString() with " | ". cascade.DOM writes this
// onto a freshly-created real element's own `id` attribute (see
// DOMNodeComponent.js) - unconditionally, no debug-mode flag, matching
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

/**
 * ContextScope - what's inside enters the tree with `context`, not with
 * the context of where the scope is placed: for what is shown somewhere
 * other than where it comes from. A portal renders its contents on its own
 * target, but inside a scope with the context of where they were put into
 * it - so they inherit from there, what that place provides for them (a
 * style, say) included (see cascade.dom's Portal). Build-only, so a
 * container that expands its subtree (cascade.dom's FlipAnimationContainer)
 * expands right through it, as through anything else. No context given:
 * the one it's placed in, as for anything else.
 */
export class ContextScope extends Component {
  setProperties({ context, children }) {
    this.scopeContext = context || null;
    this.scopeChildren = children || [];
  }

  enteredContext(given) {
    return this.scopeContext || given;
  }

  build() {
    return this.scopeChildren;
  }
}

export function contextScope(...parameters) {
  return new ContextScope(...parameters);
}

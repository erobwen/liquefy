import { observable } from "./Cascade.js";

/**
 * RenderContext wraps a target with whatever additional situational
 * information a parent wants to hand down to a specific child's own
 * renderOnto/render call - e.g. how much space is left after the parent's
 * own rendering and real measurement (see cascade.DOM's toolbar/main-frame
 * demo), or a bounding box a child should lay out within. Like the target
 * itself, a context is an ordinary observable object: reading one of its
 * extra fields inside a child's render() is a normal, tracked dependency -
 * if a parent later re-measures and writes a different value there, the
 * child that read it reruns automatically, the same versioned-timeline
 * mechanism that already makes a target property (e.g. DOMElementTarget's
 * lastChild) resolve correctly per tree position.
 *
 * IMPORTANT: this only works if the *same* context instance is reused
 * across a parent's reruns - create it once (lazily, on first render,
 * typically cached on `this.unobservable`) and write new values into its
 * fields on later renders, the same way a target itself has to persist
 * (see cascade.DOM's DOMNodeRenderComponent and the innerTarget it caches). Handing
 * an *existing* (relinked, not rerun) child a brand new context object
 * every render does nothing: relinking never re-executes render(), so it
 * cannot see a new argument at all - only a live property write on an
 * object the child is already depending on can invalidate and rerun it.
 */
export class RenderContext {
  constructor(target, extra) {
    this.target = target;
    if (extra) Object.assign(this, extra);
    return observable(this);
  }

  // A context for rendering somewhere else (typically a component's own
  // element's target, for its children) that keeps what should follow a
  // subtree down: the service locator (see ServiceLocator.js). Situational
  // fields - measured bounds, usable width - are deliberately not carried
  // over; they're only valid near where they were introduced, so each
  // component passes on what it means to (`extra`).
  //
  // The locator is copied once, when the context is created: nested
  // contexts are cached and reused across reruns, and this keeps a lookup
  // a single property read. Swapping services at runtime is done inside
  // the locator (see ObservableCompoundServiceLocator), not by reassigning
  // a context's serviceLocator.
  derive(target, extra) {
    return new RenderContext(target, { serviceLocator: this.serviceLocator, ...extra });
  }
}

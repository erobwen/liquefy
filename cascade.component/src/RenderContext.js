import { observable, repeat, refreshIfNeeded, accessInitialValues, withoutRecording, retractRepeater } from "./Cascade.js";

/**
 * RenderContext - what a component's subtree inherits: a chain of what the
 * components above it provide (see Component.provide()), one link per
 * component that actually provides something. A component providing
 * nothing adds no link: its children get the context it was given itself.
 *
 * Only non-temporal information belongs here - a location, an overlay
 * frame, portals, services, a measured size: things with one value per
 * render pass. What changes as the pass goes along (the last node placed
 * on an element, the space left after the siblings rendered so far) is the
 * render target's business (see Component.renderOnto()), never the
 * context's. That's what makes a context safe to read from build(): a build
 * repeater is a pipeline of its own, unrelated in time to rendering, and
 * reads the latest writing of whatever it reads - for a value that only
 * changes between passes, the right one.
 *
 *  - provided: the object its component's provide() returned - its own
 *    fields (plain values, getters, or an observable object's fields) are
 *    what the component provides. Never the component itself: a component
 *    and its context are kept apart, so nothing a component merely has
 *    (a style, a label) is ever inherited by accident.
 *  - parent: the context above it. Observable, and changeable: a provider
 *    removed or inserted upstream re-points its descendants' links, and
 *    only the lookups that went through the link follow. Written at the
 *    baseline (accessInitialValues()), like everything written to a
 *    context, and only when it changes - see Component.enterTree().
 *
 * A context is created once by its component and kept, and disposed of
 * with it (see Component.onDispose()) - its identity never changes, only
 * what it holds.
 *
 * Lookups (inherit()) are cached per context: the first lookup of a name
 * that isn't provided right here starts a small, independent repeater that
 * fetches it from the parent, and keeps the result on this context -
 * every later lookup of it, from here or from further down, reads that.
 * When anything the fetch read changes (a parent link, a provided value),
 * it fetches again, and only a different result invalidates those who read
 * it. A reader pulls the fetch before reading (refreshIfNeeded()), so it
 * never reads a result that is about to change.
 */
export class RenderContext {
  constructor(provided = null, parent = null) {
    this.provided = provided;
    this.parent = parent;
    return observable(this);
  }

  // The nearest value of `name`: provided right here, or further up.
  // Undefined if nothing provides it.
  inherit(name) {
    const provided = this.provided;
    if (provided) {
      const value = provided[name];
      if (typeof(value) !== "undefined") return value;
    }
    return this.inheritFromAbove(name);
  }

  // What `name` is above this context - cached here (see the class doc).
  inheritFromAbove(name) {
    const meta = this.causality;
    if (!meta.inheritCache) meta.inheritCache = new Map();
    let entry = meta.inheritCache.get(name);
    if (entry) {
      if (!entry.repeater.retracted) refreshIfNeeded(entry.repeater);
    } else {
      entry = { slot: null, repeater: null };
      meta.inheritCache.set(name, entry);
      entry.repeater = repeat(() => {
        const parent = this.parent;
        const value = parent ? parent.inherit(name) : undefined;
        if (!entry.slot) {
          entry.slot = observable({ value });
        } else if (withoutRecording(() => entry.slot.value) !== value) {
          accessInitialValues(() => { entry.slot.value = value; });
        }
      }, { independent: true });
    }
    return entry.slot.value;
  }

  // Every service locator on the way up, nearest first - each provided as
  // `serviceLocator` (see ServiceLocator.js). Found by walking, not by
  // inherit(): locators compose - one that doesn't provide something falls
  // through to the next - where every other value shadows.
  *serviceLocators() {
    let context = this;
    while (context) {
      const provided = context.provided;
      const locator = provided ? provided.serviceLocator : undefined;
      if (locator) yield locator;
      context = context.parent;
    }
  }

  // Its component is gone for good: so are the lookups cached on it.
  onDispose() {
    const cache = this.causality.inheritCache;
    if (!cache) return;
    for (const entry of cache.values()) retractRepeater(entry.repeater);
    this.causality.inheritCache = null;
  }
}

// The context of something rendered without one: provides nothing, has
// nothing above it.
RenderContext.empty = new RenderContext();

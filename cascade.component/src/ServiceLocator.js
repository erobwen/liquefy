import { observable, isObservable } from "./Cascade.js";
import { Component, getCreator } from "./Component.js";

/**
 * Service locators - how a component gets what it needs (a primitive for an
 * HTML tag, a themed button, a theme color, ...) without hard-coding where
 * it comes from. A locator is any object with `locate(query)`, returning
 * what it provides for that query, or `undefined` if it doesn't handle it.
 *
 * A query is always an object - `{ name: "button", type: "widget",
 * properties }`, say - never a bare string, so services from different
 * domains never collide on a name: an HTML `button` element
 * (`type: "htmlElement"`) and a themed `button` widget (`type: "widget"`)
 * are different queries. Which fields a locator looks at is up to that
 * locator.
 *
 * A locator travels down the tree in the render context
 * (`renderContext.serviceLocator`, forwarded to nested contexts by
 * RenderContext.derive()), so finding one is a single property read, and
 * it's contextual: a subtree can be rendered with a different locator (see
 * ServiceProvider below) - a component that only works with one theme can
 * have it, inside an app using another.
 */

// Asks each of its locators in order; the first one that provides
// something wins. A plain object - the right choice when the set of
// locators is fixed for the application's lifetime: no dependency is ever
// recorded on it, so looking something up costs nothing beyond the lookup
// itself.
export class CompoundServiceLocator {
  constructor(...locators) {
    this.locators = locators;
  }

  locate(query) {
    for (const locator of this.locators) {
      const result = locator.locate(query);
      if (result !== undefined) return result;
    }
    return undefined;
  }

  // A whole tree of queries at once - see hydrateQuery() below.
  hydrate(query) {
    return hydrateQuery(query, this);
  }
}

// The same, but observable: every build() that looks something up through
// it depends on its list of locators, so replacing one at runtime
// (`compound.locators[1] = materialTheme`, or assigning a whole new
// `locators` array) rebuilds exactly the parts of the UI that used it - a
// runtime theme switch, for instance. Costs one tracked dependency per
// lookup; use CompoundServiceLocator when nothing will ever be swapped.
export class ObservableCompoundServiceLocator extends CompoundServiceLocator {
  constructor(...locators) {
    super(...locators);
    this.locators = observable(this.locators);
    return observable(this);
  }
}

function describeQuery(query) {
  if (query === null || typeof(query) !== "object") return String(query);
  const parts = [];
  for (const key in query) {
    if (key !== "properties") parts.push(key + ": " + JSON.stringify(query[key]));
  }
  return "{ " + parts.join(", ") + " }";
}

// Look `query` up through the service locator of the component whose
// build() is running right now - found on its own render context (the
// unobservable copy renderOnto() keeps: the *current* context object,
// never a retracted writing). Reading `serviceLocator` off that context is
// an ordinary observable read, so a build() depends on which locator its
// context holds. `fallbackLocator` answers if there's no creator (a
// component constructed eagerly, outside anyone's build()), no locator in
// the context, or nothing in it provides `query` - a platform's own
// default, typically ending in a debug locator that degrades gracefully
// rather than failing (see cascade.dom's DOMDebugServiceLocator).
export function locateService(query, fallbackLocator) {
  const creator = getCreator();
  const context = creator ? creator.unobservable.renderContext : null;
  const locator = context ? context.serviceLocator : undefined;
  let result = locator ? locator.locate(query) : undefined;
  if (result === undefined && fallbackLocator) result = fallbackLocator.locate(query);
  if (result === undefined) {
    throw new Error("No service locator provides " + describeQuery(query) + " - add one to the render context's serviceLocator.");
  }
  return result;
}

/**
 * Hydration - turning a document into a working UI. A document is nothing
 * but queries: plain data, a tree of `{ type, name, properties }` objects
 * whose `properties.children` (an array, or a single one) hold further
 * queries, alongside plain strings and already-built components. Hydrating
 * one hands every query in it to a service locator - children first, so
 * each node is located with its own children already built - and the
 * result is an ordinary tree of components, exactly as if build() had
 * called the convenience functions (div(), button(), ...) itself.
 *
 * Nothing reactive happens here: it's one more way to construct components,
 * not a phase of rendering. Called from a build(), what it constructs is
 * that build's to reconcile, as always - which is why a node without a key
 * gets one from its position in the document (`h`, `h.0`, `h.0.2`, ...): a
 * rebuild (a theme switch, say) then matches the new tree to the old one
 * node for node, instead of constructing it all anew. A node's own `key`
 * wins; its descendants' positional keys extend it.
 */

// A service query: a plain object with a string `type` - not an array,
// not an observable (a component, or any model), not a properties bag.
export function isServiceQuery(value) {
  return value !== null && typeof(value) === "object" && !(value instanceof Array)
    && !isObservable(value) && typeof(value.type) === "string";
}

export function hydrateQuery(query, locator, positionalKey = "h") {
  const properties = { ...(query.properties || {}) };
  if (typeof(properties.key) === "undefined" || properties.key === null) properties.key = positionalKey;
  if (typeof(properties.children) !== "undefined") {
    const children = properties.children instanceof Array ? properties.children : [properties.children];
    properties.children = children.map((child, index) =>
      isServiceQuery(child) ? hydrateQuery(child, locator, properties.key + "." + index) : child);
  }
  const result = locator.locate({ ...query, properties });
  if (result === undefined) {
    throw new Error("No service locator provides " + describeQuery(query) + " - add one to the render context's serviceLocator.");
  }
  return result;
}

// Hydrate through the service locator of the component whose build() is
// running right now - the same lookup as locateService(), so a document is
// hydrated with whatever services (theme, platform, ...) that component's
// render context holds.
export function hydrateService(query, fallbackLocator) {
  return hydrateQuery(query, { locate: (each) => locateService(each, fallbackLocator) });
}

export function serviceProvider(...parameters) {
  return new ServiceProvider(...parameters);
}

/**
 * ServiceProvider: renders `child` with `serviceLocator` in front of
 * whatever locator the surrounding context already has - it answers first,
 * and anything it doesn't provide is still found the usual way. Same
 * target, no element of its own: only the services change, not where
 * things are rendered. Every other field of the surrounding context is
 * passed through as it is.
 */
export class ServiceProvider extends Component {
  setProperties({ serviceLocator, child }) {
    this.serviceLocator = serviceLocator;
    this.child = child;
  }

  render(context) {
    const u = this.unobservable;
    const own = this.serviceLocator;
    const inherited = context.serviceLocator;
    // Rebuilt only when either side actually changes - handing the child's
    // context a new compound on every render would invalidate every build()
    // below that looked anything up through it.
    if (!u.compound || u.own !== own || u.inherited !== inherited) {
      u.own = own;
      u.inherited = inherited;
      u.compound = inherited ? new CompoundServiceLocator(own, inherited) : own;
    }
    if (!u.providedContext) u.providedContext = context.derive(context.target);
    for (const key of Object.keys(context)) {
      if (key !== "target" && key !== "serviceLocator") u.providedContext[key] = context[key];
    }
    u.providedContext.serviceLocator = u.compound;
    this.child.renderOnto(u.providedContext);
  }
}

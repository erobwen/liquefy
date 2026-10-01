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
 * A locator is provided like anything else inherited - as `serviceLocator`,
 * by the root context or by a component on the way (see RenderContext.js,
 * and ServiceProvider below) - so it's contextual: a subtree can be
 * rendered with a different locator in front of the one around it - a
 * component that only works with one theme can have it, inside an app
 * using another. Unlike other inherited values, locators compose: one that
 * doesn't provide what's asked for falls through to the next one up.
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

// Look `query` up through the service locators provided where the
// component whose build() is running right now is placed - the nearest
// first, each falling through to the next (see RenderContext's
// serviceLocators()). Ordinary tracked reads, so a build() depends on which
// locators its context holds. `fallbackLocator` answers if there's no
// creator (a component constructed eagerly, outside anyone's build()), no
// locator in its context, or none of them provides `query` - a platform's
// own default, typically ending in a debug locator that degrades
// gracefully rather than failing (see cascade.dom's DOMDebugServiceLocator).
export function locateService(query, fallbackLocator) {
  const creator = getCreator();
  const context = creator ? creator.renderContext : null;
  let result;
  if (context) {
    for (const locator of context.serviceLocators()) {
      result = locator.locate(query);
      if (result !== undefined) break;
    }
  }
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
 * wins; its descendants' positional keys extend it. Several documents
 * hydrated in one build are numbered in turn (`h`, `h1`, `h2`, ...), and a
 * fragment at a document's root is its elements side by side (`h.0`, `h.1`).
 */

// A service query: a plain object with a string `type` - not an array,
// not an observable (a component, or any model), not a properties bag.
export function isServiceQuery(value) {
  return value !== null && typeof(value) === "object" && !(value instanceof Array)
    && !isObservable(value) && typeof(value.type) === "string";
}

export function hydrateQuery(query, locator, positionalKey = "h") {
  // Several side by side (a fragment at the root of a document): each
  // hydrated, at its own place.
  if (query instanceof Array) {
    return query.map((each, index) => hydrateQuery(each, locator, positionalKey + "." + index));
  }
  // Already built (a component at the root of a document): as it is.
  if (!isServiceQuery(query)) return query;
  const properties = { ...(query.properties || {}) };
  if (typeof(properties.key) === "undefined" || properties.key === null) properties.key = positionalKey;
  if (typeof(properties.children) !== "undefined") {
    const children = properties.children instanceof Array ? properties.children : [properties.children];
    properties.children = children.map((child, index) =>
      isServiceQuery(child) ? hydrateQuery(child, locator, properties.key + "." + index) : child);
  }
  // A component class named in the document itself (a JSX tag - see
  // cascade.DOM's jsx-runtime.js): constructed directly, its children
  // already hydrated - nothing to ask a locator for.
  if (query.type === "component" && typeof(query.componentClass) === "function") {
    return new query.componentClass(properties);
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
  return hydrateQuery(query, { locate: (each) => locateService(each, fallbackLocator) }, rootKey());
}

// The positional key of a document's root: "h" for the first document a
// build hydrates, "h1", "h2", ... for the ones after it - so several in one
// build don't collide, and a rebuild, hydrating them in the same order,
// matches each to the one it was. Counted per run of the build that's
// running (see Component's buildOneStep()).
function rootKey() {
  const creator = getCreator();
  if (!creator) return "h";
  const u = creator.unobservable;
  if (u.hydratedInBuild !== u.callbackBuild) {
    u.hydratedInBuild = u.callbackBuild;
    u.hydrated = 0;
  }
  const count = u.hydrated++;
  return count === 0 ? "h" : "h" + count;
}

export function serviceProvider(...parameters) {
  return new ServiceProvider(...parameters);
}

/**
 * ServiceProvider: renders `child` with `serviceLocator` in front of
 * whatever locators the surrounding context already has - it answers first,
 * and anything it doesn't provide is still found the usual way, further up.
 * Same target, no element of its own: only the services change, not where
 * things are rendered.
 */
export class ServiceProvider extends Component {
  setProperties({ serviceLocator, child }) {
    this.serviceLocator = serviceLocator;
    this.child = child;
  }

  // A getter: a locator swapped on a rebuild is found from then on.
  provide() {
    const provider = this;
    return { get serviceLocator() { return provider.serviceLocator; } };
  }

  render(target, context) {
    this.child.renderOnto(target, context);
  }
}

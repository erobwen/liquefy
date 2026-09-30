import { Component } from "@liquefy/cascade.component";

/**
 * JSX for Cascade - JSX tags compile to service queries, the same plain
 * data a hydration document is made of (see cascade.component's
 * ServiceLocator.js, hydrateQuery()). A JSX expression builds no
 * components at all: it's a document, handed to hydrate() like any other,
 * and the service locator in the building component's render context
 * turns it into components.
 *
 *   build() {
 *     return hydrate(
 *       <div>
 *         <h1>Count is {this.count}</h1>
 *         <widget.button onClick={callback("count", () => { this.count++; })}>More</widget.button>
 *       </div>
 *     );
 *   }
 *
 * This is the "automatic" JSX runtime (React 17's convention, which
 * esbuild, Babel and TypeScript all compile to): with `jsx: "automatic"`
 * and `jsxImportSource: "@liquefy/cascade.dom"`, the compiler imports
 * jsx()/jsxs() from here and calls them for every tag. What a tag becomes:
 *
 *  - a lowercase name (`<div>`, `<mdui-button>`): an HTML element query,
 *    `{ type: "htmlElement", name, properties }`.
 *  - a member expression (`<widget.button>`): whatever that function
 *    returns - serviceQueries() below makes whole namespaces of query
 *    functions, `widget = serviceQueries("widget")`.
 *  - a Component class (`<HighlightedCode source={...} />`): a query
 *    naming the class itself, `{ type: "component", name, componentClass,
 *    properties }` - hydrate() constructs it, as `new HighlightedCode(...)`
 *    in a build() would be, once its own JSX children are hydrated.
 *  - any other function: called with the properties.
 *
 * Properties pass through untouched - callbacks included, plain closures
 * or named ones (callback()), riding the query to the component the
 * locator makes of it. Children are flattened (a `.map()` inside a tag),
 * and `null`, `undefined` and booleans are left out (`{open && <p />}`).
 */

export function jsx(type, props, key) {
  const properties = { ...props };
  if (typeof(key) !== "undefined") properties.key = key;
  if ("children" in properties) {
    const children = flattenChildren(properties.children, []);
    if (children.length > 0) properties.children = children;
    else delete properties.children;
  }
  if (typeof(type) === "string") return { type: "htmlElement", name: type, properties };
  if (type.prototype instanceof Component) return { type: "component", name: type.name, componentClass: type, properties };
  return type(properties);
}

// The compiler calls jsxs() for a tag with several static children, and
// jsxDEV() (from jsx-dev-runtime) in development: both the same here.
export { jsx as jsxs, jsx as jsxDEV };

// <>...</>: just its children, flattened into the tag around it.
export function Fragment({ children }) {
  return children;
}

// Strings next to each other become one - `Count is {count}` is one text,
// not two.
function flattenChildren(children, result) {
  if (children instanceof Array) {
    children.forEach((child) => flattenChildren(child, result));
  } else if (children === null || typeof(children) === "undefined" || typeof(children) === "boolean") {
    // Nothing: a condition that didn't hold.
  } else {
    const child = typeof(children) === "number" ? String(children) : children;
    const last = result.length - 1;
    if (typeof(child) === "string" && typeof(result[last]) === "string") result[last] += child;
    else result.push(child);
  }
  return result;
}

/**
 * serviceQueries(type) - a namespace of query functions for JSX, one per
 * name: `serviceQueries("widget").button(properties)` is
 * `{ type: "widget", name: "button", properties }`. So with
 * `const widget = serviceQueries("widget")`, `<widget.button>` in JSX asks
 * the service locator for a themed button, exactly as `button()` does.
 */
export function serviceQueries(type) {
  return new Proxy({}, {
    get: (target, name) => typeof(name) === "string" ? (properties) => ({ type, name, properties }) : undefined,
  });
}

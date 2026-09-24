import { CompoundServiceLocator, hydrateService } from "@liquefy/cascade.component";
import { DOMElementComponent } from "./DOMElementComponent.js";

/**
 * The DOM platform's own service locators (see cascade.component's
 * ServiceLocator.js for the protocol: `locate(query)` returns what it
 * provides for a query object, or undefined).
 */

// Provides real DOM elements: `{ type: "htmlElement", name: tagName,
// properties }` - what HTMLTags.js's tag functions ask for. Any tag name,
// custom elements included (`mdui-button`, ...): a `<div>` and an
// `<mdui-button>` are both just an Element with a different tagName.
export class DOMServiceLocator {
  locate(query) {
    if (query.type !== "htmlElement") return undefined;
    return new DOMElementComponent({ tagName: query.name, ...query.properties });
  }
}

// The last resort - graceful degradation. Provides *something* for any
// query at all: a visibly marked placeholder element naming what was asked
// for, keeping the query's own key and children, so the rest of the UI
// still renders and the gap is obvious. Warns once per unresolved query
// name, so a missing service doesn't go unnoticed just because it didn't
// crash anything.
export class DOMDebugServiceLocator {
  constructor() {
    this.warned = new Set();
  }

  locate(query) {
    const name = query.name || query.type || "unknown";
    const label = (query.type ? query.type + " " : "") + name;
    if (!this.warned.has(label)) {
      this.warned.add(label);
      console.warn("No service locator provides " + label + " - rendering a placeholder instead.");
    }
    const properties = query.properties || {};
    return new DOMElementComponent({
      tagName: "div",
      key: properties.key,
      title: "Unresolved service: " + label,
      style: { display: "inline-block", border: "1px dashed #d63031", color: "#d63031", padding: "2px 6px" },
      children: ["[" + label + "]", ...(properties.children || [])],
    });
  }
}

// What HTMLTags.js falls back to when the building component's render
// context has no locator of its own (a bare `new RenderContext(target)` -
// every test in this package, for instance - or a component constructed
// outside anyone's build()). Plain and fixed: nothing here ever changes.
export const defaultDOMServiceLocator = new CompoundServiceLocator(
  new DOMServiceLocator(),
  new DOMDebugServiceLocator(),
);

// Hydrate a document - a tree of service queries (see cascade.component's
// ServiceLocator.js, hydrateQuery()) - into components, through the
// service locator of whichever component's build() is running, with the
// DOM default behind it: the document counterpart of HTMLTags.js's tag
// functions, for a UI written as data instead of calls.
export function hydrate(tree) {
  return hydrateService(tree, defaultDOMServiceLocator);
}

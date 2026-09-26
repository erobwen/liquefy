import { CompoundServiceLocator, hydrateService, locateService, toPropertiesWithChildren } from "@liquefy/cascade.component";
import { DOMElementComponent } from "./DOMElementComponent.js";
import { DOMTextComponent } from "./DOMTextComponent.js";

/**
 * The DOM platform's own service locators (see cascade.component's
 * ServiceLocator.js for the protocol: `locate(query)` returns what it
 * provides for a query object, or undefined).
 */

// Provides the DOM platform's own components:
//  - `{ type: "htmlElement", name: tagName, properties }`: real DOM
//    elements - what HTMLTags.js's tag functions ask for. Any tag name,
//    custom elements included (`mdui-button`, ...): a `<div>` and an
//    `<mdui-button>` are both just an Element with a different tagName.
//  - `{ type: "textNode", properties }`: a Text node - what text() asks for.
//  - `{ type: "domComponent", name, properties }`: the platform's other
//    components (see registerDOMComponent() below) - what their factory
//    functions (contextContainer(), flipAnimationContainer(), ...) ask for.
// Only what an application builds goes through here: inside this package,
// components construct each other directly (a DOMElementComponent its
// Text children, say) - whoever wants another implementation of one of
// them replaces the whole component, not its insides.
//
// Each of those components registers itself here, from its own module -
// rather than this module importing them all: they import this one for
// their factory functions (locateDOMComponent()), and some build on each
// other (FlipAnimationContainer and OverflowContainer on
// DOMPlacingContainer), so importing them from here made cycles in which a
// class could be needed before its module had finished loading.
const domComponents = new Map();

export function registerDOMComponent(name, Class) {
  domComponents.set(name, Class);
}

const domComponent = (name) => domComponents.get(name);

export class DOMServiceLocator {
  locate(query) {
    switch (query.type) {
      case "htmlElement":
        return new DOMElementComponent({ tagName: query.name, ...query.properties });
      case "textNode":
        return new DOMTextComponent(query.properties);
      case "domComponent": {
        const Class = domComponent(query.name);
        return Class ? new Class(query.properties) : undefined;
      }
      default:
        return undefined;
    }
  }
}

// The factory functions for the domComponent services above.
export function locateDOMComponent(name, parameters) {
  return locateService({ type: "domComponent", name, properties: toPropertiesWithChildren(parameters) }, defaultDOMServiceLocator);
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

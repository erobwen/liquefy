import { Component } from "./Component.js";

/**
 * view(name, build, methods) - a component made from a build function,
 * without writing a class: for the many small components that only build.
 * Returns a function constructing one, taking the same arguments a
 * component's constructor does (a key, properties, children - see
 * implicitProperties.js).
 *
 *   const provenanceRow = view("ProvenanceRow", ({ line }) =>
 *     tr(td(text(line.status)), td(text(line.key + " = " + line.value))));
 *
 *   tbody(lines.map((line) => provenanceRow({ key: line.key, line })))
 *
 * `build` is handed the component itself: its properties (every property
 * given becomes a field, as with Component's own setProperties()), its
 * state, inherit(). Reading them is reactive, as from any build(). Its own
 * build() is a namespace of keys of its own - a helper that keys its parts
 * can be used twice in one build once it's a view.
 *
 * `name` is the class name: what errors, component paths and debug ids
 * call it.
 *
 * `methods`, optional, go on the class as they are - anything a class
 * would override. Written as methods (not arrow functions), so `this` is
 * the component:
 *
 *   const card = view("Card", ({ style, children }) => div({ style }, children), {
 *     // A value, compared by content: rebuilt with an equal style in a new
 *     // object, the card isn't rebuilt.
 *     setProperties({ style, children }) {
 *       this.style = frozen(style);
 *       this.children = frozen(children);
 *     },
 *     initialState() {
 *       return { open: false };
 *     },
 *   });
 *
 * Without setProperties(), every property is compared by identity on a
 * rebuild - a fresh object literal given each build rebuilds the view each
 * time. Anything more than this is clearer as a class.
 */
export function view(name, build, methods = {}) {
  if (typeof(build) !== "function") throw new Error("view(\"" + name + "\", build): build must be a function.");
  if ("build" in methods) throw new Error("view(\"" + name + "\"): build is given as its own argument, not among the methods.");
  const componentClass = { [name]: class extends Component {
    build() {
      return build.call(this, this);
    }
  } }[name];
  Object.assign(componentClass.prototype, methods);
  const construct = (...parameters) => new componentClass(...parameters);
  // For instanceof, or a subclass.
  construct.componentClass = componentClass;
  return construct;
}

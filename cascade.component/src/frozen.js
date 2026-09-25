import { isObservable } from "./Cascade.js";

/**
 * frozen(value) - make a property a value: deep-freeze the plain data in it
 * (plain objects and arrays), and return it. For setProperties():
 *
 *   setProperties({ style, children, model }) {
 *     this.style = frozen(style);       // a value: compared by content
 *     this.children = frozen(children); // the array a value; the components in it stay references
 *     this.model = model;               // not frozen: compared by identity
 *   }
 *
 * When a component is rebuilt, its new properties are copied onto the
 * established component (cascade.reactive's mergeInto()) - and a property
 * that is frozen on both sides is compared by content there, not by
 * identity: rebuilt with the same style again, in a new object, it hasn't
 * changed, and nothing that read it reruns. A property that isn't frozen is
 * compared by identity, as always - which is what a large structure wants:
 * its identity stands for the whole, instead of a comparison node by node.
 *
 * Only plain data is frozen: frozen() stops at observables (components
 * among them - a frozen children array still holds the live components),
 * class instances, functions and DOM nodes, which are references, compared
 * by identity even inside a frozen value. Frozen, a value can't change
 * after it's been compared - a mutation throws instead of silently going
 * unnoticed. null and undefined pass through.
 */
export function frozen(value) {
  deepFreeze(value, new Set());
  return value;
}

// Plain data: an array, or an object straight from a literal (or
// Object.create(null)) - nothing with a class of its own, and nothing
// observable.
export function isPlainData(value) {
  if (value === null || typeof(value) !== "object" || isObservable(value)) return false;
  if (Array.isArray(value)) return true;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function deepFreeze(value, seen) {
  if (!isPlainData(value) || seen.has(value)) return;
  seen.add(value);
  for (const key of Object.keys(value)) deepFreeze(value[key], seen);
  Object.freeze(value);
}

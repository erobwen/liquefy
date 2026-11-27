/**
 * Selectors: tables of local rules, with the parts of what is selected coming along, and the
 * selection computed from nothing, which is what an incremental selection is tested against.
 * Specified in documents/selections.md; designed in the whitepaper, sections 3.4 and 3.5.
 */

import { model, Selection, ARRAY_CLASS, OBJECT_CLASS } from "@liquefy/deepwell";

/** Whether an object is a part: an array, or a synchronized object without a class. */
export function isPart(object) {
  if (Array.isArray(object)) return true;
  const prototype = Object.getPrototypeOf(object);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Adds the parts that an object refers to directly: arrays, and synchronized objects without a
 * class (whitepaper section 3.4, "Parts come along"). Its fields are read, so that a rule that
 * does this runs again when a part is attached or removed.
 *
 * Inside a rule of a load, an object that is not in memory reads as a stub (Deepwell's design,
 * section 3.7). A stub is a part if its record says so; the record is read to find out, which
 * needs a store that answers at once.
 */
export function addParts(well, object, selection) {
  const consider = (value) => {
    if (value === null || typeof(value) !== "object") return;
    if (model.isSynchronized(value)) {
      if (isPart(value)) selection.add(value);
      return;
    }
    const id = well.stubIds.get(value);
    if (id === undefined) return;
    const record = well.db.get(id);
    if (record !== undefined && (record.$class === ARRAY_CLASS || record.$class === OBJECT_CLASS)) selection.add(value);
  };
  if (Array.isArray(object)) {
    for (const item of object) consider(item);
    return;
  }
  for (const key of Object.keys(object)) consider(object[key]);
}

/**
 * The rules of a selector, with the parts of every object coming along: for each class, the
 * selector's own rule if it has one, then the object's parts. Arrays and classless objects have
 * the rules named `Array` and `Object`, if the selector gives them.
 */
export function withParts(well, rules) {
  const wrapped = new Map();
  return new Proxy(rules, {
    get(target, name) {
      if (typeof(name) !== "string") return target[name];
      let rule = wrapped.get(name);
      if (rule === undefined) {
        const own = target[name];
        rule = (object, selection) => {
          if (typeof(own) === "function") own(object, selection);
          addParts(well, object, selection);
        };
        wrapped.set(name, rule);
      }
      return rule;
    },
  });
}

/**
 * The selection of a selector from a starting object, computed from nothing: the rules applied
 * transitively, through every object that `filter` allows and no other, with the parts of each.
 * This is the reference that the incremental selection is tested against (whitepaper section
 * 3.5), and what a selector registered as whole runs, as one repeater, each time anything it
 * read changes.
 */
export function wholeSelection(well, start, rules, filter, into = new Selection()) {
  const effective = withParts(well, rules);
  const visited = new Set();
  const queue = [start];
  while (queue.length > 0) {
    const object = queue.pop();
    if (visited.has(object)) continue;
    visited.add(object);
    if (filter && !filter(object)) continue;
    into.add(object);
    const selected = new Selection();
    effective[model.classNameOf(object)](object, selected);
    for (const item of selected) {
      if (!model.isSynchronized(item)) throw new Error("A rule selects synchronized objects only.");
      queue.push(item);
    }
  }
  return into;
}

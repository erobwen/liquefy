/**
 * Field values of persistent objects.
 *
 * An object record is a plain object of fields. A field value is a primitive, null, an array,
 * a nested plain object, or a reference:
 *
 *   ref(id)   a strong reference: it keeps its target alive
 *   weak(id)  a weak reference: it is ignored by the garbage collector and may dangle after its
 *             target is reclaimed (documents/persistent-garbage-collection.md §4.4)
 *
 * References may appear anywhere inside arrays and nested objects.
 */

export function ref(id) {
  return { $ref: id };
}

export function weak(id) {
  return { $weak: id };
}

export function isRef(value) {
  return value !== null && typeof value === "object" && typeof value.$ref === "string";
}

export function isWeak(value) {
  return value !== null && typeof value === "object" && typeof value.$weak === "string";
}

/**
 * The strong references in a record, as a Map from target id to the number of places in the
 * record that reference it. This is the record's contribution to the object graph.
 */
export function strongReferences(fields) {
  const counts = new Map();
  const visit = (value) => {
    if (value === null || typeof value !== "object") return;
    if (isRef(value)) {
      counts.set(value.$ref, (counts.get(value.$ref) ?? 0) + 1);
    } else if (isWeak(value)) {
      // Ignored by the collector.
    } else if (Array.isArray(value)) {
      value.forEach(visit);
    } else {
      Object.values(value).forEach(visit);
    }
  };
  visit(fields);
  return counts;
}

/** All referenced ids, strong and weak, used to validate that references point at real objects. */
export function allReferencedIds(fields) {
  const ids = new Set();
  const visit = (value) => {
    if (value === null || typeof value !== "object") return;
    if (isRef(value)) ids.add(value.$ref);
    else if (isWeak(value)) ids.add(value.$weak);
    else if (Array.isArray(value)) value.forEach(visit);
    else Object.values(value).forEach(visit);
  };
  visit(fields);
  return ids;
}

/**
 * Values that need no world: frozen values, the tags of the encoding, and the
 * comparison of values by content. See documents/data-model.md, sections 3, 8
 * and 9.
 */

export class DataModelError extends Error {
  constructor(message) {
    super(message);
    this.name = "DataModelError";
  }
}

/** The tags of encoded values (data model 8.2). */
export const TAGS = new Set(["$ref", "$weak", "$number", "$date", "$map", "$set", "$binary"]);

/** The reserved keys of a record (data model 8.1). */
export const RECORD_KEYS = new Set(["$class", "$version", "$elements", "$indexes", "$dependents"]);

/** The class names that are built in (data model C3). */
export const OBJECT_CLASS = "Object";
export const ARRAY_CLASS = "Array";

export function isPlainObject(value) {
  if (value === null || typeof(value) !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function isPrimitive(value) {
  return value === null || typeof(value) === "string" || typeof(value) === "number" || typeof(value) === "boolean";
}

export function describe(value) {
  if (value === null) return "null";
  if (typeof(value) === "function") return "a function";
  if (typeof(value) !== "object") return "a " + typeof(value);
  if (Array.isArray(value)) return "an array";
  const prototype = Object.getPrototypeOf(value);
  if (prototype && prototype.constructor && prototype.constructor.name && prototype.constructor !== Object) {
    return "an instance of " + prototype.constructor.name;
  }
  return "a plain object";
}

// Frozen values that have passed checkFrozenValue, by identity. Since they are
// frozen all the way down, they cannot change afterwards (data model V9).
const checkedFrozenValues = new WeakSet();

/**
 * Whether a value is a frozen value: a plain object or an array, frozen, whose
 * own enumerable properties are, recursively, primitives, dates, binary values,
 * or frozen values (data model V5). Throws a DataModelError saying why not, or
 * returns true. Returns false only for values that are not frozen plain data at
 * all, so that the caller can try other kinds.
 */
export function checkFrozenValue(value, isReference = () => false) {
  if (!(Array.isArray(value) || isPlainObject(value))) return false;
  if (!Object.isFrozen(value)) return false;
  if (checkedFrozenValues.has(value)) return true;
  checkFrozenContent(value, [], new Set(), isReference);
  checkedFrozenValues.add(value);
  return true;
}

function checkFrozenContent(value, path, stack, isReference) {
  if (stack.has(value)) throw new DataModelError("A frozen value cannot contain a cycle" + at(path) + ".");
  stack.add(value);
  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw new DataModelError("A frozen value cannot have symbol keys" + at(path) + ".");
  }
  for (const key of Object.getOwnPropertyNames(value)) {
    if (Array.isArray(value) && key === "length") continue;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    const here = path.concat(key);
    if (!("value" in descriptor)) throw new DataModelError("A frozen value cannot have accessors" + at(here) + ".");
    if (!descriptor.enumerable) throw new DataModelError("A frozen value cannot have properties that are not enumerable" + at(here) + ".");
    const item = descriptor.value;
    if (item === undefined || isPrimitive(item) || item instanceof Date || item instanceof Uint8Array) continue;
    if (typeof(item) === "bigint" || typeof(item) === "symbol" || typeof(item) === "function") {
      throw new DataModelError("A frozen value cannot contain " + describe(item) + at(here) + ".");
    }
    if (isReference(item)) {
      throw new DataModelError("A frozen value can contain only data, not a reference to an object" + at(here) + ". References belong in fields of their own.");
    }
    if ((Array.isArray(item) || isPlainObject(item))) {
      if (!Object.isFrozen(item)) throw new DataModelError("A frozen value must be frozen all the way down; it is not" + at(here) + ".");
      checkFrozenContent(item, here, stack, isReference);
      continue;
    }
    throw new DataModelError("A frozen value can contain only data, not " + describe(item) + at(here) + ". References, maps and sets belong in fields of their own.");
  }
  stack.delete(value);
}

function at(path) {
  return path.length ? " (at " + path.join(".") + ")" : "";
}

/**
 * Deep-freezes plain data produced by the decoder (data model E3).
 */
export function deepFreeze(value) {
  if (value !== null && typeof(value) === "object" && (Array.isArray(value) || isPlainObject(value))) {
    for (const key of Object.keys(value)) deepFreeze(value[key]);
    Object.freeze(value);
    checkedFrozenValues.add(value);
  }
  return value;
}

/**
 * Whether two values are the same value, as data model Q1 defines it:
 * primitives by ===, with NaN equal to NaN; references by identity; frozen
 * values deeply; dates by time value; maps and sets by their entries in order;
 * binary values byte for byte. A weak reference is compared by what it refers
 * to (`sameReference`, given by the data model).
 */
export function sameValue(a, b, sameReference = (x, y) => x === y) {
  if (a === b) return true;
  if (typeof(a) === "number" && typeof(b) === "number") return Number.isNaN(a) && Number.isNaN(b);
  if (a === null || b === null || typeof(a) !== "object" || typeof(b) !== "object") return false;
  if (a instanceof Date || b instanceof Date) {
    if (!(a instanceof Date && b instanceof Date)) return false;
    const x = a.getTime(), y = b.getTime();
    return x === y || (Number.isNaN(x) && Number.isNaN(y));
  }
  if (a instanceof Uint8Array || b instanceof Uint8Array) {
    if (!(a instanceof Uint8Array && b instanceof Uint8Array) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }
  if (a instanceof Map || b instanceof Map) {
    if (!(a instanceof Map && b instanceof Map) || a.size !== b.size) return false;
    const x = [...a], y = [...b];
    for (let i = 0; i < x.length; i++) {
      if (!sameValue(x[i][0], y[i][0], sameReference) || !sameValue(x[i][1], y[i][1], sameReference)) return false;
    }
    return true;
  }
  if (a instanceof Set || b instanceof Set) {
    if (!(a instanceof Set && b instanceof Set) || a.size !== b.size) return false;
    const x = [...a], y = [...b];
    for (let i = 0; i < x.length; i++) if (!sameValue(x[i], y[i], sameReference)) return false;
    return true;
  }
  const frozenA = (Array.isArray(a) || isPlainObject(a)) && Object.isFrozen(a);
  const frozenB = (Array.isArray(b) || isPlainObject(b)) && Object.isFrozen(b);
  if (frozenA && frozenB) {
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    const keysA = Object.keys(a).filter((key) => a[key] !== undefined);
    const keysB = Object.keys(b).filter((key) => b[key] !== undefined);
    if (keysA.length !== keysB.length) return false;
    for (const key of keysA) {
      if (!Object.prototype.hasOwnProperty.call(b, key) || !sameValue(a[key], b[key], sameReference)) return false;
    }
    return true;
  }
  return sameReference(a, b);
}

/** Base64 without depending on Node's Buffer or a browser's window. */
export function bytesToBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function base64ToBytes(text) {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Escaping of keys (data model E1): a key of the application's that begins
 * with "$" gets one more "$" in front of it, so that every key that begins with
 * a single "$" is the encoding's own.
 */
export function escapeKey(key) {
  return key.startsWith("$") ? "$" + key : key;
}

export function unescapeKey(key) {
  if (key.startsWith("$$")) return key.slice(1);
  if (key.startsWith("$")) throw new DataModelError("Unknown reserved key \"" + key + "\" in an encoded value.");
  return key;
}

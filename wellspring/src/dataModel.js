/**
 * The data model: what a synchronized object is, which values its fields can
 * hold, and how objects and values are encoded and made again. Specified in
 * documents/data-model.md; the invariants named here (O1, V9, E1, ...) are its.
 *
 * This code is shared by Wellspring on the server and Fountain's client store.
 * It depends on cascade.reactive, and on neither Aquifer nor a network.
 *
 *   const model = createDataModel(world);        // one per Cascade world
 *   class Document extends model.Synchronized { title = "Untitled"; }
 *   model.registerClasses({ Document });
 *   const record = model.encodeRecord(new Document(), references);
 */

import {
  DataModelError, TAGS, RECORD_KEYS, OBJECT_CLASS, ARRAY_CLASS,
  isPlainObject, isPrimitive, describe, checkFrozenValue, deepFreeze, sameValue,
  bytesToBase64, base64ToBytes, escapeKey, unescapeKey,
} from "./values.js";

export function createDataModel(world) {
  if (!world || typeof(world.observable) !== "function" || typeof(world.meta) !== "function") {
    throw new DataModelError("createDataModel() needs a Cascade world, with meta() (cascade.reactive 3.2 or later).");
  }
  const { observable, isObservable, meta, metaData } = world;
  const model = {};

  /*------------------------------------------------------------------
   *  Synchronized objects (data model section 2)
   *-----------------------------------------------------------------*/

  /** The data model's own record about an object, in its metadata. */
  function infoOf(object) {
    if (!isObservable(object)) return undefined;
    const objectMeta = meta(object);
    const info = objectMeta.synchronized;
    return info && info.model === model ? info : undefined;
  }

  function isSynchronized(value) {
    return infoOf(value) !== undefined;
  }

  /**
   * Makes `target` a synchronized object of this world: an observable that
   * checks every value written to it (V9).
   */
  function makeSynchronized(target, trusted = false) {
    if (isObservable(target)) {
      if (isSynchronized(target)) return target;
      throw new DataModelError("This object is already observable, but not synchronized. Pass the plain object to synchronized() instead.");
    }
    const isArray = Array.isArray(target);
    // Fields it already has are checked as if they were written now; unless the object layer
    // has prepared them itself, from a record (adopt()).
    if (trusted) {
      // Nothing to check.
    } else if (isArray) {
      for (let index = 0; index < target.length; index++) checkElement(index in target ? target[index] : undefined);
    } else {
      for (const key of Reflect.ownKeys(target)) {
        const descriptor = Object.getOwnPropertyDescriptor(target, key);
        checkField(key, "value" in descriptor ? descriptor.value : (descriptor.get || descriptor.set));
      }
    }
    const proxy = observable(target);
    const info = metaData(proxy, "synchronized");
    info.model = model;
    info.id = undefined;
    meta(proxy).checkWrite = isArray
      ? (key, value, operation) => { checkArrayWrite(key, value, operation); runWriteChecks(proxy, key, value, operation); }
      : (key, value, operation) => { checkField(key, value, operation); runWriteChecks(proxy, key, value, operation); };
    return proxy;
  }

  /*
   * Checks that layers above add (design section 4): asked before every write to every
   * synchronized object of this data model, after the data model's own check, with the object,
   * the key, the value, and the operation, as cascade.reactive's meta(object).checkWrite gives
   * them. A check refuses a write by throwing.
   */
  const writeChecks = [];

  function addWriteCheck(check) {
    writeChecks.push(check);
    return () => {
      const index = writeChecks.indexOf(check);
      if (index !== -1) writeChecks.splice(index, 1);
    };
  }

  function runWriteChecks(object, key, value, operation) {
    for (let i = 0; i < writeChecks.length; i++) writeChecks[i](object, key, value, operation);
  }

  /**
   * The base class of synchronized class instances (data model 2.1). Its
   * constructor returns the observable, so that `this` in a subclass's
   * constructor, and in its field initializers, is already the observable.
   */
  class Synchronized {
    constructor() {
      return makeSynchronized(this);
    }
  }

  /** Makes a plain object or an array a synchronized object (data model 2.1). */
  function synchronized(target) {
    if (isSynchronized(target)) return target;
    if (!(Array.isArray(target) || isPlainObject(target))) {
      throw new DataModelError("synchronized() takes a plain object or an array, not " + describe(target) + ". A class extends Synchronized instead.");
    }
    if (Object.isFrozen(target)) {
      throw new DataModelError("synchronized() cannot take a frozen object: a frozen object is a value, held by a field as it is.");
    }
    return makeSynchronized(target);
  }

  /** The identity of a shared object, or undefined while it is local (O5). */
  function identityOf(object) {
    const info = infoOf(object);
    return info ? info.id : undefined;
  }

  /** Gives a synchronized object its identity, once (O5). */
  function setIdentity(object, id) {
    const info = infoOf(object);
    if (!info) throw new DataModelError("setIdentity() takes a synchronized object.");
    if (typeof(id) !== "string" || id === "") throw new DataModelError("An identity is a non-empty string.");
    if (info.id !== undefined && info.id !== id) throw new DataModelError("An object's identity never changes (O5).");
    info.id = id;
  }

  /** Takes an object's identity away, when its record has been reclaimed (data model O3). */
  function clearIdentity(object) {
    const info = infoOf(object);
    if (info) info.id = undefined;
  }

  /** Cascade's id for the object, unique within the world: its local id (data model section 1). */
  function localIdOf(object) {
    return meta(object).id;
  }

  /*------------------------------------------------------------------
   *  Weak references (data model V4)
   *-----------------------------------------------------------------*/

  /**
   * A weak reference to a synchronized object, with the interface of
   * JavaScript's WeakRef. It holds the target's identity once it has one, and
   * looks the identity up through `model.resolveWeak`, which the object layer
   * sets. Until then, and when nothing is set, it holds the target through a
   * JavaScript WeakRef.
   */
  class WeakReference {
    constructor(target, id, resolve) {
      this.localTarget = target === undefined ? undefined : new WeakRef(target);
      this.knownId = id;
      // How to find the target by its identity, when it is not at hand: set by the object layer
      // that decoded the reference, or that owns the target.
      this.resolve = resolve || (target !== undefined && infoOf(target) ? infoOf(target).resolve : undefined);
    }

    get id() {
      if (this.knownId === undefined && this.localTarget) {
        const target = this.localTarget.deref();
        if (target !== undefined) this.knownId = identityOf(target);
      }
      return this.knownId;
    }

    deref() {
      const id = this.id;
      const target = this.localTarget ? this.localTarget.deref() : undefined;
      if (target !== undefined) {
        // An object that had an identity and has lost it was reclaimed (data model O3).
        return id !== undefined && identityOf(target) === undefined ? undefined : target;
      }
      const resolve = this.resolve || model.resolveWeak;
      return id !== undefined && resolve ? resolve(id) : undefined;
    }
  }

  function weak(target) {
    if (!isSynchronized(target)) throw new DataModelError("weak() takes a synchronized object, not " + describe(target) + ".");
    return new WeakReference(target, identityOf(target));
  }

  function sameReference(a, b) {
    if (a instanceof WeakReference && b instanceof WeakReference) {
      if (a.id !== undefined || b.id !== undefined) return a.id === b.id;
      return a.deref() === b.deref();
    }
    return a === b;
  }

  /*------------------------------------------------------------------
   *  The write check (data model V9, A2, A5)
   *-----------------------------------------------------------------*/

  /**
   * The kind of a value that a field may hold, or a DataModelError saying why
   * it may not hold it.
   */
  function kindOf(value) {
    if (value === undefined) return "absent";
    if (isPrimitive(value)) return "primitive";
    if (typeof(value) === "bigint") throw new DataModelError("A field cannot hold a bigint.");
    if (typeof(value) === "symbol") throw new DataModelError("A field cannot hold a symbol.");
    if (typeof(value) === "function") throw new DataModelError("A field cannot hold a function. Methods belong on the class.");
    if (isObservable(value)) {
      if (isSynchronized(value)) return "reference";
      if (meta(value).world !== world) throw new DataModelError("A field cannot refer to an object of another Cascade world.");
      throw new DataModelError("A field cannot refer to an observable that is not synchronized. Make it with synchronized(), or extend Synchronized.");
    }
    if (value instanceof WeakReference) return "weak";
    if (value instanceof WeakRef) throw new DataModelError("A field cannot hold JavaScript's WeakRef. Use weak(object).");
    if (value instanceof Date) return "date";
    if (value instanceof Uint8Array) return "binary";
    if (value instanceof Map) {
      for (const [key, item] of value) { checkCollectionItem(key, "map key"); checkCollectionItem(item, "map value"); }
      return "map";
    }
    if (value instanceof Set) {
      for (const item of value) checkCollectionItem(item, "set element");
      return "set";
    }
    if (checkFrozenValue(value, isObservable)) return "frozen";
    if (Array.isArray(value) || isPlainObject(value)) {
      throw new DataModelError("A field cannot hold " + describe(value) + " that is neither synchronized nor frozen. Use synchronized(...) for an object of its own, or Object.freeze(...) for a value.");
    }
    throw new DataModelError("A field cannot hold " + describe(value) + ". A class whose instances are stored extends Synchronized.");
  }

  function checkCollectionItem(item, what) {
    const kind = kindOf(item);
    if (kind === "absent" || kind === "map" || kind === "set") {
      throw new DataModelError("A " + what + " cannot be " + (kind === "absent" ? "undefined" : "a " + kind) + ".");
    }
  }

  function checkField(key, value, operation = "set") {
    if (typeof(key) === "symbol") throw new DataModelError("A synchronized object cannot have symbol keys.");
    if (operation === "delete") return;
    kindOf(value);
  }

  function checkElement(value) {
    if (value === undefined) {
      throw new DataModelError("An element of a synchronized array cannot be undefined, and an array cannot have holes (data model A2).");
    }
    kindOf(value);
  }

  function checkArrayWrite(key, value, operation = "set") {
    if (operation === "add") return checkElement(value);
    if (operation === "delete") throw new DataModelError("Deleting an element would leave a hole (data model A2). Use splice().");
    if (operation !== "set") return; // an array method, asked once before it runs
    if (key === "length") return;
    if (key === undefined || isIndex(key)) return checkElement(value);
    throw new DataModelError("A synchronized array has no named fields (data model A5): \"" + String(key) + "\".");
  }

  function isIndex(key) {
    return typeof(key) === "string" && String(Number(key) >>> 0) === key && Number(key) !== 4294967295;
  }

  /*------------------------------------------------------------------
   *  Classes (data model section 5)
   *-----------------------------------------------------------------*/

  const classesByName = new Map();
  const namesByClass = new Map();

  function registerClass(Class, options = {}) {
    if (typeof(Class) !== "function" || !(Class.prototype instanceof Synchronized)) {
      throw new DataModelError("A registered class extends Synchronized (data model C1).");
    }
    const name = options.name || Class.name;
    if (!name) throw new DataModelError("A registered class needs a name.");
    if (name === OBJECT_CLASS || name === ARRAY_CLASS) throw new DataModelError("\"" + name + "\" is a built-in class name (data model C3).");
    if (name.startsWith("$")) throw new DataModelError("A class name cannot begin with \"$\".");
    const version = options.version !== undefined ? options.version : (Class.version !== undefined ? Class.version : 0);
    if (!Number.isInteger(version) || version < 0) throw new DataModelError("A class version is a non-negative integer (data model C5).");
    const existing = classesByName.get(name);
    if (existing && existing.Class !== Class) throw new DataModelError("Another class is already registered as \"" + name + "\".");
    for (let scan = Class; scan && scan !== Synchronized; scan = Object.getPrototypeOf(scan)) checkNoPrivateMembers(scan);
    // Migrations (design section 8): one function for each older version, named by the version
    // it migrates from. Applying them is the object layer's, when it loads an older record.
    const migrations = options.migrations !== undefined ? options.migrations : (Class.migrations !== undefined ? Class.migrations : {});
    if (migrations === null || typeof(migrations) !== "object") throw new DataModelError("A class's migrations are an object of functions, named by the version each migrates from.");
    for (const key of Object.keys(migrations)) {
      const from = Number(key);
      if (!Number.isInteger(from) || from < 0 || from >= version || typeof(migrations[key]) !== "function") {
        throw new DataModelError("Migration \"" + key + "\" of class \"" + name + "\" is not a function named by a version older than " + version + ".");
      }
    }
    classesByName.set(name, { Class, name, version, migrations });
    namesByClass.set(Class, name);
    return Class;
  }

  function registerClasses(classes) {
    for (const [name, Class] of Object.entries(classes)) registerClass(Class, { name });
  }

  /** Data model C6: refuse private members where they can be seen in the source. */
  function checkNoPrivateMembers(Class) {
    let source;
    try { source = Function.prototype.toString.call(Class); } catch (error) { return; }
    const declaration = /(?:^|[\s;{}])(?:static\s+)?(?:async\s+)?(?:get\s+|set\s+)?\*?\s*#[A-Za-z_$][\w$]*\s*(?:[=;(}]|$)/m;
    if (declaration.test(source)) {
      throw new DataModelError("Class " + (Class.name || "(anonymous)") + " declares #private members, which cannot work on a synchronized object (data model C6). Keep state that is not synchronized in metadata.");
    }
  }

  function classNameOf(object) {
    if (Array.isArray(object)) return ARRAY_CLASS;
    const prototype = Object.getPrototypeOf(object);
    if (prototype === Object.prototype || prototype === null) return OBJECT_CLASS;
    const name = namesByClass.get(prototype.constructor);
    if (name === undefined) throw new DataModelError("The class " + (prototype.constructor && prototype.constructor.name) + " is not registered (data model C1).");
    return name;
  }

  function classByName(name) {
    if (name === OBJECT_CLASS || name === ARRAY_CLASS) return undefined;
    const entry = classesByName.get(name);
    if (!entry) throw new DataModelError("Unknown class \"" + name + "\" (data model C4).");
    return entry;
  }

  function versionOf(name) {
    return name === OBJECT_CLASS || name === ARRAY_CLASS ? 0 : classByName(name).version;
  }

  /** The registered names and versions, in a canonical form, for the digest a client sends (C1). */
  function classesSignature() {
    return [...classesByName.values()].map(({ name, version }) => name + ":" + version).sort().join(",");
  }

  /*------------------------------------------------------------------
   *  Encoding (data model section 8)
   *-----------------------------------------------------------------*/

  /**
   * `references.identify(object, isWeak)` gives the identity to write for a
   * synchronized object. By default it is the object's identity, and an object
   * without one is an error: the object layer decides what a local object is
   * written as (a temporary identity, or a new record).
   */
  function defaultIdentify(object) {
    const id = identityOf(object);
    if (id === undefined) throw new DataModelError("This object has no identity yet, and nothing was given to name it.");
    return id;
  }

  function encodeValue(value, references = {}) {
    const identify = references.identify || defaultIdentify;
    return encodeChecked(value, identify);
  }

  function encodeChecked(value, identify) {
    switch (kindOf(value)) {
      case "absent": return undefined;
      case "primitive": return encodeNumberOr(value);
      case "reference": return { $ref: identify(value, false) };
      case "weak": {
        const target = value.localTarget && value.localTarget.deref();
        const id = value.id !== undefined ? value.id : (target !== undefined ? identify(target, true) : undefined);
        if (id === undefined) throw new DataModelError("A weak reference whose target is gone, and that never had an identity, cannot be encoded.");
        return { $weak: id };
      }
      case "date": {
        const time = value.getTime();
        return { $date: Number.isNaN(time) ? "NaN" : time };
      }
      case "binary": return { $binary: bytesToBase64(value) };
      case "map": return { $map: [...value].map(([key, item]) => [encodeChecked(key, identify), encodeChecked(item, identify)]) };
      case "set": return { $set: [...value].map((item) => encodeChecked(item, identify)) };
      case "frozen": return encodeFrozen(value);
    }
  }

  function encodeNumberOr(value) {
    if (typeof(value) !== "number") return value;
    if (Number.isNaN(value)) return { $number: "NaN" };
    if (value === Infinity) return { $number: "Infinity" };
    if (value === -Infinity) return { $number: "-Infinity" };
    if (Object.is(value, -0)) return { $number: "-0" };
    return value;
  }

  // A frozen value holds only primitives, dates, binary values and frozen values.
  function encodeFrozen(value) {
    if (Array.isArray(value)) {
      const result = [];
      for (let index = 0; index < value.length; index++) {
        const item = value[index];
        result.push(item === undefined ? null : encodeFrozenItem(item));
      }
      return result;
    }
    const result = {};
    for (const key of Object.keys(value)) {
      if (value[key] === undefined) continue;
      result[escapeKey(key)] = encodeFrozenItem(value[key]);
    }
    return result;
  }

  function encodeFrozenItem(item) {
    if (isPrimitive(item)) return encodeNumberOr(item);
    if (item instanceof Date) {
      const time = item.getTime();
      return { $date: Number.isNaN(time) ? "NaN" : time };
    }
    if (item instanceof Uint8Array) return { $binary: bytesToBase64(item) };
    return encodeFrozen(item);
  }

  /**
   * `references.strong(id)` gives the object for a strong reference, and
   * `references.weak(id)` the weak reference; by default a weak reference is
   * made from the identity alone. There is no default for strong references:
   * resolving them is the object layer's (data model K7).
   */
  function decodeValue(encoded, references = {}) {
    if (encoded === null || typeof(encoded) !== "object") {
      if (encoded === undefined || isPrimitive(encoded)) return encoded;
      throw new DataModelError("Not an encoded value: " + describe(encoded) + ".");
    }
    if (Array.isArray(encoded)) return deepFreeze(encoded.map((item) => decodeFrozenItem(item)));
    const keys = Object.keys(encoded);
    if (keys.length === 1 && TAGS.has(keys[0])) return decodeTagged(keys[0], encoded[keys[0]], references);
    return deepFreeze(decodeFrozenObject(encoded));
  }

  function decodeTagged(tag, content, references) {
    switch (tag) {
      case "$number":
        if (content === "NaN") return NaN;
        if (content === "Infinity") return Infinity;
        if (content === "-Infinity") return -Infinity;
        if (content === "-0") return -0;
        throw new DataModelError("Unknown $number: " + content);
      case "$date": return new Date(content === "NaN" ? NaN : content);
      case "$binary": return base64ToBytes(content);
      case "$ref":
        if (!references.strong) throw new DataModelError("A strong reference was decoded, and nothing was given to resolve it.");
        return references.strong(content);
      case "$weak": return references.weak ? references.weak(content) : new WeakReference(undefined, content);
      case "$map": return new Map(content.map(([key, item]) => [decodeValue(key, references), decodeValue(item, references)]));
      case "$set": return new Set(content.map((item) => decodeValue(item, references)));
    }
  }

  // Inside a frozen value, only primitives, dates, binary values and frozen values occur.
  function decodeFrozenItem(item) {
    if (item === null || typeof(item) !== "object") return item;
    if (Array.isArray(item)) return item.map(decodeFrozenItem);
    const keys = Object.keys(item);
    if (keys.length === 1 && TAGS.has(keys[0])) {
      if (keys[0] === "$number" || keys[0] === "$date" || keys[0] === "$binary") return decodeTagged(keys[0], item[keys[0]], {});
      throw new DataModelError("A frozen value cannot contain " + keys[0] + " (data model V5).");
    }
    return decodeFrozenObject(item);
  }

  function decodeFrozenObject(encoded) {
    const result = {};
    for (const key of Object.keys(encoded)) result[unescapeKey(key)] = decodeFrozenItem(encoded[key]);
    return result;
  }

  /*------------------------------------------------------------------
   *  Records (data model 8.1) and making objects (K2)
   *-----------------------------------------------------------------*/

  function encodeRecord(object, references = {}) {
    if (!isSynchronized(object)) throw new DataModelError("encodeRecord() takes a synchronized object, not " + describe(object) + ".");
    const identify = references.identify || defaultIdentify;
    const name = classNameOf(object);
    const record = { $class: name, $version: versionOf(name) };
    if (name === ARRAY_CLASS) {
      record.$elements = [...object].map((item) => encodeChecked(item, identify));
      return record;
    }
    for (const key of Object.keys(object)) {
      const encoded = encodeChecked(object[key], identify);
      if (encoded !== undefined) record[escapeKey(key)] = encoded;
    }
    return record;
  }

  /** The class name, version, and decoded fields (or elements) of a record. */
  function decodeRecord(record, references = {}) {
    if (!isPlainObject(record) || typeof(record.$class) !== "string") throw new DataModelError("Not a record: it has no $class.");
    const name = record.$class;
    const version = record.$version === undefined ? 0 : record.$version;
    if (name === ARRAY_CLASS) {
      const elements = (record.$elements || []).map((item) => decodeValue(item, references));
      return { name, version, elements };
    }
    const fields = {};
    for (const key of Object.keys(record)) {
      if (RECORD_KEYS.has(key)) continue;
      fields[unescapeKey(key)] = decodeValue(record[key], references);
    }
    return { name, version, fields };
  }

  /**
   * Makes an object from a record (data model K2): with its class's prototype,
   * without calling the constructor, without events. `options.id` is its
   * identity. Migration of older versions is Wellspring's, not done here.
   */
  function makeFromRecord(record, references = {}, options = {}) {
    const decoded = decodeRecord(record, references);
    let target;
    if (decoded.name === ARRAY_CLASS) {
      target = decoded.elements;
    } else {
      const entry = classByName(decoded.name);
      target = Object.create(entry ? entry.Class.prototype : Object.prototype);
      for (const key of Object.keys(decoded.fields)) target[key] = decoded.fields[key];
    }
    const object = makeSynchronized(target);
    if (options.id !== undefined) setIdentity(object, options.id);
    return object;
  }

  Object.assign(model, {
    world,
    Synchronized, synchronized, isSynchronized,
    identityOf, setIdentity, clearIdentity, localIdOf, infoOf,
    adopt: (target) => makeSynchronized(target, true),
    addWriteCheck,
    WeakReference, weak,
    kindOf, checkValue: kindOf,
    sameValue: (a, b) => sameValue(a, b, sameReference),
    registerClass, registerClasses, classNameOf, classByName, classesSignature,
    encodeValue, decodeValue, encodeRecord, decodeRecord, makeFromRecord,
    resolveWeak: null,
  });
  return model;
}

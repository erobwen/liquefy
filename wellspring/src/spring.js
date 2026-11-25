/**
 * Objects over records: a Wellspring store, which turns Aquifer's records into synchronized
 * objects and writes their changes back. Designed in documents/design.md, sections 2 to 5; the
 * values and records are documents/data-model.md's.
 *
 *   const spring = open({ store, classes: { Document } });
 *   spring.root.documents = synchronized([]);      // stored at the end of the transaction
 *   spring.root.documents.push(new Document());    // stored too: reachable from the root
 *
 * What is here: the identity map, references resolved when they are read, persistence by
 * reachability, one Aquifer transaction per Cascade transaction, and objects whose records are
 * reclaimed while they are in memory. Loading and holding selections (load), migrations, and
 * persistent repeaters come later (design section 11).
 */

import { Database, ROOT } from "@liquefy/aquifer";
import { DataModelError, ARRAY_CLASS, OBJECT_CLASS, escapeKey, unescapeKey, RECORD_KEYS } from "./values.js";

/** Whether an encoded value contains a strong reference anywhere. */
function holdsReference(encoded) {
  if (encoded === null || typeof(encoded) !== "object") return false;
  if (Array.isArray(encoded)) return encoded.some(holdsReference);
  const keys = Object.keys(encoded);
  if (keys.length === 1 && keys[0] === "$ref") return true;
  return keys.some((key) => holdsReference(encoded[key]));
}

/**
 * The store's side of a world: one Cascade world can serve several stores, each owning the
 * objects it has stored. `world` must have been created with `onEventGlobal` calling
 * `dispatch` (index.js does this for Wellspring's default world).
 */
export function createSpringHost(model) {
  const springs = new Set();
  function dispatch(event) {
    for (const spring of springs) spring.noticeEvent(event);
  }
  function open(options) {
    const spring = new Spring(model, options, () => springs.delete(spring));
    springs.add(spring);
    return spring;
  }
  return { dispatch, open };
}

export class Spring {
  constructor(model, { store, classes, options = {} } = {}, onClose = () => {}) {
    if (!store) throw new DataModelError("open() needs a store: Aquifer's MemoryStore or LmdbStore.");
    this.model = model;
    this.world = model.world;
    this.onClose = onClose;
    if (classes) model.registerClasses(classes);

    this.objects = new Map(); // identity → WeakRef(object): the identity map (data model O4)
    this.forget = new FinalizationRegistry((id) => {
      const entry = this.objects.get(id);
      if (entry !== undefined && entry.deref() === undefined) this.objects.delete(id);
    });
    this.changed = new Set(); // objects of this store written in the current transaction
    this.events = [];
    this.commitListeners = [];
    this.loading = 0;
    this.resolve = (id) => this.objectFor(id);

    this.db = new Database({ store, options: options.aquifer || {}, onReclaimed: (ids) => this.reclaimed(ids) });
    this.lastCommit = this.db.commit();
    this.root = this.objectFor(ROOT);
    this.removeTransactionEndListener = this.world.onTransactionEnd(() => this.flush());
  }

  close() {
    this.removeTransactionEndListener();
    this.onClose();
  }

  /*------------------------------------------------------------------
   *  Ownership
   *-----------------------------------------------------------------*/

  /** Whether an object is stored by this store. */
  owns(object) {
    const info = this.model.infoOf(object);
    return info !== undefined && info.spring === this && info.id !== undefined;
  }

  adoptAs(object, id) {
    this.model.setIdentity(object, id);
    const info = this.model.infoOf(object);
    info.spring = this;
    info.resolve = this.resolve;
    this.objects.set(id, new WeakRef(object));
    this.forget.register(object, id);
  }

  /*------------------------------------------------------------------
   *  Making objects from records (data model K2, K7)
   *-----------------------------------------------------------------*/

  /**
   * The object with the given identity: the one in memory, or one made from its record. Null
   * if there is no such record, which happens only for a reference held by an object whose own
   * record was reclaimed (data model O3).
   */
  objectFor(id) {
    const entry = this.objects.get(id);
    const known = entry && entry.deref();
    if (known !== undefined) return known;
    const record = this.db.get(id);
    if (record === undefined) return null;
    return this.make(id, record);
  }

  make(id, record) {
    const name = record.$class === undefined ? OBJECT_CLASS : record.$class; // ROOT starts without one
    const decodeOptions = {
      strong: (target) => this.objectFor(target),
      weak: (target) => new this.model.WeakReference(undefined, target, this.resolve),
    };

    if (name === ARRAY_CLASS) {
      // An array's elements are resolved when it is made: Cascade copies them then. Arrays are
      // meant to be small (data model A4).
      if (this.making && this.making.has(id)) throw new DataModelError("A cycle of arrays that contain each other cannot be loaded (" + id + ").");
      this.making = this.making || new Set();
      this.making.add(id);
      try {
        const elements = (record.$elements || []).map((item) => this.model.decodeValue(item, decodeOptions));
        const array = this.model.adopt(elements);
        this.adoptAs(array, id);
        return array;
      } finally {
        this.making.delete(id);
      }
    }

    // A record object is made and registered before its fields are set, so that a field that
    // refers back to it finds it. Its fields are set on the target, before anything has read or
    // written them, so they make no events (K2).
    const entry = this.model.classByName(name);
    const target = Object.create(entry ? entry.Class.prototype : Object.prototype);
    const object = this.model.adopt(target);
    this.adoptAs(object, id);
    for (const key of Object.keys(record)) {
      if (RECORD_KEYS.has(key) || key.startsWith("$") && !key.startsWith("$$")) continue;
      const field = unescapeKey(key);
      const encoded = record[key];
      if (holdsReference(encoded)) {
        this.defineLazyField(object, target, field, encoded, decodeOptions);
      } else {
        target[field] = this.model.decodeValue(encoded, decodeOptions);
      }
    }
    return object;
  }

  /**
   * A field that holds a reference is resolved when it is first read (data model K7): until
   * then it is an accessor on the target, which decodes the field, puts the value in its place,
   * and returns it. Writing it first puts the value in place, then writes through the object,
   * so that the write is an ordinary one, with its event.
   */
  defineLazyField(object, target, field, encoded, decodeOptions) {
    const resolve = () => {
      const value = this.model.decodeValue(encoded, decodeOptions);
      Object.defineProperty(target, field, { value, writable: true, enumerable: true, configurable: true });
      return value;
    };
    const get = function () { return resolve(); };
    get.encoded = encoded; // Encoding an unread field copies it, without loading anything.
    Object.defineProperty(target, field, {
      enumerable: true,
      configurable: true,
      get,
      set(value) {
        resolve();
        object[field] = value;
      },
    });
  }

  /*------------------------------------------------------------------
   *  Writing (design section 4)
   *-----------------------------------------------------------------*/

  noticeEvent(event) {
    if (this.loading > 0) return;
    if (event.type !== "set" && event.type !== "delete" && event.type !== "splice") return;
    if (!this.owns(event.object)) return;
    this.changed.add(event.object);
    this.events.push(event);
  }

  /**
   * At the end of each Cascade transaction that changed objects of this store: store every
   * local object that has become reachable from them (data model O2), and write them, in one
   * Aquifer transaction.
   */
  flush() {
    if (this.changed.size === 0) return;
    const changed = [...this.changed];
    const events = this.events;
    this.changed = new Set();
    this.events = [];

    // What becomes shared: local synchronized objects reachable from what changed.
    const created = [];
    const newIds = new Map();
    const visit = (object) => {
      for (const value of this.referencedObjects(object)) {
        if (this.model.identityOf(value) !== undefined || newIds.has(value)) continue;
        newIds.set(value, undefined);
        created.push(value);
        visit(value);
      }
    };
    for (const object of changed) visit(object);

    let commit;
    try {
      this.db.transaction((tx) => {
      for (const object of created) newIds.set(object, tx.create({}));
      const identify = (object, isWeak) => {
        const id = this.model.identityOf(object) ?? newIds.get(object);
        if (id === undefined) {
          throw new DataModelError(isWeak
            ? "A weak reference to an object that is not stored cannot be written: nothing keeps that object."
            : "An object refers to an object that is not stored.");
        }
        return id;
      };
      for (const object of created) tx.replace(newIds.get(object), this.encode(object, identify));
      for (const object of changed) {
        if (this.owns(object)) tx.replace(this.model.identityOf(object), this.encode(object, identify));
      }
      commit = tx;
      });
    } catch (error) {
      this.rollBack(events);
      throw error;
    }
    this.lastCommit = commit.commit;
    for (const object of created) this.adoptAs(object, newIds.get(object));
    const change = { commit: this.lastCommit, created, changed, events };
    for (const listener of this.commitListeners) listener(change);
  }

  /**
   * When a transaction could not be written, the objects in memory are returned to their state
   * before it, from the old values that its events carry (design section 4), so that what is in
   * memory is what is stored. The writes that undo it are not recorded.
   */
  rollBack(events) {
    this.loading++;
    try {
      for (let i = events.length - 1; i >= 0; i--) {
        const event = events[i];
        const object = event.object;
        if (event.type === "set") {
          if (event.oldValue === undefined) delete object[event.property];
          else object[event.property] = event.oldValue;
        } else if (event.type === "delete") {
          object[event.property] = event.deletedValue;
        } else if (event.type === "splice") {
          object.splice(Number(event.index), (event.added || []).length, ...(event.removed || []));
        }
      }
    } finally {
      this.loading--;
    }
  }

  /** The synchronized objects an object refers to strongly, without loading unread fields. */
  referencedObjects(object) {
    const found = [];
    const add = (value) => {
      if (this.model.isSynchronized(value)) found.push(value);
      else if (value instanceof Map) for (const [key, item] of value) { add(key); add(item); }
      else if (value instanceof Set) for (const item of value) add(item);
    };
    if (Array.isArray(object)) {
      for (const item of object) add(item);
      return found;
    }
    const target = this.world.meta(object).target;
    for (const key of Object.keys(object)) {
      const descriptor = Object.getOwnPropertyDescriptor(target, key);
      if (descriptor && descriptor.get && descriptor.get.encoded !== undefined) continue; // unread: stored already
      add(object[key]);
    }
    return found;
  }

  /** An object's record (data model 8.1), copying fields that were never read. */
  encode(object, identify) {
    const name = this.model.classNameOf(object);
    const record = { $class: name, $version: name === OBJECT_CLASS || name === ARRAY_CLASS ? 0 : this.model.classByName(name).version };
    if (name === ARRAY_CLASS) {
      record.$elements = [...object].map((item) => this.model.encodeValue(item, { identify }));
      return record;
    }
    const target = this.world.meta(object).target;
    for (const key of Object.keys(object)) {
      const descriptor = Object.getOwnPropertyDescriptor(target, key);
      const encoded = descriptor && descriptor.get && descriptor.get.encoded !== undefined
        ? descriptor.get.encoded
        : this.model.encodeValue(object[key], { identify });
      if (encoded !== undefined) record[escapeKey(key)] = encoded;
    }
    return record;
  }

  /** Calls `listener({ commit, created, changed, events })` after each commit. Returns a remover. */
  onCommit(listener) {
    this.commitListeners.push(listener);
    return () => { this.commitListeners = this.commitListeners.filter((other) => other !== listener); };
  }

  /*------------------------------------------------------------------
   *  Reclaimed records (data model O3), and background work (design 9.4)
   *-----------------------------------------------------------------*/

  /** An object in memory whose record is reclaimed becomes local again. */
  reclaimed(ids) {
    for (const id of ids) {
      const entry = this.objects.get(id);
      const object = entry && entry.deref();
      this.objects.delete(id);
      if (object === undefined) continue;
      const info = this.model.infoOf(object);
      this.model.clearIdentity(object);
      info.spring = undefined;
    }
  }

  /**
   * Runs up to `steps` steps of background work, and reports how much is left. Today that is
   * the collector's work; persistent repeaters and migrations will join it.
   */
  work(steps = 1) {
    const done = this.db.collector.run(steps);
    const backlog = this.db.collector.backlog();
    const remaining = backlog.cohorts + backlog.items + backlog.structureTasks + backlog.deferrals > 0;
    return { steps: done, remaining, pressure: false, backlog };
  }

  /** Runs background work until none is left, including deferred cuts that are not yet due. */
  workUntilIdle() {
    this.db.collector.run(Infinity, { flush: true });
  }
}

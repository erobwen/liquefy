/**
 * Objects over records: a Deepwell store, which turns Aquifer's records into synchronized
 * objects and writes their changes back. Designed in documents/design.md, sections 2 to 5; the
 * values and records are documents/data-model.md's.
 *
 *   const spring = open({ store, classes: { Document } });
 *   spring.root.documents = synchronized([]);      // stored at the end of the transaction
 *   spring.root.documents.push(new Document());    // stored too: reachable from the root
 *
 * What is here: the identity map, references resolved when they are read, persistence by
 * reachability, one Aquifer transaction per Cascade transaction, objects whose records are
 * reclaimed while they are in memory, load(), which holds a selection in memory and pins it in
 * Aquifer while it is held, checks before writes, volatile objects, which are synchronized but
 * never stored, and migrations. Indexes and persistent repeaters come later (design section 11).
 */

import { Database, ROOT } from "@liquefy/aquifer";
import { DataModelError, ARRAY_CLASS, OBJECT_CLASS, escapeKey, unescapeKey, RECORD_KEYS } from "./values.js";
import { RuleLoad, Selection, NotLoaded } from "./ruleLoad.js";

/** The identities an encoded value refers to strongly, at any depth. */
function collectReferences(encoded, into) {
  if (encoded === null || typeof(encoded) !== "object") return;
  if (Array.isArray(encoded)) {
    for (const item of encoded) collectReferences(item, into);
    return;
  }
  const keys = Object.keys(encoded);
  if (keys.length === 1 && keys[0] === "$ref") into.add(encoded.$ref);
  else for (const key of keys) collectReferences(encoded[key], into);
}

/** Whether an object's class says its instances are volatile: `static volatile = true`. */
function isVolatileClass(object) {
  const prototype = Object.getPrototypeOf(object);
  return Boolean(prototype && prototype.constructor && prototype.constructor.volatile === true);
}

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
 * `dispatch` (index.js does this for Deepwell's default world).
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

    // Loads (design section 3): how many loads hold each object, which held objects are pinned
    // in Aquifer, and the pins and unpins not yet written.
    this.holds = new Map();
    this.pinned = new Set();
    this.pendingPins = new Set();

    // Checks before writes (design section 4), and volatile objects (design section 2).
    this.checks = [];
    this.skipChecks = 0;
    this.nextVolatile = 1;
    this.removeWriteCheck = model.addWriteCheck((object, key, value, operation) => this.checkWrite(object, key, value, operation));

    // Loading by rules, and reads that may have to wait (design section 3.7). `options.wait`
    // makes this a store that waits: a function that is given each read, as a function to call
    // when the read is to arrive. It is how a store on a slow disk, or on another machine, is
    // stood in for. With it, a reference is followed only to what is in memory.
    this.wait = options.wait || null;
    this.inRule = 0; // a rule is running: a reference to what is not in memory reads as a stub
    this.direct = 0; // a read that may go to the store though the store waits
    this.arrived = new Map(); // identity → record, of what a read brought and is being made
    this.gone = new Set(); // identities asked for that have no record
    this.stubs = new Map(); // identity → stub
    this.stubIds = new WeakMap(); // stub → identity

    // Migrations (design section 8).
    this.migrating = 0;
    this.suspendFlush = 0; // a migration is running: its changes are written when it is whole
    this.migrationScan = null; // the background pass that completes migrations

    this.db = new Database({ store, options: options.aquifer || {}, onReclaimed: (ids) => this.reclaimed(ids) });
    this.lastCommit = this.db.commit();
    this.direct++;
    this.root = this.objectFor(ROOT);
    this.direct--;
    this.removeTransactionEndListener = this.world.onTransactionEnd(() => this.flush());
  }

  close() {
    this.removeTransactionEndListener();
    this.removeWriteCheck();
    this.onClose();
  }

  /*------------------------------------------------------------------
   *  Ownership
   *-----------------------------------------------------------------*/

  /** Whether an object belongs to this store: stored by it, or volatile in it. */
  owns(object) {
    const info = this.model.infoOf(object);
    return info !== undefined && info.spring === this && info.id !== undefined;
  }

  /** Whether an object is a volatile object of this store: synchronized, never stored. */
  isVolatile(object) {
    return this.owns(object) && this.model.infoOf(object).volatile === true;
  }

  /** Whether an object is stored by this store. */
  isStored(object) {
    return this.owns(object) && this.model.infoOf(object).volatile !== true;
  }

  adoptAs(object, id) {
    this.model.setIdentity(object, id);
    const info = this.model.infoOf(object);
    info.spring = this;
    info.resolve = this.resolve;
    this.objects.set(id, new WeakRef(object));
    this.forget.register(object, id);
    this.stubs.delete(id);
    if (this.holds.has(object) && !this.pinned.has(object)) this.pendingPins.add(object);
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
    const known = this.inMemory(id);
    if (known !== undefined) return known;
    if (this.gone.has(id)) return null;
    let record = this.arrived.get(id);
    if (record === undefined) {
      // Inside a rule, what is not in memory is not read: the rule gets a stub, which it may
      // add to its selection, and the load asks for all such objects at once (section 3.7).
      if (this.inRule > 0) return this.stubFor(id);
      if (this.wait && this.direct === 0) {
        throw new DataModelError("Object " + id + " is not loaded. With a store that waits, a reference is followed only to what a load has brought into memory (design section 3.7).");
      }
      record = this.db.get(id);
    }
    if (record === undefined) return null;
    const inRule = this.inRule;
    this.inRule = 0; // what is made now is made whole, whoever asked
    try {
      return this.make(id, record);
    } finally {
      this.inRule = inRule;
    }
  }

  /** The object with the given identity if it is in memory, or undefined. */
  inMemory(id) {
    const entry = this.objects.get(id);
    return entry === undefined ? undefined : entry.deref();
  }

  /**
   * A stub: what a reference to an object that is not in memory reads as inside a rule. It has
   * an identity and nothing else. A rule may add it to its selection; reading into it stops the
   * rule, which is run again when the object has arrived.
   */
  stubFor(id) {
    let stub = this.stubs.get(id);
    if (stub === undefined) {
      const stop = () => { throw new NotLoaded(id); };
      stub = new Proxy({}, {
        get: (target, key) => (typeof(key) === "symbol" && key !== Symbol.iterator ? undefined : stop()),
        set: stop, has: stop, ownKeys: stop, deleteProperty: stop, defineProperty: stop, getOwnPropertyDescriptor: stop,
      });
      this.stubs.set(id, stub);
      this.stubIds.set(stub, id);
    }
    return stub;
  }

  /**
   * Reads many objects in one question to the store, makes them, and calls `done` with them.
   * An array is made with its elements (data model A4), so the elements of an array that
   * arrives are asked for before anything is made, in a question of their own. With a store
   * that answers at once, `done` has been called when this returns.
   */
  readMany(ids, done, records = new Map()) {
    const arrive = () => {
      const read = this.db.getMany(ids);
      const more = new Set();
      for (const id of ids) {
        const record = read.get(id);
        if (record === undefined) {
          this.gone.add(id);
          continue;
        }
        records.set(id, record);
        if (record.$class === ARRAY_CLASS) collectReferences(record.$elements, more);
      }
      for (const id of [...more]) {
        if (records.has(id) || this.gone.has(id) || this.inMemory(id) !== undefined) more.delete(id);
      }
      if (more.size > 0) return this.readMany([...more], done, records);

      const made = [];
      for (const [id, record] of records) this.arrived.set(id, record);
      try {
        for (const id of records.keys()) made.push(this.objectFor(id));
      } finally {
        for (const id of records.keys()) this.arrived.delete(id);
      }
      done(made);
    };
    if (this.wait) this.wait(arrive);
    else arrive();
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
    const stored = record.$version === undefined ? 0 : record.$version;
    if (entry && stored !== entry.version) this.migrate(object, id, entry, stored);
    return object;
  }

  /*------------------------------------------------------------------
   *  Migrations (design section 8)
   *-----------------------------------------------------------------*/

  /**
   * Brings an object made from a record of an older version of its class up to the class's
   * version, before anyone has seen it: applies the class's migrations in order, and writes
   * the object back under the new version.
   *
   * It is a transaction of its own, written at once, whatever the code that caused the load is
   * doing: its changes are kept apart from those of a transaction that is under way, are not
   * undone if that one fails, and are not asked about by the checks before writes, since they
   * are Deepwell's and no user's. What the migration reads is not recorded by a computation
   * that is running.
   *
   * If a migration fails, its changes are undone, nothing is written, and the object is
   * dropped from memory, so that the next read tries again from the record.
   */
  migrate(object, id, entry, stored) {
    const give = (error) => {
      this.objects.delete(id);
      this.model.clearIdentity(object);
      this.model.infoOf(object).spring = undefined;
      throw error;
    };
    if (stored > entry.version) {
      give(new DataModelError("Object " + id + " is stored under version " + stored + " of class \"" + entry.name + "\", which is newer than the registered version " + entry.version + "."));
    }
    const saved = { changed: this.changed, events: this.events };
    this.changed = new Set([object]); // written back even if no field changed: the version did
    this.events = [];
    this.skipChecks++;
    this.migrating++;
    const suspendedBefore = this.suspendFlush; // more than zero if this load was made by a migration
    this.suspendFlush++;
    try {
      this.world.withoutRecording(() => this.world.transaction(() => {
        for (let version = stored; version < entry.version; version++) {
          const migration = entry.migrations[version];
          if (typeof(migration) !== "function") {
            throw new DataModelError("Class \"" + entry.name + "\" has no migration from version " + version + ", which object " + id + " is stored under.");
          }
          migration(object);
        }
      }));
      this.suspendFlush = 0;
      this.flush();
    } catch (error) {
      this.rollBack(this.events);
      give(error);
    } finally {
      this.suspendFlush = suspendedBefore;
      this.migrating--;
      this.skipChecks--;
      this.changed = saved.changed;
      this.events = saved.events;
    }
  }

  /**
   * Starts completing migrations in the background: every stored object of an older version
   * than its class is loaded, which migrates it, a few at a time, by work(). When it is done,
   * no record of an older version is left, and the migrations from those versions can be
   * removed from the classes.
   */
  completeMigrations() {
    this.migrationScan = { ids: this.db.objectIds(), next: 0, migrated: 0 };
  }

  /** One step of completing migrations: looks at a batch of records. True if more remain. */
  migrationStep(batch = 50) {
    const scan = this.migrationScan;
    if (!scan) return false;
    const end = Math.min(scan.next + batch, scan.ids.length);
    for (; scan.next < end; scan.next++) {
      const id = scan.ids[scan.next];
      if (this.inMemory(id) !== undefined) continue; // migrated when it was loaded
      const record = this.db.get(id);
      if (record === undefined || record.$class === undefined || record.$class === ARRAY_CLASS || record.$class === OBJECT_CLASS) continue;
      const entry = this.model.classByName(record.$class);
      if ((record.$version === undefined ? 0 : record.$version) >= entry.version) continue;
      this.direct++;
      try {
        this.objectFor(id);
        scan.migrated++;
      } finally {
        this.direct--;
      }
    }
    if (scan.next >= scan.ids.length) this.migrationScan = null;
    return this.migrationScan !== null;
  }

  /**
   * A field that holds a reference is resolved when it is read (data model K7).
   *
   * A field that holds one reference stays an accessor on the target for as long as it is not
   * written: each read looks the object up in the identity map, which holds objects weakly, and
   * makes it from its record if it is not there. The field therefore does not keep the object
   * in memory, and an object that nothing holds can be unloaded (design section 3.4).
   *
   * A field that holds references inside a map or a set is decoded on its first read, and the
   * value put in its place, so that it keeps its identity.
   *
   * Writing such a field first puts its value in place, then writes through the object, so that
   * the write is an ordinary one, with its event.
   */
  defineLazyField(object, target, field, encoded, decodeOptions) {
    const keys = Object.keys(encoded);
    const single = keys.length === 1 && keys[0] === "$ref";
    const resolve = () => {
      // The value is put in place for good, so it is made of objects, never of a rule's stubs.
      const inRule = this.inRule;
      this.inRule = 0;
      try {
        const value = this.model.decodeValue(encoded, decodeOptions);
        Object.defineProperty(target, field, { value, writable: true, enumerable: true, configurable: true });
        return value;
      } finally {
        this.inRule = inRule;
      }
    };
    const get = single
      ? () => this.objectFor(encoded.$ref)
      : function () { return resolve(); };
    get.encoded = encoded; // Encoding an unread field copies it, without loading anything.
    const spring = this;
    Object.defineProperty(target, field, {
      enumerable: true,
      configurable: true,
      get,
      set(value) {
        // The write has been checked already, on its way here.
        resolve();
        spring.skipChecks++;
        try {
          object[field] = value;
        } finally {
          spring.skipChecks--;
        }
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
    if (this.suspendFlush > 0) return;
    const migration = this.migrating > 0;
    if (this.changed.size === 0) {
      this.writePins();
      return;
    }
    const changed = [...this.changed];
    const events = this.events;
    this.changed = new Set();
    this.events = [];

    // What becomes shared: local synchronized objects reachable from what changed. Those that
    // stored objects reach are stored; those that only volatile objects reach become volatile.
    const created = [];
    const newIds = new Map();
    const visit = (object) => {
      for (const value of this.referencedObjects(object)) {
        if (this.model.identityOf(value) !== undefined || newIds.has(value)) continue;
        if (isVolatileClass(value)) {
          this.rollBack(events);
          throw new DataModelError("A stored object cannot refer to an object of a volatile class (" + value.constructor.name + ").");
        }
        newIds.set(value, undefined);
        created.push(value);
        visit(value);
      }
    };
    const storedChanged = changed.filter((object) => !this.isVolatile(object));
    const volatileChanged = changed.filter((object) => this.isVolatile(object));
    for (const object of storedChanged) visit(object);
    const volatileCreated = [];
    for (const object of volatileChanged) volatileCreated.push(...this.makeVolatileFrom(object, newIds));

    if (created.length === 0 && storedChanged.length === 0) {
      this.writePins();
      const change = { commit: null, created, changed, events, volatileCreated, volatileChanged, migration };
      for (const listener of this.commitListeners) listener(change);
      return;
    }

    let commit;
    try {
      this.db.transaction((tx) => {
      for (const object of created) newIds.set(object, tx.create({}));
      const identify = (object, isWeak) => {
        if (this.isVolatile(object)) throw new DataModelError("A stored object cannot refer to a volatile object (design section 2).");
        const id = this.model.identityOf(object) ?? newIds.get(object);
        if (id === undefined) {
          throw new DataModelError(isWeak
            ? "A weak reference to an object that is not stored cannot be written: nothing keeps that object."
            : "An object refers to an object that is not stored.");
        }
        return id;
      };
      for (const object of created) tx.replace(newIds.get(object), this.encode(object, identify));
      for (const object of storedChanged) {
        if (this.isStored(object)) tx.replace(this.model.identityOf(object), this.encode(object, identify));
      }
      for (const object of created) {
        if (this.holds.has(object)) tx.pin(newIds.get(object));
      }
      this.applyPins(tx);
      commit = tx;
      });
    } catch (error) {
      this.rollBack(events);
      throw error;
    }
    this.lastCommit = commit.commit;
    for (const object of created) {
      if (this.holds.has(object)) this.pinned.add(object);
      this.adoptAs(object, newIds.get(object));
    }
    const change = { commit: this.lastCommit, created, changed, events, volatileCreated, volatileChanged, migration };
    for (const listener of this.commitListeners) listener(change);
  }

  /*------------------------------------------------------------------
   *  Volatile objects (design section 2)
   *-----------------------------------------------------------------*/

  /**
   * Makes a local object a volatile object of this store: synchronized, with an identity
   * beginning with "v", but never stored. A stored object can never refer to it. Local objects
   * that it refers to become volatile with it. Fountain makes its sessions, connections and
   * presence objects this way.
   */
  volatile(object) {
    if (!this.model.isSynchronized(object)) throw new DataModelError("volatile() takes a synchronized object.");
    if (this.model.identityOf(object) !== undefined) throw new DataModelError("volatile() takes a local object; this one is stored or volatile already.");
    this.adoptVolatile(object);
    this.makeVolatileFrom(object, new Map());
    return object;
  }

  adoptVolatile(object) {
    this.adoptAs(object, "v" + this.nextVolatile++);
    this.model.infoOf(object).volatile = true;
  }

  /** Makes the local objects that a volatile object reaches volatile. Returns them. */
  makeVolatileFrom(object, alreadyStored) {
    const made = [];
    const visit = (from) => {
      for (const value of this.referencedObjects(from)) {
        if (this.model.identityOf(value) !== undefined || alreadyStored.has(value)) continue;
        this.adoptVolatile(value);
        made.push(value);
        visit(value);
      }
    };
    visit(object);
    return made;
  }

  /*------------------------------------------------------------------
   *  Checks before writes (design section 4)
   *-----------------------------------------------------------------*/

  /**
   * Adds a check, asked before every write to an object of this store, stored or volatile:
   * `check({ object, key, value, operation })`, where `operation` is "set", "delete", "add",
   * or the name of an array method (cascade.reactive's innerMeta(object).checkWrite). It is asked
   * against the state before the write, and refuses the write by throwing; then nothing is
   * written, and there is nothing to undo. Returns a function that removes it.
   *
   * Fountain checks authorization and gated writes this way.
   */
  checkWrites(check) {
    this.checks.push(check);
    return () => { this.checks = this.checks.filter((other) => other !== check); };
  }

  checkWrite(object, key, value, operation) {
    if (this.loading > 0 || this.skipChecks > 0 || !this.owns(object)) return;
    if (!this.isVolatile(object) && this.refersToVolatile(value)) {
      throw new DataModelError("A stored object cannot refer to a volatile object (design section 2).");
    }
    for (const check of this.checks) check({ object, key, value, operation });
  }

  refersToVolatile(value) {
    if (this.model.isSynchronized(value)) return this.isVolatile(value);
    if (value instanceof this.model.WeakReference) {
      const target = value.deref();
      return target !== undefined && target !== null && this.isVolatile(target);
    }
    if (value instanceof Map) {
      for (const [key, item] of value) if (this.refersToVolatile(key) || this.refersToVolatile(item)) return true;
    }
    if (value instanceof Set) {
      for (const item of value) if (this.refersToVolatile(item)) return true;
    }
    return false;
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
    const target = this.world.innerMeta(object).target;
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
    const target = this.world.innerMeta(object).target;
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

  /*------------------------------------------------------------------
   *  Loading (design section 3)
   *-----------------------------------------------------------------*/

  /**
   * Holds what `selector` selects from `start` in memory, and pins the stored objects among
   * it in Aquifer, so that they are not reclaimed while they are held, though nothing in the
   * database may refer to them any longer. Runs `action(selection)` once it is in memory.
   *
   * The selection follows the graph: the selector runs in a repeater, which runs again when
   * something it read changes, and objects that join are held, objects that leave let go.
   * Returns a handle: `handle.selection` is the current selection, a Set, and
   * `handle.release()` ends the load.
   *
   * With a store that answers at once, a reference outside the selection can still be followed
   * (design section 3.6); what the load adds is that its objects stay, and stay pinned.
   *
   * A selector is one of two things (design section 3.7):
   *
   * - A table of local rules by class name, `{ Node: (node, selection) => selection.add(node.left) }`.
   *   Each rule adds what is selected along with one object. The rules are applied in rounds,
   *   with one read of the store for each, and a change to an object runs that object's rule
   *   only. This is the form that works with a store that waits; the action then runs later,
   *   and `handle.loaded` says whether everything selected is in memory.
   * - A function `(start, selection)` that fills the whole selection. It runs again as a whole
   *   when anything it read changes, and needs a store that answers at once.
   *
   * Options, before or after the action: `filter(object)`, for a table of rules, says whether
   * the selection may contain an object, and pass through it. Fountain passes a user's right
   * to read.
   */
  load(start, selector, ...rest) {
    if (!this.owns(start)) throw new DataModelError("load() starts from an object of this store.");
    const action = rest.find((item) => typeof(item) === "function");
    const options = rest.find((item) => item !== null && typeof(item) === "object") || {};
    if (typeof(selector) !== "function") {
      if (selector === null || typeof(selector) !== "object") throw new DataModelError("A selector is a function, or a table of rules by class name.");
      const ruleLoad = new RuleLoad(this, start, selector, action, options);
      this.writePins();
      return ruleLoad.handle;
    }
    const handle = { selection: new Selection(), loaded: true, released: false, release: () => {} };
    let current = new Set();
    const repeater = this.world.repeat("load", () => {
      const selection = new Selection();
      selector(start, selection);
      this.world.withoutRecording(() => {
        for (const object of selection) {
          if (!this.model.isSynchronized(object)) throw new DataModelError("A selector selects synchronized objects only.");
          if (!current.has(object)) this.hold(object);
        }
        for (const object of current) if (!selection.has(object)) this.release(object);
      });
      current = selection;
      handle.selection = selection;
    }, { independent: true });
    handle.release = () => {
      if (handle.released) return;
      handle.released = true;
      this.world.retractRepeater(repeater);
      for (const object of current) this.release(object);
      current = new Selection();
      handle.selection = current;
      handle.loaded = false;
      this.writePins();
    };
    this.writePins();
    if (action) action(handle.selection);
    return handle;
  }

  hold(object) {
    const count = (this.holds.get(object) || 0) + 1;
    this.holds.set(object, count);
    if (count === 1 && this.owns(object) && !this.pinned.has(object)) this.pendingPins.add(object);
  }

  release(object) {
    const count = this.holds.get(object) - 1;
    if (count > 0) {
      this.holds.set(object, count);
      return;
    }
    this.holds.delete(object);
    if (this.pinned.has(object)) this.pendingPins.add(object);
    else this.pendingPins.delete(object);
  }

  /** How many loads hold an object. */
  holdsOf(object) {
    return this.holds.get(object) || 0;
  }

  /** Whether an object is pinned in Aquifer, because a load holds it. */
  isPinned(object) {
    return this.pinned.has(object);
  }

  /** Writes pins and unpins in a transaction of their own, unless there are none. */
  writePins() {
    if (this.pendingPins.size === 0) return;
    this.db.transaction((tx) => this.applyPins(tx));
    this.lastCommit = this.db.lastCommit;
  }

  /** Pins what is held and not pinned, and unpins what is pinned and no longer held. */
  applyPins(tx) {
    for (const object of this.pendingPins) {
      if (!this.owns(object)) continue;
      const id = this.model.identityOf(object);
      if (this.holds.has(object) && !this.pinned.has(object)) {
        tx.pin(id);
        this.pinned.add(object);
      } else if (!this.holds.has(object) && this.pinned.has(object)) {
        tx.unpin(id);
        this.pinned.delete(object);
      }
    }
    this.pendingPins.clear();
  }

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
      this.pinned.delete(object);
    }
  }

  /**
   * Runs up to `steps` steps of background work, and reports how much is left. Today that is
   * the collector's work; persistent repeaters and migrations will join it.
   */
  work(steps = 1) {
    let done = this.db.collector.run(steps);
    // Migrations being completed get as many steps as the collector was offered.
    for (let step = 0; step < steps && this.migrationScan !== null; step++) {
      this.migrationStep();
      done++;
    }
    const backlog = this.db.collector.backlog();
    const migrating = this.migrationScan !== null;
    const remaining = migrating || backlog.cohorts + backlog.items + backlog.structureTasks + backlog.deferrals > 0;
    return { steps: done, remaining, pressure: false, backlog, migrating };
  }

  /** Runs background work until none is left, including deferred cuts that are not yet due. */
  workUntilIdle() {
    while (this.migrationStep()) { /* until every record has been looked at */ }
    this.db.collector.run(Infinity, { flush: true });
  }
}

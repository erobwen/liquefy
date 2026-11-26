/**
 * A persistent object store with change-driven garbage collection.
 *
 * Objects are records of fields, identified by string ids. ROOT always exists. An object stays
 * alive as long as it is reachable from ROOT through strong references (`ref(id)`); weak
 * references (`weak(id)`) do not keep anything alive.
 *
 *   const db = new Database();
 *   db.transaction((tx) => {
 *     const doc = tx.create({ title: "Hello" });
 *     tx.set(ROOT, "doc", ref(doc));
 *   });
 *   db.collector.run(10);   // incremental GC work, interleaved with transactions
 *
 * Application code is expected to only hold ids of objects it reached from ROOT in the same
 * transaction, or ids it has pinned: a pinned object is a volatile root, kept alive though
 * nothing refers to it, until it is unpinned or the database is opened again
 * (documents/persistent-garbage-collection.md §9.4).
 *
 * For the layer above (documents/backlog.md, "The interface upward"):
 *
 *   tx.pin(id), tx.unpin(id), tx.isPinned(id)   volatile roots
 *   tx.commit, db.lastCommit, db.commit()        the commit number of a transaction
 *   tx.lastChanged(id), db.lastChanged(id)       the commit that last changed an object
 *   onReclaimed(ids)                             called after a collector step has committed
 *   db.collector.backlog()                       how much collector work is pending
 */

import { MemoryStore } from "./store/MemoryStore.js";
import { applyBarrier } from "./gc/barrier.js";
import { Collector } from "./gc/Collector.js";
import { GcState, ROOT, ROOT_REGION, keys, clusterRecord } from "./gc/GcState.js";
import { strongReferences, ref } from "./model.js";

/**
 * The field of ROOT that holds the pins (volatile roots). It is Aquifer's: get() leaves it out,
 * set() and delete() refuse it, and replace() keeps it. The layer above escapes its own field
 * names that begin with "$", so it never meets this one.
 */
export const PINS_FIELD = "$pins";
const PIN_BUCKETS = 64;

/** Which of the pin buckets an id goes in: FNV-1a, so that no one record grows large. */
function pinBucket(id) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 0x01000193);
  return "b" + ((hash >>> 0) % PIN_BUCKETS);
}

export class Database {
  constructor({ store = new MemoryStore(), onReclaim, onReclaimed, options = {} } = {}) {
    this.options = options;
    this.store = store;
    store.transaction((tx) => {
      if (tx.has(keys.objectKey(ROOT))) return;
      tx.put(keys.objectKey(ROOT), {});
      tx.put(keys.metaKey(ROOT), { region: ROOT_REGION, treeParent: null, cohort: null, shared: false, deferred: null });
      tx.put(keys.regionKey(ROOT_REGION), { ...clusterRecord(ROOT_REGION, 0, null), objects: 1, weight: 1 });
      tx.put(keys.topKey(ROOT_REGION), true);
      // Says that this store has the edge index, for tools that check it (the oracle).
      if (new GcState(tx, options).options.edgeIndex) tx.put("meta/edgeIndex", true);
      tx.put(keys.regionMemberKey(ROOT_REGION, ROOT), true);
    });
    this.collector = new Collector(store, { onReclaim, onReclaimed, options });
    /** The commit number of the last application transaction run through this object. */
    this.lastCommit = this.commit();
    this.clearPins();
  }

  /**
   * Pins are volatile: they last as long as the process that made them. Opening a database
   * ends the pins of the process before, in one transaction; what nothing else holds is then
   * collected as usual.
   */
  clearPins() {
    const root = this.store.get(keys.objectKey(ROOT));
    if (!root || root[PINS_FIELD] === undefined) return;
    const pinsId = root[PINS_FIELD].$ref;
    const pins = this.store.get(keys.objectKey(pinsId));
    if (!pins || Object.keys(pins).length === 0) return;
    this.transaction((tx) => tx.replace(pinsId, {}));
  }

  /**
   * Runs `fn(tx)` as one atomic transaction, including the write barrier. The transaction's
   * commit number is `tx.commit` afterwards, and `db.lastCommit`.
   */
  transaction(fn) {
    let tx;
    const result = this.store.transaction((storeTransaction) => {
      tx = new ObjectTransaction(storeTransaction, this.options);
      const value = fn(tx);
      tx.finish();
      return value;
    });
    this.lastCommit = tx.commit;
    return result;
  }

  /** The commit number of the last committed application transaction: the logical clock. */
  commit() {
    return this.store.get("meta/clock") ?? 0;
  }

  /** The commit that last changed an object, or undefined if it does not exist. */
  lastChanged(id) {
    if (!this.store.has(keys.objectKey(id))) return undefined;
    return this.store.get(keys.versionKey(id)) ?? 0;
  }

  /** Reads an object's fields from committed state, or undefined if it does not exist. */
  get(id) {
    const record = this.store.get(keys.objectKey(id));
    if (id === ROOT && record) delete record[PINS_FIELD];
    return record;
  }

  /**
   * Reads many objects in one call, from committed state: a Map from each id that exists to its
   * fields. An id with no object is left out. The layer above asks for a whole round of a
   * selection this way, so that a store that has to wait for a read waits once for all of them.
   */
  getMany(ids) {
    const records = new Map();
    for (const id of ids) {
      if (records.has(id)) continue;
      const record = this.get(id);
      if (record !== undefined) records.set(id, record);
    }
    return records;
  }

  /** Ids of all stored objects. */
  objectIds() {
    return this.store.keys("o/").map((key) => key.slice(2));
  }
}

export class ObjectTransaction {
  constructor(storeTransaction, options = {}) {
    this.tx = storeTransaction;
    this.options = options;
    this.gc = new GcState(storeTransaction, options);
    this.created = new Set();
    this.referencesBefore = new Map(); // id → strong references at first modification
    this.holds = new Map(); // id → hold lifetime
    this.releases = new Set();
    this.changed = new Set(); // ids of existing objects this transaction wrote
    /** The commit number of this transaction, once it has finished. */
    this.commit = undefined;
    this.finished = false;
  }

  create(fields = {}) {
    const id = this.gc.nextId("n");
    this.tx.put(keys.objectKey(id), fields);
    this.created.add(id);
    return id;
  }

  get(id) {
    const record = this.read(id);
    if (id === ROOT) delete record[PINS_FIELD];
    return record;
  }

  /** The stored record, with nothing left out. */
  read(id) {
    const record = this.tx.get(keys.objectKey(id));
    if (record === undefined) throw new Error(`No object ${id}`);
    return record;
  }

  /** Whether the object exists. One that is being reclaimed counts as gone already. */
  exists(id) {
    return this.tx.has(keys.objectKey(id)) && !this.gc.isDead(id);
  }

  set(id, field, value) {
    refusePinsField(id, field);
    const record = this.touch(id);
    record[field] = value;
    this.tx.put(keys.objectKey(id), record);
  }

  delete(id, field) {
    refusePinsField(id, field);
    const record = this.touch(id);
    delete record[field];
    this.tx.put(keys.objectKey(id), record);
  }

  /**
   * Holds an object that this transaction disconnects, so that it is not collected while the
   * application keeps it for later: `{ transactions: n }` or `{ milliseconds: n }`.
   *
   * The hold ends when the object is linked in again (automatically, without marking anything),
   * when it expires (then it is collected if nothing references it), or with release(id).
   * If this transaction does not actually detach the object, because it is still referenced
   * through its tree parent or another verified referrer, the hold has no effect
   * (invariants.md, H1).
   */
  hold(id, lifetime) {
    if (!lifetime || (lifetime.transactions === undefined) === (lifetime.milliseconds === undefined)) {
      throw new Error("hold needs exactly one of { transactions } or { milliseconds }");
    }
    this.get(id);
    this.holds.set(id, lifetime);
  }

  /** Ends the hold on an object now: it is collected soon unless it has been linked in again. */
  release(id) {
    this.releases.add(id);
  }

  /** Replaces all fields of an object. ROOT keeps its pins. */
  replace(id, fields) {
    const record = this.touch(id);
    if (id === ROOT) {
      if (Object.prototype.hasOwnProperty.call(fields, PINS_FIELD)) refusePinsField(id, PINS_FIELD);
      if (record[PINS_FIELD] !== undefined) fields = { ...fields, [PINS_FIELD]: record[PINS_FIELD] };
    }
    this.tx.put(keys.objectKey(id), fields);
  }

  /**
   * Pins an object: makes it a volatile root, kept alive though nothing in the database refers
   * to it, until it is unpinned or the database is opened again. Pinning a pinned object, and
   * unpinning one that is not pinned, does nothing; the layer above counts its own holds.
   *
   * A pin is an ordinary strong reference, from a bucket object reachable from ROOT, so the
   * collector's invariants cover pins unchanged.
   */
  pin(id) {
    if (!this.exists(id)) throw new Error(`No object ${id} to pin`);
    const bucket = this.pinBucketOf(id, true);
    if (this.read(bucket)[id] === undefined) this.set(bucket, id, ref(id));
  }

  unpin(id) {
    const bucket = this.pinBucketOf(id, false);
    if (bucket !== undefined && this.read(bucket)[id] !== undefined) this.delete(bucket, id);
  }

  isPinned(id) {
    const bucket = this.pinBucketOf(id, false);
    return bucket !== undefined && this.read(bucket)[id] !== undefined;
  }

  /** The bucket object for an id's pin, made, with the pins object, if `make` and missing. */
  pinBucketOf(id, make) {
    let pins = this.read(ROOT)[PINS_FIELD];
    if (pins === undefined) {
      if (!make) return undefined;
      pins = ref(this.create({}));
      const root = this.touch(ROOT);
      root[PINS_FIELD] = pins;
      this.tx.put(keys.objectKey(ROOT), root);
    }
    const name = pinBucket(id);
    let bucket = this.read(pins.$ref)[name];
    if (bucket === undefined) {
      if (!make) return undefined;
      bucket = ref(this.create({}));
      const record = this.touch(pins.$ref);
      record[name] = bucket;
      this.tx.put(keys.objectKey(pins.$ref), record);
    }
    return bucket.$ref;
  }

  /** The commit that last changed an object (0 if it has not changed since this was kept). */
  lastChanged(id) {
    this.read(id);
    return this.tx.get(keys.versionKey(id)) ?? 0;
  }

  touch(id) {
    const record = this.read(id);
    if (!this.created.has(id)) this.changed.add(id);
    if (!this.created.has(id) && !this.referencesBefore.has(id)) {
      this.referencesBefore.set(id, strongReferences(record));
    }
    return record;
  }

  /** Computes the net edge diff and runs the write barrier. */
  finish() {
    if (this.finished) throw new Error("Transaction already finished");
    this.finished = true;

    const added = [];
    const removed = [];
    const counts = [];

    for (const id of [...this.created, ...this.referencesBefore.keys()]) {
      const record = this.read(id);
      const before = this.referencesBefore.get(id) ?? new Map();
      const after = strongReferences(record);
      // Strong references must point at existing objects. Weak references may dangle (§4.4).
      for (const target of after.keys()) {
        if (!this.exists(target)) throw new Error(`Object ${id} references missing object ${target}`);
      }
      for (const [target, count] of after) {
        if (!before.has(target)) added.push({ source: id, target });
        if (before.get(target) !== count) counts.push({ source: id, target, count });
      }
      for (const target of before.keys()) {
        if (!after.has(target)) {
          removed.push({ source: id, target });
          counts.push({ source: id, target, count: 0 });
        }
      }
    }

    applyBarrier(
      this.tx,
      { created: this.created, added, removed, counts, holds: this.holds, releases: this.releases },
      this.options,
    );

    // The barrier has ticked the clock: this is the transaction's commit number. Every object it
    // changed, and every new object that was kept, records it (backlog, "The interface upward").
    this.commit = this.gc.clock();
    for (const id of [...this.created, ...this.changed]) {
      if (this.tx.has(keys.objectKey(id))) this.tx.put(keys.versionKey(id), this.commit);
    }
  }
}

function refusePinsField(id, field) {
  if (id === ROOT && field === PINS_FIELD) throw new Error(`ROOT's field ${PINS_FIELD} is Aquifer's: use pin() and unpin()`);
}

export { ROOT };

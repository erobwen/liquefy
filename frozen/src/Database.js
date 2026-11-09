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
 * transaction (documents/persistent-garbage-collection.md §9.4 discusses roots held across
 * transactions).
 */

import { MemoryStore } from "./store/MemoryStore.js";
import { applyBarrier } from "./gc/barrier.js";
import { Collector } from "./gc/Collector.js";
import { GcState, ROOT, keys } from "./gc/GcState.js";
import { strongReferences } from "./model.js";

export class Database {
  constructor({ store = new MemoryStore(), onReclaim } = {}) {
    this.store = store;
    store.transaction((tx) => {
      if (tx.has(keys.objectKey(ROOT))) return;
      tx.put(keys.objectKey(ROOT), {});
      tx.put(keys.metaKey(ROOT), { treeParent: null, cohort: null });
    });
    this.collector = new Collector(store, { onReclaim });
  }

  /** Runs `fn(tx)` as one atomic transaction, including the write barrier. */
  transaction(fn) {
    return this.store.transaction((storeTransaction) => {
      const tx = new ObjectTransaction(storeTransaction);
      const result = fn(tx);
      tx.finish();
      return result;
    });
  }

  /** Reads an object's fields from committed state, or undefined if it does not exist. */
  get(id) {
    return this.store.get(keys.objectKey(id));
  }

  /** Ids of all stored objects. */
  objectIds() {
    return this.store.keys("o/").map((key) => key.slice(2));
  }
}

export class ObjectTransaction {
  constructor(storeTransaction) {
    this.tx = storeTransaction;
    this.gc = new GcState(storeTransaction);
    this.created = new Set();
    this.referencesBefore = new Map(); // id → strong references at first modification
    this.finished = false;
  }

  create(fields = {}) {
    const id = this.gc.nextId("n");
    this.tx.put(keys.objectKey(id), fields);
    this.created.add(id);
    return id;
  }

  get(id) {
    const record = this.tx.get(keys.objectKey(id));
    if (record === undefined) throw new Error(`No object ${id}`);
    return record;
  }

  exists(id) {
    return this.tx.has(keys.objectKey(id));
  }

  set(id, field, value) {
    const record = this.touch(id);
    record[field] = value;
    this.tx.put(keys.objectKey(id), record);
  }

  delete(id, field) {
    const record = this.touch(id);
    delete record[field];
    this.tx.put(keys.objectKey(id), record);
  }

  /** Replaces all fields of an object. */
  replace(id, fields) {
    this.touch(id);
    this.tx.put(keys.objectKey(id), fields);
  }

  touch(id) {
    const record = this.get(id);
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

    for (const id of [...this.created, ...this.referencesBefore.keys()]) {
      const record = this.get(id);
      const before = this.referencesBefore.get(id) ?? new Map();
      const after = strongReferences(record);
      // Strong references must point at existing objects. Weak references may dangle (§4.4).
      for (const target of after.keys()) {
        if (!this.exists(target)) throw new Error(`Object ${id} references missing object ${target}`);
      }
      for (const target of after.keys()) {
        if (!before.has(target)) added.push({ source: id, target });
      }
      for (const target of before.keys()) {
        if (!after.has(target)) removed.push({ source: id, target });
      }
    }

    applyBarrier(this.tx, { created: this.created, added, removed });
  }
}

export { ROOT };

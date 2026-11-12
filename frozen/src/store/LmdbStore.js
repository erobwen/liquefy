/**
 * The store on LMDB (the `lmdb` package), with the same interface as MemoryStore: ordered string
 * keys, prefix ranges, and atomic transactions whose reads see their own writes
 * (documents/persistent-garbage-collection.md §4.1).
 *
 *   const store = new LmdbStore("data/my-database");
 *   const db = new Database({ store });
 *   ...
 *   store.close();
 *
 * Everything the database and the collector know is in the store, so a database opened again on
 * the same path continues where it was, in the middle of a collection if need be.
 *
 * It is not exported from the package's index, which must also load in a browser: import it
 * from "@liquefy/frozen/src/store/LmdbStore.js".
 *
 * One difference from MemoryStore: a read of the store itself during a transaction sees that
 * transaction's writes, since LMDB has a single write transaction. Nothing in the database
 * depends on the difference.
 */

import { open } from "lmdb";

/** The end of the key range of a prefix: keys are ASCII, so this sorts after all of them. */
const END = "￿";

export class LmdbStore {
  /**
   * @param path     directory of the database files (created if missing)
   * @param options  passed to lmdb's open(); for example { noSync: true } trades durability of
   *                 the last transactions for speed, as tests do
   */
  constructor(path, options = {}) {
    this.db = open({ path, ...options });
    this.inTransaction = false;
    this.observers = [];
    this.writes = null;
  }

  /** See MemoryStore.observe. */
  observe(observer) {
    this.observers.push(observer);
    return () => {
      this.observers = this.observers.filter((other) => other !== observer);
    };
  }

  notifyRead(key) {
    for (const observer of this.observers) observer.read?.(key);
  }

  get(key) {
    if (this.observers.length > 0) this.notifyRead(key);
    return this.db.get(key);
  }

  has(key) {
    if (this.observers.length > 0) this.notifyRead(key);
    return this.db.doesExist(key);
  }

  /** Entries whose key starts with `prefix`, in key order, as [key, value] pairs. */
  range(prefix) {
    const result = [];
    for (const { key, value } of this.db.getRange({ start: prefix, end: prefix + END })) {
      if (this.observers.length > 0) this.notifyRead(key);
      result.push([key, value]);
    }
    return result;
  }

  /** Keys starting with `prefix`, in order. */
  keys(prefix) {
    const result = [];
    for (const key of this.db.getKeys({ start: prefix, end: prefix + END })) {
      if (this.observers.length > 0) this.notifyRead(key);
      result.push(key);
    }
    return result;
  }

  /**
   * Runs `fn(transaction)` in one LMDB write transaction and commits it. Returns what `fn`
   * returns. If `fn` throws, the transaction is aborted and the error is rethrown.
   */
  transaction(fn) {
    if (this.inTransaction) throw new Error("Transactions do not nest");
    this.inTransaction = true;
    this.writes = this.observers.length > 0 ? new Map() : null;
    try {
      const result = this.db.transactionSync(() => fn(new Transaction(this)));
      if (this.writes !== null) {
        const writes = [...this.writes];
        for (const observer of this.observers) observer.commit?.(writes);
      }
      return result;
    } finally {
      this.inTransaction = false;
      this.writes = null;
    }
  }

  close() {
    return this.db.close();
  }
}

class Transaction {
  constructor(store) {
    this.store = store;
  }

  get(key) {
    return this.store.get(key);
  }

  has(key) {
    return this.store.has(key);
  }

  put(key, value) {
    if (value === undefined) throw new Error(`Cannot store undefined under ${key}`);
    this.store.db.putSync(key, value);
    this.store.writes?.set(key, value);
  }

  delete(key) {
    this.store.db.removeSync(key);
    this.store.writes?.set(key, undefined);
  }

  range(prefix) {
    return this.store.range(prefix);
  }

  keys(prefix) {
    return this.store.keys(prefix);
  }
}

/**
 * An in-memory, ordered key/value store with atomic transactions.
 *
 * This is the stand-in for LMDB or SQLite (see documents/persistent-garbage-collection.md §4.1).
 * Keys are strings and are kept in sorted order, so that prefix ranges can be read in order.
 * Values are plain JSON-like data and are cloned on the way in and out, so that callers can
 * never alias stored data.
 *
 * A transaction buffers its writes and applies them atomically on commit. Reads inside a
 * transaction see the transaction's own writes. If the transaction function throws, nothing is
 * written. There is a single writer: transactions do not nest and do not run concurrently.
 */

const DELETED = Symbol("deleted");

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function lowerBound(sortedKeys, key) {
  let low = 0;
  let high = sortedKeys.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (sortedKeys[middle] < key) low = middle + 1;
    else high = middle;
  }
  return low;
}

export class MemoryStore {
  constructor() {
    this.sortedKeys = [];
    this.values = new Map();
    this.inTransaction = false;
    this.observers = [];
  }

  /**
   * Adds an observer, for tools such as the visualizer: `read(key)` is called for every
   * committed key read (through get, has, range or keys), and `commit(writes)` after every
   * commit with its writes as [key, value] pairs, value undefined for a delete. Observers must
   * not change the values they are given. Returns a function that removes the observer.
   */
  observe(observer) {
    this.observers.push(observer);
    return () => {
      this.observers = this.observers.filter((other) => other !== observer);
    };
  }

  notifyRead(key) {
    for (const observer of this.observers) observer.read?.(key);
  }

  /** Reads committed state. */
  get(key) {
    if (this.observers.length > 0) this.notifyRead(key);
    return clone(this.values.get(key));
  }

  has(key) {
    if (this.observers.length > 0) this.notifyRead(key);
    return this.values.has(key);
  }

  /** Committed entries whose key starts with `prefix`, in key order, as [key, value] pairs. */
  range(prefix) {
    const result = [];
    for (let i = lowerBound(this.sortedKeys, prefix); i < this.sortedKeys.length; i++) {
      const key = this.sortedKeys[i];
      if (!key.startsWith(prefix)) break;
      if (this.observers.length > 0) this.notifyRead(key);
      result.push([key, clone(this.values.get(key))]);
    }
    return result;
  }

  /** Committed keys starting with `prefix`, in order. */
  keys(prefix) {
    const result = [];
    for (let i = lowerBound(this.sortedKeys, prefix); i < this.sortedKeys.length; i++) {
      const key = this.sortedKeys[i];
      if (!key.startsWith(prefix)) break;
      if (this.observers.length > 0) this.notifyRead(key);
      result.push(key);
    }
    return result;
  }

  get size() {
    return this.sortedKeys.length;
  }

  /**
   * Runs `fn(transaction)` and commits its writes atomically. Returns what `fn` returns.
   * If `fn` throws, the writes are discarded and the error is rethrown.
   */
  transaction(fn) {
    if (this.inTransaction) throw new Error("Transactions do not nest");
    this.inTransaction = true;
    try {
      const transaction = new Transaction(this);
      const result = fn(transaction);
      transaction.commit();
      return result;
    } finally {
      this.inTransaction = false;
    }
  }

  putCommitted(key, value) {
    if (!this.values.has(key)) {
      this.sortedKeys.splice(lowerBound(this.sortedKeys, key), 0, key);
    }
    this.values.set(key, value);
  }

  deleteCommitted(key) {
    if (!this.values.has(key)) return;
    this.sortedKeys.splice(lowerBound(this.sortedKeys, key), 1);
    this.values.delete(key);
  }
}

export class Transaction {
  constructor(store) {
    this.store = store;
    this.writes = new Map();
    this.committed = false;
  }

  get(key) {
    if (this.writes.has(key)) {
      const value = this.writes.get(key);
      return value === DELETED ? undefined : clone(value);
    }
    return this.store.get(key);
  }

  has(key) {
    if (this.writes.has(key)) return this.writes.get(key) !== DELETED;
    return this.store.has(key);
  }

  put(key, value) {
    if (value === undefined) throw new Error(`Cannot store undefined under ${key}`);
    this.writes.set(key, clone(value));
  }

  delete(key) {
    this.writes.set(key, DELETED);
  }

  /** Entries starting with `prefix`, seen through this transaction's writes, in key order. */
  range(prefix) {
    const merged = new Map(this.store.range(prefix));
    for (const [key, value] of this.writes) {
      if (!key.startsWith(prefix)) continue;
      if (value === DELETED) merged.delete(key);
      else merged.set(key, clone(value));
    }
    return [...merged.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  }

  keys(prefix) {
    return this.range(prefix).map(([key]) => key);
  }

  commit() {
    if (this.committed) throw new Error("Transaction already committed");
    this.committed = true;
    for (const [key, value] of this.writes) {
      if (value === DELETED) this.store.deleteCommitted(key);
      else this.store.putCommitted(key, value);
    }
    if (this.store.observers.length > 0) {
      const writes = [...this.writes].map(([key, value]) => [key, value === DELETED ? undefined : value]);
      for (const observer of this.store.observers) observer.commit?.(writes);
    }
  }
}

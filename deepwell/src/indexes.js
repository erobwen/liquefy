/**
 * Indexes: a B-tree of persistent objects, kept in order by a key computed from each member.
 * Specified in documents/indexes.md; designed in documents/design.md, sections 6 and 7.
 *
 *   class ProductsByPrice extends Index {
 *     keyOf(product) { return product.price; }
 *   }
 *   well.root.byPrice = new ProductsByPrice();
 *   well.root.byPrice.add(product);
 *   product.price = 12;                              // the entry moves, in the same transaction
 *   well.root.byPrice.members({ from: 10, to: 20 }); // in key order
 *
 * What is here: the tree and its nodes, the key of a member evaluated as a pure function of the
 * member alone, the record each member keeps of the indexes it is in and the key it is filed
 * under in each (which is what triggers a key to be evaluated again when the member is
 * written, with nothing stored in the index for it), and the maintenance that runs at the end
 * of the transaction that wrote the member. Keys that read other objects come later (design
 * section 11, step 9).
 */

import { DataModelError, deepFreeze } from "./values.js";

/*------------------------------------------------------------------
 *  Keys (indexes.md section 3)
 *-----------------------------------------------------------------*/

const RANK = { null: 0, boolean: 1, number: 2, date: 3, string: 4, array: 5 };

function rankOf(key) {
  if (key === null) return RANK.null;
  if (typeof(key) === "boolean") return RANK.boolean;
  if (typeof(key) === "number") return RANK.number;
  if (typeof(key) === "string") return RANK.string;
  if (key instanceof Date) return RANK.date;
  if (Array.isArray(key)) return RANK.array;
  return -1;
}

/** The order of keys: by kind first, then by value; arrays element by element. */
export function compareKeys(a, b) {
  const rank = rankOf(a);
  const difference = rank - rankOf(b);
  if (difference !== 0) return difference;
  switch (rank) {
    case RANK.null: return 0;
    case RANK.boolean: return Number(a) - Number(b);
    case RANK.number: return a < b ? -1 : (a > b ? 1 : 0);
    case RANK.date: return a.getTime() - b.getTime();
    case RANK.string: return a < b ? -1 : (a > b ? 1 : 0);
    default: {
      const shared = Math.min(a.length, b.length);
      for (let i = 0; i < shared; i++) {
        const item = compareKeys(a[i], b[i]);
        if (item !== 0) return item;
      }
      return a.length - b.length;
    }
  }
}

/** A key as it is stored: checked, and frozen, so that nothing can change it where it is filed. */
function normalizeKey(key, index) {
  const refuse = (what) => {
    throw new DataModelError("The key of " + index.constructor.name + " cannot be " + what + ". A key is null, a boolean, a number, a string, a date, or an array of keys (indexes.md section 3).");
  };
  const visit = (value) => {
    if (value === undefined) refuse("undefined");
    if (typeof(value) === "number") {
      if (Number.isNaN(value)) refuse("NaN");
      return value === 0 ? 0 : value; // -0 is filed as 0
    }
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) refuse("an invalid date");
      return new Date(value.getTime());
    }
    if (Array.isArray(value)) return value.map(visit);
    if (rankOf(value) === -1) refuse(typeof(value) === "object" ? "an object" : "a " + typeof(value));
    return value;
  };
  return deepFreeze(visit(key));
}

/** An entry `[key, sequence, slot]` against a key and a sequence number. */
function compareEntry(entry, key, sequence) {
  return compareKeys(entry[0], key) || (entry[1] - sequence);
}

/** The first position whose entry is not before (key, sequence), from `start`. */
function lowerBound(entries, key, sequence, start = 0) {
  let low = start;
  let high = entries.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (compareEntry(entries[middle], key, sequence) < 0) low = middle + 1;
    else high = middle;
  }
  return low;
}

/** The child of an inner node that (key, sequence) belongs under. The first child has no lower bound. */
function childPosition(entries, key, sequence) {
  return lowerBound(entries, key, sequence + 0.5, 1) - 1;
}

const NO_ENTRIES = deepFreeze([]);

function freezeEntries(entries) {
  for (const entry of entries) Object.freeze(entry);
  return Object.freeze(entries);
}

/*------------------------------------------------------------------
 *  The index classes of one data model
 *-----------------------------------------------------------------*/

export function createIndexes(model) {
  const world = model.world;
  const { Synchronized, infoOf, isSynchronized } = model;

  const state = {
    maintaining: 0, // the index's own code is writing: its nodes may be written (I8)
    computing: 0, // a key is being computed: nothing may be written (K2)
    settling: false,
    dirty: new Set(), // members written since their keys were last compared (T1)
    journal: [], // how to undo what a transaction did to the members' records of their indexes
  };

  /**
   * Runs the index's own code: its nodes may be written, and what it does is one transaction,
   * so that the tree, the index and what the member knows of it are stored together.
   */
  function maintain(action) {
    let result;
    state.maintaining++;
    try {
      world.transaction(() => { result = action(); });
    } finally {
      state.maintaining--;
    }
    return result;
  }

  /*------------------------------------------------------------------
   *  Nodes (indexes.md section 4)
   *
   *  A node is one record: `entries`, a frozen array of [key, sequence, slot] in order, and
   *  one field "r<slot>" for each entry, holding the member (in a leaf) or the child (in an
   *  inner node). A reference field of its own for each entry is what lets a node be read
   *  without loading what it refers to: Deepwell resolves such a field when it is read.
   *
   *  In an inner node, the key and sequence of an entry are the least that its child may
   *  hold; those of the first entry are not used.
   *-----------------------------------------------------------------*/

  class IndexNode extends Synchronized {
    constructor(leaf) {
      super();
      this.leaf = leaf;
      this.entries = NO_ENTRIES;
      this.slots = 0;
    }
  }
  model.registerClass(IndexNode, { name: "Deepwell.IndexNode" });

  function referred(node, entry) {
    return node["r" + entry[2]];
  }

  function place(node, position, key, sequence, object) {
    const slot = node.slots;
    node.slots = slot + 1;
    node["r" + slot] = object;
    const entries = node.entries.slice();
    entries.splice(position, 0, [key, sequence, slot]);
    node.entries = freezeEntries(entries);
  }

  function take(node, position) {
    const entry = node.entries[position];
    delete node["r" + entry[2]];
    const entries = node.entries.slice();
    entries.splice(position, 1);
    node.entries = freezeEntries(entries);
  }

  function setLeast(node, position, key, sequence) {
    const entries = node.entries.slice();
    entries[position] = [key, sequence, entries[position][2]];
    node.entries = freezeEntries(entries);
  }

  /** Moves `count` entries, from `start` in one node, to `at` in another. */
  function move(from, start, count, to, at) {
    const moving = from.entries.slice(start, start + count);
    let slot = to.slots;
    const added = [];
    for (const entry of moving) {
      const object = from["r" + entry[2]];
      delete from["r" + entry[2]];
      to["r" + slot] = object;
      added.push([entry[0], entry[1], slot++]);
    }
    to.slots = slot;
    const remaining = from.entries.slice();
    remaining.splice(start, count);
    from.entries = freezeEntries(remaining);
    const entries = to.entries.slice();
    entries.splice(at, 0, ...added);
    to.entries = freezeEntries(entries);
  }

  /** Inserts into the subtree. Returns the node split off to the right, with its least entry, or null. */
  function insert(node, key, sequence, member, order) {
    if (node.leaf) {
      place(node, lowerBound(node.entries, key, sequence), key, sequence, member);
    } else {
      const position = childPosition(node.entries, key, sequence);
      const split = insert(referred(node, node.entries[position]), key, sequence, member, order);
      if (split === null) return null;
      place(node, position + 1, split.key, split.sequence, split.node);
    }
    if (node.entries.length <= order) return null;
    const right = new IndexNode(node.leaf);
    const keep = Math.ceil(node.entries.length / 2);
    const least = node.entries[keep];
    move(node, keep, node.entries.length - keep, right, 0);
    return { key: least[0], sequence: least[1], node: right };
  }

  /** Removes from the subtree. Returns whether the entry was there. */
  function remove(node, key, sequence, order) {
    if (node.leaf) {
      const position = lowerBound(node.entries, key, sequence);
      if (position >= node.entries.length || compareEntry(node.entries[position], key, sequence) !== 0) return false;
      take(node, position);
      return true;
    }
    const position = childPosition(node.entries, key, sequence);
    const child = referred(node, node.entries[position]);
    if (!remove(child, key, sequence, order)) return false;
    if (child.entries.length < Math.floor(order / 2)) rebalance(node, position, child, order);
    return true;
  }

  /** A child has too few entries: it takes one from a sibling, or is joined with one. */
  function rebalance(parent, position, child, order) {
    const least = Math.floor(order / 2);
    const entries = parent.entries;
    const left = position > 0 ? referred(parent, entries[position - 1]) : null;
    if (left !== null && left.entries.length > least) {
      if (!child.leaf) setLeast(child, 0, entries[position][0], entries[position][1]);
      move(left, left.entries.length - 1, 1, child, 0);
      setLeast(parent, position, child.entries[0][0], child.entries[0][1]);
      return;
    }
    const right = position < entries.length - 1 ? referred(parent, entries[position + 1]) : null;
    if (right !== null && right.entries.length > least) {
      if (!child.leaf) setLeast(right, 0, entries[position + 1][0], entries[position + 1][1]);
      move(right, 0, 1, child, child.entries.length);
      setLeast(parent, position + 1, right.entries[0][0], right.entries[0][1]);
      return;
    }
    const into = left !== null ? left : child;
    const from = left !== null ? child : right;
    const fromPosition = left !== null ? position : position + 1;
    if (!from.leaf) setLeast(from, 0, entries[fromPosition][0], entries[fromPosition][1]);
    move(from, 0, from.entries.length, into, into.entries.length);
    take(parent, fromPosition);
  }

  /**
   * Collects the entries between two bounds, in order, as [node, entry] pairs. A bound is
   * { key, sequence }, where a sequence of -Infinity or Infinity puts it before or after every
   * entry of that key. Returns true when `limit` is reached.
   */
  function collect(node, low, high, limit, reverse, found) {
    const entries = node.entries;
    if (node.leaf) {
      if (!reverse) {
        for (let i = low ? lowerBound(entries, low.key, low.sequence) : 0; i < entries.length; i++) {
          if (high && compareEntry(entries[i], high.key, high.sequence) > 0) return true;
          found.push([node, entries[i]]);
          if (found.length >= limit) return true;
        }
      } else {
        for (let i = (high ? lowerBound(entries, high.key, high.sequence + 0.5) : entries.length) - 1; i >= 0; i--) {
          if (low && compareEntry(entries[i], low.key, low.sequence) < 0) return true;
          found.push([node, entries[i]]);
          if (found.length >= limit) return true;
        }
      }
      return false;
    }
    if (!reverse) {
      for (let i = low ? childPosition(entries, low.key, low.sequence) : 0; i < entries.length; i++) {
        if (high && i > 0 && compareEntry(entries[i], high.key, high.sequence) > 0) return true;
        if (collect(referred(node, entries[i]), low, high, limit, reverse, found)) return true;
      }
    } else {
      for (let i = high ? childPosition(entries, high.key, high.sequence) : entries.length - 1; i >= 0; i--) {
        if (collect(referred(node, entries[i]), low, high, limit, reverse, found)) return true;
        if (low && i > 0 && compareEntry(entries[i], low.key, low.sequence) <= 0) return true;
      }
    }
    return false;
  }

  /*------------------------------------------------------------------
   *  What a member knows of its indexes (indexes.md section 5)
   *
   *  For each index a member is in: the key it is filed under there, and its sequence number.
   *  In memory, a Map from the index to { key, sequence }, in the member's metadata; stored in
   *  the member's own record, under `$indexes`, with a weak reference to the index.
   *-----------------------------------------------------------------*/

  /** The member's map of its indexes, or undefined if it is in none. */
  function membershipsOf(member) {
    const info = infoOf(member);
    if (info === undefined) return undefined;
    if (info.indexRecords !== undefined) {
      const records = info.indexRecords;
      info.indexRecords = undefined;
      const map = new Map();
      for (const [reference, key, sequence] of records) {
        const index = info.well ? info.well.indexFor(reference.$weak) : null;
        if (index) map.set(index, { key: normalizeKey(model.decodeValue(key), index), sequence });
      }
      info.indexes = map;
    }
    return info.indexes;
  }

  function membershipOf(member, index) {
    const map = membershipsOf(member);
    return map === undefined ? undefined : map.get(index);
  }

  function setMembership(member, index, entry) {
    const info = infoOf(member);
    let map = membershipsOf(member);
    if (map === undefined) map = info.indexes = new Map();
    const before = map.get(index);
    if (entry === undefined) map.delete(index);
    else map.set(index, entry);
    const indexInfo = infoOf(index);
    if (info.well || indexInfo.well) {
      state.journal.push(() => {
        if (before === undefined) map.delete(index);
        else map.set(index, before);
      });
    }
    if (info.well) info.well.noteChanged(member); // its record holds the entry
  }

  /** The `$indexes` of a member's record, or undefined. `identityOf` may answer undefined. */
  function encodeMemberships(member, identityOf) {
    const info = infoOf(member);
    if (info.indexRecords !== undefined) return info.indexRecords; // never looked at: as stored
    if (info.indexes === undefined || info.indexes.size === 0) return undefined;
    const records = [];
    for (const [index, entry] of info.indexes) {
      const id = identityOf(index);
      // An index that is not stored is not named: it is found again through its own members
      // when it is (see storedIndex()).
      if (id !== undefined) records.push([{ $weak: id }, model.encodeValue(entry.key), entry.sequence]);
    }
    return records.length > 0 ? records : undefined;
  }

  function hasMemberships(info) {
    return info.indexRecords !== undefined || (info.indexes !== undefined && info.indexes.size > 0);
  }

  /*------------------------------------------------------------------
   *  Keys evaluated (indexes.md section 3), and re-evaluated (section 6)
   *-----------------------------------------------------------------*/

  /**
   * The key of a member: `index.keyOf(member)`, as a pure function of the member. While it
   * runs, nothing can be written (K2), and what it reads is recorded: reading a field of any
   * object but the member is refused (K3), since a write to that object would not be noticed.
   */
  function evaluate(index, member) {
    const keyOf = index.keyOf;
    let key;
    let sources;
    state.computing++;
    let invalidator = null;
    try {
      invalidator = world.invalidateOnChange("index key", () => { key = keyOf.call(index, member); }, () => {});
      sources = world.sourcesOf(invalidator);
    } finally {
      state.computing--;
      if (invalidator !== null) invalidator.dispose();
    }
    for (const source of sources) {
      if (source.object !== member) {
        throw new DataModelError(index.constructor.name + ".keyOf() read " + (source.object === index ? "the index itself" : "another object than its member")
          + (source.key === null ? "" : " (\"" + String(source.key) + "\")")
          + ". A key is computed from the member's own fields only (indexes.md K3); keys that read other objects are step 9 of the design.");
      }
    }
    return normalizeKey(key, index);
  }

  /**
   * Compares the key of every member written since the last time with the key it is filed
   * under, and moves those that differ (T1, T2). Called at the end of every transaction, before
   * anything is stored.
   */
  function settle() {
    if (state.settling || state.dirty.size === 0) return;
    state.settling = true;
    try {
      world.withoutRecording(() => world.transaction(() => maintain(() => {
        while (state.dirty.size > 0) {
          const members = [...state.dirty];
          state.dirty.clear();
          for (const member of members) {
            const map = membershipsOf(member);
            if (map === undefined) continue;
            for (const [index, entry] of [...map]) {
              const key = evaluate(index, member);
              if (compareKeys(key, entry.key) !== 0) index.keyChanged(member, entry.key, key);
            }
          }
        }
      })));
    } catch (error) {
      state.dirty.clear();
      throw error;
    } finally {
      state.settling = false;
    }
  }

  // Every write to a synchronized object is seen here, before it is made: a member that is
  // written is noted (T1), a node is written by its index only (I8), and nothing is written
  // while a key is computed (K2).
  model.addWriteCheck((object) => {
    if (state.computing > 0) {
      throw new DataModelError("An index's keyOf() cannot write: a key is a pure function of its member (indexes.md K2).");
    }
    if (object instanceof IndexNode && state.maintaining === 0) {
      throw new DataModelError("The nodes of an index are written by the index only (indexes.md I8).");
    }
    const info = infoOf(object);
    if (info !== undefined && hasMemberships(info)) state.dirty.add(object);
  });

  // With no store open, nothing else would call settle(). A store calls it itself, where a
  // failure can be undone with the transaction (see Well.flush()).
  world.onTransactionEnd(() => {
    if (state.wells === 0) settle();
  });
  state.wells = 0;

  /*------------------------------------------------------------------
   *  Index (indexes.md section 2)
   *-----------------------------------------------------------------*/

  function boundsOf(options, index) {
    const has = (name) => options[name] !== undefined;
    if (has("from") && has("after")) throw new DataModelError("A range has `from` or `after`, not both.");
    if (has("to") && has("before")) throw new DataModelError("A range has `to` or `before`, not both.");
    const low = has("from") ? { key: normalizeKey(options.from, index), sequence: -Infinity }
      : (has("after") ? { key: normalizeKey(options.after, index), sequence: Infinity } : null);
    const high = has("to") ? { key: normalizeKey(options.to, index), sequence: Infinity }
      : (has("before") ? { key: normalizeKey(options.before, index), sequence: -Infinity } : null);
    return { low, high };
  }

  class Index extends Synchronized {
    /** The most entries a node may hold; at least 4. A subclass may say otherwise. */
    static order = 32;

    constructor() {
      super();
      const order = this.constructor.order;
      if (!Number.isInteger(order) || order < 4) throw new DataModelError("An index's order is an integer of at least 4.");
      maintain(() => {
        this.root = new IndexNode(true);
        this.size = 0;
        this.sequence = 0;
      });
    }

    /** The key of a member: a pure function of the member's own fields. A subclass defines it. */
    keyOf(member) {
      throw new DataModelError(this.constructor.name + " has no keyOf(member).");
    }

    /**
     * Called when a member's key is found to have changed, at the end of the transaction that
     * wrote the member. Moves the member to where its new key belongs. A subclass that keeps
     * more than the tree may extend it.
     */
    keyChanged(member, oldKey, newKey) {
      const entry = membershipOf(member, this);
      maintain(() => {
        this.unfile(oldKey, entry.sequence);
        this.file(member, newKey, entry.sequence);
        setMembership(member, this, { key: newKey, sequence: entry.sequence });
      });
    }

    /** Adds a member. Returns false if it is one already. */
    add(member) {
      if (!isSynchronized(member) || Array.isArray(member)) throw new DataModelError("An index's members are synchronized objects, not arrays or other values.");
      if (member instanceof IndexNode || member === this) throw new DataModelError("An index cannot hold itself, or a node of an index.");
      const info = infoOf(member);
      if (info.volatile === true) throw new DataModelError("An index cannot hold a volatile object.");
      if (membershipOf(member, this) !== undefined) return false;
      const key = evaluate(this, member);
      maintain(() => {
        const sequence = this.sequence;
        this.sequence = sequence + 1;
        this.file(member, key, sequence);
        this.size = this.size + 1;
        setMembership(member, this, { key, sequence });
      });
      return true;
    }

    /** Removes a member. Returns false if it is none. */
    delete(member) {
      const entry = isSynchronized(member) ? membershipOf(member, this) : undefined;
      if (entry === undefined) return false;
      maintain(() => {
        this.unfile(entry.key, entry.sequence);
        this.size = this.size - 1;
        setMembership(member, this, undefined);
      });
      return true;
    }

    has(member) {
      return isSynchronized(member) && membershipOf(member, this) !== undefined;
    }

    /** The key a member is filed under, or undefined if it is no member. */
    filedKeyOf(member) {
      const entry = isSynchronized(member) ? membershipOf(member, this) : undefined;
      return entry === undefined ? undefined : entry.key;
    }

    file(member, key, sequence) {
      const split = insert(this.root, key, sequence, member, this.constructor.order);
      if (split === null) return;
      const root = new IndexNode(false);
      place(root, 0, null, 0, this.root);
      place(root, 1, split.key, split.sequence, split.node);
      this.root = root;
    }

    unfile(key, sequence) {
      if (!remove(this.root, key, sequence, this.constructor.order)) {
        throw new DataModelError("An entry of " + this.constructor.name + " was not where its member says it is filed. The index is damaged; rebuild() makes it again.");
      }
      let root = this.root;
      while (!root.leaf && root.entries.length === 1) root = referred(root, root.entries[0]);
      if (root !== this.root) this.root = root;
    }

    found(options = {}) {
      const { low, high } = boundsOf(options, this);
      const limit = options.limit === undefined ? Infinity : options.limit;
      const found = [];
      if (limit > 0) collect(this.root, low, high, limit, options.reverse === true, found);
      return found;
    }

    /**
     * The members in a range of keys, in key order; members of the same key in the order they
     * were added. Options: `from` and `to` are bounds that are included, `after` and `before`
     * bounds that are not, `limit` the most to return, and `reverse: true` gives the range from
     * its end. Without bounds, every member.
     */
    members(options) {
      return this.found(options).map(([node, entry]) => referred(node, entry));
    }

    /** The keys in a range, one for each member, in order. Loads no member. */
    keys(options) {
      return this.found(options).map(([, entry]) => entry[0]);
    }

    /** The members filed under exactly this key. */
    get(key) {
      return this.members({ from: key, to: key });
    }

    first() {
      return this.members({ limit: 1 })[0];
    }

    last() {
      return this.members({ limit: 1, reverse: true })[0];
    }

    [Symbol.iterator]() {
      return this.members()[Symbol.iterator]();
    }

    /**
     * Makes the tree again from nothing: the same members, each under the key it has now
     * (R1). It reads every member.
     */
    rebuild() {
      maintain(() => {
        const members = this.members();
        this.root = new IndexNode(true);
        let sequence = 0;
        for (const member of members) {
          const key = evaluate(this, member);
          this.file(member, key, sequence);
          setMembership(member, this, { key, sequence });
          sequence++;
        }
        this.sequence = sequence;
        this.size = members.length;
      });
    }

    /**
     * Checks the invariants of indexes.md section 7 against what is there, reading every node
     * and every member. Returns what is wrong, as a list of sentences: empty if nothing is.
     */
    check() {
      const wrong = [];
      const order = this.constructor.order;
      const least = Math.floor(order / 2);
      let count = 0;
      let leafDepth = null;
      let previous = null;
      const visit = (node, depth, low, high, isRoot) => {
        const entries = node.entries;
        if (entries.length > order) wrong.push("A node holds " + entries.length + " entries, more than " + order + " (I3).");
        if (!isRoot && entries.length < least) wrong.push("A node holds " + entries.length + " entries, fewer than " + least + " (I3).");
        if (!node.leaf && entries.length < 2) wrong.push("An inner node has fewer than two children (I3).");
        const fields = Object.keys(node).filter((name) => name.startsWith("r")).sort();
        const slots = entries.map((entry) => "r" + entry[2]).sort();
        if (fields.join() !== slots.join()) wrong.push("A node's reference fields are not those of its entries (I2).");
        if (node.leaf) {
          if (leafDepth === null) leafDepth = depth;
          else if (leafDepth !== depth) wrong.push("Leaves are at different depths (I4).");
          for (const entry of entries) {
            if (previous !== null && compareEntry(previous, entry[0], entry[1]) >= 0) wrong.push("Entries are out of order (I1).");
            if (low !== null && compareEntry(entry, low[0], low[1]) < 0) wrong.push("An entry is before the least its node may hold (I5).");
            if (high !== null && compareEntry(entry, high[0], high[1]) >= 0) wrong.push("An entry is not before the least of the next node (I5).");
            previous = entry;
            count++;
            if (entry[1] >= this.sequence) wrong.push("An entry has a sequence number that the index has not given yet (I7).");
            const member = referred(node, entry);
            const filed = isSynchronized(member) ? membershipOf(member, this) : undefined;
            if (filed === undefined) {
              wrong.push("A member does not know that it is in the index (M1).");
              continue;
            }
            if (compareKeys(filed.key, entry[0]) !== 0 || filed.sequence !== entry[1]) wrong.push("A member is filed under another entry than it knows of (M1).");
            if (compareKeys(evaluate(this, member), entry[0]) !== 0) wrong.push("A member is filed under a key that is not its key now (T2).");
          }
          return;
        }
        for (let i = 0; i < entries.length; i++) {
          const childLow = i === 0 ? low : [entries[i][0], entries[i][1]];
          const childHigh = i === entries.length - 1 ? high : [entries[i + 1][0], entries[i + 1][1]];
          const child = referred(node, entries[i]);
          if (!(child instanceof IndexNode)) {
            wrong.push("An inner node refers to something that is not a node (I2).");
            continue;
          }
          visit(child, depth + 1, childLow, childHigh, false);
        }
      };
      visit(this.root, 0, null, null, true);
      if (count !== this.size) wrong.push("The index says it has " + this.size + " members, and holds " + count + " (I6).");
      return [...new Set(wrong)];
    }
  }

  /*------------------------------------------------------------------
   *  For the store (well.js)
   *-----------------------------------------------------------------*/

  /** The journal so far, taken: the store undoes it if the transaction cannot be written. */
  function takeJournal() {
    const journal = state.journal;
    state.journal = [];
    return journal;
  }

  function undo(journal) {
    for (let i = journal.length - 1; i >= 0; i--) journal[i]();
  }

  /** Sets what a member's record says of its indexes, when the member is made from it. */
  function loadMemberships(member, records) {
    infoOf(member).indexRecords = records;
  }

  /**
   * An index has just been given an identity. Its members' records name it from now on, so
   * the stored members among them are written again.
   */
  function membersToWriteFor(index) {
    return index.members().filter((member) => infoOf(member).well !== undefined);
  }

  return {
    Index, IndexNode, state, maintain, settle, takeJournal, undo,
    encodeMemberships, loadMemberships, membersToWriteFor, compareKeys,
  };
}

# Indexes

*Specification, draft. Part of [Deepwell](../README.md), with [its design](design.md), whose sections 6 and 7 it details for steps 8 and 9 of the roadmap: a B-tree of persistent objects, with keys that read their member, and keys that read other objects. It is implemented in `src/indexes.js`, with what a store adds in `src/well.js`.*

This document states what an index is, what a key is, how the tree is stored, what a member knows of its indexes, when a key is evaluated again, and how a key that reads other objects is evaluated again when one of them is written. Each rule that can be checked is stated as an invariant, with who maintains it and how it is verified, in the style of [the data model](data-model.md).

What is not done is listed in section 9.

---

# 1. Terms

- **Index.** A synchronized object, an instance of a registered class that extends `Index`, which holds a set of members in the order of their keys.
- **Member.** A synchronized record object that has been added to an index. An object can be a member of any number of indexes.
- **Key.** The value an index computes from a member, with `keyOf(member)`, to decide where the member is filed.
- **Sequence number.** A number the index gives a member when it is added, one more for each. A member keeps it for as long as it is a member.
- **Entry.** A member's place in the index: its key and its sequence number. Entries are ordered by key, and entries of the same key by sequence number, so no two entries are equal.
- **Node.** One of the objects the tree is made of, an instance of `Deepwell.IndexNode`.
- **Filed under.** A member is filed under the key of its entry. That may differ from its key now only inside the transaction that wrote the member (T2), or while the member is stale (D3).
- **Source.** A synchronized object, other than the member, that a member's key read a field of.
- **Stale.** A member is stale when one of its sources was written and its key has not been computed since. An index is stale while it has stale members.

---

# 2. The interface

```javascript
class ProductsByPrice extends Index {
    keyOf(product) { return product.price; }
}

well.root.byPrice = new ProductsByPrice();
well.root.byPrice.add(product);

product.price = 12;                                  // the entry moves, in this transaction

well.root.byPrice.members({ from: 10, to: 20 });     // the members, in key order
well.root.byPrice.keys({ after: 10, limit: 5 });     // their keys, without loading them
```

An index class is registered by name, like any class of stored objects. Its `keyOf` is a method, not a closure, so that the code can be found again after a restart (design section 7.1).

| | |
|---|---|
| `add(member)` | Adds a member. False if it is one already. |
| `delete(member)` | Removes a member. False if it is none. |
| `has(member)` | Whether it is a member. |
| `filedKeyOf(member)` | The key it is filed under, or undefined. |
| `size` | The number of members. |
| `members(range)` | The members in a range, in order. |
| `keys(range)` | The keys in a range, one for each member, in order. Loads no member. |
| `get(key)` | The members filed under exactly that key. |
| `first()`, `last()` | The member at either end. |
| `stale` | Whether the index has stale members (D3). |
| `isStale(member)` | Whether that member is stale. |
| `rebuild()` | Makes the trees again from nothing (R1). |
| `check()` | Verifies the invariants below, and returns what is wrong. |

A range is `{ from, to, after, before, limit, reverse }`, all optional. `from` and `to` are bounds that are included; `after` and `before` are bounds that are not. `reverse: true` gives the range from its end. Without bounds, a range is the whole index.

`keyChanged(member, oldKey, newKey)` is called when a member's key is found to have changed (T1). What it does by default is move the entry. A subclass that maintains more than the tree extends it.

`static order` is the most entries a node may hold: 32 by default, at least 4. `static immediate` is how many keys may read one object and still be computed again in the transaction that writes it: 16 by default (D3).

An index is used the same way on objects that are not stored. Nothing in it depends on a store, except what section 5 says of records.

---

# 3. Keys

**K1. A key is an ordered value.** A key is `null`, a boolean, a number other than `NaN`, a string, a valid `Date`, or an array of keys. Keys are ordered by kind, in that order, and then by value: numbers numerically, with `-0` and `0` the same key; dates by time; strings by code unit; arrays element by element, a shorter array before a longer one that begins with it. A key of any other kind, `undefined` among them, is refused where it is computed.
*Maintained by:* `normalizeKey` and `compareKeys`. *Verified by:* a test of the order over every pair of a list of keys, and tests that refuse `undefined`, `NaN` and objects.

**K2. A key is computed without writing.** While `keyOf` runs, every write to a synchronized object throws. A migration of an object that `keyOf` causes to be loaded is not `keyOf`'s write, and is made (design section 8).
*Maintained by:* the data model's write check, asked by the index. *Verified by:* a test with a `keyOf` that writes.

**K3. A key reads stored state only, and what it read is known.** What `keyOf` reads is recorded. The synchronized objects it read a field of, other than the member, are the key's sources (section 7): another object the member refers to, an array or a classless object that is a part of the member, or the index itself. Reading a field of the member that holds a reference is reading the member; reading into what it refers to makes that object a source. A key that read an observable that is not synchronized, or a volatile object, is refused: a write to it could not cause the key to be evaluated again. A key cannot be computed inside `withoutRecording()`, where what it reads cannot be seen; that is refused too.
*Maintained by:* `evaluate`, from what cascade.reactive's `sourcesOf()` reports. *Verified by:* tests with keys that read a referred object, a part, the index, an observable that is not synchronized, and a volatile object.

**K4. A key is a value of its own.** The key an entry holds is frozen, and shares nothing that can change with the member it was computed from.
*Maintained by:* `normalizeKey`, which copies dates and arrays and freezes the result.

---

# 4. The tree

The tree is a B+ tree. Its leaves hold the entries of the members; its inner nodes hold, for each child, the least entry that the child may contain.

A node is one record:

```json
{
  "$class": "Deepwell.IndexNode", "$version": 0,
  "leaf": true,
  "entries": [[10, 4, 0], [10, 7, 2], [12, 1, 1]],
  "slots": 3,
  "r0": { "$ref": "n31" }, "r1": { "$ref": "n12" }, "r2": { "$ref": "n40" }
}
```

`entries` is a frozen value: `[key, sequence number, slot]` for each entry, in order. What an entry refers to, a member in a leaf and a child in an inner node, is in the field named `r` and the slot. `slots` is the next slot to use. In an inner node, the key and sequence number of the first entry are not used: the first child has no lower bound.

A reference has a field of its own because Deepwell resolves a reference field when it is read, and not before (data model K7). A node can therefore be read, and a range of keys answered, without loading anything the node refers to; and a search loads one child for each level, not every child of every node on its way. References in a `Set`, or in an array object, would all be loaded with the node.

**I1. Entries are in order.** Within a leaf, and from each leaf to the next, entries are in strictly increasing order of key and sequence number.

**I2. A node's references are those of its entries.** A node has one field `r<slot>` for each of its entries, and no other. In a leaf it refers to a member; in an inner node, to a node.

**I3. Nodes are neither too full nor too empty.** A node holds at most `order` entries. A node other than the root holds at least half of `order`, rounded down. An inner node has at least two children.

**I4. All leaves are at the same depth.**

**I5. A child holds what its parent says.** Every entry in the subtree of a child is not before the least entry the parent holds for that child, and is before the least entry the parent holds for the next.

**I6. The index knows its size.** `size` is the number of entries in the leaves.

**I7. The sequence number is not used twice.** `sequence` is greater than the sequence number of every entry.

**I8. Only the index writes its nodes.** A write to a node from anything but the index's own code throws (design section 7.1, the second restriction).
*Maintained by:* the data model's write check, asked by the index.

*I1 to I7 are maintained by:* `insert`, `remove` and `rebalance`, which split a node that is too full, and let one that is too empty take an entry from a sibling or join it. *Verified by:* `check()`, which reads the whole tree, after every twentieth step of a fuzzer that adds, removes and writes members, and again after the store has been closed and opened.

**What an operation reads and writes.** A search reads the index object and one node for each level. Adding, removing or moving a member writes the leaf, and the nodes above it that split or are joined; with nodes of 32 entries, a tree of a million members is four or five levels deep. When nodes are split or joined, the references that move are read, which loads the objects they name: about one object loaded for each operation, taken over many.
*Verified by:* tests that count the records read by a range of keys, and the records written by one change of key, in an index of 2000 members.

---

# 5. What a member knows of its indexes

For each index it is in, a member keeps the key it is filed under and its sequence number. In memory this is in the member's untracked metadata. It is stored in the member's own record, under a reserved key:

```json
{
  "$class": "Product", "$version": 0,
  "name": "Chair", "price": 12,
  "$indexes": [[{ "$weak": "n7" }, 12, 4]]
}
```

Each element is the index, as a weak reference; the key, encoded like any value; and the sequence number. It is not a field of the object: application code does not see it, and it is not sent to clients.

This is what makes a write to a member find its entry, with nothing looked up in the index: the member is in memory, since it is being written, and its record came with what it needs. It is stored for the same reason an observer in memory would not do: after a restart, the member is loaded again, and must still know.

**M1. A member and its index agree.** For every member of an index, the member's record of that index holds the key and the sequence number of exactly one entry of the index, which refers to the member; and every entry of an index refers to a member that has such a record.
*Maintained by:* `add`, `delete` and `keyChanged`, which change the tree and the member's record together, in one transaction; and by the store, which undoes both together when a transaction cannot be written. *Verified by:* `check()`.

**M2. A member's record of an index is stored when it changes.** A stored member whose record of an index changed is written in that transaction, also when none of its fields changed.
*Maintained by:* `Well.noteChanged`.

**M3. A member does not keep an index alive, and an index keeps its members.** The reference from a member to an index is weak. The references from the leaves to the members are strong: a member of a stored index is stored, and is not reclaimed while it is a member.

**M4. An index that is gone is forgotten.** A member's record of an index whose record has been reclaimed is dropped when the member's indexes are next looked at.
*Verified by:* a test that removes an index, lets the collector reclaim it, and writes a former member.

**M5. An index that becomes stored is named by its members.** A member's record names only indexes that are stored. When an index is stored after members that were stored already, those members are written again, in the transaction that stores the index.
*Verified by:* a test that fills an index before attaching it to the root, reopens the store, and writes a member.

---

# 6. When a key is evaluated again

**T1. A write to a member evaluates its keys again.** Every write to a member of an index, stored or not, notes the member. At the end of the transaction, before anything is stored, the key of each noted member is computed for each index it is in, and compared with the key it is filed under. Where they differ, `keyChanged` is called, which moves the entry. No dependency is stored: being a member is the trigger (design section 7.2).
*Maintained by:* the write check, which notes the member, and `settle`, which a store calls first thing when it writes a transaction. *Verified by:* the fuzzer of I1 to I7, and a test that writes a member after the store has been opened anew.

**T2. At the end of a transaction, every member that is not stale is filed under its key.** For every member of every index that is not stale (D3), `keyOf(member)` equals the key it is filed under. Inside the transaction that wrote a member, before its end, the index still has the member where it was.
*Verified by:* `check()`, which computes every key again.

**T3. The move is part of the transaction.** What `keyChanged` writes is written in the same Aquifer transaction as the write to the member that caused it. A transaction that cannot be written leaves the tree, and what the members know, as they were before it.
*Verified by:* a test that counts commits, and tests of a transaction whose key cannot be computed.

**T4. A repeater that read a range runs again when the range changes.** Nodes are observable objects, so a Cascade repeater that read a range of an index has read the nodes it passed through, and runs again when one of them is written. A change elsewhere in the tree does not run it again, unless a split or a join reached a node it read.
*Verified by:* a test with two repeaters reading the two ends of an index.

**T5. The index's writes are not asked about.** The checks before writes that a store has been given (design section 4) are not asked about writes made by the index's own code: they are Deepwell's, like a migration's.

---

# 7. Keys that read other objects

A key such as `product.price * product.currency.rate` reads an object other than its member. A write to that object must cause the key to be evaluated again, also when the member is not in memory, and after a restart (design section 7.2).

**What is stored.** Three things, none of them an observer:

- *In the member's record,* with the key it is filed under: the sources of that key, each named by a number that the index gave the source. This is what the key read when it was last computed.

  ```json
  "$indexes": [[{ "$weak": "n7" }, 24, 4, [0]]]
  ```

- *In the source's record,* under a reserved key: for each index that has keys that read it, the number the index gave it.

  ```json
  { "$class": "Currency", "$version": 0, "rate": 2, "$dependents": [[{ "$weak": "n7" }, 0]] }
  ```

- *In the index,* a second tree, `dependencies`, of the same nodes as the first: one entry for each member and source of its key, ordered by the source's number and then by the member's sequence number, referring to the member. The members whose keys read a source are a range of it.

A source's record says only that an index has keys that read it, and by which number. That is one small entry however many keys read the source: a million products that read one currency are a million entries in the index's tree, in nodes that are read a few at a time, and one entry in the currency. The numbers are what lets the entries be ordered, and removed, without loading the source.

**D1. A write to a source is noticed.** Every write to a synchronized object that knows of an index whose keys read it notes the object. At the end of the transaction, before anything is stored, the members whose keys read it are found in the index's `dependencies`, and their keys are computed again (D3 says when). What an index writes to itself as it works, its size and the like, is not noticed; a write to a field of the index by anything else is.
*Maintained by:* the write check, and `settle`. *Verified by:* tests that write a source, also after the store has been opened anew with nothing else in memory.

**D2. The dependencies are those of the keys as last computed.** For every member, the sources in its record are the objects its key read when it was last computed; `dependencies` holds exactly one entry for each member and source in those records, and no other; and every source knows of the index, by the number those records use. When a key is computed again and reads other objects than before, the entries, and the member's record, are changed to match, in the same transaction.
A source that no key reads any longer keeps knowing of the index until it is next written; then it is found to have no readers, and forgets.
*Maintained by:* `refresh`, `add` and `delete`. *Verified by:* `check()`, after every step of a fuzzer that also changes what members refer to, changes sources, and replaces them.

**D3. Few readers are computed again at once, many in the background.** When a source is written, and at most `immediate` keys read it, they are computed again in that transaction, and T2 holds at its end. When more do, the index notes the source in `work`, which is stored, and is stale: the members whose keys read that source, and have not been computed since, may be filed under keys that are no longer theirs, and `isStale(member)` says which they are. A store's `work()` computes them again, fifty for each step, each step a transaction of its own; when a source's readers are all done, it is removed from `work`. A source that is written again while its work is under way starts over.
*Why:* a million keys cannot be computed in the transaction that changed one rate (design section 7.2).
*Verified by:* tests with more readers than `immediate`, of the stale members, of the work done in steps, and of a source written again meanwhile; the fuzzer runs `work` at random, and requires the index to be right whenever it is not stale.

**D4. Work survives a restart.** `work` is a field of the index. An index that is made from its record with work left is taken up again by the store's `work()`.
*Verified by:* a test that reopens the store with work left.
A stale index that nothing has read since the store was opened is not in memory, and its work waits until it is.

**D5. Sources are named when the index is.** Like a member's (M5), a source's record names only indexes that are stored; when an index is stored after its sources, they are written again in the transaction that stores it.
*Verified by:* a test that fills an index before attaching it to the root.

---

# 8. Rebuilding

**R1. An index can be made again from nothing.** `rebuild()` discards both trees and the work, and files every member again under the key it has now, with the dependencies of that key. The result holds the same members, in the same order as before if the index was correct and not stale. It reads every member.
*This is the oracle:* an index that has been maintained through any sequence of changes holds what one rebuilt from nothing holds. *Verified by:* the fuzzer, which compares the index with its members sorted by their keys, and with itself after `rebuild()`.

---

# 9. Not done

- **Coarse dependency records** (design section 7.2): one record saying that an index as a whole depends on an object, in place of an entry for each key that reads it.
- **A key that throws while the index works in the background** (whitepaper section 8.16): the step fails, and is tried again. It should not stop the index.
- **Finding stale indexes that are not in memory** (D4).
- **Member sets that follow a selection** (design section 6.2). Members are added and removed by calling `add` and `delete`.
- **Weak holding of members** (design section 7.2), which needs the collector to call the index's removal code before it reclaims a member. An index holds its members (M3).
- **Rebuilding when the class of an index changes.** `rebuild()` exists, and must be called; a version of the index class is not yet a reason for it, and an index being rebuilt does not say how much of its member set it covers (design section 7.3).
- **A store that waits** (design section 3.7). Moving an entry reads nodes as they are needed, which only a store that answers at once allows.
- **Indexes over volatile objects**, and arrays or classless objects as members.
- **Moving a reference between nodes without loading what it names**, which would make a split or a join read nothing but nodes.
- **Indexes of objects not yet migrated** (design section 8): an index over a field that a migration introduces is correct only for the members that have been loaded since.

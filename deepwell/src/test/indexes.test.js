import assert from "assert";
import { MemoryStore, checkIntegrity } from "@liquefy/aquifer";
import { open, transaction, repeat, Synchronized, synchronized, Index, compareKeys, model, world, DataModelError } from "../index.js";

class Product extends Synchronized {
  constructor(name, price) {
    super();
    this.name = name;
    this.price = price;
    this.tags = synchronized([]);
    this.currency = null;
  }
}
class Currency extends Synchronized {
  constructor(rate) {
    super();
    this.rate = rate;
  }
}
// Small nodes, so that a few dozen members make a tree several levels deep.
class ByPrice extends Index {
  static order = 4;
  keyOf(product) { return product.price; }
}
class ByName extends Index {
  static order = 4;
  keyOf(product) { return [product.name, product.price]; }
}
class ByRate extends Index {
  keyOf(product) { return product.price * product.currency.rate; }
}
class ByTags extends Index {
  keyOf(product) { return product.tags.length; }
}
class Writing extends Index {
  keyOf(product) { product.price = 0; return 0; }
}
class Parameterized extends Index {
  constructor() { super(); this.field = "price"; }
  keyOf(product) { return product[this.field]; }
}
class Wide extends Index {
  keyOf(product) { return product.price; }
}
const classes = { Product, Currency, ByPrice, ByName, ByRate, ByTags, Writing, Parameterized, Wide };

const wells = [];
function openWell(store = new MemoryStore()) {
  const well = open({ store, classes });
  wells.push(well);
  return well;
}
afterEach(() => { while (wells.length) wells.pop().close(); });

function reopen(well) {
  well.close();
  wells.splice(wells.indexOf(well), 1);
  return openWell(well.db.store);
}

function recordsRead(store, action) {
  const read = new Set();
  const stop = store.observe({ read: (key) => { if (key.startsWith("o/")) read.add(key.slice(2)); } });
  try { action(); } finally { stop(); }
  return read;
}

const names = (products) => products.map((product) => product.name);

/** A small deterministic random number generator, so that a failing run can be repeated. */
function random(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("indexes: the order of keys", function () {

  it("orders by kind, then by value, and arrays element by element", function () {
    const ordered = [null, false, true, -Infinity, -1, 0, 1.5, Infinity, new Date(0), new Date(5), "", "a", "b", [], [1], [1, "a"], [2]];
    for (let i = 0; i < ordered.length; i++) {
      for (let j = 0; j < ordered.length; j++) {
        assert.equal(Math.sign(compareKeys(ordered[i], ordered[j])), Math.sign(i - j), i + " against " + j);
      }
    }
  });
});

describe("indexes: members in key order", function () {

  it("keeps its members in key order, and members of one key in the order they were added", function () {
    const well = openWell();
    const index = well.root.byPrice = new ByPrice();
    transaction(() => {
      for (const [name, price] of [["c", 30], ["a", 10], ["b", 20], ["a2", 10], ["d", 40]]) index.add(new Product(name, price));
    });
    assert.deepEqual(names(index.members()), ["a", "a2", "b", "c", "d"]);
    assert.equal(index.size, 5);
    assert.deepEqual(index.keys(), [10, 10, 20, 30, 40]);
    assert.deepEqual(index.check(), []);
  });

  it("answers ranges: bounds that are included or not, a limit, and from the end", function () {
    const well = openWell();
    const index = well.root.byPrice = new ByPrice();
    transaction(() => { for (let i = 0; i < 30; i++) index.add(new Product("p" + i, i)); });
    assert.deepEqual(index.keys({ from: 5, to: 8 }), [5, 6, 7, 8]);
    assert.deepEqual(index.keys({ after: 5, before: 8 }), [6, 7]);
    assert.deepEqual(index.keys({ from: 27 }), [27, 28, 29]);
    assert.deepEqual(index.keys({ to: 2 }), [0, 1, 2]);
    assert.deepEqual(index.keys({ from: 10, limit: 3 }), [10, 11, 12]);
    assert.deepEqual(index.keys({ to: 10, limit: 3, reverse: true }), [10, 9, 8]);
    assert.deepEqual(index.keys({ after: 3, before: 7, reverse: true }), [6, 5, 4]);
    assert.deepEqual(index.keys({ from: 100 }), []);
    assert.deepEqual(names(index.get(12)), ["p12"]);
    assert.equal(index.first().name, "p0");
    assert.equal(index.last().name, "p29");
    assert.deepEqual(names([...index]).length, 30);
    assert.throws(() => index.keys({ from: 1, after: 1 }), DataModelError);
  });

  it("adds a member once, and removes it", function () {
    const well = openWell();
    const index = well.root.byPrice = new ByPrice();
    const product = new Product("a", 1);
    assert.equal(index.add(product), true);
    assert.equal(index.add(product), false);
    assert.equal(index.has(product), true);
    assert.equal(index.filedKeyOf(product), 1);
    assert.equal(index.delete(product), true);
    assert.equal(index.delete(product), false);
    assert.equal(index.has(product), false);
    assert.equal(index.size, 0);
    assert.deepEqual(index.check(), []);
  });

  it("stores a member that is added: the index holds it", function () {
    const well = openWell();
    const index = well.root.byPrice = new ByPrice();
    const product = new Product("kept", 3);
    index.add(product);
    assert.equal(well.isStored(product), true);
    const again = reopen(well);
    assert.deepEqual(names(again.root.byPrice.members()), ["kept"]);
  });

  it("works on objects that are not stored at all", function () {
    const index = new ByPrice();
    const products = [new Product("b", 2), new Product("a", 1), new Product("c", 3)];
    for (const product of products) index.add(product);
    products[0].price = 9;
    assert.deepEqual(names(index.members()), ["a", "c", "b"]);
    assert.deepEqual(index.check(), []);
  });
});

describe("indexes: a member whose key changes", function () {

  it("moves, in the transaction that wrote the member", function () {
    const well = openWell();
    const index = well.root.byPrice = new ByPrice();
    const products = [];
    transaction(() => { for (let i = 0; i < 20; i++) { products.push(new Product("p" + i, i * 10)); index.add(products[i]); } });
    const before = well.lastCommit;
    products[3].price = 155;
    assert.equal(well.lastCommit, before + 1, "one Aquifer transaction: the member and the nodes");
    assert.equal(index.filedKeyOf(products[3]), 155);
    assert.deepEqual(index.keys({ from: 140, to: 160 }), [140, 150, 155, 160]);
    assert.deepEqual(index.check(), []);
  });

  it("does not move for a write that leaves the key as it was", function () {
    const well = openWell();
    const index = well.root.byPrice = new ByPrice();
    const product = new Product("a", 5);
    index.add(product);
    const changed = [];
    well.onCommit((change) => changed.push(...change.changed));
    product.name = "renamed";
    assert.deepEqual(changed, [product], "the member only: no node was written");
  });

  it("is found again after the store is opened anew, with nothing of the index in memory", function () {
    const well = openWell();
    const index = well.root.byPrice = new ByPrice();
    well.root.products = synchronized([]);
    transaction(() => {
      for (let i = 0; i < 20; i++) {
        const product = new Product("p" + i, i);
        well.root.products.push(product);
        index.add(product);
      }
    });
    const again = reopen(well);
    const product = again.root.products[4];
    product.price = 100;
    assert.equal(again.root.byPrice.last(), product);
    assert.deepEqual(again.root.byPrice.check(), []);
    const third = reopen(again);
    assert.equal(third.root.byPrice.last().name, "p4");
    assert.deepEqual(third.root.byPrice.check(), []);
  });

  it("moves in every index it is in", function () {
    const well = openWell();
    const byPrice = well.root.byPrice = new ByPrice();
    const byName = well.root.byName = new ByName();
    const products = [new Product("b", 2), new Product("a", 1), new Product("c", 3)];
    transaction(() => { for (const product of products) { byPrice.add(product); byName.add(product); } });
    transaction(() => { products[0].price = 0; products[0].name = "z"; });
    assert.deepEqual(names(byPrice.members()), ["z", "a", "c"]);
    assert.deepEqual(names(byName.members()), ["a", "c", "z"]);
    assert.deepEqual(byName.keys({ from: ["c"] }), [["c", 3], ["z", 0]]);
    assert.deepEqual([...byPrice.check(), ...byName.check()], []);
  });

  it("reruns a repeater that read the range the member moves into, and no other", function () {
    const well = openWell();
    const index = well.root.byPrice = new ByPrice();
    const products = [];
    transaction(() => { for (let i = 0; i < 40; i++) { products.push(new Product("p" + i, i * 10)); index.add(products[i]); } });
    let low = 0;
    let high = 0;
    let seenLow;
    const lowRepeater = repeat(() => { low++; seenLow = index.keys({ to: 20 }); });
    const highRepeater = repeat(() => { high++; index.keys({ from: 380 }); });
    products[20].price = 15;
    assert.deepEqual(seenLow, [0, 10, 15, 20]);
    assert.equal(low, 2);
    assert.equal(high, 1, "the far end of the tree was not written");
    world.retractRepeater(lowRepeater);
    world.retractRepeater(highRepeater);
  });
});

describe("indexes: what is read from the store", function () {

  it("reads one node for each level, and no member, to answer a range of keys", function () {
    const well = openWell();
    const index = well.root.wide = new Wide();
    transaction(() => { for (let i = 0; i < 2000; i++) index.add(new Product("p" + i, i)); });
    const again = reopen(well);
    const store = again.db.store;
    let keys;
    const read = recordsRead(store, () => { keys = again.root.wide.keys({ from: 1000, limit: 3 }); });
    assert.deepEqual(keys, [1000, 1001, 1002]);
    assert.ok(read.size <= 4, "the index and a path to one leaf, not " + read.size + " records");
  });

  it("reads the members asked for only", function () {
    const well = openWell();
    const index = well.root.wide = new Wide();
    transaction(() => { for (let i = 0; i < 200; i++) index.add(new Product("p" + i, i)); });
    const again = reopen(well);
    const wide = again.root.wide;
    wide.keys({ from: 100, limit: 2 });
    const read = recordsRead(again.db.store, () => { wide.members({ from: 100, limit: 2 }); });
    assert.equal(read.size, 2);
  });

  it("writes the member and the nodes on its path when a key changes, not the tree", function () {
    const well = openWell();
    const index = well.root.wide = new Wide();
    const products = [];
    transaction(() => { for (let i = 0; i < 2000; i++) { products.push(new Product("p" + i, i * 2)); index.add(products[i]); } });
    const written = [];
    well.onCommit((change) => written.push(...change.changed, ...change.created));
    products[500].price = 3001;
    assert.ok(written.length <= 6, "a few records, not " + written.length);
    assert.deepEqual(index.check(), []);
  });
});

describe("indexes: against a model", function () {

  /** What the index should hold: the members sorted by key, those of one key in any order. */
  function expected(members, keyOf) {
    return [...members].sort((a, b) => compareKeys(keyOf(a), keyOf(b)));
  }

  function sameOrder(index, members, keyOf) {
    const found = index.members();
    const wanted = expected(members, keyOf);
    assert.equal(found.length, wanted.length);
    assert.deepEqual(found.map(keyOf), wanted.map(keyOf));
    assert.deepEqual(new Set(found), new Set(wanted));
    assert.equal(index.size, wanted.length);
  }

  for (const seed of [1, 2, 3, 4, 5]) {
    it("random adds, removes and writes leave the index as one built from nothing (seed " + seed + ")", function () {
      this.timeout(20000);
      const next = random(seed);
      const pick = (list) => list[Math.floor(next() * list.length)];
      let well = openWell();
      well.root.byPrice = new ByPrice();
      well.root.byName = new ByName();
      well.root.all = synchronized([]);
      let created = 0;
      const priceOf = (product) => product.price;
      const nameOf = (product) => [product.name, product.price];

      for (let step = 0; step < 400; step++) {
        const all = well.root.all;
        const byPrice = well.root.byPrice;
        const byName = well.root.byName;
        const operations = 1 + Math.floor(next() * 4);
        transaction(() => {
          for (let i = 0; i < operations; i++) {
            const choice = next();
            if (choice < 0.35 || all.length === 0) {
              const product = new Product("n" + Math.floor(next() * 30), Math.floor(next() * 50));
              created++;
              all.push(product);
              byPrice.add(product);
              if (next() < 0.7) byName.add(product);
            } else if (choice < 0.55) {
              const product = pick(all);
              byPrice.delete(product);
              byName.delete(product);
              all.splice(all.indexOf(product), 1);
            } else if (choice < 0.85) {
              pick(all).price = Math.floor(next() * 50);
            } else if (choice < 0.95) {
              pick(all).name = "n" + Math.floor(next() * 30);
            } else {
              const product = pick(all);
              if (!byName.add(product)) byName.delete(product);
            }
          }
        });

        if (step % 20 === 19) {
          const members = [...well.root.all];
          sameOrder(well.root.byPrice, members, priceOf);
          sameOrder(well.root.byName, members.filter((product) => well.root.byName.has(product)), nameOf);
          assert.deepEqual([...well.root.byPrice.check(), ...well.root.byName.check()], [], "step " + step);
        }
        if (step % 100 === 99) {
          well.workUntilIdle();
          assert.deepEqual(checkIntegrity(well.db.store, { quiescent: true }), []);
          well = reopen(well);
          const members = [...well.root.all];
          sameOrder(well.root.byPrice, members, priceOf);
          assert.deepEqual([...well.root.byPrice.check(), ...well.root.byName.check()], [], "after reopening at step " + step);
          // Rebuilt from nothing, it holds the same.
          const before = well.root.byPrice.keys();
          well.root.byPrice.rebuild();
          assert.deepEqual(well.root.byPrice.keys(), before);
          assert.deepEqual(well.root.byPrice.check(), []);
        }
      }
      assert.ok(created > 100);
    });
  }
});

describe("indexes: what is refused", function () {

  it("a key that reads another object than its member", function () {
    const well = openWell();
    const index = well.root.byRate = new ByRate();
    const product = new Product("a", 2);
    product.currency = new Currency(3);
    assert.throws(() => index.add(product), /another object than its member/);
    assert.equal(index.size, 0);
    const byTags = well.root.byTags = new ByTags();
    assert.throws(() => byTags.add(product), /another object than its member/);
    const parameterized = well.root.parameterized = new Parameterized();
    assert.throws(() => parameterized.add(product), /the index itself/);
  });

  it("a key that writes", function () {
    const well = openWell();
    const index = well.root.writing = new Writing();
    const product = new Product("a", 2);
    assert.throws(() => index.add(product), /cannot write/);
    assert.equal(product.price, 2);
  });

  it("a key that is no key, when the member is added and when it is written", function () {
    const well = openWell();
    const index = well.root.byPrice = new ByPrice();
    assert.throws(() => index.add(new Product("a", undefined)), /cannot be undefined/);
    assert.throws(() => index.add(new Product("a", NaN)), /cannot be NaN/);
    const product = new Product("a", 1);
    index.add(product);
    const before = well.lastCommit;
    assert.throws(() => { product.price = Object.freeze({ amount: 2 }); }, /cannot be an object/);
    assert.equal(product.price, 1, "the write is undone");
    assert.equal(index.filedKeyOf(product), 1);
    assert.equal(well.lastCommit, before, "and nothing was stored");
    assert.deepEqual(index.check(), []);
  });

  it("a write to a node by anything but its index", function () {
    const well = openWell();
    const index = well.root.byPrice = new ByPrice();
    index.add(new Product("a", 1));
    assert.throws(() => { index.root.leaf = false; }, /written by the index only/);
    assert.throws(() => { index.root.entries = Object.freeze([]); }, /written by the index only/);
  });

  it("what is no member: arrays, values, volatile objects, the index itself", function () {
    const well = openWell();
    const index = well.root.byPrice = new ByPrice();
    assert.throws(() => index.add(synchronized([])), DataModelError);
    assert.throws(() => index.add({ price: 1 }), DataModelError);
    assert.throws(() => index.add(index), DataModelError);
    assert.throws(() => index.add(well.volatile(new Product("v", 1))), /volatile/);
    assert.equal(index.has({}), false);
    assert.equal(index.delete({}), false);
  });

  it("an index without keyOf, and one of too small an order", function () {
    class NoKey extends Index {}
    class Narrow extends Index { static order = 3; keyOf() { return 0; } }
    model.registerClasses({ NoKey, Narrow });
    assert.throws(() => new NoKey().add(new Product("a", 1)), /has no keyOf/);
    assert.throws(() => new Narrow(), /at least 4/);
  });
});

describe("indexes: a transaction that cannot be stored", function () {

  it("leaves the index, and what its members know of it, as they were", function () {
    const well = openWell();
    const index = well.root.byPrice = new ByPrice();
    const products = [];
    transaction(() => { for (let i = 0; i < 10; i++) { products.push(new Product("p" + i, i)); index.add(products[i]); } });
    const stop = well.checkWrites(({ key, value }) => { if (key === "name" && value === "refused") throw new Error("Refused."); });
    const before = index.keys();
    assert.throws(() => transaction(() => {
      products[2].price = 50;
      index.delete(products[5]);
      index.add(new Product("new", 3.5));
      products[7].name = "refused";
    }), /Refused/);
    stop();
    // The writes before the refused one stand, as in any transaction (design section 4): what
    // matters here is that the index and its members agree.
    assert.deepEqual(index.check(), []);
    assert.equal(index.has(products[5]), false);
    assert.notDeepEqual(index.keys(), before);
  });

  it("undoes the move when the key cannot be computed", function () {
    const well = openWell();
    const index = well.root.byPrice = new ByPrice();
    const products = [];
    transaction(() => { for (let i = 0; i < 10; i++) { products.push(new Product("p" + i, i)); index.add(products[i]); } });
    const before = index.keys();
    assert.throws(() => transaction(() => {
      products[1].price = 70;
      products[2].price = NaN;
    }), /cannot be NaN/);
    assert.equal(products[1].price, 1);
    assert.equal(products[2].price, 2);
    assert.deepEqual(index.keys(), before);
    assert.deepEqual(index.check(), []);
    const again = reopen(well);
    assert.deepEqual(again.root.byPrice.keys(), before);
    assert.deepEqual(again.root.byPrice.check(), []);
  });
});

describe("indexes: an index that is stored after its members", function () {

  it("is known to members that were stored before it was", function () {
    const well = openWell();
    well.root.products = synchronized([]);
    const product = new Product("early", 1);
    well.root.products.push(product);
    const index = new ByPrice();
    index.add(product);
    assert.equal(well.isStored(index), false);
    well.root.byPrice = index;
    const again = reopen(well);
    again.root.products[0].price = 9;
    assert.deepEqual(again.root.byPrice.keys(), [9]);
    assert.deepEqual(again.root.byPrice.check(), []);
  });

  it("is forgotten by its members when it is gone", function () {
    const well = openWell();
    well.root.products = synchronized([]);
    const product = new Product("stays", 1);
    well.root.products.push(product);
    well.root.byPrice = new ByPrice();
    well.root.byPrice.add(product);
    delete well.root.byPrice;
    well.workUntilIdle();
    const again = reopen(well);
    again.root.products[0].price = 5; // the index it names is no more: nothing to move
    assert.equal(again.root.products[0].price, 5);
    assert.deepEqual(checkIntegrity(again.db.store, { quiescent: true }), []);
  });
});

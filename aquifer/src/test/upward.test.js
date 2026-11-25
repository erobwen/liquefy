import assert from "node:assert/strict";
import { Database, ROOT, PINS_FIELD } from "../Database.js";
import { MemoryStore } from "../store/MemoryStore.js";
import { ref, weak } from "../model.js";
import { reachableFromRoot, checkIntegrity } from "../oracle.js";

// The interface upward (documents/backlog.md): volatile roots, commit numbers, the commit that
// last changed each object, notification after reclaim, and the collector's backlog.

function setup(store = new MemoryStore()) {
  const reclaimed = [];
  const db = new Database({
    store,
    onReclaimed: (ids) => {
      // Called after the step has committed: the objects are gone from committed state.
      for (const id of ids) assert.equal(db.get(id), undefined, `${id} is reported reclaimed but still stored`);
      reclaimed.push(...ids);
    },
  });
  return { db, reclaimed };
}

function collectAll(db) {
  db.collector.run(Infinity, { flush: true });
}

function assertIntegrity(db) {
  const problems = checkIntegrity(db.store);
  assert.deepEqual(problems, []);
}

describe("volatile roots (pin, unpin)", function () {

  it("keeps a pinned object, and what it refers to, though nothing else refers to it", function () {
    const { db, reclaimed } = setup();
    let document, chapter;
    db.transaction((tx) => {
      chapter = tx.create({ title: "One" });
      document = tx.create({ chapter: ref(chapter) });
      tx.set(ROOT, "document", ref(document));
    });
    db.transaction((tx) => {
      tx.pin(document);
      tx.delete(ROOT, "document");
    });
    collectAll(db);
    assert.ok(db.get(document) && db.get(chapter), "pinned and kept");
    assert.deepEqual(reclaimed, []);
    assertIntegrity(db);

    db.transaction((tx) => tx.unpin(document));
    collectAll(db);
    assert.equal(db.get(document), undefined);
    assert.equal(db.get(chapter), undefined);
    assert.deepEqual(new Set(reclaimed), new Set([document, chapter]));
    assertIntegrity(db);
  });

  it("can be linked in again after being pinned, and unpinned without loss", function () {
    const { db } = setup();
    let item;
    db.transaction((tx) => {
      item = tx.create({});
      tx.set(ROOT, "here", ref(item));
    });
    db.transaction((tx) => { tx.pin(item); tx.delete(ROOT, "here"); });
    collectAll(db);
    db.transaction((tx) => { tx.set(ROOT, "there", ref(item)); tx.unpin(item); });
    collectAll(db);
    assert.ok(db.get(item));
    assert.ok(reachableFromRoot(db.store).has(item));
    assertIntegrity(db);
  });

  it("pinning twice and unpinning what is not pinned do nothing", function () {
    const { db } = setup();
    let item;
    db.transaction((tx) => { item = tx.create({}); tx.set(ROOT, "item", ref(item)); });
    db.transaction((tx) => {
      assert.equal(tx.isPinned(item), false);
      tx.unpin(item);
      tx.pin(item);
      tx.pin(item);
      assert.equal(tx.isPinned(item), true);
    });
    db.transaction((tx) => { tx.unpin(item); assert.equal(tx.isPinned(item), false); });
    assertIntegrity(db);
  });

  it("refuses to pin what does not exist", function () {
    const { db } = setup();
    assert.throws(() => db.transaction((tx) => tx.pin("n999")), /No object n999/);
  });

  it("ends when the database is opened again", function () {
    const store = new MemoryStore();
    const first = setup(store);
    let item;
    first.db.transaction((tx) => { item = tx.create({}); tx.set(ROOT, "item", ref(item)); });
    first.db.transaction((tx) => { tx.pin(item); tx.delete(ROOT, "item"); });
    collectAll(first.db);
    assert.ok(first.db.get(item));

    const second = setup(store); // a new process
    second.db.transaction((tx) => assert.equal(tx.isPinned(item), false));
    collectAll(second.db);
    assert.equal(second.db.get(item), undefined);
    assertIntegrity(second.db);
  });

  it("hides ROOT's pins field from the layer above, and keeps it from being written", function () {
    const { db } = setup();
    let item;
    db.transaction((tx) => { item = tx.create({}); tx.set(ROOT, "item", ref(item)); tx.pin(item); });
    assert.equal(db.get(ROOT)[PINS_FIELD], undefined);
    db.transaction((tx) => {
      assert.equal(tx.get(ROOT)[PINS_FIELD], undefined);
      assert.throws(() => tx.set(ROOT, PINS_FIELD, 1), /Aquifer/);
      assert.throws(() => tx.delete(ROOT, PINS_FIELD), /Aquifer/);
      assert.throws(() => tx.replace(ROOT, { [PINS_FIELD]: 1 }), /Aquifer/);
      tx.replace(ROOT, { item: ref(item) });
      assert.equal(tx.isPinned(item), true, "replace() keeps the pins");
    });
    assertIntegrity(db);
  });

  it("spreads many pins over buckets", function () {
    const { db } = setup();
    const ids = [];
    db.transaction((tx) => {
      for (let i = 0; i < 500; i++) ids.push(tx.create({ i }));
      const list = tx.create({});
      tx.set(ROOT, "list", ref(list));
      ids.forEach((id, i) => tx.set(list, "k" + i, ref(id)));
    });
    db.transaction((tx) => { for (const id of ids) tx.pin(id); tx.delete(ROOT, "list"); });
    collectAll(db);
    assert.ok(ids.every((id) => db.get(id)));
    const pins = db.store.get("o/" + db.store.get("o/" + ROOT)[PINS_FIELD].$ref);
    const largest = Math.max(...Object.values(pins).map((bucket) => Object.keys(db.store.get("o/" + bucket.$ref)).length));
    assert.ok(largest < 30, `the largest bucket holds ${largest} pins`);
    db.transaction((tx) => { for (const id of ids) tx.unpin(id); });
    collectAll(db);
    assert.ok(ids.every((id) => db.get(id) === undefined));
    assertIntegrity(db);
  });
});

describe("commit numbers, and the commit that last changed an object", function () {

  it("numbers every application transaction, in order", function () {
    const { db } = setup();
    const start = db.commit();
    let first, second;
    db.transaction((tx) => { tx.set(ROOT, "a", 1); first = tx; });
    db.transaction((tx) => { tx.set(ROOT, "a", 2); second = tx; });
    assert.equal(first.commit, start + 1);
    assert.equal(second.commit, start + 2);
    assert.equal(db.lastCommit, start + 2);
    assert.equal(db.commit(), start + 2);
  });

  it("does not number collector steps", function () {
    const { db } = setup();
    let item;
    db.transaction((tx) => { item = tx.create({}); tx.set(ROOT, "item", ref(item)); });
    db.transaction((tx) => tx.delete(ROOT, "item"));
    const before = db.commit();
    collectAll(db);
    assert.equal(db.commit(), before);
  });

  it("records, for each object, the commit that last changed it", function () {
    const { db } = setup();
    let a, b, created;
    db.transaction((tx) => {
      a = tx.create({ n: 1 });
      b = tx.create({ n: 1 });
      tx.set(ROOT, "a", ref(a));
      tx.set(ROOT, "b", ref(b));
      created = tx.commit;
    });
    created = db.lastCommit;
    assert.equal(db.lastChanged(a), created);
    assert.equal(db.lastChanged(b), created);
    db.transaction((tx) => tx.set(a, "n", 2));
    assert.equal(db.lastChanged(a), db.lastCommit);
    assert.equal(db.lastChanged(b), created, "an object that was not written keeps its commit");
    db.transaction((tx) => assert.equal(tx.lastChanged(b), created));
    assert.equal(db.lastChanged("n999"), undefined);
    assertIntegrity(db);
  });

  it("forgets it when the object is reclaimed", function () {
    const { db } = setup();
    let item;
    db.transaction((tx) => { item = tx.create({}); tx.set(ROOT, "item", ref(item)); });
    db.transaction((tx) => tx.delete(ROOT, "item"));
    collectAll(db);
    assert.equal(db.store.get("v/" + item), undefined);
    assertIntegrity(db);
  });

  it("does not record it for a new object that was never linked in", function () {
    const { db } = setup();
    let orphan;
    db.transaction((tx) => { orphan = tx.create({}); });
    assert.equal(db.get(orphan), undefined);
    assert.equal(db.store.get("v/" + orphan), undefined);
  });
});

describe("onReclaimed, and the collector's backlog", function () {

  it("is told what was reclaimed, after the step has committed, including weak targets", function () {
    const { db, reclaimed } = setup();
    let target, holder;
    db.transaction((tx) => {
      target = tx.create({});
      holder = tx.create({ loose: weak(target) });
      tx.set(ROOT, "target", ref(target));
      tx.set(ROOT, "holder", ref(holder));
    });
    db.transaction((tx) => tx.delete(ROOT, "target"));
    collectAll(db);
    assert.deepEqual(reclaimed, [target]);
    assert.equal(db.get(holder).loose.$weak, target, "the weak reference dangles, as it may");
  });

  it("reports pending work, and nothing when idle", function () {
    const { db } = setup();
    assert.deepEqual(db.collector.backlog(), { cohorts: 0, items: 0, structureTasks: 0, deferrals: 0 });
    const ids = [];
    db.transaction((tx) => {
      const list = tx.create({});
      tx.set(ROOT, "list", ref(list));
      for (let i = 0; i < 50; i++) { const id = tx.create({}); ids.push(id); tx.set(list, "k" + i, ref(id)); }
    });
    db.transaction((tx) => tx.delete(ROOT, "list"));
    const busy = db.collector.backlog();
    assert.ok(busy.cohorts + busy.items + busy.structureTasks + busy.deferrals > 0, JSON.stringify(busy));
    collectAll(db);
    const idle = db.collector.backlog();
    assert.equal(idle.cohorts + idle.items + idle.deferrals, 0, JSON.stringify(idle));
  });
});

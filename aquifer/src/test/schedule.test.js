import assert from "node:assert/strict";
import { Database, ROOT } from "../Database.js";
import { ref } from "../model.js";
import { reachableFromRoot, checkIntegrity } from "../oracle.js";

function setup(options = {}) {
  let db;
  db = new Database({
    options: { deferral: 0, ...options },
    onReclaim: (ids) => {
      const reachable = reachableFromRoot(db.store);
      for (const id of ids) assert.ok(!reachable.has(id), `reclaimed reachable object ${id}`);
    },
  });
  return db;
}

const cohortRecords = (db) => db.store.range("c/").map(([, cohort]) => cohort).filter((cohort) => !cohort.mergedInto);
const isReady = (cohort) => cohort.pending.expand === 0 && cohort.pending.mark === 0;

/** ROOT.field → a tree of `width`^`depth` objects. */
function tree(db, field, width, depth) {
  db.transaction((tx) => {
    const build = (level) => {
      const fields = { level };
      if (level < depth) for (let i = 0; i < width; i++) fields[`c${i}`] = ref(build(level + 1));
      return tx.create(fields);
    };
    tx.set(ROOT, field, ref(build(0)));
  });
}

describe("Step order", () => {
  it("serves a ready cohort before anything else, including structure tasks", () => {
    const db = setup({ regionCap: 5, deferCuts: false });
    for (const field of ["a", "b", "c"]) tree(db, field, 3, 2);
    db.collector.runUntilIdle();
    db.transaction((tx) => {
      tx.delete(ROOT, "a");
      tx.delete(ROOT, "b");
      tx.set(ROOT, "d", ref(tx.create({ more: ref(tx.create({})) }))); // structure work too
    });
    let served = 0;
    for (;;) {
      const ready = cohortRecords(db).filter(isReady).map((cohort) => cohort.id);
      if (!db.collector.step()) break;
      if (ready.length > 0) {
        assert.ok(ready.includes(db.collector.lastStep.cohort), `step ${JSON.stringify(db.collector.lastStep)} skipped ready ${ready}`);
        served++;
      }
      assert.deepEqual(checkIntegrity(db.store), []);
    }
    assert.ok(served > 0);
    assert.deepEqual(checkIntegrity(db.store, { quiescent: true }), []);
    assert.equal(db.objectIds().length, reachableFromRoot(db.store).size);
  });

  it("reclaims in the same step as a check that rescues nothing", () => {
    const db = setup({ deferCuts: false });
    let leaf;
    db.transaction((tx) => {
      leaf = tx.create({});
      tx.set(ROOT, "leaf", ref(leaf));
    });
    db.collector.runUntilIdle();
    db.transaction((tx) => tx.delete(ROOT, "leaf"));
    // A leaf has nothing to mark: its cohort is ready at once.
    do db.collector.step(); while (db.collector.lastStep.kind === "structure");
    assert.deepEqual(db.collector.lastStep, { kind: "check", cohort: db.collector.lastStep.cohort, ids: [leaf], regions: [], reclaimed: true });
    assert.ok(!db.get(leaf), "reclaimed");
    assert.equal(cohortRecords(db).length, 0);
  });

  it("does not reclaim after a check that rescued", () => {
    // candidates: 0 makes quick swap give up, so the cut starts a cohort although another
    // stable object still references it. The check then finds that object.
    const db = setup({ deferCuts: false, candidates: 0 });
    let shared;
    db.transaction((tx) => {
      shared = tx.create({});
      tx.set(ROOT, "a", ref(shared));
      tx.set(ROOT, "other", ref(tx.create({ shared: ref(shared) })));
    });
    db.collector.runUntilIdle();
    assert.equal(db.store.get(`g/${shared}`).treeParent, ROOT);
    db.transaction((tx) => tx.delete(ROOT, "a"));
    assert.equal(cohortRecords(db).length, 1, "the cut started a cohort");
    do db.collector.step(); while (db.collector.lastStep.kind !== "check");
    assert.equal(db.collector.lastStep.kind, "check");
    assert.equal(db.collector.lastStep.reclaimed, false);
    assert.ok(db.get(shared));
    db.collector.runUntilIdle();
    assert.ok(db.get(shared));
    assert.deepEqual(checkIntegrity(db.store, { quiescent: true }), []);
  });
});

describe("Without deferred cuts (deferCuts: false)", () => {
  it("starts a cohort at once, in the cutting transaction", () => {
    const db = setup({ deferCuts: false, deferral: 5 });
    tree(db, "doc", 2, 2);
    db.collector.runUntilIdle();
    db.transaction((tx) => tx.delete(ROOT, "doc"));
    assert.equal(db.store.keys("d/").length, 0);
    assert.equal(cohortRecords(db).length, 1);
    db.collector.runUntilIdle();
    assert.deepEqual(db.objectIds(), [ROOT]);
  });

  it("ignores holds, and releases of them", () => {
    const db = setup({ deferCuts: false });
    tree(db, "doc", 2, 1);
    db.collector.runUntilIdle();
    const doc = db.get(ROOT).doc.$ref;
    db.transaction((tx) => {
      tx.delete(ROOT, "doc");
      tx.hold(doc, { transactions: 10 });
    });
    assert.equal(db.store.keys("d/").length + db.store.keys("h/").length, 0, "nothing deferred");
    db.transaction((tx) => tx.release(doc));
    db.collector.runUntilIdle();
    assert.ok(!db.get(doc));
  });

  it("still quick-swaps a move", () => {
    const db = setup({ deferCuts: false });
    let a, b, child;
    db.transaction((tx) => {
      child = tx.create({});
      a = tx.create({ child: ref(child) });
      b = tx.create({});
      tx.set(ROOT, "a", ref(a));
      tx.set(ROOT, "b", ref(b));
    });
    db.transaction((tx) => {
      tx.delete(a, "child");
      tx.set(b, "child", ref(child));
    });
    assert.equal(cohortRecords(db).length, 0);
    assert.equal(db.store.get(`g/${child}`).treeParent, b);
  });
});

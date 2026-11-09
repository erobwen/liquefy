import assert from "node:assert/strict";
import { Database, ROOT } from "../Database.js";
import { ref } from "../model.js";
import { reachableFromRoot, checkIntegrity } from "../oracle.js";

function setup(options = {}) {
  const reclaimed = [];
  let db;
  db = new Database({
    options,
    onReclaim: (ids) => {
      const reachable = reachableFromRoot(db.store);
      for (const id of ids) assert.ok(!reachable.has(id), `reclaimed reachable object ${id}`);
      reclaimed.push(...ids);
    },
  });
  return { db, reclaimed };
}

function settle(db) {
  db.collector.runUntilIdle();
  assert.deepEqual(checkIntegrity(db.store, { quiescent: true }), []);
  assert.deepEqual(new Set(db.objectIds()), reachableFromRoot(db.store));
}

const cohorts = (db) => db.store.keys("c/").length;
const deferrals = (db) => db.store.keys("d/").length;

describe("Quick swap, deferred cuts and replacement parents", () => {
  it("quick-swaps a move inside one transaction: nothing becomes unstable", () => {
    const { db } = setup();
    let para;
    db.transaction((tx) => {
      para = tx.create({ text: "hello" });
      tx.set(ROOT, "ch1", ref(tx.create({ para: ref(para) })));
      tx.set(ROOT, "ch2", ref(tx.create({})));
    });
    db.transaction((tx) => {
      const { ch1, ch2 } = tx.get(ROOT);
      tx.delete(ch1.$ref, "para");
      tx.set(ch2.$ref, "para", ref(para));
    });
    assert.equal(cohorts(db), 0, "no cohort");
    assert.equal(deferrals(db), 0, "no deferral");
    assert.equal(db.store.get(`g/${para}`).treeParent, db.get(ROOT).ch2.$ref);
    settle(db);
    assert.equal(db.collector.stats.mark, 0);
  });

  it("cancels a deferred cut when the object is relinked in a later transaction", () => {
    const { db } = setup({ deferral: 5 });
    let subtree;
    db.transaction((tx) => {
      subtree = tx.create({ child: ref(tx.create({ leaf: ref(tx.create({})) })) });
      tx.set(ROOT, "archive", ref(subtree));
      tx.set(ROOT, "folder", ref(tx.create({})));
    });
    db.transaction((tx) => tx.delete(ROOT, "archive")); // cut, the application holds the id
    assert.equal(deferrals(db), 1);
    assert.equal(db.collector.run(10), 0, "nothing is due yet");
    db.transaction((tx) => tx.set(tx.get(ROOT).folder.$ref, "moved", ref(subtree))); // paste
    assert.equal(deferrals(db), 0, "the relink cancelled the deferral");
    settle(db);
    assert.equal(db.collector.stats.mark, 0, "nothing inside the subtree was ever marked");
    assert.equal(db.objectIds().length, 5);
  });

  it("dequeues from a linked list without marking the rest of the list", () => {
    const { db, reclaimed } = setup({ deferral: 0 });
    let first;
    db.transaction((tx) => {
      let next = null;
      for (let i = 0; i < 20; i++) next = tx.create(next ? { next: ref(next) } : {});
      first = next;
      tx.set(ROOT, "queue", ref(first));
    });
    db.transaction((tx) => {
      const head = tx.get(ROOT).queue.$ref;
      tx.set(ROOT, "queue", tx.get(head).next); // dequeue
    });
    settle(db);
    assert.deepEqual(reclaimed, [first]);
    assert.equal(db.collector.stats.mark, 1, "only the dequeued node was marked");
    assert.equal(db.collector.stats.replacementParents, 1, "the new head found ROOT as its parent");
  });

  it("does not quick-swap or re-parent under a descendant", () => {
    // root → t → x, and x → t. Cutting root → t: t's only other referrer is its own child x,
    // so the walk from x meets t and quick swap must fail.
    const { db, reclaimed } = setup({ deferral: 0 });
    let t;
    let x;
    db.transaction((tx) => {
      x = tx.create({});
      t = tx.create({ x: ref(x) });
      tx.set(x, "back", ref(t));
      tx.set(ROOT, "t", ref(t));
    });
    db.transaction((tx) => tx.delete(ROOT, "t"));
    assert.equal(deferrals(db), 1, "quick swap failed, the cut is deferred");
    settle(db);
    assert.deepEqual(new Set(reclaimed), new Set([t, x]), "the detached cycle is garbage");
  });

  it("re-parents a shared child during marking when it is still reachable", () => {
    // root → t → x and root → x. Cutting root → t: marking t finds x shared and re-parents it
    // under root instead of marking it.
    const { db, reclaimed } = setup({ deferral: 0 });
    let t;
    let x;
    db.transaction((tx) => {
      x = tx.create({ grandchild: ref(tx.create({})) });
      t = tx.create({ x: ref(x) });
      tx.set(ROOT, "t", ref(t));
      tx.set(ROOT, "x", ref(x));
    });
    db.transaction((tx) => tx.delete(ROOT, "t"));
    settle(db);
    assert.deepEqual(reclaimed, [t]);
    assert.equal(db.store.get(`g/${x}`).treeParent, ROOT);
    assert.equal(db.collector.stats.mark, 1, "x and its grandchild were never marked");
  });

  it("gives up a walk that exceeds its budget, and still collects correctly", () => {
    // A deep chain: the only other referrer of the cut node is deep below ROOT, beyond the
    // walk budget. Quick swap must fail (not wrongly succeed), and the collector still keeps it.
    const { db, reclaimed } = setup({ deferral: 0, walkBudget: 3 });
    let target;
    db.transaction((tx) => {
      let deep = tx.create({});
      const top = deep;
      for (let i = 0; i < 10; i++) {
        const node = tx.create({});
        tx.set(deep, "next", ref(node));
        deep = node;
      }
      target = tx.create({});
      tx.set(deep, "target", ref(target));
      tx.set(ROOT, "chain", ref(top));
      tx.set(ROOT, "target", ref(target));
    });
    // ROOT's edges are processed first, so the target was placed under ROOT. Cutting that edge
    // leaves only the deep referrer, which is beyond the walk budget: quick swap fails, the cut
    // is deferred and then marked, and the check rescues the target through the deep referrer.
    db.transaction((tx) => tx.delete(ROOT, "target"));
    settle(db);
    assert.equal(reclaimed.length, 0);
    assert.ok(db.get(target));
  });
});

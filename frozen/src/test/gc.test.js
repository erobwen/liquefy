import assert from "node:assert/strict";
import { Database, ROOT } from "../Database.js";
import { ref, weak } from "../model.js";
import { reachableFromRoot, checkIntegrity } from "../oracle.js";

function setup() {
  const reclaimed = [];
  let db;
  db = new Database({
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

describe("Basic collector", () => {
  it("never persists new objects that nothing references", () => {
    const { db } = setup();
    db.transaction((tx) => {
      const a = tx.create({ name: "a" });
      tx.create({ next: ref(a) });
    });
    assert.deepEqual(db.objectIds(), [ROOT]);
    assert.ok(db.collector.isIdle());
  });

  it("attaches new structures below a stable parent", () => {
    const { db } = setup();
    db.transaction((tx) => {
      const leaf = tx.create({ name: "leaf" });
      const node = tx.create({ child: ref(leaf) });
      tx.set(ROOT, "node", ref(node));
    });
    assert.equal(db.objectIds().length, 3);
    assert.ok(db.collector.isIdle(), "nothing to collect");
    assert.deepEqual(checkIntegrity(db.store, { quiescent: true }), []);
  });

  it("reclaims a detached chain", () => {
    const { db, reclaimed } = setup();
    db.transaction((tx) => {
      const c = tx.create({});
      const b = tx.create({ next: ref(c) });
      const a = tx.create({ next: ref(b) });
      tx.set(ROOT, "chain", ref(a));
    });
    db.transaction((tx) => tx.delete(ROOT, "chain"));
    settle(db);
    assert.equal(reclaimed.length, 3);
    assert.deepEqual(db.objectIds(), [ROOT]);
  });

  it("reclaims a detached cycle", () => {
    const { db, reclaimed } = setup();
    db.transaction((tx) => {
      const a = tx.create({});
      const b = tx.create({ back: ref(a) });
      tx.set(a, "next", ref(b));
      tx.set(ROOT, "cycle", ref(a));
    });
    db.transaction((tx) => tx.delete(ROOT, "cycle"));
    settle(db);
    assert.equal(reclaimed.length, 2);
  });

  it("keeps a subtree that is still referenced from elsewhere", () => {
    const { db, reclaimed } = setup();
    let shared;
    db.transaction((tx) => {
      shared = tx.create({ name: "shared" });
      const owner = tx.create({ item: ref(shared) });
      const other = tx.create({ link: ref(shared) });
      tx.set(ROOT, "owner", ref(owner));
      tx.set(ROOT, "other", ref(other));
    });
    db.transaction((tx) => tx.delete(ROOT, "owner"));
    settle(db);
    assert.equal(reclaimed.length, 1, "only the owner dies");
    assert.ok(db.get(shared));
  });

  it("rescues in the barrier when a move adds before it removes", () => {
    const { db } = setup();
    let para;
    db.transaction((tx) => {
      para = tx.create({ text: "hello" });
      const ch1 = tx.create({ para: ref(para) });
      const ch2 = tx.create({});
      tx.set(ROOT, "ch1", ref(ch1));
      tx.set(ROOT, "ch2", ref(ch2));
    });
    db.transaction((tx) => {
      const { ch1, ch2 } = tx.get(ROOT);
      tx.delete(ch1.$ref, "para");
      tx.set(ch2.$ref, "para", ref(para));
    });
    // Without quick swap, the cut still starts a cohort; the check finds ch2 and rescues.
    settle(db);
    assert.ok(db.get(para));
  });

  it("merges cohorts whose fates depend on each other", () => {
    const { db, reclaimed } = setup();
    db.transaction((tx) => {
      const a = tx.create({});
      const b = tx.create({});
      tx.set(a, "b", ref(b));
      tx.set(b, "a", ref(a));
      tx.set(ROOT, "a", ref(a));
      tx.set(ROOT, "b", ref(b));
    });
    // Two cuts in separate transactions give two cohorts; each member is referenced from the other.
    db.transaction((tx) => tx.delete(ROOT, "a"));
    db.transaction((tx) => tx.delete(ROOT, "b"));
    settle(db);
    assert.equal(reclaimed.length, 2);
  });

  it("ignores weak references", () => {
    const { db, reclaimed } = setup();
    let target;
    db.transaction((tx) => {
      target = tx.create({});
      const index = tx.create({ entry: weak(target) });
      tx.set(ROOT, "index", ref(index));
      tx.set(ROOT, "target", ref(target));
    });
    db.transaction((tx) => tx.delete(ROOT, "target"));
    settle(db);
    assert.deepEqual(reclaimed, [target]);
    assert.deepEqual(db.get(db.get(ROOT).index.$ref), { entry: weak(target) }, "the weak reference dangles");
  });

  it("rejects references to missing objects", () => {
    const { db } = setup();
    assert.throws(() => db.transaction((tx) => tx.set(ROOT, "x", ref("nope"))), /missing object/);
    assert.deepEqual(db.objectIds(), [ROOT]);
  });

  it("does not rescue an unmarked object through its own stale descendant", () => {
    // root → t → x. Cutting root → t leaves x stale-stable below t until t is marked. If x → t
    // then rescued t under x, the tree would get the cycle t → x → t, and marking of t would be
    // skipped, so the cycle would look stable forever. The rescue must wait for t's check.
    const { db } = setup();
    let t;
    let x;
    db.transaction((tx) => {
      x = tx.create({});
      t = tx.create({ x: ref(x) });
      tx.set(ROOT, "t", ref(t));
    });
    db.transaction((tx) => {
      tx.delete(ROOT, "t");
      tx.set(ROOT, "x", ref(x)); // x is reachable, but its tree parent is still t
    });
    db.transaction((tx) => tx.set(x, "back", ref(t))); // x looks stable, t is not marked yet
    settle(db); // fails on a tree cycle
    assert.ok(db.get(t) && db.get(x), "both are reachable through root → x → t");
  });

  it("rescues an object referenced again while its cohort is still pending", () => {
    const { db, reclaimed } = setup();
    let b;
    db.transaction((tx) => {
      b = tx.create({});
      const a = tx.create({ b: ref(b) });
      tx.set(ROOT, "a", ref(a));
    });
    db.transaction((tx) => tx.delete(ROOT, "a"));
    db.collector.run(2); // a is marked, b becomes unstable
    db.transaction((tx) => tx.set(ROOT, "b", ref(b)));
    settle(db);
    assert.equal(reclaimed.length, 1);
    assert.ok(db.get(b));
  });
});

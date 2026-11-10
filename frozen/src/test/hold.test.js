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

/** ROOT.archive → a subtree of three objects, and an empty ROOT.folder. */
function withArchive(db) {
  let archive;
  db.transaction((tx) => {
    archive = tx.create({ child: ref(tx.create({ leaf: ref(tx.create({})) })) });
    tx.set(ROOT, "archive", ref(archive));
    tx.set(ROOT, "folder", ref(tx.create({})));
  });
  return archive;
}

/** n application transactions that touch nothing GC-relevant, to advance the logical clock. */
function idleTransactions(db, n) {
  for (let i = 0; i < n; i++) db.transaction((tx) => tx.set(ROOT, "counter", i));
}

const holdCut = (archive, lifetime) => (tx) => {
  tx.delete(ROOT, "archive");
  tx.hold(archive, lifetime);
};

describe("hold", () => {
  it("ends by reattachment: nothing is marked, however long the gap", () => {
    const { db, reclaimed } = setup({ deferral: 0 });
    const archive = withArchive(db);
    db.transaction(holdCut(archive, { transactions: 1000 }));
    for (let i = 0; i < 50; i++) {
      idleTransactions(db, 1);
      db.collector.run(5);
    }
    assert.ok(db.get(archive), "still held");
    db.transaction((tx) => tx.set(tx.get(ROOT).folder.$ref, "archive", ref(archive)));
    db.collector.runUntilIdle();
    assert.deepEqual(reclaimed, []);
    assert.equal(db.collector.stats.mark, 0, "nothing was ever marked");
    assert.deepEqual(checkIntegrity(db.store, { quiescent: true }), []);
  });

  it("ends by expiry on the transaction clock: then it is collected", () => {
    const { db, reclaimed } = setup({ deferral: 0 });
    const archive = withArchive(db);
    db.transaction(holdCut(archive, { transactions: 10 }));
    idleTransactions(db, 9);
    db.collector.run(100);
    assert.equal(reclaimed.length, 0, "not due yet");
    idleTransactions(db, 1);
    db.collector.run(100);
    assert.equal(reclaimed.length, 3, "expired and collected");
    assert.ok(db.collector.isIdle());
  });

  it("ends by expiry on the wall clock", () => {
    let now = 1_000_000;
    const { db, reclaimed } = setup({ deferral: 0, now: () => now });
    const archive = withArchive(db);
    db.transaction(holdCut(archive, { milliseconds: 60_000 }));
    idleTransactions(db, 100);
    db.collector.run(100);
    assert.equal(reclaimed.length, 0, "transactions do not expire a time-based hold");
    now += 60_000;
    db.collector.run(100);
    assert.equal(reclaimed.length, 3);
  });

  it("ends by release: it is due at once", () => {
    const { db, reclaimed } = setup({ deferral: 0 });
    const archive = withArchive(db);
    db.transaction(holdCut(archive, { transactions: 1000 }));
    db.transaction((tx) => tx.release(archive));
    db.collector.run(100);
    assert.equal(reclaimed.length, 3);
  });

  it("has no effect when the transaction does not detach the object", () => {
    const { db } = setup();
    const archive = withArchive(db);
    db.transaction((tx) => tx.set(ROOT, "second", ref(archive)));
    db.transaction((tx) => tx.hold(archive, { transactions: 5 })); // nothing cut at all
    db.transaction((tx) => {
      tx.delete(ROOT, "second"); // a non-tree edge
      tx.hold(archive, { transactions: 5 });
    });
    assert.equal(db.store.keys("d/").length + db.store.keys("c/").length, 0);
  });

  it("refuses a malformed lifetime", () => {
    const { db } = setup();
    const archive = withArchive(db);
    assert.throws(() => db.transaction((tx) => tx.hold(archive, {})), /exactly one/);
    assert.throws(() => db.transaction((tx) => tx.hold(archive, { transactions: 1, milliseconds: 1 })), /exactly one/);
  });

  it("has no effect when the cut is quick-swapped: the object is still attached", () => {
    const { db } = setup();
    const archive = withArchive(db);
    db.transaction((tx) => tx.set(tx.get(ROOT).folder.$ref, "alsoArchive", ref(archive)));
    db.transaction(holdCut(archive, { transactions: 1000 }));
    assert.equal(db.store.keys("d/").length + db.store.keys("c/").length, 0, "quick swap found the folder; nothing deferred");
  });

  it("releasing an object that is not held is harmless", () => {
    const { db } = setup();
    const archive = withArchive(db);
    db.transaction((tx) => tx.release(archive));
    db.collector.runUntilIdle();
    assert.ok(db.get(archive));
  });
});

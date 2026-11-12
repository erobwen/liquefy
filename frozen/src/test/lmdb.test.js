import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Database, ROOT } from "../Database.js";
import { ref } from "../model.js";
import { LmdbStore } from "../store/LmdbStore.js";
import { runSeed } from "../fuzz/fuzz.js";
import { reachableFromRoot, checkIntegrity } from "../oracle.js";

describe("A database on LMDB", () => {
  let path;
  const stores = [];
  const open = () => {
    const store = new LmdbStore(path, { noSync: true });
    stores.push(store);
    return store;
  };
  beforeEach(() => (path = mkdtempSync(join(tmpdir(), "frozen-db-"))));
  afterEach(() => {
    for (const store of stores.splice(0)) store.close();
    rmSync(path, { recursive: true, force: true });
  });

  const options = { deferral: 0, regionCap: 12, clusterCap: 3, stepBudget: 5 };

  it("keeps its objects when closed and opened again", () => {
    let store = open();
    let db = new Database({ store, options });
    let doc;
    db.transaction((tx) => {
      doc = tx.create({ title: "Hello", sections: [ref(tx.create({ text: "one" })), ref(tx.create({ text: "two" }))] });
      tx.set(ROOT, "doc", ref(doc));
    });
    db.collector.runUntilIdle();
    store.close();
    stores.length = 0;

    store = open();
    db = new Database({ store, options });
    assert.equal(db.get(doc).title, "Hello");
    assert.equal(db.get(db.get(doc).sections[1].$ref).text, "two");
    assert.deepEqual(checkIntegrity(store, { quiescent: true }), []);
  });

  it("continues a collection that was interrupted by closing the database", () => {
    let store = open();
    let db = new Database({ store, options });
    db.transaction((tx) => {
      const documents = [];
      for (let d = 0; d < 6; d++) {
        const paragraphs = [];
        for (let p = 0; p < 8; p++) paragraphs.push(ref(tx.create({ text: `${d}.${p}` })));
        documents.push(ref(tx.create({ paragraphs })));
      }
      tx.set(ROOT, "library", ref(tx.create({ documents })));
      tx.set(ROOT, "kept", ref(tx.create({ text: "stays" })));
    });
    db.collector.runUntilIdle();
    db.transaction((tx) => tx.delete(ROOT, "library"));
    // Stop in the middle: some cohort is active, or being reclaimed a few objects at a time.
    db.collector.run(6);
    assert.ok(store.keys("c/").length > 0, "a cohort is still at work");
    assert.ok(db.objectIds().length > 2, "garbage is still stored");
    assert.deepEqual(checkIntegrity(store), []);
    store.close();
    stores.length = 0;

    // A new process: nothing but the files.
    store = open();
    db = new Database({ store, options });
    assert.deepEqual(checkIntegrity(store), []);
    db.collector.runUntilIdle();
    assert.deepEqual(checkIntegrity(store, { quiescent: true }), []);
    assert.deepEqual(new Set(db.objectIds()), reachableFromRoot(store));
    assert.equal(db.objectIds().length, 2, "only ROOT and the kept object are left");
  });

  it("passes the fuzzer", function () {
    this.timeout(60_000);
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const store = open();
      runSeed(seed, { transactions: 150, store });
      store.transaction((tx) => {
        for (const key of store.keys("")) tx.delete(key);
      });
      store.close();
      stores.length = 0;
    }
  });
});

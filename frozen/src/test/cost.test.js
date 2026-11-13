import assert from "node:assert/strict";
import { Database, ROOT } from "../Database.js";
import { ref } from "../model.js";
import { reachableFromRoot, checkIntegrity } from "../oracle.js";

/**
 * Bounds on what the collector costs. The fuzzer checks that it is right; these check that it
 * stays cheap in the cases that once were not (documents/backlog.md).
 */

/** Runs the collector to idle. Returns its number of steps and the most keys one step wrote. */
function collect(db) {
  let largest = 0;
  const stop = db.store.observe({ commit: (writes) => (largest = Math.max(largest, writes.length)) });
  const steps = db.collector.runUntilIdle();
  stop();
  assert.deepEqual(checkIntegrity(db.store, { quiescent: true }), []);
  assert.equal(db.objectIds().length, reachableFromRoot(db.store).size);
  return { steps, largest };
}

/** ROOT.library → documents of 5 paragraphs of 5 runs. Returns the document ids. */
function library(db, documents) {
  const docs = [];
  db.transaction((tx) => {
    for (let d = 0; d < documents; d++) {
      const paragraphs = [];
      for (let p = 0; p < 5; p++) {
        const runs = [];
        for (let r = 0; r < 5; r++) runs.push(ref(tx.create({ text: `${d}.${p}.${r}` })));
        paragraphs.push(ref(tx.create({ runs })));
      }
      docs.push(tx.create({ paragraphs }));
    }
    tx.set(ROOT, "library", ref(tx.create({ docs: docs.map(ref) })));
  });
  collect(db);
  return docs;
}

describe("Collector cost", () => {
  it("deletes an object with many leaf children in steps that follow the budget, not the count", () => {
    const db = new Database({ options: { deferral: 0, stepBudget: 100 } });
    db.transaction((tx) => {
      const items = [];
      for (let i = 0; i < 1000; i++) items.push(ref(tx.create({ i })));
      tx.set(ROOT, "list", ref(tx.create({ items })));
    });
    collect(db);
    db.transaction((tx) => tx.delete(ROOT, "list"));
    const { steps, largest } = collect(db);
    assert.equal(db.objectIds().length, 1);
    assert.ok(steps <= 80, `${steps} steps for 1,000 leaves`);
    // The one big step deletes the list object itself, with its 1,000 edge keys: one object
    // with a thousand references is one unit (the design chunks big collections, §5.4).
    assert.ok(largest <= 100 * 5 + 1000, `the largest step wrote ${largest} keys, for a budget of 100 objects`);
  });

  it("does nothing after an edit that leaves its region within bounds", () => {
    const db = new Database({ options: { deferral: 0, regionCap: 100 } });
    const docs = library(db, 12);
    for (const doc of docs.slice(0, 4)) {
      db.transaction((tx) => tx.set(doc, "note", ref(tx.create({ text: "a note" }))));
      assert.equal(db.collector.step(), false, "no collector work");
    }
  });

  it("deletes a document as one suspended region: few steps, and no object marked singly", () => {
    const db = new Database({ options: { deferral: 0, regionCap: 100 } });
    const docs = library(db, 12);
    const before = { ...db.collector.stats };
    db.transaction((tx) => {
      const lib = tx.get(ROOT).library.$ref;
      tx.set(lib, "docs", tx.get(lib).docs.filter((doc) => doc.$ref !== docs[3]));
    });
    collect(db);
    const cohortSteps = (stats) => stats.expand + stats.mark + stats.check + stats.reclaim;
    const steps = cohortSteps(db.collector.stats) - cohortSteps(before);
    assert.ok(!db.get(docs[3]));
    assert.equal(db.collector.stats.reclaimed - before.reclaimed, 31);
    assert.equal(db.collector.stats.detached - before.detached, 0, "nothing was made unstable one by one");
    assert.ok(steps <= 3, `${steps} cohort steps for a 31-object document`);
  });

  it("reads nothing but the dead document's own region to delete it", () => {
    const db = new Database({ options: { deferral: 0, regionCap: 100 } });
    const docs = library(db, 12);
    const scanned = new Set();
    const stop = db.store.observe({ read: (key) => key.startsWith("y/") && scanned.add(key.split("/")[1]) });
    db.transaction((tx) => {
      const lib = tx.get(ROOT).library.$ref;
      tx.set(lib, "docs", tx.get(lib).docs.filter((doc) => doc.$ref !== docs[5]));
    });
    db.collector.runUntilIdle();
    stop();
    assert.ok(scanned.size <= 3, `edges of ${scanned.size} regions were read, of ${db.store.keys("r/").length}`);
  });
});

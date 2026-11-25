import assert from "node:assert/strict";
import { Database, ROOT } from "../Database.js";
import { ref } from "../model.js";
import { reachableFromRoot, checkIntegrity } from "../oracle.js";

function setup(options = {}) {
  let db;
  db = new Database({
    options: { deferral: 0, deferCuts: false, regionCap: 12, clusterCap: 3, ...options },
    onReclaim: (ids) => {
      const reachable = reachableFromRoot(db.store);
      for (const id of ids) assert.ok(!reachable.has(id), `reclaimed reachable object ${id}`);
    },
  });
  return db;
}

/** ROOT.library → `documents` documents of 6 chapters of 8 paragraphs. Returns the ids. */
function library(db, documents = 4) {
  const ids = { documents: [], paragraphs: [] };
  db.transaction((tx) => {
    const docs = [];
    for (let d = 0; d < documents; d++) {
      const chapters = [];
      for (let c = 0; c < 6; c++) {
        const paragraphs = [];
        for (let p = 0; p < 8; p++) {
          const id = tx.create({ text: `${d}.${c}.${p}` });
          ids.paragraphs.push(id);
          paragraphs.push(ref(id));
        }
        chapters.push(ref(tx.create({ paragraphs })));
      }
      const doc = tx.create({ chapters });
      ids.documents.push(doc);
      docs.push(ref(doc));
    }
    ids.library = tx.create({ docs });
    tx.set(ROOT, "library", ref(ids.library));
  });
  settle(db);
  return ids;
}

function settle(db) {
  db.collector.runUntilIdle();
  assert.deepEqual(checkIntegrity(db.store, { quiescent: true }), []);
  assert.equal(db.objectIds().length, reachableFromRoot(db.store).size);
}

const clusters = (db) => db.store.range("r/").map(([, record]) => record);
const levels = (db) => Math.max(...clusters(db).map((record) => record.level));

/** Removes the first document from the library. */
function deleteFirst(db, ids) {
  db.transaction((tx) => {
    const docs = tx.get(ids.library).docs;
    docs.shift();
    tx.set(ids.library, "docs", docs);
  });
}

/** The objects inside a cluster, at any depth. */
function objectsIn(db, cluster) {
  const members = db.store.keys(`m/${cluster}/`).map((key) => key.split("/")[2]);
  if (db.store.get(`r/${cluster}`).level === 0) return members;
  return members.flatMap((member) => objectsIn(db, member));
}

/** Explicit members inside a cluster that still have tree children: its anchors. */
const anchorsOf = (db, cluster) =>
  objectsIn(db, cluster).filter((id) => db.store.get(`g/${id}`).cohort !== null && db.store.keys(`t/${id}/`).length > 0);

/** Steps until a meta-region is suspended and `test(record)` holds. Returns its record. */
function untilMetaSuspended(db, test = () => true) {
  for (;;) {
    const found = clusters(db).find((record) => record.level > 0 && record.suspended && test(record));
    if (found) return found;
    assert.ok(db.collector.step(), "a meta-region was suspended before the collector ran out of work");
    assert.deepEqual(checkIntegrity(db.store), []);
  }
}

const cohortSteps = (stats) => stats.expand + stats.mark + stats.check + stats.reclaim;

describe("Meta-regions", () => {
  it("adds levels as regions multiply, keeping every region at the same depth", () => {
    const db = setup();
    library(db);
    assert.ok(levels(db) >= 2, "at least two levels of meta-regions");
    assert.ok(db.collector.stats.structure["level added"] > 0);
    // The integrity check in settle verifies the hierarchy, counters, tree counts and flags.
  });

  it("suspends a deleted document as whole meta-regions, detaching fewer objects than region by region", () => {
    const run = (clusterCap) => {
      const db = setup({ clusterCap });
      const ids = library(db);
      const before = { ...db.collector.stats };
      deleteFirst(db, ids);
      settle(db);
      for (const id of [ids.documents[0], ...ids.paragraphs.slice(0, 48)]) assert.ok(!db.get(id));
      return { steps: db.collector.stats.detached - before.detached, meta: db.collector.stats.suspendedMeta - before.suspendedMeta };
    };
    const flat = run(1000);
    const nested = run(3);
    assert.equal(flat.meta, 0);
    assert.ok(nested.meta > 0, "a meta-region was suspended");
    assert.ok(nested.steps * 2 <= flat.steps, `${nested.steps} objects detached with meta-regions, ${flat.steps} without`);
  });

  it("resumes a suspended meta-region when its sole anchor is linked again", () => {
    const db = setup();
    const ids = library(db);
    deleteFirst(db, ids);
    const suspended = untilMetaSuspended(db, (record) => record.suspended.marked && anchorsOf(db, record.id).length === 1);
    const kept = objectsIn(db, suspended.id);
    db.transaction((tx) => tx.set(ROOT, "rescued", ref(anchorsOf(db, suspended.id)[0])));
    assert.equal(db.store.get(`r/${suspended.id}`).suspended, null, "resumed at once, in the barrier");
    assert.equal(db.store.get(`r/${suspended.id}`).materializedIn, undefined, "not materialized");
    settle(db);
    for (const id of kept) assert.ok(db.get(id), `${id} survived`);
  });

  it("materializes a suspended meta-region that a stable object references into", () => {
    const db = setup();
    const ids = library(db);
    deleteFirst(db, ids);
    const suspended = untilMetaSuspended(db);
    // An object inside it, unstable with it, is quoted from ROOT through a stable object.
    const quoted = objectsIn(db, suspended.id).find((id) => db.store.get(`g/${id}`).cohort === null);
    db.transaction((tx) => tx.set(ROOT, "quote", ref(tx.create({ of: ref(quoted) }))));
    assert.equal(db.store.get(`r/${suspended.id}`).suspended, null, "materialized at once, in the barrier");
    assert.ok(db.store.get(`r/${suspended.id}`).materializedIn);
    settle(db);
    assert.ok(db.get(quoted), "the quoted paragraph survived");
    assert.ok(!db.get(ids.documents[0]), "the rest of the document is gone");
  });

  it("finds a referrer from outside a suspended meta-region in its check, and keeps it", () => {
    const db = setup();
    const ids = library(db);
    const quoted = ids.paragraphs[30];
    // The quote exists before the deletion: the meta-region's check must find it.
    db.transaction((tx) => tx.set(ids.documents[1], "quote", ref(quoted)));
    settle(db);
    deleteFirst(db, ids);
    settle(db);
    assert.ok(db.get(quoted), "the quoted paragraph survived");
    assert.ok(!db.get(ids.documents[0]));
  });

  it("removes levels again when the data shrinks", () => {
    const db = setup();
    const ids = library(db);
    const before = levels(db);
    db.transaction((tx) => tx.set(ids.library, "docs", []));
    settle(db);
    assert.ok(levels(db) < before, `${levels(db)} levels, from ${before}`);
  });
});

import assert from "node:assert/strict";
import { Database, ROOT } from "../Database.js";
import { ref } from "../model.js";
import { reachableFromRoot, checkIntegrity } from "../oracle.js";

function setup(options = {}) {
  let db;
  db = new Database({
    options: { deferral: 0, deferCuts: false, regionCap: 12, ...options },
    onReclaim: (ids) => {
      const reachable = reachableFromRoot(db.store);
      for (const id of ids) assert.ok(!reachable.has(id), `reclaimed reachable object ${id}`);
    },
  });
  return db;
}

/** ROOT.doc → a document of `sections` sections with `paragraphs` paragraphs each. */
function document(db, sections = 4, paragraphs = 4) {
  db.transaction((tx) => {
    const list = [];
    for (let s = 0; s < sections; s++) {
      const items = [];
      for (let p = 0; p < paragraphs; p++) items.push(ref(tx.create({ text: `${s}.${p}` })));
      list.push(ref(tx.create({ paragraphs: items })));
    }
    tx.set(ROOT, "doc", ref(tx.create({ sections: list })));
  });
  db.collector.runUntilIdle();
}

function settle(db) {
  db.collector.runUntilIdle();
  assert.deepEqual(checkIntegrity(db.store, { quiescent: true }), []);
  assert.equal(db.objectIds().length, reachableFromRoot(db.store).size);
}

const meta = (db, id) => db.store.get(`g/${id}`);
const members = (db, region) => db.store.keys(`m/${region}/`).map((key) => key.split("/")[2]);

/** Steps until a region is suspended with its exits cut. Returns { region, anchors, implicit }. */
function untilSuspendedAndMarked(db) {
  for (;;) {
    for (const [key, record] of db.store.range("r/")) {
      if (!record.suspended?.marked) continue;
      const region = key.slice(2);
      const all = members(db, region);
      return {
        region,
        anchors: all.filter((id) => meta(db, id).cohort !== null && db.store.keys(`t/${id}/`).length > 0),
        implicit: all.filter((id) => meta(db, id).cohort === null),
      };
    }
    assert.ok(db.collector.step(), "a region was suspended before the collector ran out of work");
    assert.deepEqual(checkIntegrity(db.store), []);
  }
}

describe("Suspension", () => {
  it("marks and reclaims whole regions, in fewer steps than object by object", () => {
    const markSteps = (suspension) => {
      const db = setup({ suspension, regionCap: 30 });
      document(db, 4, 12);
      assert.ok(db.store.keys("r/").length > 2, "the document spans several regions");
      db.transaction((tx) => tx.delete(ROOT, "doc"));
      const before = db.collector.stats.mark;
      settle(db);
      assert.deepEqual(db.objectIds(), [ROOT]);
      if (suspension) assert.ok(db.collector.stats.suspended > 0 && db.collector.stats.regionsReclaimed > 0);
      return db.collector.stats.mark - before;
    };
    const withSuspension = markSteps(true);
    const without = markSteps(false);
    assert.ok(withSuspension * 2 < without, `${withSuspension} mark steps with suspension, ${without} without`);
  });

  it("resumes a region whose sole anchor is linked again, keeping its internal tree", () => {
    const db = setup();
    document(db);
    db.transaction((tx) => tx.delete(ROOT, "doc"));
    const { region, anchors, implicit } = untilSuspendedAndMarked(db);
    assert.equal(anchors.length, 1, "a section region hangs from its section");
    const parents = new Map(implicit.map((id) => [id, meta(db, id).treeParent]));

    db.transaction((tx) => tx.set(ROOT, "kept", ref(anchors[0])));
    assert.equal(db.store.get(`r/${region}`).suspended, null, "resumed at once, in the barrier");
    for (const [id, parent] of parents) assert.equal(meta(db, id).treeParent, parent, "internal tree kept");
    assert.equal(meta(db, anchors[0]).treeParent, ROOT);

    settle(db);
    for (const id of [...anchors, ...implicit]) assert.ok(db.get(id), `${id} survives`);
  });

  it("materializes a region when one of its implicit members gets a stable referrer", () => {
    const db = setup();
    document(db);
    db.transaction((tx) => tx.delete(ROOT, "doc"));
    const { region, implicit } = untilSuspendedAndMarked(db);
    const paragraph = implicit[0];

    db.transaction((tx) => tx.set(ROOT, "quote", ref(paragraph)));
    assert.equal(db.store.get(`r/${region}`).suspended, null, "materialized");
    assert.deepEqual(checkIntegrity(db.store), []);

    settle(db);
    assert.ok(db.get(paragraph), "the referenced paragraph survives");
    assert.equal(meta(db, paragraph).treeParent, ROOT, "re-parented under its new referrer");
  });

  it("materializes a region whose internal tree changes", () => {
    const db = setup();
    document(db);
    db.transaction((tx) => tx.delete(ROOT, "doc"));
    const { region, implicit } = untilSuspendedAndMarked(db);
    const child = implicit.find((id) => implicit.includes(meta(db, id).treeParent) || meta(db, id).treeParent);
    const parent = meta(db, child).treeParent;

    db.transaction((tx) => {
      const fields = tx.get(parent);
      tx.set(parent, "paragraphs", fields.paragraphs.filter((value) => value.$ref !== child));
    });
    assert.equal(db.store.get(`r/${region}`).suspended, null, "materialized");
    assert.deepEqual(checkIntegrity(db.store), []);
    settle(db);
    assert.deepEqual(db.objectIds(), [ROOT]);
  });

  it("can be turned off", () => {
    const db = setup({ suspension: false });
    document(db);
    db.transaction((tx) => tx.delete(ROOT, "doc"));
    settle(db);
    assert.equal(db.collector.stats.suspended, 0);
    assert.deepEqual(db.objectIds(), [ROOT]);
  });
});

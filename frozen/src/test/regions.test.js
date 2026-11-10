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

function settle(db) {
  db.collector.runUntilIdle();
  assert.deepEqual(checkIntegrity(db.store, { quiescent: true }), []);
  assert.deepEqual(new Set(db.objectIds()), reachableFromRoot(db.store));
}

const regionOf = (db, id) => db.store.get(`g/${id}`).region;
const regions = (db) => db.store.keys("r/").map((key) => key.slice(2));
const membersOf = (db, region) => db.store.keys(`m/${region}/`).map((key) => key.split("/")[2]);

/** ROOT → a document with `sections` sections of `size` paragraphs each. */
function document(db, sections, size) {
  let doc;
  db.transaction((tx) => {
    const list = [];
    for (let s = 0; s < sections; s++) {
      const paragraphs = [];
      for (let p = 0; p < size; p++) paragraphs.push(ref(tx.create({ text: `${s}.${p}` })));
      list.push(ref(tx.create({ paragraphs })));
    }
    doc = tx.create({ sections: list });
    tx.set(ROOT, "doc", ref(doc));
  });
  return doc;
}

describe("Level-0 regions", () => {
  it("places new objects in their tree parent's region", () => {
    const db = setup();
    const doc = document(db, 2, 3);
    for (const id of db.objectIds()) assert.equal(regionOf(db, id), regionOf(db, doc));
  });

  it("splits a region that grows past the cap into branches", () => {
    const db = setup({ regionCap: 12 });
    document(db, 4, 5);
    settle(db);
    assert.ok(regions(db).length > 1, "the region split");
    assert.ok(db.collector.stats.structure.split > 0);
    // Each region is a branch: all its members but its anchors have their tree parent inside it.
    for (const region of regions(db)) {
      const members = new Set(membersOf(db, region));
      const anchors = [...members].filter((id) => !members.has(db.store.get(`g/${id}`).treeParent));
      const parentRegions = new Set(anchors.map((id) => db.store.get(`g/${id}`).treeParent).filter(Boolean).map((p) => regionOf(db, p)));
      assert.ok(parentRegions.size <= 1, `region ${region} hangs from at most one region`);
    }
  });

  it("quick-swaps across regions, using a referrer added in the same transaction", () => {
    const db = setup({ regionCap: 6 });
    let para;
    db.transaction((tx) => {
      para = tx.create({ text: "moving" });
      const ch1 = tx.create({ para: ref(para), a: ref(tx.create({})), b: ref(tx.create({})) });
      const ch2 = tx.create({ a: ref(tx.create({})), b: ref(tx.create({})) });
      tx.set(ROOT, "ch1", ref(ch1));
      tx.set(ROOT, "ch2", ref(ch2));
    });
    settle(db);
    const { ch1, ch2 } = db.get(ROOT);
    assert.notEqual(regionOf(db, ch1.$ref), regionOf(db, ch2.$ref), "the chapters are in different regions");
    db.transaction((tx) => {
      tx.delete(ch1.$ref, "para");
      tx.set(ch2.$ref, "para", ref(para));
    });
    assert.equal(db.store.keys("d/").length + db.store.keys("c/").length, 0, "swapped, nothing deferred");
    assert.equal(db.store.get(`g/${para}`).treeParent, ch2.$ref);
    settle(db);
  });

  it("deletes empty regions, and cleans up flags that name them lazily", () => {
    const db = setup({ regionCap: 8 });
    let font;
    db.transaction((tx) => {
      font = tx.create({ name: "font" });
      tx.set(ROOT, "font", ref(font));
    });
    const doc = document(db, 3, 3);
    db.transaction((tx) => {
      // Every paragraph references the font, from wherever the splits put it.
      for (const id of db.objectIds()) {
        if (tx.get(id).text !== undefined) tx.set(id, "font", ref(font));
      }
    });
    settle(db);
    const fontRegion = regionOf(db, font);
    const before = regions(db).length;
    assert.ok(db.store.keys(`e/${fontRegion}/`).length > 0, "the font's region is flagged by the document's regions");

    db.transaction((tx) => tx.delete(ROOT, "doc"));
    settle(db);
    assert.ok(!db.get(doc));
    assert.ok(regions(db).length < before, "the document's regions were deleted");

    // Stale flags on the font's region go away at the next lookup there: cut the font.
    db.transaction((tx) => tx.delete(ROOT, "font"));
    settle(db);
    assert.equal(db.store.keys(`e/${fontRegion}/`).length, 0);
  });

  it("merges a region that became light into the region it hangs from", () => {
    const db = setup({ regionCap: 12 });
    const doc = document(db, 4, 5);
    settle(db);
    const regionsBefore = regions(db).length;
    // Empty most sections, so that their regions become light.
    db.transaction((tx) => {
      for (const section of tx.get(doc).sections) tx.set(section.$ref, "paragraphs", []);
    });
    settle(db);
    assert.ok(regions(db).length < regionsBefore, "fewer regions");
    assert.ok(db.collector.stats.structure.merged > 0, "a light region merged into its parent region");
  });
});

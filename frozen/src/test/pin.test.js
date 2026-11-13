import assert from "node:assert/strict";
import { Database, ROOT } from "../Database.js";
import { ref } from "../model.js";
import { reachableFromRoot, checkIntegrity } from "../oracle.js";

function setup(options = {}) {
  let db;
  db = new Database({
    options: { deferral: 0, regionCap: 30, clusterCap: 8, flagCap: 8, ...options },
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
  assert.equal(db.objectIds().length, reachableFromRoot(db.store).size);
}

/**
 * ROOT → a font, a note, and a library of documents whose paragraphs all reference the font.
 * The font and the note start out in ROOT's region.
 */
function library(db, documents = 40) {
  const ids = {};
  db.transaction((tx) => {
    ids.font = tx.create({ name: "Default font" });
    ids.note = tx.create({ text: "a note next to the font", detail: ref(tx.create({ text: "its detail" })) });
    tx.set(ROOT, "font", ref(ids.font));
    tx.set(ROOT, "note", ref(ids.note));
  });
  db.transaction((tx) => {
    const docs = [];
    for (let d = 0; d < documents; d++) {
      const paragraphs = [];
      for (let p = 0; p < 6; p++) paragraphs.push(ref(tx.create({ text: `${d}.${p}`, font: ref(ids.font) })));
      docs.push(ref(tx.create({ paragraphs })));
    }
    tx.set(ROOT, "library", ref(tx.create({ docs })));
  });
  settle(db);
  return ids;
}

const regionOf = (db, id) => db.store.get(`g/${id}`).region;
const members = (db, region) => db.store.keys(`m/${region}/`).map((key) => key.split("/")[2]);

/** Deletes the note, and returns how many regions' edges its collection scanned. */
function regionsScannedToDeleteNote(db, ids) {
  const scanned = new Set();
  const stop = db.store.observe({ read: (key) => key.startsWith("y/") && scanned.add(key.split("/")[1]) });
  db.transaction((tx) => tx.delete(ROOT, "note"));
  db.collector.runUntilIdle();
  stop(); // before the integrity check, which reads everything
  settle(db);
  assert.ok(!db.get(ids.note), "the note is reclaimed");
  return scanned.size;
}

describe("Pinning", () => {
  it("gives an object referenced from many regions a region of its own", () => {
    const db = setup();
    const ids = library(db);
    const region = regionOf(db, ids.font);
    assert.ok(db.collector.stats.structure.pinned > 0);
    assert.equal(db.store.get(`r/${region}`).pinned, true);
    assert.deepEqual(members(db, region), [ids.font], "the font is alone in it");
    assert.notEqual(regionOf(db, ids.note), region);
    assert.ok(db.get(ids.font), "and is still there");
  });

  it("scrubs the flags the font's old region was left with", () => {
    const db = setup();
    const ids = library(db);
    const old = regionOf(db, ids.note);
    assert.ok(db.collector.stats.structure["flag removed"] > 0, "stale flags were removed");
    assert.ok(db.store.get(`r/${old}`).flags <= 8, `${db.store.get(`r/${old}`).flags} flags left on the note's region`);
    assert.equal(db.store.range(`e/${old}/`).filter(([, value]) => value === "copy").length, 0, "none unverified");
    assert.ok(db.store.get(`r/${regionOf(db, ids.font)}`).flags > 8, "the font's region has the many flags");
  });

  it("makes collecting the font's former neighbour cheap", () => {
    const without = setup({ flagCap: 1_000_000 });
    const scannedWithout = regionsScannedToDeleteNote(without, library(without));
    const db = setup();
    const scanned = regionsScannedToDeleteNote(db, library(db));
    assert.ok(scannedWithout > 30, `${scannedWithout} regions scanned without pinning`);
    assert.ok(scanned <= 5, `${scanned} regions scanned with pinning, ${scannedWithout} without`);
  });

  it("keeps a pinned region to itself: nothing merges into it, and it does not merge away", () => {
    const db = setup();
    const ids = library(db);
    const region = regionOf(db, ids.font);
    // Give the font a child, and empty most of the library: light regions look for a home.
    db.transaction((tx) => {
      tx.set(ids.font, "metrics", ref(tx.create({ ascent: 10 })));
      const lib = tx.get(ROOT).library.$ref;
      tx.set(lib, "docs", tx.get(lib).docs.slice(0, 2));
    });
    settle(db);
    assert.equal(regionOf(db, ids.font), region, "the font did not move");
    for (const id of members(db, region)) {
      assert.ok(id === ids.font || db.store.get(`g/${id}`).treeParent === ids.font, `${id} is the font or hangs from it`);
    }
  });
});

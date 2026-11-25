import assert from "node:assert/strict";
import { Database, ROOT } from "../Database.js";
import { ref } from "../model.js";
import { random } from "../fuzz/fuzz.js";
import { reachableFromRoot, checkIntegrity } from "../oracle.js";

function setup(options = {}) {
  let db;
  db = new Database({
    options: { deferral: 0, regionCap: 30, clusterCap: 4, ...options },
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

/** ROOT.library → documents of 5 paragraphs of 5 runs. Returns the document ids. */
function library(db, documents = 12) {
  const docs = [];
  db.transaction((tx) => {
    for (let d = 0; d < documents; d++) {
      const ps = [];
      for (let p = 0; p < 5; p++) {
        const rs = [];
        for (let r = 0; r < 5; r++) rs.push(ref(tx.create({ text: `${d}.${p}.${r}` })));
        ps.push(ref(tx.create({ rs })));
      }
      docs.push(tx.create({ ps }));
    }
    tx.set(ROOT, "library", ref(tx.create({ docs: docs.map(ref) })));
  });
  settle(db);
  return docs;
}

/** Moves a paragraph from one document to another, in one transaction (a quick swap). */
function moveParagraph(db, from, to, index = 0) {
  let moved;
  db.transaction((tx) => {
    const ps = tx.get(from).ps;
    [moved] = ps.splice(index, 1);
    tx.set(from, "ps", ps);
    tx.set(to, "ps", [...tx.get(to).ps, moved]);
  });
  return moved.$ref;
}

const regionOf = (db, id) => db.store.get(`g/${id}`).region;
const level0 = (db) => db.store.range("r/").filter(([, record]) => record.level === 0).map(([key]) => key.slice(2));
/** Regions with tree edges entering from more than one other region. */
const hangingFromSeveral = (db) => level0(db).filter((region) => db.store.keys(`P/${region}/`).length > 1);
const cohortSteps = (stats) => stats.expand + stats.mark + stats.check + stats.reclaim;

describe("Re-homing", () => {
  it("moves a re-parented subtree to where its new tree parent is", () => {
    const db = setup();
    const docs = library(db);
    const from = docs[0];
    const to = docs.find((doc) => regionOf(db, doc) !== regionOf(db, from));
    const paragraph = moveParagraph(db, from, to);
    assert.equal(db.store.get(`g/${paragraph}`).treeParent, to, "re-parented at once");
    assert.notEqual(regionOf(db, paragraph), regionOf(db, to), "still in its old region");
    assert.ok(db.store.keys("x/").length > 0, "a re-home task is pending");
    settle(db);
    assert.ok(db.collector.stats.structure["re-homed"] > 0);
    // In its new parent's region, or in a region that hangs only from there.
    const region = regionOf(db, paragraph);
    const entries = db.store.keys(`P/${region}/`).map((key) => key.split("/")[2]);
    assert.ok(region === regionOf(db, to) || (entries.length === 1 && entries[0] === regionOf(db, to)));
    for (const run of db.get(paragraph).rs) assert.equal(regionOf(db, run.$ref), region, "its runs moved with it");
  });

  it("keeps regions branches while data is shuffled, so that deleting stays cheap", () => {
    const run = (rehome) => {
      const db = setup({ rehome });
      const docs = library(db);
      const rng = random(3);
      for (let i = 0; i < 60; i++) {
        const from = rng.pick(docs);
        const to = rng.pick(docs);
        if (from === to || db.get(from).ps.length === 0) continue;
        moveParagraph(db, from, to, rng.int(db.get(from).ps.length));
        db.collector.run(rng.int(12));
      }
      settle(db);
      const mixed = hangingFromSeveral(db).length;
      const before = { ...db.collector.stats };
      db.transaction((tx) => {
        const lib = tx.get(ROOT).library.$ref;
        tx.set(lib, "docs", tx.get(lib).docs.slice(6));
      });
      settle(db);
      return { mixed, steps: db.collector.stats.detached - before.detached };
    };
    const without = run(false);
    const withRehome = run(true);
    assert.ok(without.mixed > 5, `${without.mixed} regions hang from several others without re-homing`);
    assert.equal(withRehome.mixed, 0, "none with re-homing");
    assert.ok(withRehome.steps * 2 <= without.steps, `${withRehome.steps} objects detached with re-homing, ${without.steps} without`);
  });

  it("drops the task when the object is moved back first", () => {
    const db = setup();
    const docs = library(db);
    const from = docs[0];
    const to = docs.find((doc) => regionOf(db, doc) !== regionOf(db, from));
    const paragraph = moveParagraph(db, from, to);
    const region = regionOf(db, paragraph);
    moveParagraph(db, to, from, db.get(to).ps.length - 1);
    settle(db);
    assert.equal(regionOf(db, paragraph), region, "it never moved");
    assert.equal(db.collector.stats.structure["re-homed"] ?? 0, 0);
  });
});

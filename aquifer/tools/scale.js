/**
 * Does GC work stay flat as the database grows? (design §2.2)
 *
 *   node tools/scale.js
 *
 * Builds databases of growing size: ROOT → library → documents, each document a tree of about
 * 50 objects, all referencing one shared font. Then deletes a fixed number of documents and
 * counts the object records the collector reads per reclaimed object.
 */

import { Database, ROOT } from "../src/Database.js";
import { ref } from "../src/model.js";
import { GcState } from "../src/gc/GcState.js";
import { reachableFromRoot } from "../src/oracle.js";

let recordsRead = 0;
const record = GcState.prototype.record;
GcState.prototype.record = function (id) {
  recordsRead++;
  return record.call(this, id);
};

function buildDocument(tx, font) {
  const paragraphs = [];
  for (let p = 0; p < 7; p++) {
    const runs = [];
    for (let r = 0; r < 6; r++) runs.push(ref(tx.create({ text: "lorem", font: ref(font) })));
    paragraphs.push(ref(tx.create({ runs })));
  }
  return tx.create({ title: "doc", paragraphs });
}

function build(documents, clusterCap = 32) {
  const db = new Database({ options: { deferral: 0, regionCap: 100, clusterCap } });
  let font;
  db.transaction((tx) => {
    font = tx.create({ name: "Default font" });
    tx.set(ROOT, "font", ref(font));
    tx.set(ROOT, "library", ref(tx.create({ count: 0 })));
  });
  const library = db.get(ROOT).library.$ref;
  // Documents are kept in a chunked list: library → chunks of 20 documents.
  for (let chunkStart = 0; chunkStart < documents; chunkStart += 20) {
    db.transaction((tx) => {
      const chunk = [];
      for (let i = chunkStart; i < Math.min(documents, chunkStart + 20); i++) chunk.push(ref(buildDocument(tx, font)));
      tx.set(library, `chunk${chunkStart / 20}`, ref(tx.create({ documents: chunk })));
    });
  }
  db.collector.runUntilIdle(); // settle the splits from loading
  return { db, library };
}

/** Counts of clusters per level: "regions/level-1/level-2...". */
function levels(db) {
  const counts = [];
  for (const [, record] of db.store.range("r/")) counts[record.level] = (counts[record.level] ?? 0) + 1;
  return counts.join("/");
}

function measure(documents, deletions) {
  const { db, library } = build(documents);
  const objects = db.objectIds().length;
  const regions = levels(db);

  recordsRead = 0;
  const stepsBefore = db.collector.stats.steps;
  const reclaimedBefore = db.collector.stats.reclaimed;
  for (let d = 0; d < deletions; d++) {
    db.transaction((tx) => {
      const chunk = tx.get(library)[`chunk${d % Math.ceil(documents / 20)}`].$ref;
      const list = tx.get(chunk).documents;
      list.shift();
      tx.set(chunk, "documents", list);
    });
    db.collector.runUntilIdle();
  }
  const reclaimed = db.collector.stats.reclaimed - reclaimedBefore;
  if (db.objectIds().length !== reachableFromRoot(db.store).size) throw new Error("incomplete collection");
  return {
    documents,
    objects,
    regions,
    reclaimed,
    steps: db.collector.stats.steps - stepsBefore,
    recordsRead,
    recordsPerReclaimed: (recordsRead / reclaimed).toFixed(1),
  };
}

/** Deletes one chunk of 20 documents (about 1000 objects) in one transaction. */
function measureChunk(documents, clusterCap) {
  const { db, library } = build(documents, clusterCap);
  const objects = db.objectIds().length;
  const regions = levels(db);
  recordsRead = 0;
  const before = { ...db.collector.stats };
  db.transaction((tx) => tx.delete(library, "chunk0"));
  db.collector.runUntilIdle();
  const stats = db.collector.stats;
  const cohortSteps = (s) => s.expand + s.mark + s.check + s.reclaim;
  if (db.objectIds().length !== reachableFromRoot(db.store).size) throw new Error("incomplete collection");
  return {
    clusterCap,
    documents,
    objects,
    "clusters per level": regions,
    reclaimed: stats.reclaimed - before.reclaimed,
    "cohort steps": cohortSteps(stats) - cohortSteps(before),
    suspended: stats.suspended - before.suspended,
    "of them meta": stats.suspendedMeta - before.suspendedMeta,
    recordsRead,
  };
}

console.log("Deleting 10 documents (about 50 objects each) from databases of growing size:");
console.table([100, 400, 1600].map((n) => measure(n, 10)));
console.log("Deleting a chunk of 20 documents (about 1000 objects) at once, without and with meta-regions:");
console.table([100, 400].flatMap((n) => [measureChunk(n, 100000), measureChunk(n, 32), measureChunk(n, 4)]));

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

function measure(documents, deletions) {
  const db = new Database({ options: { deferral: 0, regionCap: 100 } });
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
  const objects = db.objectIds().length;
  const regions = db.store.keys("r/").length;

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

console.log("Deleting 10 documents (about 50 objects each) from databases of growing size:");
console.table([100, 400, 1600].map((n) => measure(n, 10)));

/**
 * Does the cost of a change stay flat as a database on LMDB grows? (design §2.2, step 8)
 *
 *   node tools/lmdb.js [documents...]        default: 100 400 1600
 *
 * Builds a library of documents (about 50 objects each, with some text) on LMDB in a temporary
 * directory, then measures, per database size:
 *   - a small edit (add a paragraph), with the collector work it causes;
 *   - deleting a document, with its whole collection.
 * Keys read and written are counted by a store observer; times are wall-clock. The store runs
 * with { noSync: true }, so times are without the disk flush of each commit.
 */

import { mkdtempSync, rmSync, statSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Database, ROOT } from "../src/Database.js";
import { ref } from "../src/model.js";
import { LmdbStore } from "../src/store/LmdbStore.js";
import { reachableFromRoot } from "../src/oracle.js";

const TEXT = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore. ".repeat(3);

function measure(documents) {
  const path = mkdtempSync(join(tmpdir(), "frozen-scale-"));
  const store = new LmdbStore(path, { noSync: true });
  const db = new Database({ store, options: { deferral: 0, regionCap: 150, clusterCap: 32 } });
  const counters = { read: 0, written: 0 };
  let counting = false;
  store.observe({
    read: () => { if (counting) counters.read++; },
    commit: (writes) => { if (counting) counters.written += writes.length; },
  });

  let started = Date.now();
  let library;
  const docs = [];
  db.transaction((tx) => { library = tx.create({}); tx.set(ROOT, "library", ref(library)); });
  for (let start = 0; start < documents; start += 20) {
    db.transaction((tx) => {
      const list = [];
      for (let d = start; d < Math.min(documents, start + 20); d++) {
        const ps = [];
        for (let p = 0; p < 7; p++) {
          const rs = [];
          for (let r = 0; r < 6; r++) rs.push(ref(tx.create({ text: TEXT })));
          ps.push(ref(tx.create({ rs })));
        }
        const doc = tx.create({ ps });
        docs.push(doc);
        list.push(ref(doc));
      }
      tx.set(library, `chunk${start / 20}`, ref(tx.create({ docs: list })));
    });
    db.collector.runUntilIdle();
  }
  const loadMs = Date.now() - started;
  const objects = store.keys("o/").length;
  const levels = [];
  for (const [, record] of store.range("r/")) levels[record.level] = (levels[record.level] ?? 0) + 1;

  const run = (count, action) => {
    counters.read = 0;
    counters.written = 0;
    counting = true;
    started = performance.now();
    for (let i = 0; i < count; i++) {
      action(i);
      db.collector.runUntilIdle();
    }
    counting = false;
    return { ms: (performance.now() - started) / count, read: counters.read / count, written: counters.written / count };
  };

  const edit = run(100, (i) =>
    db.transaction((tx) => {
      const doc = docs[(i * 37) % docs.length];
      tx.set(doc, "ps", [...tx.get(doc).ps, ref(tx.create({ rs: [ref(tx.create({ text: TEXT }))] }))]);
    }),
  );
  const remove = run(10, (i) =>
    db.transaction((tx) => {
      const chunk = tx.get(library)[`chunk${Math.floor((i * 3) % Math.ceil(documents / 20))}`].$ref;
      const list = tx.get(chunk).docs;
      list.shift();
      tx.set(chunk, "docs", list);
    }),
  );
  if (store.keys("o/").length !== reachableFromRoot(store).size) throw new Error("incomplete collection");

  const megabytes = readdirSync(path).reduce((sum, file) => sum + statSync(join(path, file)).size, 0) / 1024 / 1024;
  store.close();
  rmSync(path, { recursive: true, force: true });
  return {
    documents,
    objects,
    "clusters per level": levels.join("/"),
    "file MB": megabytes.toFixed(0),
    "load s": (loadMs / 1000).toFixed(1),
    "edit: ms": edit.ms.toFixed(2),
    "edit: keys read": edit.read.toFixed(0),
    "edit: keys written": edit.written.toFixed(0),
    "delete doc: ms": remove.ms.toFixed(1),
    "delete doc: keys read": remove.read.toFixed(0),
    "delete doc: keys written": remove.written.toFixed(0),
  };
}

const sizes = process.argv.slice(2).map(Number);
console.table((sizes.length > 0 ? sizes : [100, 400, 1600]).map(measure));

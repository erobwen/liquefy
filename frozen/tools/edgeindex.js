/**
 * The edge index against reading edges from the records (design §5.5, A against B).
 *
 *   node tools/edgeindex.js
 *
 * Builds documents whose runs carry some text, then measures, with and without the index:
 *   - what the collector reads to delete 10 documents (keys, bytes, object records);
 *   - what a small edit writes (the index costs a key per changed reference);
 *   - what loading costs in keys written, splits included (a move rewrites the moved objects'
 *     edge keys).
 */

import { Database, ROOT } from "../src/Database.js";
import { ref } from "../src/model.js";

const TEXT = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore. ".repeat(3);

function run(edgeIndex, textual) {
  const db = new Database({ options: { deferral: 0, regionCap: 150, clusterCap: 32, edgeIndex } });
  const counters = { keysRead: 0, bytesRead: 0, recordsRead: 0, keysWritten: 0, bytesWritten: 0 };
  let collecting = false;
  db.store.observe({
    read: (key) => {
      if (!collecting) return;
      counters.keysRead++;
      counters.bytesRead += key.length + JSON.stringify(db.store.values.get(key) ?? null).length;
      if (key.startsWith("o/")) counters.recordsRead++;
    },
    commit: (writes) => {
      counters.keysWritten += writes.length;
      for (const [key, value] of writes) counters.bytesWritten += key.length + JSON.stringify(value ?? null).length;
    },
  });
  const collect = () => {
    collecting = true;
    db.collector.runUntilIdle();
    collecting = false;
  };
  const reset = () => { for (const key in counters) counters[key] = 0; };

  let library;
  const docs = [];
  db.transaction((tx) => { library = tx.create({}); tx.set(ROOT, "library", ref(library)); });
  for (let c = 0; c < 10; c++) {
    db.transaction((tx) => {
      const list = [];
      for (let d = 0; d < 20; d++) {
        const ps = [];
        for (let p = 0; p < 7; p++) {
          const rs = [];
          for (let r = 0; r < 6; r++) rs.push(ref(tx.create({ text: textual ? TEXT : "x" })));
          ps.push(ref(tx.create({ rs })));
        }
        const doc = tx.create({ ps });
        docs.push(doc);
        list.push(ref(doc));
      }
      tx.set(library, `chunk${c}`, ref(tx.create({ docs: list })));
    });
    collect();
  }
  const load = { ...counters };

  reset();
  for (let i = 0; i < 100; i++) {
    db.transaction((tx) => {
      const doc = docs[(i * 7) % docs.length];
      tx.set(doc, "ps", [...tx.get(doc).ps, ref(tx.create({ rs: [ref(tx.create({ text: textual ? TEXT : "x" }))] }))]);
    });
    collect();
  }
  const edit = { ...counters };

  reset();
  for (const doc of docs.slice(0, 10)) {
    db.transaction((tx) => {
      for (const [field, value] of Object.entries(tx.get(library))) {
        const chunk = value.$ref;
        const list = tx.get(chunk).docs;
        if (list.some((d) => d.$ref === doc)) tx.set(chunk, "docs", list.filter((d) => d.$ref !== doc));
      }
    });
    collect();
  }
  const reclaimed = 10 * 50;
  return {
    records: textual ? "with text" : "tiny",
    edges: edgeIndex ? "B: index" : "A: records",
    "delete: keys read": counters.keysRead,
    "delete: KB read": (counters.bytesRead / 1024).toFixed(0),
    "delete: object records read": counters.recordsRead,
    "edit: keys written": (edit.keysWritten / 100).toFixed(1),
    "load: keys written per object": (load.keysWritten / (docs.length * 50)).toFixed(1),
    "load: KB written": (load.bytesWritten / 1024).toFixed(0),
  };
}

console.table([run(false, true), run(true, true), run(false, false), run(true, false)]);

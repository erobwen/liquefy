/**
 * How are clusters shaped? Counts, per level, the clusters with one root and with several, and
 * whether several roots hang from one parent.   node tools/shapes.js
 */
import { Database, ROOT } from "../src/Database.js";
import { ref } from "../src/model.js";

function shapes(db) {
  const store = db.store;
  const clusters = new Map(store.range("r/").map(([k, r]) => [k.slice(2), r]));
  const members = (c) => store.keys(`m/${c}/`).map((k) => k.split("/")[2]);
  const rows = {};
  const add = (level, row) => (rows[level] ??= []).push(row);
  for (const [id, record] of clusters) {
    const ms = members(id);
    const set = new Set(ms);
    if (record.level === 0) {
      const anchors = ms.filter((m) => m !== ROOT && !set.has(store.get(`g/${m}`).treeParent));
      const parents = new Set(anchors.map((m) => store.get(`g/${m}`).treeParent));
      const parentRegions = new Set([...parents].map((p) => store.get(`g/${p}`).region));
      add(0, { size: ms.length, roots: anchors.length + (set.has(ROOT) ? 1 : 0), parents: parents.size, parentClusters: parentRegions.size });
    } else {
      // Roots: members with tree edges entering from outside this meta-region, or none at all.
      let roots = 0;
      const outside = new Set();
      const link = new Map(ms.map((m) => [m, m]));
      const find = (x) => (link.get(x) === x ? x : find(link.get(x)));
      for (const m of ms) {
        const entries = store.keys(`P/${m}/`).map((k) => k.split("/")[2]);
        const inside = entries.filter((e) => set.has(e));
        const out = entries.filter((e) => !set.has(e));
        out.forEach((e) => outside.add(clusters.get(e).container ?? e));
        if (out.length > 0 || entries.length === 0) roots++;
        for (const e of inside) link.set(find(m), find(e));
      }
      const components = new Set(ms.map(find)).size;
      add(record.level, { size: ms.length, roots, parentClusters: outside.size, components });
    }
  }
  for (const [level, list] of Object.entries(rows)) {
    const n = list.length;
    const count = (f) => list.filter(f).length;
    const avg = (f) => (list.reduce((s, r) => s + f(r), 0) / n).toFixed(1);
    console.log(
      `  level ${level}: ${n} clusters, avg size ${avg((r) => r.size)}, single root ${count((r) => r.roots <= 1)}, ` +
        `multi-root ${count((r) => r.roots > 1)} (avg roots ${avg((r) => r.roots)}, max ${Math.max(...list.map((r) => r.roots))}), ` +
        (level === "0"
          ? `roots under several parent objects ${count((r) => r.parents > 1)}, `
          : `disconnected inside ${count((r) => r.components > 1)}, `) +
        `hanging from several clusters ${count((r) => r.parentClusters > 1)}`,
    );
  }
}

function visualizerExample() {
  const db = new Database({ options: { deferral: 0, regionCap: 12, clusterCap: 3 } });
  db.transaction((tx) => {
    const documents = [];
    for (let d = 1; d <= 4; d++) {
      const sections = [];
      for (let s = 1; s <= 3; s++) {
        const paragraphs = [];
        for (let p = 1; p <= 4; p++) paragraphs.push(ref(tx.create({ text: `${d}.${s}.${p}` })));
        sections.push(ref(tx.create({ paragraphs })));
      }
      documents.push(ref(tx.create({ sections })));
    }
    tx.set(ROOT, "library", ref(tx.create({ documents })));
  });
  db.collector.runUntilIdle();
  return db;
}

function larger(regionCap, clusterCap, incremental) {
  const db = new Database({ options: { deferral: 0, regionCap, clusterCap } });
  let library;
  db.transaction((tx) => { library = tx.create({}); tx.set(ROOT, "library", ref(library)); });
  for (let c = 0; c < 10; c++) {
    db.transaction((tx) => {
      const docs = [];
      for (let d = 0; d < 20; d++) {
        const ps = [];
        for (let p = 0; p < 7; p++) {
          const rs = [];
          for (let r = 0; r < 6; r++) rs.push(ref(tx.create({ text: "lorem" })));
          ps.push(ref(tx.create({ rs })));
        }
        docs.push(ref(tx.create({ ps })));
      }
      tx.set(library, `chunk${c}`, ref(tx.create({ docs })));
    });
    if (incremental) db.collector.runUntilIdle();
  }
  db.collector.runUntilIdle();
  return db;
}

console.log("Visualizer example (regionCap 12, clusterCap 3):");
shapes(visualizerExample());
console.log("200 documents of 50 objects (regionCap 100, clusterCap 32):");
shapes(larger(100, 32, true));
console.log("Same, regionCap 30, clusterCap 8:");
shapes(larger(30, 8, true));

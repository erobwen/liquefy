/**
 * What does moving data around cost later? (design §6.7)   node tools/fragmentation.js
 *
 * Builds 40 documents, moves paragraphs between them at random (each move re-parents the
 * paragraph at once, in another region than its own), then deletes 10 documents and counts the
 * collector's cohort steps. Without re-homing, regions end up hanging from several places and
 * can no longer be suspended as a unit.
 */

import { Database, ROOT } from "../src/Database.js";
import { ref } from "../src/model.js";
import { random } from "../src/fuzz/fuzz.js";
import { checkIntegrity } from "../src/oracle.js";

function run(moves, rehome) {
  const db = new Database({ options: { deferral: 0, regionCap: 30, clusterCap: 8, rehome } });
  const docs = [];
  db.transaction((tx) => {
    for (let d = 0; d < 40; d++) {
      const ps = [];
      for (let p = 0; p < 7; p++) {
        const rs = [];
        for (let r = 0; r < 6; r++) rs.push(ref(tx.create({ text: "lorem" })));
        ps.push(ref(tx.create({ rs })));
      }
      docs.push(tx.create({ ps }));
    }
    tx.set(ROOT, "library", ref(tx.create({ docs: docs.map(ref) })));
  });
  db.collector.runUntilIdle();

  const rng = random(7);
  const stepsBefore = db.collector.stats.steps;
  for (let i = 0; i < moves; i++) {
    db.transaction((tx) => {
      const from = rng.pick(docs);
      const to = rng.pick(docs);
      const ps = tx.get(from).ps;
      if (from === to || ps.length === 0) return;
      const [moved] = ps.splice(rng.int(ps.length), 1);
      tx.set(from, "ps", ps);
      tx.set(to, "ps", [...tx.get(to).ps, moved]);
    });
    db.collector.runUntilIdle();
  }
  const upkeep = db.collector.stats.steps - stepsBefore;

  let mixed = 0;
  let regions = 0;
  for (const [key, record] of db.store.range("r/")) {
    if (record.level !== 0) continue;
    regions++;
    if (db.store.keys(`P/${key.slice(2)}/`).length > 1) mixed++;
  }

  const before = { ...db.collector.stats };
  for (const doc of docs.slice(0, 10)) {
    db.transaction((tx) => {
      const library = tx.get(ROOT).library.$ref;
      tx.set(library, "docs", tx.get(library).docs.filter((d) => d.$ref !== doc));
    });
    db.collector.runUntilIdle();
  }
  const problems = checkIntegrity(db.store, { quiescent: true });
  if (problems.length > 0) throw new Error(problems[0]);
  const stats = db.collector.stats;
  const cohort = (s) => s.expand + s.mark + s.check + s.reclaim;
  const reclaimed = stats.reclaimed - before.reclaimed;
  return {
    moves,
    "re-homing": rehome ? "on" : "off",
    regions,
    "hanging from several": mixed,
    "steps per move": moves ? (upkeep / moves).toFixed(1) : "",
    "objects reclaimed": reclaimed,
    "cohort steps": cohort(stats) - cohort(before),
    "steps per object": ((cohort(stats) - cohort(before)) / reclaimed).toFixed(2),
  };
}

console.table([0, 50, 200, 800].flatMap((moves) => [run(moves, false), run(moves, true)]));

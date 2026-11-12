/**
 * Replays a fuzz seed like runSeed, one collector step at a time, checking integrity after every
 * step. On the first problem, it writes the whole step log to debug-log.txt (or $LOG) and
 * prints the edge from the live part of the graph into a wrongly reclaimed set.
 *
 *   MAXSTEPS=<1 + seed % 4> node tools/replay.js <seed> [object id to follow in the log]
 */
import { writeFileSync } from "node:fs";
import { Database } from "../src/Database.js";
import { random, randomTransaction } from "../src/fuzz/fuzz.js";
import { reachableFromRoot, checkIntegrity } from "../src/oracle.js";

const seed = Number(process.argv[2] ?? 13);
const watch = process.argv[3];
const rng = random(seed);
let time = 0;
const options = {
  now: () => time,
  deferral: rng.int(4),
  walkBudget: rng.pick([2, 4, 64]),
  candidates: rng.pick([1, 2, 8]),
  regionCap: rng.pick([3, 5, 8, 16, 100]),
};
options.deferCuts = rng.next() >= 0.25;
console.log(options);
const log = [];
let db;
db = new Database({
  options,
  onReclaim: (ids) => {
    const reachable = reachableFromRoot(db.store);
    const bad = ids.filter((id) => reachable.has(id));
    if (bad.length) {
      writeFileSync(process.env.LOG ?? "debug-log.txt", log.join("\n"));
      console.log("RECLAIMED REACHABLE", bad, "in", JSON.stringify(db.collector.lastStep));
      const doomed = new Set(ids);
      for (const key of db.store.keys("o/")) {
        const source = key.slice(2);
        if (doomed.has(source) || !reachable.has(source)) continue;
        const record = db.store.get(key);
        for (const target of JSON.stringify(record).match(/"\$ref":"[^"]+"/g) ?? []) {
          const id = target.slice(8, -1);
          if (doomed.has(id)) {
            const sm = db.store.get(`g/${source}`), tm = db.store.get(`g/${id}`);
            console.log("EDGE", source, "->", id, "\n  source", show(source), "\n  target", show(id),
              "\n  flags on target region", db.store.keys(`e/${tm.region}/`), "\n  members of target region", db.store.keys(`m/${tm.region}/`));
          }
        }
      }
      process.exit(1);
    }
  },
});
const show = (id) => {
  const meta = db.store.get(`g/${id}`);
  if (!meta) return `${id}: gone`;
  const region = db.store.get(`r/${meta.region}`);
  return `${id}: ${JSON.stringify(meta)} region ${JSON.stringify(region)}`;
};
const clipboard = [];
let stepNo = 0;
for (let i = 0; i < 300; i++) {
  time += rng.int(1000);
  randomTransaction(db, rng, clipboard);
  log.push(`--- tx ${i}` + (watch ? "  " + show(watch) : ""));
  const steps = rng.int(Number(process.env.MAXSTEPS ?? 4) + 1);
  for (let k = 0; k < steps; k++) {
    if (!db.collector.step()) break;
    stepNo++;
    log.push(`step ${stepNo} ${JSON.stringify(db.collector.lastStep)}` + (watch ? "  " + show(watch) : ""));
    const problems = checkIntegrity(db.store);
    if (problems.length) {
      console.log(log.slice(-25).join("\n"));
      console.log("INTEGRITY", problems.slice(0, 5));
      process.exit(1);
    }
  }
}
log.push("--- final drain");
while (db.collector.step({ flush: true })) {
  stepNo++;
  log.push(`step ${stepNo} ${JSON.stringify(db.collector.lastStep)}` + (watch ? "  " + show(watch) : ""));
  const problems = checkIntegrity(db.store);
  if (problems.length) {
    console.log(log.slice(-25).join("\n"));
    console.log("INTEGRITY", problems.slice(0, 5));
    process.exit(1);
  }
}
console.log("no failure");

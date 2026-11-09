/**
 * Fuzzer with oracle (documents/persistent-garbage-collection.md §16.2).
 *
 * Applies random transactions to objects reachable from ROOT, as an application would,
 * interleaved with random amounts of collector work, and checks:
 *   - safety: every reclaimed object is unreachable in the committed state at reclaim time;
 *   - integrity: GC metadata is consistent with the object records;
 *   - completeness: once the collector is idle, stored objects are exactly the reachable ones.
 */

import { Database, ROOT } from "../Database.js";
import { ref, weak, isRef } from "../model.js";
import { reachableFromRoot, checkIntegrity } from "../oracle.js";

/** A seeded pseudo-random generator (mulberry32). */
export function random(seed) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (n) => Math.floor(next() * n);
  const pick = (list) => list[int(list.length)];
  return { next, int, pick };
}

const FIELDS = ["a", "b", "c", "d"];

const OPERATIONS = [
  "create", "create", "create",
  "link", "link",
  "unlink", "unlink",
  "move",
  "cycle",
  "list",
  "weak",
  "replace",
  "cut", "paste",
  "hold", "release",
  "skip", "skip",
];

/**
 * One random transaction. Touches objects reachable from ROOT, as an application would, plus
 * the `clipboard`: references cut in an earlier transaction and held by the application, to be
 * pasted later. A held object may have been reclaimed meanwhile, in which case the paste is
 * dropped; while it exists, relinking it must be safe in any GC state.
 */
export function randomTransaction(db, rng, clipboard = []) {
  const reachable = [...reachableFromRoot(db.store)].sort();
  const operation = rng.pick(OPERATIONS);

  db.transaction((tx) => {
    const source = rng.pick(reachable);
    switch (operation) {
      case "cut": {
        const fields = Object.entries(tx.get(source)).filter(([, value]) => isRef(value));
        if (fields.length === 0) break;
        const [field, value] = rng.pick(fields);
        tx.delete(source, field);
        clipboard.push(value);
        break;
      }
      case "hold": {
        // Like cut, but the application asks the database to keep the object for a while.
        const fields = Object.entries(tx.get(source)).filter(([, value]) => isRef(value));
        if (fields.length === 0) break;
        const [field, value] = rng.pick(fields);
        tx.delete(source, field);
        tx.hold(value.$ref, rng.next() < 0.5 ? { transactions: 1 + rng.int(20) } : { milliseconds: rng.int(5000) });
        clipboard.push(value);
        break;
      }
      case "release": {
        if (clipboard.length === 0) break;
        const value = rng.pick(clipboard);
        if (tx.exists(value.$ref)) tx.release(value.$ref);
        break;
      }
      case "paste": {
        const index = rng.int(clipboard.length);
        if (clipboard.length === 0) break;
        const [value] = clipboard.splice(index, 1);
        if (tx.exists(value.$ref)) tx.set(source, rng.pick(FIELDS), value);
        break;
      }
      case "skip": {
        // source.f → x, x.g → y becomes source.f → y: a dequeue.
        const fields = Object.entries(tx.get(source)).filter(([, value]) => isRef(value));
        if (fields.length === 0) break;
        const [field, value] = rng.pick(fields);
        const next = Object.values(tx.get(value.$ref)).filter(isRef);
        if (next.length === 0) break;
        tx.set(source, field, rng.pick(next));
        break;
      }
      case "create": {
        const fields = {};
        for (let i = rng.int(3); i > 0; i--) fields[rng.pick(FIELDS)] = ref(rng.pick(reachable));
        tx.set(source, rng.pick(FIELDS), ref(tx.create(fields)));
        break;
      }
      case "link":
        tx.set(source, rng.pick(FIELDS), ref(rng.pick(reachable)));
        break;
      case "unlink":
        tx.delete(source, rng.pick(FIELDS));
        break;
      case "move": {
        const fields = Object.entries(tx.get(source)).filter(([, value]) => isRef(value));
        if (fields.length === 0) break;
        const [field, value] = rng.pick(fields);
        tx.delete(source, field);
        tx.set(rng.pick(reachable), rng.pick(FIELDS), value);
        break;
      }
      case "cycle": {
        const size = 1 + rng.int(4);
        const ids = Array.from({ length: size }, () => tx.create({}));
        ids.forEach((id, i) => tx.set(id, "next", ref(ids[(i + 1) % size])));
        if (rng.next() < 0.5) tx.set(ids[rng.int(size)], "out", ref(rng.pick(reachable)));
        tx.set(source, rng.pick(FIELDS), ref(ids[0]));
        break;
      }
      case "list": {
        const items = Array.from({ length: rng.int(4) }, () =>
          ref(rng.next() < 0.5 ? rng.pick(reachable) : tx.create({})),
        );
        tx.set(source, rng.pick(FIELDS), items);
        break;
      }
      case "weak":
        tx.set(source, rng.pick(FIELDS), weak(rng.pick(reachable)));
        break;
      case "replace":
        if (source !== ROOT) tx.replace(source, {});
        break;
    }
  });
}

/**
 * Runs one seed. Throws on the first violation.
 *
 * @param maxSteps        collector steps after each transaction are random in 0..maxSteps;
 *                        fewer steps keep more cohorts alive at the same time
 * @param integrityEvery  run the (expensive) integrity check every n transactions
 */
export function runSeed(seed, { transactions = 300, maxSteps = 4, integrityEvery = 1 } = {}) {
  const rng = random(seed);
  // Vary the collector options per seed, including small budgets, so that walks and searches
  // that give up are exercised too.
  // A fake wall clock that advances by a random amount per transaction, for time-based holds.
  let time = 0;
  const options = {
    now: () => time,
    deferral: rng.int(4),
    walkBudget: rng.pick([2, 4, 64]),
    candidates: rng.pick([1, 2, 8]),
  };
  const clipboard = [];
  let reclaimed = 0;
  let db;
  db = new Database({
    options,
    onReclaim: (ids) => {
      const reachable = reachableFromRoot(db.store);
      for (const id of ids) {
        if (reachable.has(id)) throw new Error(`seed ${seed}: reclaimed reachable object ${id}`);
      }
      reclaimed += ids.length;
    },
  });

  const assertIntegrity = (when, options) => {
    const problems = checkIntegrity(db.store, options);
    if (problems.length > 0) throw new Error(`seed ${seed}, ${when}: ${problems.slice(0, 5).join("; ")}`);
  };

  for (let i = 0; i < transactions; i++) {
    time += rng.int(1000);
    randomTransaction(db, rng, clipboard);
    db.collector.run(rng.int(maxSteps + 1));
    if (i % integrityEvery === 0) assertIntegrity(`transaction ${i}`);
  }

  db.collector.runUntilIdle(1_000_000);
  assertIntegrity("quiescent", { quiescent: true });
  const stored = db.objectIds().length;
  const reachable = reachableFromRoot(db.store).size;
  if (stored !== reachable) throw new Error(`seed ${seed}: ${stored} objects stored, ${reachable} reachable`);
  return { reclaimed, live: stored, stats: db.collector.stats };
}

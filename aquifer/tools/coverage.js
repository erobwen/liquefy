/**
 * Counts how often each GC mechanism fires across fuzz seeds, to check that the fuzzer
 * exercises them.   node tools/coverage.js [seeds=100]
 */
import { GcState } from "../src/gc/GcState.js";
import { runSeed } from "../src/fuzz/fuzz.js";

const counts = {};
const count = (name) => (counts[name] = (counts[name] ?? 0) + 1);
for (const name of ["defer", "reparent", "rescue", "merge", "makeUnstable", "quickSwap", "suspend", "resume", "materialize"]) {
  const original = GcState.prototype[name];
  GcState.prototype[name] = function (...args) {
    const result = original.apply(this, args);
    count(name === "quickSwap" ? `quickSwap:${result ? "swapped" : "failed"}` : name);
    return result;
  };
}
const walk = GcState.prototype.verifiedWalk;
GcState.prototype.verifiedWalk = function (...args) {
  const result = walk.apply(this, args);
  count(`walk:${result ? "ok" : "failed"}`);
  return result;
};

const seeds = Number(process.argv[2] ?? 100);
const totals = {};
for (let seed = 1; seed <= seeds; seed++) {
  const { stats } = runSeed(seed, { transactions: 300, maxSteps: 2 });
  for (const [key, value] of Object.entries(stats)) {
    if (typeof value === "number") totals[key] = (totals[key] ?? 0) + value;
    else for (const [outcome, n] of Object.entries(value)) totals[`structure:${outcome}`] = (totals[`structure:${outcome}`] ?? 0) + n;
  }
}
console.log("collector stats:", totals);
console.log("GcState calls:", counts);

/**
 * Runs the fuzzer over a range of seeds and reports failures.
 *
 *   node tools/sweep.js <fromSeed> <toSeed> [transactions=300] [maxSteps=4] [integrityEvery=1]
 *
 * Smaller maxSteps means less collector work between transactions, so more cohorts are alive
 * at the same time.
 */

import { runSeed } from "../src/fuzz/fuzz.js";

const [from = 1, to = 100, transactions = 300, maxSteps = 4, integrityEvery = 1] = process.argv
  .slice(2)
  .map(Number);

let failures = 0;
let reclaimed = 0;
const started = Date.now();
for (let seed = from; seed <= to; seed++) {
  try {
    reclaimed += runSeed(seed, { transactions, maxSteps, integrityEvery }).reclaimed;
  } catch (error) {
    failures++;
    console.log(`seed ${seed}: ${error.message.slice(0, 300)}`);
  }
}
console.log(
  `seeds ${from}-${to}, ${transactions} transactions, maxSteps ${maxSteps}: ` +
    `${failures} failures, ${reclaimed} objects reclaimed, ${Date.now() - started} ms`,
);
process.exitCode = failures > 0 ? 1 : 0;

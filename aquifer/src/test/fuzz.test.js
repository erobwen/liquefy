import { runSeed } from "../fuzz/fuzz.js";

describe("Fuzzer with oracle", function () {
  this.timeout(60_000);

  for (let seed = 1; seed <= 40; seed++) {
    it(`seed ${seed}`, () => {
      runSeed(seed, { transactions: 300, maxSteps: 1 + (seed % 4) });
    });
  }
});

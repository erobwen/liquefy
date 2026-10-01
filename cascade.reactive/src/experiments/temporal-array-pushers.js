import { getWorld } from "../cascade.js";
const { observable, repeat } = getWorld({ name: "temporal-array-pushers" });

// n repeaters laying words out on one temporal array, in order - each reads
// only the last element (where the word before it ended) and pushes its own
// (see cascade.js's "Temporal arrays", and the Paper demo in
// cascade.application). Run with: node src/experiments/temporal-array-pushers.js
//
// What it measures is the cursor: one current content per array, moved
// forward through the writings as repeaters run one after another, instead
// of a content of its own for every writing (see
// docs/plan-array-timelines.md, "Storage"). Measured on the same machine,
// n = 3000, before and after:
//
//                              content per writing    cursor
//   first render                    102 ms            54 ms
//   change at the start            1463 ms           119 ms
//   same-length change, middle       34 ms           5.5 ms
for (const n of [100, 1000, 3000]) {
  const placed = observable([]);
  const texts = observable(Array.from({ length: n }, (_, i) => "w" + i));

  let start = performance.now();
  repeat(() => {
    for (let i = 0; i < n; i++) {
      repeat(() => {
        const text = texts[i];
        const previous = placed.at(-1);
        const column = previous ? previous.end + 1 : 0;
        placed.push(Object.freeze({ column, end: column + text.length }));
      });
    }
  });
  const firstRender = performance.now() - start;

  // Longer: every word after it moves.
  start = performance.now();
  texts[0] = "longer word";
  const changeAtStart = performance.now() - start;

  // Same length: the next word lands where it was, and the rest stay put.
  const middle = Math.floor(n / 2);
  start = performance.now();
  texts[middle] = "w" + "x".repeat(String(middle).length);
  const changeInMiddle = performance.now() - start;

  console.log(
    `n=${n}: first render ${firstRender.toFixed(0)} ms, change at the start ${changeAtStart.toFixed(0)} ms, ` +
    `same-length change in the middle ${changeInMiddle.toFixed(1)} ms`
  );
}

import { getWorld } from "../cascade.js";
import assert from "assert";

// Stress test for the partial-chain order numbers (see
// docs/plan-partial-repeaters.md, "Time as tree position"): forces many
// insertions into the *same* shrinking gap (the initial 65536 spacer
// bisects down to nothing in about sixteen of them), and checks that
// tree-order comparisons stay correct across the pressure-release blast(s)
// that forces, not just that nothing throws.
describe("partial chain order (pressure release)", function () {
  it("keeps tree-order comparisons correct across many insertions that force pressure-release blasts", function () {
    const { observable, repeat, linkRepeater } = getWorld({
      name: "partial-chain-order",
    });

    const target = observable({ value: 0 });
    const seenValues = [];
    const middles = [];
    let afterRepeater = null;
    let pendingCount = 0;

    // Each "middle" repeater is only ever created once (never rerun after
    // that - only relinked), so seenValues[i] permanently records what
    // middle #i actually saw at the moment it was inserted. If tree order
    // ever gets corrupted by a blast, some middle reads a stale/wrong
    // predecessor and this stops matching its index.
    const parent = repeat(() => {
      target.value = 0; // baseline "before" write, reconciles to a no-op after the first run

      for (const m of middles) linkRepeater(m);

      if (middles.length < pendingCount) {
        const idx = middles.length;
        const created = repeat(() => {
          seenValues[idx] = target.value;
          target.value = target.value + 1;
        });
        middles.push(created);
      }

      // Stable anchor every new middle inserts *before* - without this,
      // every insertion would just be an append (unbounded room ahead,
      // never triggering a blast). Never does anything itself.
      if (afterRepeater) {
        linkRepeater(afterRepeater);
      } else {
        afterRepeater = repeat(() => {});
      }
    });

    const N = 24; // enough halvings of the gap before "after" to force several blasts
    for (let i = 0; i < N; i++) {
      pendingCount = i + 1;
      parent.restart();
    }

    for (let i = 0; i < N; i++) {
      assert.equal(seenValues[i], i, `middle #${i} should have seen ${i}, saw ${seenValues[i]}`);
    }
  });
});

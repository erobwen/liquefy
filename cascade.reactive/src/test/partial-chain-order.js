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
    const { temporal, repeat, linkRepeater } = getWorld({
      name: "partial-chain-order",
    });

    const target = temporal({ value: 0 });
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

  // A list whose children are all replaced, over and over, before a
  // sibling that stays: every round inserts a long run of new partials at
  // one spot. Two things went wrong with that. Releases stopped at a fixed
  // density (half full), so a run needed one for nearly every insert, each
  // over the whole run so far - seconds for a few hundred children. And a
  // release that reached the end of the chain spread its window over all
  // the number space left, putting the tail at MAXINT at once.
  it("a list replaced whole, over and over, keeps its order numbers in order and its tail far from the top of the number space", function () {
    const { temporal, repeat, linkRepeater } = getWorld({ name: "partial-chain-order-replace" });
    const list = temporal({ keys: [] });
    const sink = temporal({ value: 0 });
    let trailer = null;
    const root = repeat(() => {
      for (const key of list.keys) {
        repeat(() => { for (let i = 0; i < 10; i++) repeat(() => { sink.value; }); });
      }
      if (trailer) linkRepeater(trailer); else trailer = repeat(() => {});
    });
    for (let round = 0; round < 8; round++) {
      list.keys = Array.from({ length: 100 }, (_, index) => round + ":" + index);
    }
    let count = 0;
    let previous = -1;
    for (let node = root.chainHead.first; node !== null; node = node.orderNext) {
      assert.ok(Number.isSafeInteger(node.orderNumber), "not a safe integer: " + node.orderNumber);
      assert.ok(node.orderNumber > previous, "out of order: " + previous + ", " + node.orderNumber);
      previous = node.orderNumber;
      count++;
    }
    assert.equal(count, root.chainHead.count);
    assert.ok(previous < Number.MAX_SAFE_INTEGER / 1000, "tail at " + previous);
  });
});

import { getWorld } from "../cascade.js";
import assert from "assert";

// Each root repeater owns its own pipeline (chainHead) - see "Repeater
// scheduling: pipelines, wavefronts, parking" in cascade.js. This checks
// that two entirely unrelated pipelines, invalidated in the very same
// synchronous batch, don't interfere with each other through the shared
// state.workQueue: one pipeline's own internal back-reference handling
// (flagging, parking, waiting for a wave boundary) must not stall,
// duplicate, or otherwise perturb a completely independent pipeline's
// ordinary invalidation, and both must be fully settled by the time the
// triggering write returns.
const { observable, repeat } = getWorld({ name: "multi-pipeline-isolation", timeLevels: 2 });

describe("multiple independent pipelines (each owns its own chainHead, scheduled through the same shared workQueue)", function () {

  it("one pipeline's internal revert-and-park doesn't affect an unrelated pipeline's ordinary invalidation", function () {
    // Pipeline 1 - the same A/B/C revert shape as flagged-repeaters.js,
    // to make sure it's actually exercising parking/flagging here too.
    const model1 = observable({ trigger: false });
    const shared1 = observable({ p: "original" });
    let cRunCount = 0;

    repeat(() => { // pipeline 1's root
      repeat(() => { // A
        if (model1.trigger) shared1.p = "changed";
      });
      repeat(() => { // B - reverts A's change in the same wave
        if (model1.trigger) shared1.p = "original";
      });
      repeat(() => { // C
        cRunCount++;
      });
    });

    // Pipeline 2 - entirely unrelated, plain observable, no relation to
    // pipeline 1's chainHead, model, or shared state at all.
    const model2 = observable({ value: 1 });
    let pipeline2RunCount = 0;
    let pipeline2SeenValue = null;
    repeat(() => {
      pipeline2RunCount++;
      pipeline2SeenValue = model2.value;
    });

    assert.equal(cRunCount, 1);
    assert.equal(pipeline2RunCount, 1);

    // Trigger both in the same synchronous stretch - pipeline 1 first,
    // to make sure its own parking (waiting for a wave boundary) doesn't
    // swallow or delay pipeline 2's own, completely unrelated settlement.
    model1.trigger = true;
    model2.value = 2;

    assert.equal(cRunCount, 1, "pipeline 1's C must still not have reran - B's revert resolves its flag as unchanged, regardless of pipeline 2's own activity");
    assert.equal(pipeline2RunCount, 2, "pipeline 2 must have settled normally, unaffected by pipeline 1's own internal parking");
    assert.equal(pipeline2SeenValue, 2);
  });

});

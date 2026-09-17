import { getWorld } from "../cascade.js";
import assert from "assert";

// flush() (see cascade.js's "Repeater scheduling" section, and
// checkWaveRetreat() specifically) gives the application control over wave
// direction: while state.flushing > 0, an invalidation/flagging that would
// normally park - waiting for the next wave to come back around - instead
// moves the wave itself backward, so it's picked up again within this same
// wave.
//
// Both tests below reach "backward" via an *array* mutation
// (invalidateArrayObservers), not a plain property write - deliberately.
// "Time as tree position" (see cascade.js's own design notes) means a plain
// property write's position is always either the writer's tree order
// (within one chain) or its declared time level (across chains, compared
// before tree order at all) - and migrateOvertakenObserversFor only ever
// migrates/flags an observer positioned *after* the new writing, never one
// positioned before it. So a later-positioned (or later-time-level) write
// to a plain property can never, by construction, reach an earlier reader
// - flush() only changes *scheduling*, not that invariant, and shouldn't:
// rewriting a write's own effective position would be a much bigger,
// separate change (see accessInitialValues() in access-initial-values.js,
// which does exactly that, deliberately, by writing as though genuinely
// external). Arrays still have no position gate at all today
// (invalidateArrayObservers notifies every registered observer
// unconditionally, regardless of where it sits) - which is what actually
// lets these two scenarios reach back, not a principled feature of its
// own; see docs/plan-array-timelines.md for why that's still open.
// Enumeration (key composition) used to have the same gap and has since
// been fixed to be position-aware too - see enumeration-timeline.js.
const { observable, repeat, flush } = getWorld({ name: "flush", timeLevels: 3 });

describe("flush() (retreat the wave instead of parking, while flushing)", function () {

  it("a later repeater's flush() reaches back into an earlier sibling within the same pipeline, reprocessed within the same wave", function () {
    const model = observable({ trigger: false });
    const portalSlots = observable([]);
    let slotRunCount = 0;
    let slotSeenLength = null;

    repeat(() => { // root - single pipeline, so "modal" and "portal" share one chainHead
      repeat(() => { // "modal" - structurally first, reads the portal slot array
        slotRunCount++;
        slotSeenLength = portalSlots.length;
      });
      repeat(() => { // "portal" - structurally later; flushes new content back
                     // into the slot the moment it's asked to
        if (model.trigger) {
          flush(() => { portalSlots.push("content"); });
        }
      });
    });

    assert.equal(slotRunCount, 1);
    assert.equal(slotSeenLength, 0);

    model.trigger = true;

    assert.equal(portalSlots.length, 1);
    assert.equal(slotRunCount, 2, "the earlier sibling must have rerun within the very same wave - without flush() this would stay parked for the next one");
    assert.equal(slotSeenLength, 1);
  });

  it("a later-level pipeline's flush() corrects an earlier-level one and sees the correction settle within the same synchronous write", function () {
    // selections is an array, not a plain scalar, specifically so the
    // corrective write below (from the later, time:1 selector) can reach
    // the earlier, time:0 model at all - see the module comment above.
    const model = observable({ selections: observable(["initial"]) });
    const view = observable({ shown: null });

    let modelRunCount = 0;
    repeat(() => { // "model" pipeline
      modelRunCount++;
      view.shown = model.selections.length === 0 ? null : model.selections[model.selections.length - 1];
    }, { time: 0 });

    let selectorRunCount = 0;
    const selectorSeenValues = [];
    repeat(() => { // "selector" pipeline - one level later
      selectorRunCount++;
      const seen = view.shown;
      selectorSeenValues.push(seen);
      if (seen === null) {
        // Discovered an invalid value - reach back to the model level and
        // correct it, rather than rendering the invalid state or waiting
        // for a separate, later fix-up pass.
        flush(() => { model.selections.push("corrected"); });
      }
    }, { time: 1 });

    assert.equal(modelRunCount, 1);
    assert.equal(selectorRunCount, 1);
    assert.deepEqual(selectorSeenValues, ["initial"]);

    model.selections.pop(); // an external event produces a momentarily invalid (empty) selection

    assert.equal(view.shown, "corrected");
    assert.deepEqual(model.selections, ["corrected"]);
    assert.deepEqual(
      selectorSeenValues,
      ["initial", null, "corrected"],
      "the selector must see its own flush()'d correction settle within this same synchronous write, not on some later, separate trigger"
    );
  });

});

import { getWorld } from "../cascade.js";
import assert from "assert";

// flush() (see cascade.js's "Repeater scheduling" section, and
// checkWaveRetreat() specifically) gives the application control over wave
// direction: while state.flushing > 0, an invalidation/flagging that would
// normally park - waiting for the next wave to come back around - instead
// moves the wave itself backward, so it's picked up again within this same
// wave.
//
// Both tests below reach "backward": a later writer corrects something an
// earlier reader already read. "Time as tree position" (see cascade.js's own
// design notes) means a write - to a property or to an array, which is
// temporal too (see "Temporal arrays") - is seen only by readers positioned
// after it: its writer's tree order within one chain, or its declared time
// level across chains. So the correction is written at initial time, with
// accessInitialValues() (see access-initial-values.js) - where the earlier
// reader reads from - and flush() is what makes the earlier reader rerun
// within this same wave rather than the next. The two are independent:
// accessInitialValues() changes *where* the write lands, flush() *when* what
// it invalidates is processed.
const { observable, repeat, flush, accessInitialValues } = getWorld({ name: "flush", timeLevels: 3 });

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
          accessInitialValues(() => flush(() => { portalSlots.push("content"); }));
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
        accessInitialValues(() => flush(() => { model.selections.push("corrected"); }));
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

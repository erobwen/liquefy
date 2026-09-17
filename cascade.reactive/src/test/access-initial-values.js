import { getWorld } from "../cascade.js";
import assert from "assert";

// accessInitialValues() (see cascade.js) makes a write behave as though it
// came from genuinely outside any repeater - currentTime()/currentReadTime()/
// currentWriter() all derive purely from state.context, so nulling it for
// the callback's duration reuses the exact same "write lands at the
// baseline (time 0, writer null)" behavior external code already gets for
// free (see currentTime()'s own comment) - no new invalidation path
// needed, since the write reuses the object's own construction writing and
// goes through the ordinary, already-eager invalidateWritingObservers.
//
// Unlike flush.js's own tests (which reach backward through an array, a
// dependency with no position awareness at all yet), these reach backward
// through a plain scalar property - the thing a plain property write can
// ordinarily never do (see flush.js's module comment on why). Composed
// with flush() where the correction also needs to settle within the same
// wave, rather than waiting for the next one.
const { observable, repeat, flush, accessInitialValues } = getWorld({ name: "access-initial-values", timeLevels: 3 });

describe("accessInitialValues() (write as though genuinely outside any repeater)", function () {

  it("a later sibling corrects an earlier one's already-read scalar state, within the same pipeline, in the same wave", function () {
    const modalState = observable({ openModalId: null });
    const trigger = observable({ open: false });
    let frameRunCount = 0;
    let frameSeenId = null;

    repeat(() => { // root - single pipeline, so "frame" and "opener" share one chainHead
      repeat(() => { // "frame" - structurally first, reads which modal is open
        frameRunCount++;
        frameSeenId = modalState.openModalId;
      });
      repeat(() => { // "opener" - structurally later; corrects the frame's
                      // already-read state the moment it's asked to
        if (trigger.open) {
          flush(() => {
            accessInitialValues(() => { modalState.openModalId = "settings"; });
          });
        }
      });
    });

    assert.equal(frameRunCount, 1);
    assert.equal(frameSeenId, null);

    trigger.open = true;

    assert.equal(frameRunCount, 2, "frame must rerun within the very same wave, seeing the corrected modal state");
    assert.equal(frameSeenId, "settings");
  });

  it("a later-level pipeline corrects an earlier-level model's plain property and sees it settle within the same synchronous write", function () {
    const model = observable({ selection: "initial" });
    const view = observable({ shown: null });

    let modelRunCount = 0;
    repeat(() => { // "model" pipeline
      modelRunCount++;
      view.shown = model.selection;
    }, { time: 0 });

    let selectorRunCount = 0;
    const selectorSeenValues = [];
    repeat(() => { // "selector" pipeline - one level later
      selectorRunCount++;
      const seen = view.shown;
      selectorSeenValues.push(seen);
      if (seen === null) {
        flush(() => {
          accessInitialValues(() => { model.selection = "corrected"; });
        });
      }
    }, { time: 1 });

    assert.equal(modelRunCount, 1);
    assert.deepEqual(selectorSeenValues, ["initial"]);

    model.selection = null; // an external event produces a momentarily invalid value

    assert.equal(view.shown, "corrected");
    assert.equal(model.selection, "corrected");
    assert.deepEqual(
      selectorSeenValues,
      ["initial", null, "corrected"],
      "the selector must see its own correction settle within this same synchronous write, not on some later, separate trigger"
    );
  });

});

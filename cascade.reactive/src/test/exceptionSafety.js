import { getWorld } from "../cascade.js";
import assert from "assert";

// What adjusts process-wide state for the duration of a callback puts it
// back even when the callback throws - and the scheduler goes on working
// after a repeater throws. Left wrong, either would silently break
// everything that runs afterwards, not just what threw.
describe("exception safety", function () {
  const world = getWorld({ name: "exceptionSafety" });
  const { observable, repeat, withoutRecording, flush, accessInitialValues, transaction, withoutReactions, state } = world;
  const boom = () => { throw new Error("boom"); };

  const snapshot = () => ({
    context: state.context,
    recordingPaused: state.recordingPaused,
    postponeInvalidation: state.postponeInvalidation,
    blockInvalidation: state.blockInvalidation,
    flushing: state.flushing,
    refreshingAllDirtyRepeaters: state.refreshingAllDirtyRepeaters,
  });

  it("withoutRecording, flush, accessInitialValues, transaction and withoutReactions put everything back when their callback throws", function () {
    const before = snapshot();
    for (const wrapper of [withoutRecording, flush, accessInitialValues, transaction, withoutReactions]) {
      assert.throws(() => wrapper(boom), /boom/);
      assert.deepEqual(snapshot(), before);
    }
  });

  it("the same inside a repeater: its context comes back", function () {
    const data = observable({ value: 1 });
    let contextAfter = null;
    let contextInside = null;
    repeat(() => {
      data.value;
      contextInside = state.context;
      try { accessInitialValues(boom); } catch (error) { /* expected */ }
      contextAfter = state.context;
    });
    assert.ok(contextInside !== null);
    assert.equal(contextAfter, contextInside);
  });

  it("a write inside withoutReactions postpones nothing: later writes still reach their readers", function () {
    const data = observable({ value: 1 });
    const seen = [];
    repeat(() => { seen.push(data.value); });
    withoutReactions(() => { data.value = 2; });
    data.value = 3;
    assert.deepEqual(seen, [1, 3]);
    assert.equal(state.postponeInvalidation, 0);
  });

  it("a repeater that throws when rerun: the error reaches the writer - and every other repeater goes on being refreshed", function () {
    const data = observable({ broken: false, other: 1 });
    const seen = [];
    repeat(() => { if (data.broken) boom(); });
    repeat(() => { seen.push(data.other); });
    assert.throws(() => { data.broken = true; }, /boom/);
    assert.equal(state.refreshingAllDirtyRepeaters, false);
    assert.equal(state.context, null);
    data.other = 2;
    assert.deepEqual(seen, [1, 2], "still refreshed");
  });
});

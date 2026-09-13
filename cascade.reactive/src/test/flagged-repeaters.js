import { getWorld } from "../cascade.js";
import assert from "assert";

// migrateOvertakenObserversFor() (see cascade.js) finds a reader whose
// dependency has been overtaken by a closer writing, but a repeater-tree
// reader (as opposed to an invalidator - see that function's own comment)
// with a genuinely different value is deliberately not invalidated on the
// spot: it's flagged instead (flagRepeaterEntry), left exactly where it
// was, and only actually re-examined later - either opportunistically,
// when linkRepeater happens to reach it, or as exitTimeLevel's own
// backstop sweep (resolveFlaggedRepeatersAtLevel), right before a time
// level would otherwise be declared settled.
//
// This is the concrete A/B/C shape from the design discussion that
// motivated it: A changes something, B (running right after A, in the
// same wave) undoes it before C - whose own dependency was on something
// even earlier than either of them - is ever actually reached. Without
// deferring the decision, C would be invalidated the instant A's change
// was discovered, even though B was always going to cancel it out first -
// "invalidation traveling faster than the computation front". Both tests
// share the same shape; only whether B's revert exists differs.
const { observable, repeat } = getWorld({ name: "flagged-repeaters", timeLevels: 2 });

describe("flagged repeaters (deferred recheck instead of an immediate invalidation)", function () {

  it("a later, closer write that gets reverted before the reader is reached never causes that reader to rerun", function () {
    const model = observable({ trigger: false });
    const shared = observable({ p: "original" });
    let cRunCount = 0;
    let cSeenValue = null;

    repeat(() => { // root - just so A/B/C share one chain and a fixed structural order
      repeat(() => { // A - structurally first
        if (model.trigger) shared.p = "changedByA";
      });
      repeat(() => { // B - structurally second, right after A; also depends on
                     // model.trigger (even though it only *acts* on it the same
                     // way A does) so it reruns in the very same wave as A, not
                     // some later one - the revert has to land before C is ever
                     // examined for this to prove anything.
        if (model.trigger) shared.p = "original";
      });
      repeat(() => { // C - structurally last; its own dependency, established
                     // on the very first pass, resolves to the timeline's
                     // baseline anchor, since neither A nor B wrote anything yet
        cRunCount++;
        cSeenValue = shared.p;
      });
    });

    assert.equal(cRunCount, 1);
    assert.equal(cSeenValue, "original");

    model.trigger = true; // invalidates both A and B, in that structural order, in one wave

    assert.equal(cSeenValue, "original", "shared.p settles back to what it always was");
    assert.equal(cRunCount, 1, "C must not have reran at all - B's revert should resolve C's flagged dependency as unchanged before C is ever invalidated");
  });

  it("a genuine, lasting change (nothing reverts it) still reaches a flagged reader", function () {
    const model = observable({ trigger: false });
    const shared = observable({ p: "original" });
    let cRunCount = 0;
    let cSeenValue = null;

    repeat(() => {
      repeat(() => { // A only - nothing undoes its change this time
        if (model.trigger) shared.p = "changedByA";
      });
      repeat(() => {
        cRunCount++;
        cSeenValue = shared.p;
      });
    });

    assert.equal(cRunCount, 1);
    assert.equal(cSeenValue, "original");

    model.trigger = true;

    assert.equal(cRunCount, 2, "C's flagged dependency must still be resolved - here by exitTimeLevel's own backstop sweep, since nothing ever calls linkRepeater on C in this test - and found genuinely different");
    assert.equal(cSeenValue, "changedByA");
  });

});

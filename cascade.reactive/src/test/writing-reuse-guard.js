import { getWorld } from "../cascade.js";
import assert from "assert";

// setHandlerObject's staleQueue branch (see cascade.js) lets a repeater
// reuse its own prior writing object across reruns - same identity,
// mutated in place via nextValue/finalizeTouchedStaleWritings - so a
// rerun whose own value doesn't actually change can be recognized and
// skipped, instead of always treating a fresh rerun as "something new,
// always notify". But mutating a writing in place means deciding,
// immediately and unconditionally, whether to notify its *current*
// observers if the value differs - exactly the eager treatment a
// tree-ordered (partial-type) observer must never get (see
// migrateOvertakenObserversFor's own reasoning for why). So a stale
// writing that still has live observers is never reused: it's retired
// outright (retireWritingOnto) and a fresh writing takes its place,
// letting its former observers go through the same flag-or-silently-
// repoint decision as any other overtaken dependency.
//
// This is the same A/B/C shape as flagged-repeaters.js, but where that
// file exercised migrateOvertakenObserversFor (a *fresh* writing
// overtaking a farther one), this one exercises the reuse guard
// specifically: here, the reader depends *directly* on the very writing
// that gets reused across reruns, not on some unrelated farther one.
const { observable, repeat } = getWorld({ name: "writing-reuse-guard", timeLevels: 2 });

describe("writing reuse guard (a reused writing with live observers is retired, not mutated in place)", function () {

  it("a direct dependent of a reused writing is not invalidated if the change gets reverted before it's reached", function () {
    const model = observable({ trigger: false });
    const shared = observable({ p: "original" });
    let cRunCount = 0;
    let cSeenValue = null;

    repeat(() => { // root
      repeat(() => { // P - writes shared.p on every run (its writing gets reused across reruns, not freshly inserted each time)
        shared.p = model.trigger ? "changed" : "original";
      });
      repeat(() => { // Q - structurally right after P; reverts P's change in the very same wave, before C is ever reached
        if (model.trigger) shared.p = "original";
      });
      repeat(() => { // C - reads shared.p once, on the very first pass, when it resolves directly to P's own writing (Q hasn't written anything yet)
        cRunCount++;
        cSeenValue = shared.p;
      });
    });

    assert.equal(cRunCount, 1);
    assert.equal(cSeenValue, "original");

    model.trigger = true; // invalidates both P and Q, in that structural order, in one wave

    assert.equal(cSeenValue, "original", "shared.p settles back to what it always was");
    assert.equal(cRunCount, 1, "C must not have reran - P's reused writing has a live observer (C), so it gets retired and C flagged rather than eagerly invalidated; Q's revert then resolves that flag as unchanged");
  });

  it("a genuine, lasting change to a reused writing still reaches its direct dependent", function () {
    const model = observable({ trigger: false });
    const shared = observable({ p: "original" });
    let cRunCount = 0;
    let cSeenValue = null;

    repeat(() => {
      repeat(() => { // P only - nothing undoes its change this time
        shared.p = model.trigger ? "changed" : "original";
      });
      repeat(() => {
        cRunCount++;
        cSeenValue = shared.p;
      });
    });

    assert.equal(cRunCount, 1);
    assert.equal(cSeenValue, "original");

    model.trigger = true;

    assert.equal(cRunCount, 2, "C's flagged dependency must still be resolved - by exitTimeLevel's own backstop sweep, since nothing ever calls linkRepeater on C in this test - and found genuinely different");
    assert.equal(cSeenValue, "changed");
  });

});

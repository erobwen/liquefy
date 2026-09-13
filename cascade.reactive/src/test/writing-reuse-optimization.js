import { getWorld } from "../cascade.js";
import assert from "assert";

// staleWritingNeedsRetirement() (see cascade.js) only forces a stale
// writing into retirement (a fresh object taking its place - see
// retireWritingOnto) when it currently has an observer that actually
// needs the deferred, wavefront-aware treatment - a same-chain,
// tree-ordered partial. A writing with no observers at all, or only
// eager-eligible ones (an invalidator, or same-time legacy code from an
// entirely different chain), is reused in place exactly as it always
// was: cheaper (no extra object, no retire/settle pass), and just as
// correct, since finalizeTouchedStaleWritings' own eager notify-if-
// different is the right treatment for those observers regardless.
//
// getOrCreateTimelineWriting is the "advanced... typically used by
// plugins" escape hatch (see its own doc comment in cascade.js) - used
// here only to observe object identity directly, which the ordinary
// observable() API has no reason to expose.
const { observable, repeat, invalidateOnChange, getOrCreateTimelineWriting } =
  getWorld({ name: "writing-reuse-optimization", timeLevels: 2 });

function currentWriting(obj, key) {
  // time === Infinity is how external code always reads (see
  // currentReadTime()) - "whatever's actually the latest writing", not
  // the baseline (time 0, writer null) anchor a real writer's own writing
  // sorts *after*, not through.
  return getOrCreateTimelineWriting(obj.causality.handler, key, Infinity, null);
}

describe("writing reuse optimization (only retire when an observer actually needs it)", function () {

  it("a writing with no observers at all is reused in place across reruns", function () {
    const model = observable({ trigger: false });
    const shared = observable({ p: "a" });

    repeat(() => {
      shared.p = model.trigger ? "b" : "a";
    });

    const first = currentWriting(shared, "p");
    model.trigger = true;
    const second = currentWriting(shared, "p");

    assert.strictEqual(second, first, "no observer at all needs deferred treatment, so the writing object itself should be reused, not replaced");
  });

  it("a writing whose only observer is an invalidator (eager-eligible, not tree-ordered) is still reused in place", function () {
    const model = observable({ trigger: false });
    const shared = observable({ p: "a" });
    let invalidatedCount = 0;

    repeat(() => {
      shared.p = model.trigger ? "b" : "a";
    });

    invalidateOnChange(() => shared.p, () => { invalidatedCount++; });

    const first = currentWriting(shared, "p");
    model.trigger = true;
    const second = currentWriting(shared, "p");

    assert.strictEqual(second, first, "an invalidator observer is eager-eligible - it needs no deferred treatment, so reuse is still safe");
    assert.equal(invalidatedCount, 1, "the invalidator must still fire eagerly, exactly as before");
  });

  it("a writing with a same-chain tree observer is retired (a fresh object takes its place), not reused", function () {
    const model = observable({ trigger: false });
    const shared = observable({ p: "a" });
    let cSeenValue = null;

    repeat(() => { // root
      repeat(() => { // P
        shared.p = model.trigger ? "b" : "a";
      });
      repeat(() => { // C - a genuine tree-ordered dependent
        cSeenValue = shared.p;
      });
    });

    const first = currentWriting(shared, "p");
    model.trigger = true;
    const second = currentWriting(shared, "p");

    assert.notStrictEqual(second, first, "C's dependency needs deferred treatment, so this writing must be retired rather than mutated in place");
    assert.equal(cSeenValue, "b");
  });

});

import { getWorld } from "../cascade.js";
import assert from "assert";

// A disposed invalidator is gone for good: a record() made on it later - a
// late async continuation, say - runs its action, but subscribes nothing.
const { observable, invalidateOnChange } = getWorld({ name: "invalidator-dispose" });

describe("invalidator dispose", function () {
  it("a record() after dispose() doesn't subscribe the invalidator again", function () {
    const o = observable({ a: 1 });
    let fired = 0;
    const invalidator = invalidateOnChange(() => o.a, () => { fired++; });
    invalidator.dispose();
    assert.equal(invalidator.isRemoved, true);
    assert.equal(invalidator.record(() => o.a), 1, "the action still runs, and its result is returned");
    o.a = 2;
    assert.equal(fired, 0);
  });

  it("a record() after it fired doesn't subscribe it again either - it's one shot", function () {
    const o = observable({ a: 1, b: 1 });
    let fired = 0;
    const invalidator = invalidateOnChange(() => o.a, () => { fired++; });
    o.a = 2;
    assert.equal(fired, 1);
    invalidator.record(() => o.b);
    o.b = 2;
    assert.equal(fired, 1);
  });

  it("a record() before dispose() adds to what it waits for", function () {
    const o = observable({ a: 1, b: 1 });
    let fired = 0;
    const invalidator = invalidateOnChange(() => o.a, () => { fired++; });
    invalidator.record(() => o.b);
    o.b = 2;
    assert.equal(fired, 1);
  });
});

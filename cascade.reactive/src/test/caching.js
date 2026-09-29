import { getWorld } from "../cascade.js";
import assert from "assert";

// caching(f): f's results kept per argument list until what they were
// computed from changes - then just cleared, recomputed only if asked for
// again (Flow's cache - see lib/caching.js).
describe("caching()", function () {
  const { observable, repeat, caching } = getWorld({ name: "caching" });

  it("computes once per argument list, clears on a change, and computes again only when asked", function () {
    const data = observable({ factor: 2 });
    let computations = 0;
    const times = caching((value) => { computations++; return value * data.factor; });

    assert.equal(times(3), 6);
    assert.equal(times(3), 6);
    assert.equal(times(4), 8);
    assert.equal(computations, 2, "once per argument list");

    data.factor = 10;
    assert.equal(computations, 2, "a change only clears - nothing is computed until someone asks");
    assert.equal(times(3), 30);
    assert.equal(computations, 3);
  });

  it("whoever read a cached value follows it", function () {
    const data = observable({ factor: 2 });
    const times = caching((value) => value * data.factor);
    const seen = [];
    repeat(() => { seen.push(times(5)); });
    data.factor = 3;
    assert.deepEqual(seen, [10, 15]);
  });

  it("tells observables apart by identity, caches undefined, and takes null arguments", function () {
    const a = observable({ name: "a" });
    const b = observable({ name: "b" });
    let computations = 0;
    const nameOf = caching((object) => { computations++; return object ? object.name : undefined; });
    assert.equal(nameOf(a), "a");
    assert.equal(nameOf(b), "b");
    assert.equal(nameOf(null), undefined);
    assert.equal(nameOf(null), undefined);
    assert.equal(computations, 3, "null's undefined result is cached too");
  });

  it("an invalidated entry leaves nothing behind watching", function () {
    const data = observable({ factor: 2 });
    let computations = 0;
    const times = caching((value) => { computations++; return value * data.factor; });
    times(1);
    data.factor = 3;
    data.factor = 4;
    data.factor = 5;
    assert.equal(computations, 1, "cleared once - after that, nothing depends on factor any more");
  });
});

import { getWorld } from "../cascade.js";
import assert from "assert";

// Smaller corners of the object and array handlers, and of the world's
// configuration - each once wrong.
describe("edge cases", function () {
  const { observable, repeat, transaction } = getWorld({ name: "edge-cases", timeLevels: 2 });

  it("a time outside the world's time levels is refused, with a clear error", function () {
    assert.throws(() => repeat(() => {}, { time: 2 }), /time 2 is outside this world's time levels, 0 to 1/);
    assert.throws(() => repeat(() => {}, { time: -1 }), /outside/);
  });

  it("a transaction that throws still lets what it wrote reach its readers", function () {
    const model = observable({ a: 1 });
    const seen = [];
    repeat(() => seen.push(model.a));
    assert.throws(() => transaction(() => { model.a = 2; throw new Error("boom"); }), /boom/);
    assert.deepEqual(seen, [1, 2]);
  });

  it("symbol keys are read, written and followed like any other", function () {
    const key = Symbol("key");
    const model = observable({});
    model[key] = 1;
    assert.equal(model[key], 1);
    const seen = [];
    repeat(() => seen.push(model[key]));
    model[key] = 2;
    assert.deepEqual(seen, [1, 2]);
  });

  it("a class's own Symbol.iterator works through the proxy", function () {
    class Pair {
      constructor() { this.items = [1, 2]; }
      *[Symbol.iterator]() { yield* this.items; }
    }
    assert.deepEqual([...observable(new Pair())], [1, 2]);
  });

  it("a data property named toString is followed too", function () {
    const model = observable({ toString: "a" });
    const seen = [];
    repeat(() => seen.push(model.toString));
    model.toString = "b";
    assert.deepEqual(seen, ["a", "b"]);
  });

  it("defineProperty with a value is a write, seen by reads and readers", function () {
    const model = observable({ a: 1 });
    const seen = [];
    repeat(() => seen.push(model.a));
    Object.defineProperty(model, "a", { value: 5, writable: true, enumerable: true, configurable: true });
    assert.equal(model.a, 5);
    assert.deepEqual(seen, [1, 5]);

    const array = observable([1]);
    Object.defineProperty(array, "extra", { value: 3, writable: true, configurable: true });
    assert.equal(array.extra, 3);
  });

  it("copyWithin takes negative indices as the native one does, and returns the array", function () {
    for (const parameters of [[-2, 0], [0, 3, -1], [1], [0, -2], [-1, -3, -2]]) {
      const expected = [1, 2, 3, 4, 5].copyWithin(...parameters);
      const array = observable([1, 2, 3, 4, 5]);
      assert.equal(array.copyWithin(...parameters), array);
      assert.deepEqual([...array], expected, "copyWithin(" + parameters.join(", ") + ")");
    }
  });

  it("unnamed configurations differing only in a callback are two worlds", function () {
    const shared = () => {};
    assert.notEqual(getWorld({ onEventGlobal: () => 1 }), getWorld({ onEventGlobal: () => 2 }));
    assert.equal(getWorld({ onEventGlobal: shared }), getWorld({ onEventGlobal: shared }));
  });
});

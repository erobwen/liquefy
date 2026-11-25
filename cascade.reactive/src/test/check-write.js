import { getWorld } from "../cascade.js";
import assert from "assert";

const { observable, innerMeta, repeat, transaction } = getWorld({ name: "check-write test" });

function refuseStrings(object) {
  const seen = [];
  innerMeta(object).checkWrite = (key, value) => {
    seen.push([key, value]);
    if (typeof(value) === "string") throw new Error("No strings: " + String(key));
  };
  return seen;
}

describe("innerMeta(object).checkWrite", function () {

  it("is asked before a property is set, and can refuse it by throwing", function () {
    const object = observable({ a: 1 });
    const seen = refuseStrings(object);
    object.a = 2;
    assert.throws(() => { object.b = "x"; }, /No strings: b/);
    assert.deepEqual(seen, [["a", 2], ["b", "x"]]);
    assert.equal(object.a, 2);
    assert.equal(object.b, undefined);
    assert.deepEqual(Object.keys(object), ["a"]);
  });

  it("refuses before anything is observed: no event, no repeater run", function () {
    const object = observable({ a: 1 });
    refuseStrings(object);
    let runs = 0;
    repeat(() => { object.a; runs++; });
    assert.throws(() => { object.a = "x"; });
    assert.equal(runs, 1);
    assert.equal(object.a, 1);
  });

  it("is asked for defineProperty, with the value or the accessor", function () {
    const object = observable({});
    const seen = refuseStrings(object);
    Object.defineProperty(object, "n", { value: 5, writable: true, enumerable: true, configurable: true });
    const getter = () => 1;
    Object.defineProperty(object, "g", { get: getter, configurable: true });
    assert.deepEqual(seen, [["n", 5], ["g", getter]]);
  });

  it("is asked for every element an array method adds, with an undefined key", function () {
    const array = observable([1]);
    const seen = refuseStrings(array);
    array.push(2, 3);
    array.unshift(0);
    array.splice(1, 1, 7);
    array.fill(9, 0, 1);
    array[1] = 8;
    assert.deepEqual(seen, [[undefined, 2], [undefined, 3], [undefined, 0], [undefined, 7], [undefined, 9], ["1", 8]]);
    assert.throws(() => array.push(4, "x"), /No strings/);
    assert.throws(() => array.splice(0, 0, "x"), /No strings/);
    assert.throws(() => array.fill("x"), /No strings/);
    assert.deepEqual([...array], [9, 8, 2, 3]);
  });

  it("does not ask about methods that only move elements", function () {
    const array = observable([3, 1, 2]);
    const seen = refuseStrings(array);
    array.sort();
    array.reverse();
    array.pop();
    array.shift();
    assert.deepEqual(seen, []);
  });

  it("refuses inside a transaction without leaving earlier writes undone", function () {
    const object = observable({ a: 1, b: 1 });
    refuseStrings(object);
    assert.throws(() => transaction(() => { object.a = 2; object.b = "x"; }));
    assert.equal(object.a, 2);
    assert.equal(object.b, 1);
  });

});

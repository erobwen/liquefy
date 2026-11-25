import { getWorld } from "../cascade.js";
import assert from "assert";

const { observable, innerMeta, repeat, transaction } = getWorld({ name: "check-write test" });

function refuseStrings(object) {
  const seen = [];
  innerMeta(object).checkWrite = (key, value, operation) => {
    seen.push(operation === "set" ? [key, value] : [key, value, operation]);
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

  it("is asked once per array method, then for every element it adds, with an undefined key", function () {
    const array = observable([1]);
    const seen = refuseStrings(array);
    array.push(2, 3);
    array.unshift(0);
    array.splice(1, 1, 7);
    array.fill(9, 0, 1);
    array[1] = 8;
    assert.deepEqual(seen, [
      [undefined, undefined, "push"], [undefined, 2, "add"], [undefined, 3, "add"],
      [undefined, undefined, "unshift"], [undefined, 0, "add"],
      [undefined, undefined, "splice"], [undefined, 7, "add"],
      [undefined, undefined, "fill"], [undefined, 9, "add"],
      ["1", 8]]);
    assert.throws(() => array.push(4, "x"), /No strings/);
    assert.throws(() => array.splice(0, 0, "x"), /No strings/);
    assert.throws(() => array.fill("x"), /No strings/);
    assert.deepEqual([...array], [9, 8, 2, 3]);
  });

  it("is asked about methods that only remove or move elements, by name", function () {
    const array = observable([3, 1, 2, 4]);
    const seen = refuseStrings(array);
    array.sort();
    array.reverse();
    array.copyWithin(0, 1);
    array.pop();
    array.shift();
    assert.deepEqual(seen.map((call) => call[2]), ["sort", "reverse", "copyWithin", "pop", "shift"]);
  });

  it("is asked about deletes, with an undefined value, and can refuse them", function () {
    const object = observable({ a: 1, kept: 2 });
    const array = observable([1, 2]);
    const seen = [];
    innerMeta(object).checkWrite = (key, value, operation) => {
      seen.push([key, value, operation]);
      if (key === "kept") throw new Error("Kept.");
    };
    innerMeta(array).checkWrite = (key, value, operation) => seen.push([key, value, operation]);
    delete object.a;
    assert.throws(() => { delete object.kept; }, /Kept/);
    assert.equal(object.kept, 2);
    delete array[1];
    assert.deepEqual(seen, [["a", undefined, "delete"], ["kept", undefined, "delete"], ["1", undefined, "delete"]]);
  });

  it("refuses inside a transaction without leaving earlier writes undone", function () {
    const object = observable({ a: 1, b: 1 });
    refuseStrings(object);
    assert.throws(() => transaction(() => { object.a = 2; object.b = "x"; }));
    assert.equal(object.a, 2);
    assert.equal(object.b, 1);
  });

});

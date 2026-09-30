import { getWorld } from "../cascade.js";
import assert from "assert";

// A delete from inside a repeater is a writing of its own, at the
// repeater's position - just like a set: seen by what comes after it, not
// by what comes before, and undone when the repeater reruns without
// deleting, or is retracted.
const { observable, repeat } = getWorld({ name: "delete-in-repeater", timeLevels: 3 });

describe("delete inside a repeater", function () {
  it("what comes before still sees the value; what comes after sees it gone", function () {
    const model = observable({ w: 5 });
    let before, after;
    repeat(() => {
      repeat(() => { before = model.w; });
      repeat(() => { delete model.w; });
      repeat(() => { after = model.w; });
    });
    assert.equal(before, 5);
    assert.equal(after, undefined);
    assert.equal(model.w, undefined, "outside any repeater: the latest - as for a set");
  });

  it("across times: time 0 deletes, time 1 sees it gone - and a rerun without the delete brings it back", function () {
    const model = observable({ w: 5 });
    const control = observable({ remove: true });
    const seen = [];
    repeat(() => { if (control.remove) delete model.w; }, { time: 0 });
    repeat(() => { seen.push("w" in model ? model.w : "gone"); }, { time: 1 });
    assert.deepEqual(seen, ["gone"]);

    control.remove = false;
    assert.deepEqual(seen, ["gone", 5]);

    control.remove = true;
    assert.deepEqual(seen, ["gone", 5, "gone"]);
  });

  it("the baseline changing reaches past the delete only where it isn't deleted", function () {
    const model = observable({ w: 5 });
    const seen = [];
    repeat(() => { seen.push("before " + model.w); }, { time: 0 });
    repeat(() => { delete model.w; }, { time: 1 });
    repeat(() => { seen.push("after " + model.w); }, { time: 2 });
    assert.deepEqual(seen, ["before 5", "after undefined"]);

    model.w = 6;
    assert.deepEqual(seen, ["before 5", "after undefined", "before 6"], "only the reader before the delete reruns");
  });

  it("Object.keys after the delete doesn't have the key; before it, it does", function () {
    const model = observable({ a: 1, b: 2 });
    let keysBefore, keysAfter;
    repeat(() => { keysBefore = Object.keys(model); }, { time: 0 });
    repeat(() => { delete model.a; }, { time: 1 });
    repeat(() => { keysAfter = Object.keys(model); }, { time: 2 });
    assert.deepEqual(keysBefore, ["a", "b"]);
    assert.deepEqual(keysAfter, ["b"]);
  });
});

describe("a key added from inside a repeater", function () {
  it("is gone for what enumerates after it once a rerun no longer adds it", function () {
    const model = observable({});
    const control = observable({ add: true });
    const seen = [];
    repeat(() => { if (control.add) model.x = 1; }, { time: 0 });
    repeat(() => { seen.push(("x" in model) + " " + Object.keys(model).join()); }, { time: 1 });
    control.add = false;
    assert.deepEqual(seen, ["true x", "false "]);
  });
});

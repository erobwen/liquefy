import { getWorld } from "../cascade.js";
import assert from "assert";

// observable() creates a timeless object: one value per property, whoever
// writes it and whenever. temporal() creates a temporal signal: a write
// from inside a repeater is a writing at that repeater's position (what
// every other test here is about).
const { observable, temporal, isObservable, isTemporal, repeat, retractRepeater } =
  getWorld({ name: "timeless", timeLevels: 3 });

describe("timeless objects", function () {
  it("observable() is timeless, temporal() is not - both are observable", function () {
    assert.equal(isTemporal(observable({})), false);
    assert.equal(isTemporal(temporal({})), true);
    assert.equal(isObservable(observable({})), true);
    assert.equal(isObservable(temporal({})), true);
    assert.equal(isTemporal({}), false);
  });

  it("a write from a later time reaches a reader at an earlier one - a temporal object's doesn't", function () {
    const timeless = observable({ w: 5 });
    const signal = temporal({ w: 5 });
    const seen = [];
    repeat(() => { seen.push("timeless " + timeless.w); }, { time: 0 });
    repeat(() => { seen.push("signal " + signal.w); }, { time: 0 });
    repeat(() => { timeless.w = 6; signal.w = 6; }, { time: 1 });
    assert.deepEqual(seen, ["timeless 5", "signal 5", "timeless 6"]);
    assert.equal(timeless.w, 6);
    assert.equal(signal.w, 6);
  });

  it("a write from a repeater stays when the repeater is retracted - a temporal object's goes with it", function () {
    const timeless = observable({ w: 5 });
    const signal = temporal({ w: 5 });
    const writer = repeat(() => { timeless.w = 6; signal.w = 6; });
    assert.equal(timeless.w, 6);
    assert.equal(signal.w, 6);
    retractRepeater(writer);
    assert.equal(timeless.w, 6);
    assert.equal(signal.w, 5);
  });

  it("a write from a repeater stays when it reruns without writing", function () {
    const model = observable({ w: 5 });
    const control = observable({ write: true });
    const seen = [];
    repeat(() => { if (control.write) model.w = 6; });
    repeat(() => { seen.push(model.w); });
    control.write = false;
    assert.deepEqual(seen, [6]);
    assert.equal(model.w, 6);
  });

  it("never has more than its baseline writing", function () {
    const model = observable({ w: 5 });
    repeat(() => model.w, { time: 0 });
    repeat(() => { model.w = 6; }, { time: 1 });
    repeat(() => { model.w = 7; model.v = 1; }, { time: 2 });
    const timelines = model.causality.handler.timelines;
    assert.deepEqual(Object.keys(timelines), ["w"], "v was never read by a repeater: still on the target");
    assert.equal(timelines.w.first, timelines.w.last);
    assert.equal(model.w, 7);
    assert.equal(model.v, 1);
  });

  it("writers and readers in any order settle on the last write", function () {
    const source = observable({ value: 1 });
    const derived = observable({ double: 0, quadruple: 0 });
    const seen = [];
    // Declared against the flow of data: each reads what the next one writes.
    repeat(() => { seen.push(derived.quadruple); });
    repeat(() => { derived.quadruple = derived.double * 2; });
    repeat(() => { derived.double = source.value * 2; });
    assert.equal(seen[seen.length - 1], 4);
    source.value = 2;
    assert.equal(seen[seen.length - 1], 8);
  });

  it("a repeater writing what it read reruns until it writes the same again", function () {
    const model = observable({ value: 3 });
    let runs = 0;
    repeat(() => {
      runs++;
      if (model.value < 10) model.value = 10;
    });
    assert.equal(model.value, 10);
    assert.equal(runs, 2);
  });

  it("a delete from a repeater is a delete for everyone", function () {
    const model = observable({ a: 1, w: 5 });
    const seen = [];
    repeat(() => { seen.push(Object.keys(model).join()); }, { time: 0 });
    const deleter = repeat(() => { delete model.w; }, { time: 1 });
    assert.deepEqual(seen, ["a,w", "a"]);
    retractRepeater(deleter);
    assert.equal("w" in model, false);
  });

  it("an array is timeless too: what a repeater pushes is there for every reader, and stays", function () {
    const list = observable([1]);
    const seen = [];
    repeat(() => { seen.push(list.join()); }, { time: 0 });
    const pusher = repeat(() => { list.push(2); }, { time: 1 });
    assert.deepEqual(seen, ["1", "1,2"]);
    retractRepeater(pusher);
    assert.deepEqual([...list], [1, 2]);
  });

  it("an object rebuilt with the same build id stays what it was", function () {
    let built;
    const control = observable({ value: 1 });
    repeat(() => {
      built = [observable({ value: control.value }, "model"), temporal({ value: control.value }, "signal")];
    });
    const [model, signal] = built;
    control.value = 2;
    assert.equal(built[0], model);
    assert.equal(built[1], signal);
    assert.equal(model.value, 2);
    assert.equal(signal.value, 2);
    assert.equal(isTemporal(model), false);
    assert.equal(isTemporal(signal), true);
  });
});

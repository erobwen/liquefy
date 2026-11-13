import { getWorld } from "../cascade.js";
import assert from "assert";

// An object's data stays on its target, as plain properties, until a
// property needs a timeline: when a repeater first reads it, or when it is
// first written anywhere but the baseline. Nothing an application sees
// depends on which of the two a property currently is.
const { observable, repeat, withoutRecording } = getWorld({ name: "lazy-timelines", timeLevels: 3 });

const timelineKeys = (object) => Object.keys(object.causality.handler.timelines);

describe("lazy timelines", function () {
  it("creating, reading and writing from outside any repeater creates no timeline", function () {
    const model = observable({ a: 1, b: "two" });
    assert.equal(model.a, 1);
    model.a = 2;
    model.c = 3;
    delete model.b;
    assert.deepEqual(timelineKeys(model), []);
    assert.equal(model.a, 2);
    assert.equal(model.c, 3);
    assert.equal(model.b, undefined);
    assert.deepEqual(Object.keys(model), ["a", "c"]);
  });

  it("an unrecorded read from inside a repeater creates no timeline", function () {
    const model = observable({ a: 1 });
    let seen;
    repeat(() => { seen = withoutRecording(() => model.a); });
    assert.equal(seen, 1);
    assert.deepEqual(timelineKeys(model), []);
  });

  it("only the property a repeater reads gets a timeline - and reacts as ever", function () {
    const model = observable({ a: 1, b: 2, c: 3 });
    const seen = [];
    repeat(() => { seen.push(model.b); });
    assert.deepEqual(timelineKeys(model), ["b"]);

    model.b = 20;
    model.a = 10;
    assert.deepEqual(seen, [2, 20]);
    assert.deepEqual(timelineKeys(model), ["b"]);
    assert.equal(model.a, 10);
    assert.equal(model.b, 20);
  });

  it("a write before the first read is what that read sees", function () {
    const model = observable({ a: 1 });
    model.a = 2;
    const seen = [];
    repeat(() => { seen.push(model.a); });
    model.a = 3;
    assert.deepEqual(seen, [2, 3]);
  });

  it("the order of the keys doesn't depend on which were read by a repeater", function () {
    const model = observable({ a: 1, b: 2, c: 3, d: 4 });
    repeat(() => model.c);
    repeat(() => model.a);
    model.e = 5;
    assert.deepEqual(Object.keys(model), ["a", "b", "c", "d", "e"]);
    assert.deepEqual(JSON.stringify(model), '{"a":1,"b":2,"c":3,"d":4,"e":5}');
    assert.deepEqual({ ...model }, { a: 1, b: 2, c: 3, d: 4, e: 5 });
  });

  it("a write from a repeater to an unread property is seen after it, not before", function () {
    const model = observable({ w: 5 });
    let before, after;
    repeat(() => {
      repeat(() => { before = withoutRecording(() => model.w); });
      repeat(() => { model.w = 6; });
      repeat(() => { after = model.w; });
    });
    assert.equal(before, 5);
    assert.equal(after, 6);
    assert.equal(model.w, 6);
  });

  it("a write at a later time leaves the baseline for those before it - and is retracted with its repeater", function () {
    const model = observable({ w: 5 });
    const control = observable({ write: true });
    const seen = [];
    repeat(() => { seen.push("early " + model.w); }, { time: 0 });
    repeat(() => { if (control.write) model.w = 6; }, { time: 1 });
    repeat(() => { seen.push("late " + model.w); }, { time: 2 });
    assert.deepEqual(seen, ["early 5", "late 6"]);

    control.write = false;
    assert.deepEqual(seen, ["early 5", "late 6", "late 5"]);
    assert.equal(model.w, 5);
  });

  it("a delete from a repeater of an unread property is seen after it - and is undone with it", function () {
    const model = observable({ a: 1, w: 5 });
    const control = observable({ remove: true });
    const seen = [];
    repeat(() => { if (control.remove) delete model.w; }, { time: 0 });
    repeat(() => { seen.push(Object.keys(model).join()); }, { time: 1 });
    assert.deepEqual(seen, ["a"]);
    assert.equal("w" in model, false);
    assert.equal(Object.getOwnPropertyDescriptor(model, "w"), undefined);
    assert.equal(model.w, undefined);

    control.remove = false;
    assert.deepEqual(seen, ["a", "a,w"]);
    assert.equal(model.w, 5);
  });

  it("a deleted property that was read by a repeater is gone, whatever is asked", function () {
    const model = observable({ a: 1, b: 2 });
    const seen = [];
    repeat(() => { seen.push(model.a); });
    delete model.a;
    assert.deepEqual(seen, [1, undefined]);
    assert.equal(model.a, undefined);
    assert.equal("a" in model, false);
    assert.equal(Object.getOwnPropertyDescriptor(model, "a"), undefined);
    assert.deepEqual(Object.keys(model), ["b"]);
    delete model.a;

    model.a = 3;
    assert.deepEqual(seen, [1, undefined, 3]);
    assert.deepEqual(Object.getOwnPropertyDescriptor(model, "a"),
      { value: 3, writable: true, enumerable: true, configurable: true });
  });

  it("a new key written from outside reruns whoever enumerated the keys", function () {
    const model = observable({ a: 1 });
    const seen = [];
    repeat(() => { seen.push(Object.keys(model).join()); });
    model.b = 2;
    model.b = 3;
    delete model.a;
    assert.deepEqual(seen, ["a", "a,b", "b"]);
    assert.deepEqual(timelineKeys(model), []);
  });

  it("a deleted, read property falls back to what the object inherits", function () {
    class Thing {
      constructor() { this.size = 1; }
    }
    Thing.prototype.size = "inherited";
    const thing = observable(new Thing());
    repeat(() => thing.size);
    delete thing.size;
    assert.equal(thing.size, "inherited");
    assert.equal("size" in thing, true);
    assert.deepEqual(Object.keys(thing), []);
  });

  it("methods and accessors stay what they were", function () {
    const calls = [];
    const model = observable({
      count: 1,
      get double() { return this.count * 2; },
      increase() { this.count++; },
      onChange(event) { calls.push(event.type); },
    });
    const seen = [];
    repeat(() => { seen.push(model.double); });
    model.increase();
    assert.deepEqual(seen, [2, 4]);
    assert.deepEqual(Object.keys(model), ["count", "double", "increase", "onChange"]);
  });

  it("a change event carries the previous value, read by a repeater or not", function () {
    const events = [];
    const model = observable({
      a: 1,
      b: 1,
      onChange(event) {
        if (event.type === "set") events.push(event.property + ": " + event.oldValue + " -> " + event.newValue);
      },
    });
    repeat(() => model.b);
    model.a = 2;
    model.b = 2;
    model.a = 2;
    model.c = 3;
    assert.deepEqual(events, ["a: 1 -> 2", "b: 1 -> 2", "c: undefined -> 3"]);
  });
});

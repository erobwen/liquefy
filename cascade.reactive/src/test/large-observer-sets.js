import { getWorld } from "../cascade.js";
import assert from "assert";

// A property with many observers keeps them in chunks (500 each, chained
// after the first). Emptying a chunk in the middle unlinks it - every
// observer in the chunks after it is still notified.
describe("large observer sets", function () {
  const { observable, invalidateOnChange } = getWorld({ name: "largeObserverSets" });

  function observe(object, count) {
    let fired = 0;
    const invalidators = [];
    for (let i = 0; i < count; i++) {
      invalidators.push(invalidateOnChange(() => object.a, () => { fired++; }));
    }
    return { invalidators, fired: () => fired };
  }

  it("emptying a chunk in the middle leaves the chunks after it notified", function () {
    const object = observable({ a: 1 });
    const { invalidators, fired } = observe(object, 1500);
    for (let i = 500; i < 1000; i++) invalidators[i].dispose(); // all of the first chained chunk
    object.a = 2;
    assert.equal(fired(), 1000);
  });

  it("emptying the first and the last chunk too", function () {
    const object = observable({ a: 1 });
    const { invalidators, fired } = observe(object, 2000);
    for (let i = 500; i < 1000; i++) invalidators[i].dispose();
    for (let i = 1500; i < 2000; i++) invalidators[i].dispose();
    object.a = 2;
    assert.equal(fired(), 1000);
  });

  it("the last observer gone - wherever it was - is reported once everything is empty", function () {
    let removed = 0;
    const object = observable({ a: 1 });
    object.onRemovedLastObserver = () => { removed++; };
    const { invalidators } = observe(object, 1200);
    for (let i = 500; i < 1200; i++) invalidators[i].dispose();
    assert.equal(removed, 0, "the root chunk still has observers");
    for (let i = 0; i < 500; i++) invalidators[i].dispose();
    assert.equal(removed, 1);
  });

  // A reader moved to a closer writing (a repeater writing the same value
  // in between) leaves the observer set it was in behind - and disposed
  // later, it was taken out of it a second time, counting it down below
  // what it holds. With a full first chunk, the next chunk's count reached
  // zero with a reader still in it: unlinked, and that reader never heard
  // of a change again.
  it("a reader taken out twice - moved, then disposed - doesn't count down a chunk still holding others", function () {
    const { observable, repeat, linkRepeater } = getWorld({ name: "largeObserverSetsRelocated", warnOnNestedRepeater: false });
    const object = observable({ v: 1 });
    const control = observable({ on: false, tick: 0 });
    const readers = [];
    let late = null;
    let after = null;
    const lateSaw = [];
    repeat(() => {
      for (let i = 0; i < 500; i++) {
        if (readers[i]) linkRepeater(readers[i]);
        else readers[i] = repeat(() => { void object.v; });
      }
      if (control.on) {
        if (late) linkRepeater(late);
        else late = repeat(() => { lateSaw.push(object.v); });
        object.v = 1;
      }
      if (after) linkRepeater(after);
      else after = repeat(() => { void object.v; void control.tick; });
    });
    control.on = true;
    control.tick++;
    object.v = 2;
    assert.deepEqual(lateSaw, [1, 2]);
  });
});

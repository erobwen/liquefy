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
});

import { getWorld } from "../cascade.js";
import assert from "assert";

// Temporal arrays (see cascade.js's "Temporal arrays"): an array's elements
// are positioned in time like a property's value - a reader sees what was
// written before it, not after - and a reader reruns only when what *it*
// read changed: the whole array, its length, one index, or one element
// counted from the end (pop(), at(-1)).
const { observable, repeat, invalidateOnChange } = getWorld({ name: "temporal-arrays" });

describe("temporal arrays", function () {

  describe("positioned reads", function () {
    it("a reader sees what was pushed before it, not after - and an external read sees the latest", function () {
      const array = observable([]);
      const model = observable({ value: "x" });
      let before = null;
      let after = null;
      let beforeRuns = 0;
      repeat(() => {
        repeat(() => { beforeRuns++; before = [...array]; });
        repeat(() => { array.push(model.value); });
        repeat(() => { after = [...array]; });
      });
      assert.deepEqual(before, []);
      assert.deepEqual(after, ["x"]);
      assert.deepEqual([...array], ["x"]);

      model.value = "y";
      assert.deepEqual(after, ["y"]);
      assert.deepEqual([...array], ["y"]);
      assert.equal(beforeRuns, 1, "a write after a reader never reaches it");
    });
  });

  describe("readers rerun only when what they read changed", function () {
    it("a popper reruns only when the last element changes", function () {
      const array = observable([1, 2, 3]);
      let popped = null;
      let runs = 0;
      repeat(() => { runs++; popped = array.pop(); });
      assert.equal(popped, 3);
      assert.deepEqual([...array], [1, 2]);

      array.unshift(0);
      assert.equal(runs, 1, "the last element is still the same");
      assert.deepEqual([...array], [0, 1, 2], "the pop is replayed on what's before it, without rerunning");

      array.push(4);
      assert.equal(runs, 2);
      assert.equal(popped, 4);
      assert.deepEqual([...array], [0, 1, 2, 3]);
    });

    it("at(-1) reads the last element only", function () {
      const array = observable(["a", "b"]);
      let last = null;
      let runs = 0;
      repeat(() => { runs++; last = array.at(-1); });
      array[0] = "z";
      array.unshift("y");
      assert.equal(runs, 1);
      array[array.length - 1] = "c";
      assert.equal(runs, 2);
      assert.equal(last, "c");
    });

    it("a shifter reruns only when the first element changes", function () {
      const array = observable([1, 2, 3]);
      let shifted = null;
      let runs = 0;
      repeat(() => { runs++; shifted = array.shift(); });
      assert.equal(shifted, 1);
      array.push(4);
      array[2] = 30;
      assert.equal(runs, 1);
      assert.deepEqual([...array], [2, 30, 4]);
      array.unshift(0);
      assert.equal(runs, 2);
      assert.equal(shifted, 0);
      assert.deepEqual([...array], [1, 2, 30, 4]);
    });

    it("a reader of one index reruns only when that index changes", function () {
      const array = observable(["a", "b", "c"]);
      let seen = null;
      let runs = 0;
      repeat(() => { runs++; seen = array[1]; });
      array[0] = "z";
      array.push("d");
      assert.equal(runs, 1);
      array[1] = "B";
      assert.equal(runs, 2);
      assert.equal(seen, "B");
      array.unshift("first"); // shifts everything - index 1 is now "z"
      assert.equal(runs, 3);
      assert.equal(seen, "z");
    });

    it("a reader of the length reruns only when the length changes", function () {
      const array = observable([1, 2]);
      let length = null;
      let runs = 0;
      repeat(() => { runs++; length = array.length; });
      array[0] = 10;
      array.reverse();
      assert.equal(runs, 1);
      array.push(3);
      assert.equal(runs, 2);
      assert.equal(length, 3);
    });

    it("an enumerator reruns on any change to the elements", function () {
      const array = observable([1, 2]);
      let sum = null;
      let runs = 0;
      repeat(() => { runs++; sum = array.reduce((a, b) => a + b, 0); });
      array[0] = 1; // same value - nothing written
      assert.equal(runs, 1);
      array[0] = 5;
      assert.equal(runs, 2);
      assert.equal(sum, 7);
    });

    it("splice reads what it removes", function () {
      const array = observable(["a", "b", "c"]);
      let removed = null;
      let runs = 0;
      repeat(() => { runs++; removed = array.splice(1, 1); });
      assert.deepEqual(removed, ["b"]);
      assert.deepEqual([...array], ["a", "c"]);
      array[0] = "A";
      array.push("d");
      assert.equal(runs, 1);
      assert.deepEqual([...array], ["A", "c", "d"]);
      array[1] = "B";
      assert.equal(runs, 2);
      assert.deepEqual(removed, ["B"]);
    });

    it("an invalidator reads like any other reader", function () {
      const array = observable(["a", "b"]);
      let invalidated = 0;
      invalidateOnChange(() => array[1], () => { invalidated++; });
      array[0] = "z";
      assert.equal(invalidated, 0);
      array[1] = "y";
      assert.equal(invalidated, 1);
    });
  });

  describe("writes are relative to what's before them", function () {
    it("pushers don't depend on each other - a changed push is replayed under the next", function () {
      const array = observable([]);
      const model = observable({ a: "a", b: "b" });
      let aRuns = 0;
      let bRuns = 0;
      repeat(() => {
        repeat(() => { aRuns++; array.push(model.a); });
        repeat(() => { bRuns++; array.push(model.b); });
      });
      assert.deepEqual([...array], ["a", "b"]);
      model.a = "A";
      assert.equal(aRuns, 2);
      assert.equal(bRuns, 1);
      assert.deepEqual([...array], ["A", "b"]);
    });

    it("a sort is replayed on a changed predecessor, without its writer running again", function () {
      const array = observable([3, 1, 2]);
      let runs = 0;
      repeat(() => { runs++; array.sort(); });
      assert.deepEqual([...array], [1, 2, 3]);
      array.push(0);
      assert.deepEqual([...array], [0, 1, 2, 3]);
      assert.equal(runs, 1);
    });

    it("a partial reading what it wrote itself doesn't rerun for its own writes", function () {
      const array = observable([]);
      const model = observable({ first: "a" });
      let runs = 0;
      let length = null;
      repeat(() => {
        repeat(() => { array.push(model.first); });
        repeat(() => { runs++; array.push("b"); length = array.length; });
      });
      assert.equal(runs, 1);
      assert.equal(length, 2);
      model.first = "A";
      assert.deepEqual([...array], ["A", "b"]);
      assert.equal(length, 2);
    });
  });

  describe("flagged readers check their own read once the wavefront reaches them", function () {
    it("a change undone before the wavefront reaches a reader doesn't rerun it", function () {
      const array = observable([]);
      const model = observable({ value: 1 });
      let bRuns = 0;
      let cRuns = 0;
      let cSeen = null;
      repeat(() => {
        repeat(() => { array.push(model.value); });                     // A
        repeat(() => { bRuns++; array.pop(); array.push("fixed"); });   // B: replaces the last
        repeat(() => { cRuns++; cSeen = [...array]; });                 // C
      });
      assert.deepEqual(cSeen, ["fixed"]);

      model.value = 2;
      assert.equal(bRuns, 2, "B read the last element, which changed");
      assert.equal(cRuns, 1, "what C reads is the same as before");
      assert.deepEqual([...array], ["fixed"]);
    });

    it("a rerun that writes the same elements again doesn't rerun the readers after it", function () {
      const array = observable([]);
      const model = observable({ items: ["a", "b"], tick: 0 });
      let readerRuns = 0;
      repeat(() => {
        repeat(() => { model.tick; model.items.forEach((item) => array.push(item)); });
        repeat(() => { readerRuns++; [...array]; });
      });
      model.tick++;
      assert.equal(readerRuns, 1);
      model.items = ["a", "c"];
      assert.equal(readerRuns, 2);
      assert.deepEqual([...array], ["a", "c"]);
    });

    it("a writer that stops writing is retracted - readers after it see what's before it", function () {
      const array = observable(["base"]);
      const model = observable({ show: true });
      let seen = null;
      let readerRuns = 0;
      repeat(() => {
        repeat(() => { if (model.show) array.push("shown"); });
        repeat(() => { readerRuns++; seen = [...array]; });
      });
      assert.deepEqual(seen, ["base", "shown"]);
      model.show = false;
      assert.equal(readerRuns, 2);
      assert.deepEqual(seen, ["base"]);
      assert.deepEqual([...array], ["base"]);
      model.show = true;
      assert.deepEqual(seen, ["base", "shown"]);
    });

    it("words laying themselves out, each reading only where the one before it ended", function () {
      const placed = observable([]);
      const texts = observable(["one", "two", "three", "four"]);
      const runs = {};
      repeat(() => {
        for (let index = 0; index < 4; index++) {
          repeat(() => {
            const text = texts[index];
            runs[index] = (runs[index] || 0) + 1;
            const previous = placed.at(-1); // frozen: compared by value
            const column = previous ? previous.end + 1 : 0;
            placed.push(Object.freeze({ column, end: column + text.length }));
          });
        }
      });
      assert.deepEqual(placed.map((word) => word.column), [0, 4, 8, 14]);
      // Same length: only the word itself lays out again.
      texts[1] = "TWO";
      assert.deepEqual(runs, { 0: 1, 1: 2, 2: 1, 3: 1 });
      // Longer: the words after it lay out again too.
      texts[1] = "seven";
      assert.deepEqual(runs, { 0: 1, 1: 3, 2: 2, 3: 2 });
      assert.deepEqual(placed.map((word) => word.column), [0, 4, 10, 16]);
    });
  });

  describe("properties of arrays are ordinary properties", function () {
    it("a property reader doesn't rerun for the elements, nor an element reader for a property", function () {
      const array = observable([1, 2]);
      array.label = "x";
      let labelRuns = 0;
      let elementRuns = 0;
      repeat(() => { labelRuns++; array.label; });
      repeat(() => { elementRuns++; array[0]; });
      array.push(3);
      assert.equal(labelRuns, 1);
      array.label = "y";
      assert.equal(labelRuns, 2);
      assert.equal(elementRuns, 1);
      assert.deepEqual(Object.keys(array), ["0", "1", "2", "label"]);
    });
  });

  describe("rebuilding", function () {
    it("an established array takes a rebuild's elements - readers rerun only for what they read", function () {
      const source = observable({ items: [1, 2, 3] });
      let built = null;
      repeat(() => { built = observable(source.items.slice(), "list"); });
      const established = built;
      let first = null;
      let firstRuns = 0;
      repeat(() => { firstRuns++; first = established[0]; });

      source.items = [1, 2, 4];
      assert.equal(built, established);
      assert.deepEqual([...established], [1, 2, 4]);
      assert.equal(firstRuns, 1);

      source.items = [9, 2, 4];
      assert.equal(firstRuns, 2);
      assert.equal(first, 9);
    });
  });

  describe("it's still an array", function () {
    it("behaves like one, and its target mirrors the latest elements", function () {
      const array = observable([3, 1, 2]);
      repeat(() => { array.sort(); });
      assert(Array.isArray(array));
      assert.equal(JSON.stringify(array), "[1,2,3]");
      assert.equal(array + "", "1,2,3");
      assert.deepEqual(array.map((value, index, self) => self === array && value * index), [0, 2, 6]);
      assert.deepEqual([...array.causality.target], [1, 2, 3], "the target mirrors what an external read sees");
      array.push(0);
      assert.deepEqual([...array.causality.target], [0, 1, 2, 3]);
    });
  });
});

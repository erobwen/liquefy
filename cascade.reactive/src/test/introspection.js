import { getWorld } from "../cascade.js";
import assert from "assert";

// hasObservers() and sourcesOf() - see cascade.js's "Introspection".
describe("introspection", function () {
  const { observable, temporal, repeat, retractRepeater, invalidateOnChange } = getWorld({ name: "introspection" });
  const world = getWorld({ name: "introspection" });
  const { hasObservers, sourcesOf } = world;

  class Thing {
    constructor() {
      this.size = 2;
      return temporal(this);
    }
    get area() { return this.size * this.size; }
  }

  describe("hasObservers()", function () {

    it("is true while something reads the property, and only that property", function () {
      const object = observable({ a: 1, b: 2 });
      assert.equal(hasObservers(object, "a"), false);
      assert.equal(hasObservers(object), false);
      const repeater = repeat(() => object.a);
      assert.equal(hasObservers(object, "a"), true);
      assert.equal(hasObservers(object, "b"), false);
      assert.equal(hasObservers(object), true);
      retractRepeater(repeater);
      assert.equal(hasObservers(object, "a"), false);
      assert.equal(hasObservers(object), false);
    });

    it("counts an invalidator, until it has fired", function () {
      const object = temporal({ a: 1 });
      invalidateOnChange(() => object.a, () => {});
      assert.equal(hasObservers(object, "a"), true);
      object.a = 2;
      assert.equal(hasObservers(object, "a"), false, "an invalidator fires once, and lets go");
    });

    it("finds observers in the chunks after a full first one", function () {
      const object = temporal({ a: 1 });
      const invalidators = [];
      for (let i = 0; i < 700; i++) invalidators.push(invalidateOnChange(() => object.a, () => {}));
      for (let i = 0; i < 500; i++) invalidators[i].dispose();
      assert.equal(hasObservers(object, "a"), true, "the first 500 are gone, the rest are in a chunk");
      for (let i = 500; i < 700; i++) invalidators[i].dispose();
      assert.equal(hasObservers(object, "a"), false);
    });

    it("a getter on the prototype: observed with every prototype member of the object, and what it reads", function () {
      const thing = new Thing();
      const repeater = repeat(() => thing.area);
      assert.equal(hasObservers(thing, "area"), true);
      assert.equal(hasObservers(thing, "size"), true, "what the getter read");
      retractRepeater(repeater);
      assert.equal(hasObservers(thing, "area"), false);
      assert.equal(hasObservers(thing), false);
    });

    it("a method given the very value it inherits: still observed, by the readers of the prototype's", function () {
      class Tool { use() { return 1; } }
      const tool = temporal(new Tool());
      const repeater = repeat(() => tool.use());
      tool.use = Tool.prototype.use;
      assert.equal(hasObservers(tool, "use"), true);
      retractRepeater(repeater);
      assert.equal(hasObservers(tool, "use"), false);
    });

    it("an array's length and indices: observed together, by what was read of its elements", function () {
      const list = temporal([1, 2, 3]);
      const repeater = repeat(() => list[0]);
      assert.equal(hasObservers(list, 0), true, "a number is the same key as its string");
      assert.equal(hasObservers(list, "0"), true);
      assert.equal(hasObservers(list, "length"), true);
      assert.equal(hasObservers(list), true);
      retractRepeater(repeater);
      assert.equal(hasObservers(list, 0), false);
    });

    it("enumerating an object observes its keys, not its properties", function () {
      const object = observable({ a: 1 });
      repeat(() => Object.keys(object));
      assert.equal(hasObservers(object, "a"), false);
      assert.equal(hasObservers(object), true);
    });

    it("a sole reader rerunning lets go for a moment - asked afterwards, it is observed again", function () {
      const object = temporal({ a: 1 });
      const seenInHook = [];
      object.onRemovedLastObserver = (description, key) => {
        if (key === "a") seenInHook.push(hasObservers(object, "a"));
      };
      repeat(() => object.a);
      object.a = 2;
      assert.deepEqual(seenInHook, [false], "told it was let go of, mid-rerun");
      assert.equal(hasObservers(object, "a"), true, "and read again by the rerun");
    });

    it("throws for what is not observable", function () {
      assert.throws(() => hasObservers({}), /observable/);
      assert.throws(() => hasObservers(null, "a"), /observable/);
    });
  });

  describe("sourcesOf()", function () {

    it("lists what a repeater read in its last run, once each", function () {
      const object = observable({ a: 1, b: 2 });
      const keyed = observable({ x: 1 });
      const list = temporal([1, 2]);
      const thing = new Thing();
      const repeater = repeat(() => {
        object.a; object.a; object.b;
        Object.keys(keyed);
        list.length; list[1];
        thing.area;
      });
      const sources = sourcesOf(repeater);
      assert.deepEqual(sources, [
        { object, key: "a", kind: "property" },
        { object, key: "b", kind: "property" },
        { object: keyed, key: null, kind: "keys" },
        { object: list, key: null, kind: "elements" },
        { object: thing, key: null, kind: "prototype" },
        { object: thing, key: "size", kind: "property" },
      ]);
    });

    it("follows the reruns: what it reads now, not what it read before", function () {
      const object = temporal({ which: "a", a: 1, b: 2 });
      const repeater = repeat(() => object[object.which]);
      assert.deepEqual(sourcesOf(repeater).map((source) => source.key), ["which", "a"]);
      object.which = "b";
      assert.deepEqual(sourcesOf(repeater).map((source) => source.key), ["which", "b"]);
      retractRepeater(repeater);
      assert.deepEqual(sourcesOf(repeater), []);
    });

    it("a repeater's own reads, not its children's", function () {
      const object = observable({ a: 1, b: 2 });
      let child = null;
      const parent = repeat(() => {
        object.a;
        child = repeat(() => object.b);
      });
      assert.deepEqual(sourcesOf(parent).map((source) => source.key), ["a"]);
      assert.deepEqual(sourcesOf(child).map((source) => source.key), ["b"]);
    });

    it("an invalidator's reads", function () {
      const object = observable({ a: 1 });
      const invalidator = invalidateOnChange(() => object.a, () => {});
      assert.deepEqual(sourcesOf(invalidator), [{ object, key: "a", kind: "property" }]);
    });

    it("throws for what is neither a repeater nor an invalidator", function () {
      assert.throws(() => sourcesOf({}), /repeater or an invalidator/);
      assert.throws(() => sourcesOf(null), /repeater or an invalidator/);
    });
  });
});

import { getWorld } from "../cascade.js";
import assert from "assert";

const { observable, temporal, meta, plainMeta, innerMeta, repeat, retractRepeater, transaction } = getWorld();

describe("innerMeta()", function () {

  it("innerMeta(object) is cascade's own bookkeeping, on the dedicated property, cascadeMetadataObject by default", function () {
    const object = observable({ name: "a" });
    assert.strictEqual(innerMeta(object), object.cascadeMetadataObject);
    assert.strictEqual(innerMeta(object).proxy, object);
    assert.equal(typeof(innerMeta(object).id), "number");
    assert.notEqual(innerMeta(object).id, innerMeta(observable({})).id);
  });

  it("works for arrays and temporal objects too", function () {
    const array = observable([1, 2]);
    assert.strictEqual(innerMeta(array).proxy, array);
    const signal = temporal({});
    assert.strictEqual(innerMeta(signal).proxy, signal);
  });

  it("the dedicated property is not one of the object's own keys, and cannot be written", function () {
    const object = observable({ name: "a" });
    assert.deepEqual(Object.keys(object), ["name"]);
    assert.throws(() => { object.cascadeMetadataObject = {}; });
  });

  it("the property's name is configurable, and innerMeta() finds it whatever it is", function () {
    const world = getWorld({ name: "meta test, old name", objectMetaProperty: "causality" });
    const object = world.observable({ cascadeMetadataObject: "just data" });
    assert.strictEqual(world.innerMeta(object), object.causality);
    assert.equal(object.cascadeMetadataObject, "just data");
    assert.equal(world.meta(object, "cascadeMetadataObject").saved, undefined);
  });
});

// meta() and plainMeta() are the same pair of records, observable and not.
for (const [name, record, observed] of [["meta", meta, true], ["plainMeta", plainMeta, false]]) {
  describe(name + "()", function () {

    it(name + "(object) is a record for the object, made on first use and the same ever after", function () {
      const object = observable({ a: 1 });
      const objectRecord = record(object);
      assert.strictEqual(record(object), objectRecord);
      assert.deepEqual(Object.keys(objectRecord), []);
      assert.notStrictEqual(record(observable({})), objectRecord);
    });

    it(name + "(object, property) is a record for the property, one per property", function () {
      const object = observable({ title: "Untitled" });
      const titleRecord = record(object, "title");
      assert.strictEqual(record(object, "title"), titleRecord);
      assert.notStrictEqual(record(object, "other"), titleRecord);
      assert.notStrictEqual(record(object), titleRecord);
    });

    it("is beside the object, not in it", function () {
      const object = observable({ a: 1 });
      record(object).loaded = true;
      record(object, "a").saved = 1;
      assert.deepEqual(Object.keys(object), ["a"]);
    });

    it(observed ? "is observable" : "is not observable", function () {
      const object = observable({});
      assert.equal(innerMetaOrNull(record(object)) !== null, observed);
      assert.equal(innerMetaOrNull(record(object, "a")) !== null, observed);
    });

    it("throws for what is not observable", function () {
      assert.throws(() => record({}), /observable/);
      assert.throws(() => record(null, "a"), /observable/);
    });
  });
}

function innerMetaOrNull(object) {
  try { return innerMeta(object); } catch (error) { return null; }
}

describe("meta() and plainMeta() together", function () {

  it("are separate records, and neither is cascade's bookkeeping", function () {
    const object = observable({ a: 1 });
    assert.notStrictEqual(meta(object), plainMeta(object));
    assert.notStrictEqual(meta(object, "a"), plainMeta(object, "a"));
    assert.notStrictEqual(meta(object), innerMeta(object));
    assert.notStrictEqual(plainMeta(object), innerMeta(object));
    plainMeta(object).id = "mine";
    meta(object).proxy = "mine too";
    assert.equal(typeof(innerMeta(object).id), "number");
    assert.strictEqual(innerMeta(object).proxy, object);
  });

  it("hold values, plain objects and observables alike", function () {
    const document = observable({ title: "Untitled" });
    const sync = observable({ loaded: "unloaded" });
    meta(document).sync = sync;
    plainMeta(document).store = { name: "the store" };
    meta(document, "title").saved = "Untitled";
    assert.strictEqual(meta(document).sync, sync);
    assert.equal(plainMeta(document).store.name, "the store");
    assert.equal(meta(document, "title").saved, "Untitled");
  });
});

describe("observing meta()", function () {

  it("an object record is observed like any observable", function () {
    const object = observable({});
    const seen = [];
    repeat(() => seen.push(meta(object).loaded || "unloaded"));
    meta(object).loaded = "loading";
    meta(object).loaded = "loaded";
    assert.deepEqual(seen, ["unloaded", "loading", "loaded"]);
  });

  it("a property record is observed like any observable", function () {
    const object = observable({ title: "Untitled" });
    meta(object, "title").saved = "Untitled";
    const seen = [];
    repeat(() => seen.push(object.title !== meta(object, "title").saved ? "unsaved" : "saved"));
    object.title = "A New Title";
    meta(object, "title").saved = "A New Title";
    assert.deepEqual(seen, ["saved", "unsaved", "saved"]);
  });

  it("a record first asked for inside a repeater outlives the repeater", function () {
    const object = observable({ title: "Untitled" });
    let propertyRecord = null;
    let objectRecord = null;
    const repeater = repeat(() => {
      propertyRecord = meta(object, "title");
      propertyRecord.saving = 0;
      objectRecord = meta(object);
      objectRecord.loaded = "loaded";
    });
    retractRepeater(repeater);
    assert.strictEqual(meta(object, "title"), propertyRecord);
    assert.strictEqual(meta(object), objectRecord);
    transaction(() => { propertyRecord.saving++; });
    assert.equal(meta(object, "title").saving, 1);
    assert.equal(meta(object).loaded, "loaded");
  });
});

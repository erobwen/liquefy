import { getWorld } from "../cascade.js";
import assert from "assert";

const { observable, temporal, meta, repeat, retractRepeater, transaction } = getWorld();

describe("meta()", function () {

  it("meta(object) is the object's metadata object, on its dedicated property", function () {
    const object = observable({ name: "a" });
    assert.strictEqual(meta(object), object.causality);
    assert.strictEqual(meta(object).proxy, object);
    assert.equal(typeof(meta(object).id), "number");
    assert.notEqual(meta(object).id, meta(observable({})).id);
  });

  it("works for arrays and temporal objects too", function () {
    const array = observable([1, 2]);
    assert.strictEqual(meta(array).proxy, array);
    const signal = temporal({});
    assert.strictEqual(meta(signal).proxy, signal);
  });

  it("the metadata property is not one of the object's own keys, and cannot be written", function () {
    const object = observable({ name: "a" });
    assert.deepEqual(Object.keys(object), ["name"]);
    assert.throws(() => { object.causality = {}; });
  });

  it("the property's name is configurable, and meta() finds it whatever it is", function () {
    const world = getWorld({ name: "meta test, long name", objectMetaProperty: "cascadeMetadataObject" });
    const object = world.observable({ causality: "just data" });
    assert.strictEqual(world.meta(object), object.cascadeMetadataObject);
    assert.equal(object.causality, "just data");
    assert.equal(world.meta(object, "causality").saved, undefined);
  });

  it("throws for what is not observable", function () {
    assert.throws(() => meta({}), /observable/);
    assert.throws(() => meta(null), /observable/);
  });

  it("meta(object, property) is an observable record, made on first use and the same ever after", function () {
    const object = observable({ title: "Untitled" });
    const record = meta(object, "title");
    assert.strictEqual(meta(object, "title"), record);
    assert.notStrictEqual(meta(object, "other"), record);
    assert.deepEqual(Object.keys(record), []);
    assert.strictEqual(meta(record).proxy, record);
    // Beside the object, not in it.
    assert.deepEqual(Object.keys(object), ["title"]);
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
    let record = null;
    const repeater = repeat(() => {
      record = meta(object, "title");
      record.saving = 0;
    });
    retractRepeater(repeater);
    assert.strictEqual(meta(object, "title"), record);
    transaction(() => { record.saving++; });
    assert.equal(meta(object, "title").saving, 1);
  });
});

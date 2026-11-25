import assert from "assert";
import getWorld from "@liquefy/cascade.reactive";
import { strongReferences } from "@liquefy/aquifer";
import { createDataModel, DataModelError } from "../index.js";

const events = [];
const world = getWorld({ name: "wellspring test: encoding", onEventGlobal: (event) => events.push(event) });
const model = createDataModel(world);
const { Synchronized, synchronized, weak, encodeValue, decodeValue, encodeRecord, makeFromRecord } = model;

// A small seeded random generator, so that failures can be reproduced.
function random(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function generator(seed, objects) {
  const next = random(seed);
  const pick = (items) => items[Math.floor(next() * items.length)];
  const strings = ["", "a", "$ref", "$$x", "$", "with \"quotes\"", "\ud800 lone", "emoji \u{1F600}", "line\nbreak"];
  const numbers = [0, -0, 1, -1.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER, 2 ** 60, 1e-300];

  function primitive() {
    return pick([() => pick(strings), () => pick(numbers), () => next() < 0.5, () => null])();
  }
  function frozenLeaf(depth) {
    const roll = next();
    if (roll < 0.5 || depth > 2) return primitive();
    if (roll < 0.6) return new Date(pick([0, 1764028800000, NaN]));
    if (roll < 0.7) return new Uint8Array([0, 255, Math.floor(next() * 256)]);
    return frozen(depth + 1);
  }
  function frozen(depth = 0) {
    if (next() < 0.5) {
      const array = [];
      const length = Math.floor(next() * 4);
      for (let i = 0; i < length; i++) array.push(frozenLeaf(depth));
      return Object.freeze(array);
    }
    const object = {};
    const count = Math.floor(next() * 4);
    for (let i = 0; i < count; i++) object[pick(strings.concat(["k" + i]))] = frozenLeaf(depth);
    return Object.freeze(object);
  }
  function collectionItem() {
    return pick([primitive, () => new Date(1000), () => frozen(1), () => pick(objects)])();
  }
  return function value() {
    const roll = next();
    if (roll < 0.25) return primitive();
    if (roll < 0.35) return new Date(pick([0, -1, 1764028800000, NaN]));
    if (roll < 0.45) return new Uint8Array(Array.from({ length: Math.floor(next() * 5) }, () => Math.floor(next() * 256)));
    if (roll < 0.6) return frozen();
    if (roll < 0.7) return new Map(Array.from({ length: Math.floor(next() * 3) }, () => [collectionItem(), collectionItem()]));
    if (roll < 0.8) return new Set(Array.from({ length: Math.floor(next() * 3) }, () => collectionItem()));
    if (roll < 0.9) return pick(objects);
    return weak(pick(objects));
  };
}

function isDeeplyFrozen(value) {
  if (value === null || typeof(value) !== "object" || value instanceof Date || value instanceof Uint8Array) return true;
  return Object.isFrozen(value) && Object.values(value).every(isDeeplyFrozen);
}

describe("encoding values (data model 8.2, E2, E3)", function () {

  const objects = ["n1", "n2", "n3"].map((id) => {
    const object = synchronized({});
    model.setIdentity(object, id);
    return object;
  });
  const byId = new Map(objects.map((object) => [model.identityOf(object), object]));
  const references = { strong: (id) => byId.get(id) };

  it("round-trips generated values, through JSON as well", function () {
    for (let seed = 1; seed <= 2000; seed++) {
      const value = generator(seed, objects)();
      const encoded = encodeValue(value);
      const viaJson = JSON.parse(JSON.stringify(encoded));
      for (const form of [encoded, viaJson]) {
        const decoded = decodeValue(form, references);
        assert.ok(model.sameValue(decoded, value), "seed " + seed + ": " + JSON.stringify(encoded));
        assert.ok(isDeeplyFrozen(decoded) || decoded instanceof Map || decoded instanceof Set || model.isSynchronized(decoded) || decoded instanceof model.WeakReference, "seed " + seed);
      }
    }
  });

  it("keeps -0, NaN, infinities, invalid dates and lone surrogates", function () {
    for (const value of [-0, NaN, Infinity, -Infinity]) {
      assert.ok(Object.is(decodeValue(JSON.parse(JSON.stringify(encodeValue(value)))), value));
    }
    assert.ok(Number.isNaN(decodeValue(JSON.parse(JSON.stringify(encodeValue(new Date(NaN))))).getTime()));
    assert.equal(decodeValue(JSON.parse(JSON.stringify(encodeValue("\ud800")))), "\ud800");
  });

  it("omits undefined properties of a frozen object, and turns holes into null", function () {
    assert.deepEqual(encodeValue(Object.freeze({ a: 1, b: undefined })), { a: 1 });
    // eslint-disable-next-line no-sparse-arrays
    assert.deepEqual(encodeValue(Object.freeze([1, , undefined])), [1, null, null]);
  });

  it("gives decoded dates, maps, sets and binary values that are not shared", function () {
    const encoded = encodeValue(new Date(5));
    assert.notStrictEqual(decodeValue(encoded), decodeValue(encoded));
  });

  it("refuses to decode a reference without a way to resolve it, and unknown tags", function () {
    assert.throws(() => decodeValue({ $ref: "n1" }), /resolve/);
    assert.throws(() => decodeValue({ $nope: 1, other: 2 }), /Unknown reserved key/);
    assert.throws(() => decodeValue(Object.freeze([{ $ref: "n1" }])), /frozen value cannot contain/);
  });

  it("encodes a weak reference by identity, and decodes one without resolving it", function () {
    const encoded = encodeValue(weak(objects[0]));
    assert.deepEqual(encoded, { $weak: "n1" });
    const decoded = decodeValue(encoded);
    assert.ok(decoded instanceof model.WeakReference);
    assert.equal(decoded.id, "n1");
    assert.equal(decoded.deref(), undefined);
    model.resolveWeak = (id) => byId.get(id);
    try {
      assert.strictEqual(decoded.deref(), objects[0]);
    } finally {
      model.resolveWeak = null;
    }
  });
});

describe("escaping, and references Aquifer can see (data model E1, E4)", function () {

  it("escapes every key of the application's that begins with $", function () {
    const object = synchronized({ $ref: "n1", $$x: 1, plain: Object.freeze({ $weak: "n2", $class: 1 }) });
    model.setIdentity(object, "n10");
    const record = encodeRecord(object);
    assert.deepEqual(record, { $class: "Object", $version: 0, $$ref: "n1", $$$x: 1, plain: { $$weak: "n2", $$class: 1 } });
    const made = makeFromRecord(JSON.parse(JSON.stringify(record)), { strong: () => assert.fail("no references here") });
    assert.equal(made.$ref, "n1");
    assert.equal(made.$$x, 1);
    assert.deepEqual({ ...made.plain }, { $weak: "n2", $class: 1 });
  });

  it("never lets a value pass for a reference", function () {
    const attempts = [
      { $ref: "victim" },
      { $ref: "victim", note: "x" },
      { nested: Object.freeze({ $ref: "victim" }) },
      { list: Object.freeze([Object.freeze({ $ref: "victim" })]) },
      { map: new Map([[Object.freeze({ $ref: "victim" }), Object.freeze({ $weak: "victim" })]]) },
      { set: new Set([Object.freeze({ $ref: "victim", other: 1 })]) },
    ];
    for (const fields of attempts) {
      const frozenFields = {};
      for (const [key, value] of Object.entries(fields)) frozenFields[key] = typeof(value) === "object" && !(value instanceof Map) && !(value instanceof Set) ? Object.freeze(value) : value;
      const object = synchronized(fields.$ref !== undefined ? fields : frozenFields);
      const record = JSON.parse(JSON.stringify(encodeRecord(object, { identify: () => "x" })));
      assert.equal(strongReferences(record).size, 0, JSON.stringify(record));
    }
  });

  it("puts real references where Aquifer finds them", function () {
    const target = synchronized({});
    model.setIdentity(target, "n77");
    const object = synchronized({ one: target, many: new Map([["k", target]]), loose: weak(target) });
    model.setIdentity(object, "n78");
    const references = strongReferences(encodeRecord(object));
    assert.deepEqual([...references], [["n77", 2]]);
  });
});

describe("records and making objects (data model 8.1, K1, K2)", function () {

  let constructed = 0;
  class Chapter extends Synchronized {
    title = "Untitled";
    paragraphs = synchronized([]);
    constructor() {
      super();
      constructed++;
    }
    describe() { return "Chapter " + this.title; }
  }
  model.registerClasses({ Chapter });

  it("encodes a class instance with its class and version", function () {
    const chapter = new Chapter();
    model.setIdentity(chapter.paragraphs, "n200");
    model.setIdentity(chapter, "n201");
    chapter.title = "One";
    assert.deepEqual(encodeRecord(chapter), { $class: "Chapter", $version: 0, title: "One", paragraphs: { $ref: "n200" } });
  });

  it("makes an object from its record without running the constructor, and without events", function () {
    const paragraphs = synchronized([]);
    model.setIdentity(paragraphs, "n300");
    const before = constructed;
    events.length = 0;
    const chapter = makeFromRecord({ $class: "Chapter", $version: 0, title: "Two", paragraphs: { $ref: "n300" } },
      { strong: (id) => (id === "n300" ? paragraphs : undefined) }, { id: "n301" });
    assert.equal(constructed, before, "K1: the constructor runs once, where the object is made");
    assert.deepEqual(events.filter((event) => event.type !== "create").map((event) => event.type), [], "K2: arriving data is not a change");
    assert.ok(chapter instanceof Chapter);
    assert.equal(chapter.describe(), "Chapter Two");
    assert.strictEqual(chapter.paragraphs, paragraphs);
    assert.equal(model.identityOf(chapter), "n301");
    assert.throws(() => { chapter.title = {}; }, DataModelError, "an object made from a record checks its writes too");
  });

  it("round-trips arrays", function () {
    const target = synchronized({});
    model.setIdentity(target, "n400");
    const array = synchronized([1, "two", target, Object.freeze({ three: 3 })]);
    model.setIdentity(array, "n401");
    const record = JSON.parse(JSON.stringify(encodeRecord(array)));
    assert.equal(record.$class, "Array");
    const made = makeFromRecord(record, { strong: () => target });
    assert.ok(Array.isArray(made) && model.isSynchronized(made));
    assert.equal(made.length, 4);
    assert.strictEqual(made[2], target);
    assert.ok(model.sameValue(made[3], Object.freeze({ three: 3 })));
  });

  it("refuses unknown and unregistered classes (C1, C4)", function () {
    assert.throws(() => makeFromRecord({ $class: "Nowhere", $version: 0 }), /Unknown class/);
    class Unregistered extends Synchronized {}
    const object = new Unregistered();
    model.setIdentity(object, "n500");
    assert.throws(() => encodeRecord(object), /not registered/);
  });

  it("refuses to encode a reference to an object without identity, unless told how to name it", function () {
    const object = synchronized({ other: synchronized({}) });
    assert.throws(() => encodeRecord(object), /no identity/);
    const record = encodeRecord(object, { identify: (target) => "t" + model.localIdOf(target) });
    assert.match(record.other.$ref, /^t\d+$/);
  });
});

describe("classes (data model section 5)", function () {

  it("registers by name, with a version, and gives a signature", function () {
    const local = createDataModel(getWorld({ name: "wellspring test: classes" }));
    class Book extends local.Synchronized { static version = 2; }
    class Author extends local.Synchronized {}
    local.registerClasses({ Book, Author });
    assert.equal(local.classByName("Book").version, 2);
    assert.equal(local.classesSignature(), "Author:0,Book:2");
    assert.equal(local.classNameOf(new Book()), "Book");
    assert.equal(local.classNameOf(local.synchronized({})), "Object");
    assert.equal(local.classNameOf(local.synchronized([])), "Array");
  });

  it("refuses what cannot be registered", function () {
    const local = createDataModel(getWorld({ name: "wellspring test: classes 2" }));
    class Plain {}
    assert.throws(() => local.registerClass(Plain), /extends Synchronized/);
    class Object2 extends local.Synchronized {}
    assert.throws(() => local.registerClass(Object2, { name: "Object" }), /built-in/);
    assert.throws(() => local.registerClass(Object2, { name: "Array" }), /built-in/);
    class Versioned extends local.Synchronized {}
    assert.throws(() => local.registerClass(Versioned, { version: -1 }), /version/);
    class First extends local.Synchronized {}
    class Second extends local.Synchronized {}
    local.registerClass(First, { name: "Same" });
    assert.throws(() => local.registerClass(Second, { name: "Same" }), /already registered/);
  });

  it("refuses classes with #private members (C6), which would fail on the observable", function () {
    const local = createDataModel(getWorld({ name: "wellspring test: classes 3" }));
    class Secretive extends local.Synchronized {
      #secret = 1;
      reveal() { return this.#secret; }
    }
    assert.throws(() => local.registerClass(Secretive), /#private/);
    // Why: a constructed object has its private field, installed on the observable that the
    // base class returned; an object made from a record (K2) never ran the constructor, and has not.
    assert.equal(new Secretive().reveal(), 1);
    const made = local.makeFromRecord({ $class: "Object", $version: 0 });
    Object.setPrototypeOf(made, Secretive.prototype);
    assert.throws(() => made.reveal(), TypeError);
    class PrivateMethod extends local.Synchronized {
      #helper() { return 1; }
    }
    assert.throws(() => local.registerClass(PrivateMethod), /#private/);
    class Innocent extends local.Synchronized {
      label = "a # in a string";
    }
    local.registerClass(Innocent);
  });
});

describe("equality (data model Q1)", function () {

  it("compares values by content, and references by identity", function () {
    const same = model.sameValue;
    assert.ok(same(0, -0));
    assert.ok(same(NaN, NaN));
    assert.ok(same(new Date(5), new Date(5)));
    assert.ok(same(new Date(NaN), new Date(NaN)));
    assert.ok(!same(new Date(5), new Date(6)));
    assert.ok(same(new Map([[1, 2], [3, 4]]), new Map([[1, 2], [3, 4]])));
    assert.ok(!same(new Map([[1, 2], [3, 4]]), new Map([[3, 4], [1, 2]])), "order matters");
    assert.ok(same(new Set([1, 2]), new Set([1, 2])));
    assert.ok(same(new Uint8Array([1, 2]), new Uint8Array([1, 2])));
    assert.ok(same(Object.freeze({ a: Object.freeze([1, new Date(1)]) }), Object.freeze({ a: Object.freeze([1, new Date(1)]) })));
    assert.ok(!same(synchronized({}), synchronized({})));
    const target = synchronized({});
    assert.ok(same(weak(target), weak(target)));
  });
});

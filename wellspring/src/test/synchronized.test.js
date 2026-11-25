import assert from "assert";
import getWorld from "@liquefy/cascade.reactive";
import { createDataModel, DataModelError } from "../index.js";

const world = getWorld({ name: "wellspring test: synchronized" });
const model = createDataModel(world);
const { Synchronized, synchronized, isSynchronized, weak } = model;

describe("Synchronized and synchronized() (data model 2.1)", function () {

  it("a class instance is the observable from its constructor on", function () {
    let seenInConstructor = null;
    class Document extends Synchronized {
      title = "Untitled";
      constructor() {
        super();
        seenInConstructor = this;
      }
    }
    const document = new Document();
    assert.ok(world.isObservable(document));
    assert.ok(isSynchronized(document));
    assert.strictEqual(seenInConstructor, document, "a constructor cannot hand out a non-observable this");
    assert.ok(document instanceof Document);
    assert.equal(document.title, "Untitled");
  });

  it("checks field initializers like any other write", function () {
    class Bad extends Synchronized {
      settings = { margin: 20 };
    }
    assert.throws(() => new Bad(), /neither synchronized nor frozen/);
    class Good extends Synchronized {
      settings = Object.freeze({ margin: 20 });
      chapters = synchronized([]);
    }
    const good = new Good();
    assert.ok(isSynchronized(good.chapters));
  });

  it("synchronized() makes a plain object or an array synchronized, and checks what it holds", function () {
    const object = synchronized({ a: 1, list: synchronized([1, 2]) });
    assert.ok(isSynchronized(object) && isSynchronized(object.list));
    assert.strictEqual(synchronized(object), object);
    assert.throws(() => synchronized({ nested: { a: 1 } }), /neither synchronized nor frozen/);
    assert.throws(() => synchronized([1, , 3]), /holes/);
    assert.throws(() => synchronized(Object.freeze({})), /frozen object is a value/);
    assert.throws(() => synchronized(new Date()), /plain object or an array/);
    assert.throws(() => synchronized(world.observable({})), /already observable/);
  });

  it("an object starts local, without identity, and gets one once (O5)", function () {
    const object = synchronized({});
    assert.equal(model.identityOf(object), undefined);
    assert.equal(typeof(model.localIdOf(object)), "number");
    model.setIdentity(object, "n1");
    model.setIdentity(object, "n1");
    assert.equal(model.identityOf(object), "n1");
    assert.throws(() => model.setIdentity(object, "n2"), /never changes/);
    model.clearIdentity(object);
    assert.equal(model.identityOf(object), undefined);
  });

  it("an object of another data model, or another world, is not synchronized here", function () {
    const other = createDataModel(getWorld({ name: "wellspring test: other world" }));
    const foreign = other.synchronized({});
    assert.ok(!isSynchronized(foreign));
    assert.throws(() => { synchronized({}).x = foreign; }, DataModelError);
  });
});

describe("the write check (data model V9, A2, A5)", function () {

  function refused(write, pattern) {
    assert.throws(write, (error) => error instanceof DataModelError && (!pattern || pattern.test(error.message)));
  }

  it("accepts every kind of value", function () {
    const object = synchronized({});
    const target = synchronized({});
    object.s = "text";
    object.n = -0;
    object.b = true;
    object.z = null;
    object.ref = target;
    object.weak = weak(target);
    object.frozen = Object.freeze({ a: 1, list: Object.freeze([1, Object.freeze({ b: new Date(0) })]) });
    object.date = new Date();
    object.map = new Map([["k", target], [1, Object.freeze([1])]]);
    object.set = new Set([1, "a", target]);
    object.bytes = new Uint8Array([1, 2, 3]);
    object.s = undefined;
    assert.equal(object.s, undefined);
  });

  it("refuses what is neither synchronized nor a value", function () {
    const object = synchronized({});
    refused(() => { object.x = {}; }, /Object\.freeze/);
    refused(() => { object.x = []; });
    refused(() => { object.x = () => 1; }, /function/);
    refused(() => { object.x = 10n; }, /bigint/);
    refused(() => { object.x = Symbol("s"); }, /symbol/);
    refused(() => { object.x = new (class Thing {})(); }, /Thing/);
    refused(() => { object.x = world.observable({}); }, /not synchronized/);
    refused(() => { object.x = new WeakRef(synchronized({})); }, /weak\(object\)/);
    refused(() => { object[Symbol("k")] = 1; }, /symbol keys/);
    refused(() => { Object.defineProperty(object, "g", { get() { return 1; }, configurable: true }); }, /function/);
  });

  it("refuses frozen objects that are not frozen data all the way down", function () {
    const object = synchronized({});
    refused(() => { object.x = Object.freeze({ inner: { a: 1 } }); }, /all the way down/);
    refused(() => { object.x = Object.freeze({ ref: synchronized({}) }); }, /only data/);
    refused(() => { object.x = Object.freeze({ map: new Map() }); }, /only data/);
    refused(() => { object.x = Object.freeze({ f() {} }); }, /function/);
    const withAccessor = {};
    Object.defineProperty(withAccessor, "a", { get: () => 1, enumerable: true });
    refused(() => { object.x = Object.freeze(withAccessor); }, /accessors/);
    refused(() => { object.x = Object.freeze(new (class Point { x = 1; })()); });
  });

  it("refuses undefined elements, holes, and named fields in arrays", function () {
    const array = synchronized([1]);
    refused(() => array.push(undefined), /A2/);
    refused(() => { array[0] = undefined; }, /A2/);
    refused(() => { array.label = "x"; }, /A5/);
    refused(() => array.push({}), /Object\.freeze/);
    refused(() => array.splice(0, 0, [1]));
    array.length = 0;
    assert.equal(array.length, 0);
  });

  it("refuses bad keys and values inside maps and sets", function () {
    const object = synchronized({});
    refused(() => { object.x = new Map([[{}, 1]]); });
    refused(() => { object.x = new Map([["k", undefined]]); }, /undefined/);
    refused(() => { object.x = new Set([new Set()]); }, /set/);
  });

  it("refuses before the value is stored", function () {
    const object = synchronized({ a: 1 });
    refused(() => { object.a = {}; });
    assert.equal(object.a, 1);
  });
});

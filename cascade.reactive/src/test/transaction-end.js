import { getWorld } from "../cascade.js";
import assert from "assert";

// A world of its own: its listeners must not see the other tests' writes.
const { observable, repeat, transaction, postponeInvalidations, continueInvalidations, onTransactionEnd } =
  getWorld({ name: "transaction-end test" });

describe("onTransactionEnd()", function () {
  let ends;
  let remove;
  beforeEach(function () {
    ends = 0;
    remove = onTransactionEnd(() => { ends++; });
  });
  afterEach(function () {
    remove();
  });

  it("is called once at the end of a transaction, however much it wrote", function () {
    const object = observable({ a: 1, b: 2, list: observable([]) });
    ends = 0;
    transaction(() => {
      object.a = 10;
      object.b = 20;
      object.list.push(1, 2);
      delete object.a;
    });
    assert.equal(ends, 1);
  });

  it("only at the end of the outermost one", function () {
    const object = observable({ a: 1 });
    ends = 0;
    transaction(() => {
      transaction(() => { object.a = 2; });
      assert.equal(ends, 0);
      object.a = 3;
    });
    assert.equal(ends, 1);
  });

  it("postponeInvalidations() ... continueInvalidations() is a transaction too", function () {
    const object = observable({ a: 1 });
    ends = 0;
    postponeInvalidations();
    object.a = 2;
    object.a = 3;
    assert.equal(ends, 0);
    continueInvalidations();
    assert.equal(ends, 1);
  });

  it("is not called for a transaction that changed nothing", function () {
    const object = observable({ a: 1 });
    ends = 0;
    transaction(() => { object.a = 1; });
    transaction(() => {});
    assert.equal(ends, 0);
  });

  it("a write outside any transaction is a transaction of its own", function () {
    const object = observable({ a: 1, list: observable([]) });
    ends = 0;
    object.a = 2;
    assert.equal(ends, 1);
    object.list.push(1);
    assert.equal(ends, 2);
    delete object.a;
    assert.equal(ends, 3);
  });

  it("ends after the repeaters it set off have run again, and their writes are part of it", function () {
    const source = observable({ value: 1 });
    const derived = observable({ value: 0 });
    repeat(() => { derived.value = source.value * 2; });
    let seen = null;
    ends = 0;
    const removeOther = onTransactionEnd(() => { seen = derived.value; });
    try {
      transaction(() => { source.value = 5; });
    } finally {
      removeOther();
    }
    assert.equal(ends, 1);
    assert.equal(seen, 10);
  });

  it("the first run of a repeater made outside any is one transaction", function () {
    const object = observable({ a: 0, b: 0 });
    ends = 0;
    repeat(() => {
      object.a = 1;
      object.b = 2;
    });
    assert.equal(ends, 1);
  });

  it("a write a listener makes is a transaction of its own, ended right after", function () {
    const object = observable({ a: 1 });
    const log = observable({ count: 0 });
    const calls = [];
    const removeOther = onTransactionEnd(() => {
      calls.push(log.count);
      if (log.count < 2) log.count++;
    });
    try {
      object.a = 2;
    } finally {
      removeOther();
    }
    assert.deepEqual(calls, [0, 1, 2]);
  });

  it("is no longer called once removed", function () {
    const object = observable({ a: 1 });
    remove();
    ends = 0;
    object.a = 2;
    assert.equal(ends, 0);
  });

  it("a listener that always writes is stopped with an error", function () {
    const log = observable({ count: 0 });
    const removeOther = onTransactionEnd(() => { log.count++; });
    try {
      assert.throws(() => { log.count = 100; }, /100 transactions/);
    } finally {
      removeOther();
    }
    // And the world goes on working.
    const object = observable({ a: 1 });
    ends = 0;
    object.a = 2;
    assert.equal(ends, 1);
  });
});

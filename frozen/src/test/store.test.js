import assert from "node:assert/strict";
import { MemoryStore } from "../store/MemoryStore.js";

describe("MemoryStore", () => {
  it("keeps keys ordered and reads prefix ranges", () => {
    const store = new MemoryStore();
    store.transaction((tx) => {
      tx.put("b/2", 2);
      tx.put("a/1", 1);
      tx.put("b/1", 1);
      tx.put("c/1", 1);
    });
    assert.deepEqual(store.keys("b/"), ["b/1", "b/2"]);
    assert.deepEqual(store.range("a/"), [["a/1", 1]]);
  });

  it("lets a transaction see its own writes, merged into ranges", () => {
    const store = new MemoryStore();
    store.transaction((tx) => {
      tx.put("x/1", "one");
      tx.put("x/3", "three");
    });
    store.transaction((tx) => {
      tx.put("x/2", "two");
      tx.delete("x/3");
      assert.equal(tx.get("x/2"), "two");
      assert.equal(tx.get("x/3"), undefined);
      assert.deepEqual(tx.keys("x/"), ["x/1", "x/2"]);
      assert.equal(store.get("x/2"), undefined, "committed state is unchanged until commit");
    });
    assert.deepEqual(store.keys("x/"), ["x/1", "x/2"]);
  });

  it("discards all writes when the transaction throws", () => {
    const store = new MemoryStore();
    store.transaction((tx) => tx.put("k", 1));
    assert.throws(() =>
      store.transaction((tx) => {
        tx.put("k", 2);
        tx.put("other", 3);
        throw new Error("abort");
      }),
    );
    assert.equal(store.get("k"), 1);
    assert.equal(store.has("other"), false);
  });

  it("never aliases stored values", () => {
    const store = new MemoryStore();
    const value = { list: [1] };
    store.transaction((tx) => tx.put("k", value));
    value.list.push(2);
    const read = store.get("k");
    read.list.push(3);
    assert.deepEqual(store.get("k"), { list: [1] });
  });
});

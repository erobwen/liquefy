import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MemoryStore } from "../store/MemoryStore.js";
import { LmdbStore } from "../store/LmdbStore.js";

/** Both stores must behave the same: the database and the collector only know the interface. */
const stores = {
  MemoryStore: () => ({ store: new MemoryStore(), close: () => {} }),
  LmdbStore: () => {
    const path = mkdtempSync(join(tmpdir(), "frozen-store-"));
    const store = new LmdbStore(path, { noSync: true });
    return {
      store,
      close: () => {
        store.close();
        rmSync(path, { recursive: true, force: true });
      },
    };
  },
};

for (const [name, create] of Object.entries(stores)) {
  describe(name, () => {
    let store;
    let close;
    beforeEach(() => ({ store, close } = create()));
    afterEach(() => close());

    it("keeps keys ordered and reads prefix ranges", () => {
      store.transaction((tx) => {
        tx.put("b/2", 2);
        tx.put("a/1", 1);
        tx.put("b/1", 1);
        tx.put("c/1", 1);
        tx.put("B/1", 1); // upper case sorts apart: R/ and r/, T/ and t/ are different key spaces
      });
      assert.deepEqual(store.keys("b/"), ["b/1", "b/2"]);
      assert.deepEqual(store.range("a/"), [["a/1", 1]]);
      assert.deepEqual(store.keys("B/"), ["B/1"]);
    });

    it("lets a transaction see its own writes, merged into ranges", () => {
      store.transaction((tx) => {
        tx.put("x/1", "one");
        tx.put("x/3", "three");
      });
      store.transaction((tx) => {
        tx.put("x/2", "two");
        tx.delete("x/3");
        assert.equal(tx.get("x/2"), "two");
        assert.equal(tx.get("x/3"), undefined);
        assert.equal(tx.has("x/3"), false);
        assert.deepEqual(tx.keys("x/"), ["x/1", "x/2"]);
        assert.deepEqual(tx.range("x/"), [["x/1", "one"], ["x/2", "two"]]);
      });
      assert.deepEqual(store.keys("x/"), ["x/1", "x/2"]);
    });

    it("discards all writes when the transaction throws", () => {
      store.transaction((tx) => tx.put("k", 1));
      assert.throws(() =>
        store.transaction((tx) => {
          tx.put("k", 2);
          tx.put("other", 3);
          tx.delete("k");
          throw new Error("abort");
        }),
      );
      assert.equal(store.get("k"), 1);
      assert.equal(store.has("other"), false);
    });

    it("never aliases stored values", () => {
      const value = { list: [1] };
      store.transaction((tx) => tx.put("k", value));
      value.list.push(2);
      const read = store.get("k");
      read.list.push(3);
      assert.deepEqual(store.get("k"), { list: [1] });
    });

    it("stores the kinds of values the collector uses", () => {
      store.transaction((tx) => {
        tx.put("flag", true);
        tx.put("count", 3);
        tx.put("record", { id: "r1", container: null, explicit: {}, list: [{ $ref: "n1" }] });
      });
      assert.equal(store.get("flag"), true);
      assert.equal(store.get("count"), 3);
      assert.deepEqual(store.get("record"), { id: "r1", container: null, explicit: {}, list: [{ $ref: "n1" }] });
      assert.equal(store.get("missing"), undefined);
    });

    it("tells observers what was read and what a commit wrote", () => {
      const reads = [];
      let committed = null;
      store.transaction((tx) => tx.put("a/1", 1));
      store.observe({ read: (key) => reads.push(key), commit: (writes) => (committed = writes) });
      store.transaction((tx) => {
        tx.get("a/1");
        tx.put("a/2", 2);
        tx.delete("a/1");
      });
      assert.ok(reads.includes("a/1"));
      assert.deepEqual(new Map(committed), new Map([["a/2", 2], ["a/1", undefined]]));
    });
  });
}

describe("MemoryStore", () => {
  it("shows committed state to readers of the store during a transaction", () => {
    const store = new MemoryStore();
    store.transaction((tx) => {
      tx.put("k", 1);
      assert.equal(store.get("k"), undefined, "committed state is unchanged until commit");
    });
    assert.equal(store.get("k"), 1);
  });
});

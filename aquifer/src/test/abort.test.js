import assert from "node:assert/strict";
import { Database } from "../Database.js";
import { MemoryStore } from "../store/MemoryStore.js";
import { random, randomTransaction, seedOptions } from "../fuzz/fuzz.js";
import { reachableFromRoot, checkIntegrity } from "../oracle.js";

class Abort extends Error {}

/** A store whose next transaction can be made to throw after a number of writes. */
class FlakyStore extends MemoryStore {
  failAfter = null;

  transaction(fn) {
    const limit = this.failAfter;
    this.failAfter = null;
    if (limit === null) return super.transaction(fn);
    return super.transaction((tx) => {
      let writes = 0;
      const put = tx.put.bind(tx);
      const remove = tx.delete.bind(tx);
      tx.put = (key, value) => {
        if (writes++ >= limit) throw new Abort();
        put(key, value);
      };
      tx.delete = (key) => {
        if (writes++ >= limit) throw new Abort();
        remove(key);
      };
      return fn(tx);
    });
  }
}

const snapshot = (store) => JSON.stringify(store.range(""));

/**
 * The transaction principle (invariants.md §1): a transaction or collector step that fails
 * midway writes nothing, so the store stays at the last commit, where every invariant holds.
 * Here a fifth of all application transactions and collector steps are made to throw after a
 * random number of writes, as a crash in the middle of one would.
 */
describe("Aborted transactions and collector steps", () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    it(`seed ${seed}`, () => {
      const rng = random(seed);
      let time = 0;
      const store = new FlakyStore();
      let db;
      db = new Database({
        store,
        options: seedOptions(rng, () => time),
        onReclaim: (ids) => {
          const reachable = reachableFromRoot(store);
          for (const id of ids) assert.ok(!reachable.has(id), `reclaimed reachable object ${id}`);
        },
      });
      const clipboard = [];
      let aborted = 0;

      /** Runs `action`, perhaps armed to fail; a failure must leave the store untouched. */
      const attempt = (action) => {
        const before = rng.next() < 0.2 ? snapshot(store) : null;
        if (before !== null) store.failAfter = rng.int(12);
        try {
          action();
        } catch (error) {
          if (!(error instanceof Abort)) throw error;
          aborted++;
          assert.equal(snapshot(store), before, "an aborted transaction wrote nothing");
        }
        store.failAfter = null;
      };

      for (let i = 0; i < 200; i++) {
        time += rng.int(1000);
        attempt(() => randomTransaction(db, rng, clipboard));
        for (let steps = rng.int(4); steps > 0; steps--) attempt(() => db.collector.step());
        assert.deepEqual(checkIntegrity(store), [], `after transaction ${i}`);
      }
      db.collector.runUntilIdle();
      assert.deepEqual(checkIntegrity(store, { quiescent: true }), []);
      assert.equal(db.objectIds().length, reachableFromRoot(store).size);
      assert.ok(aborted > 20, `${aborted} operations were aborted`);
    });
  }
});

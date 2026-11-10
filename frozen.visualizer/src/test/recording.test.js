import assert from "node:assert/strict";
import { MemoryStore, checkIntegrity, reachableFromRoot } from "@liquefy/frozen";
import { Recorder } from "../recording/Recorder.js";
import { scenarios, recordScenario } from "../recording/scenarios.js";
import { describe as describeFrame } from "../view/describe.js";

/** A MemoryStore holding exactly `state`, for the oracle. */
function storeOf(state) {
  const store = new MemoryStore();
  for (const [key, value] of state) store.putCommitted(key, value);
  return store;
}

/** Every change sentence of every frame. */
function allChanges(timeline) {
  const changes = [];
  for (let i = 0; i < timeline.length; i++) {
    changes.push(...describeFrame(timeline.stateAt(i), timeline.stateAt(i - 1), timeline.frame(i)).changes);
  }
  return changes;
}

describe("Recorder and Timeline", () => {
  it("replays to exactly the recorded store, from any checkpoint", () => {
    const recorder = new Recorder({ options: { deferral: 0, regionCap: 6 } });
    for (let i = 0; i < 40; i++) {
      recorder.transaction(`add ${i}`, (tx) => tx.set("root", `f${i % 7}`, { $ref: tx.create({ i }) }));
      recorder.collect({ limit: 2 });
    }
    recorder.collect();
    const timeline = recorder.timeline();
    assert.ok(timeline.length > 64, "long enough to use checkpoints");
    const final = timeline.stateAt(timeline.length - 1);
    assert.deepEqual(new Map(recorder.store.range("")), final);
    // Out of order access gives the same answers as in order.
    const middle = timeline.stateAt(40);
    timeline.stateAt(timeline.length - 1);
    assert.deepEqual(timeline.stateAt(40), middle);
  });

  it("records one frame per transaction and per collector step, with what each step was", () => {
    const recorder = new Recorder({ options: { deferral: 0 } });
    recorder.transaction("create", (tx) => tx.set("root", "a", { $ref: tx.create({}) }));
    recorder.transaction("cut", (tx) => tx.delete("root", "a"));
    const steps = recorder.collect();
    const kinds = recorder.frames.map((frame) => frame.kind);
    assert.deepEqual(kinds.slice(0, 3), ["start", "transaction", "transaction"]);
    assert.equal(kinds.length, 3 + steps);
    assert.deepEqual(kinds.slice(3).filter((kind) => kind !== "structure"), ["deferral", "mark", "check"]);
    assert.ok(recorder.frames.find((frame) => frame.kind === "check").reads.length > 0, "the check read records");
  });
});

describe("Scenarios", () => {
  for (const scenario of scenarios) for (const deferCuts of [true, false]) {
    it(`${scenario.key}, deferred cuts ${deferCuts ? "on" : "off"}: ends consistent and fully collected`, () => {
      const { timeline } = recordScenario(scenario.key, {}, { deferCuts });
      for (let i = 0; i < timeline.length; i++) {
        const view = describeFrame(timeline.stateAt(i), timeline.stateAt(i - 1), timeline.frame(i));
        assert.ok(view.summary, `frame ${i} has a summary`);
        for (const edge of view.edges) {
          assert.ok(view.objects.some((o) => o.id === edge.source) && view.objects.some((o) => o.id === edge.target));
        }
      }
      const store = storeOf(timeline.stateAt(timeline.length - 1));
      assert.deepEqual(checkIntegrity(store, { quiescent: true }), []);
      assert.equal(store.keys("o/").length, reachableFromRoot(store).size);
    });
  }

  it("moving: shows a quick swap, a cancelled deferral and a cohort", () => {
    const changes = allChanges(recordScenario("moving").timeline);
    assert.ok(changes.some((c) => /re-parented/.test(c)), "quick swap");
    assert.ok(changes.some((c) => /deferral ended/.test(c)), "cancelled deferral");
    assert.ok(changes.some((c) => /reclaimed/.test(c)), "collected");
  });

  it("dequeue: finds a replacement parent and reclaims only the dequeued item", () => {
    const changes = allChanges(recordScenario("dequeue").timeline);
    assert.ok(changes.some((c) => /re-parented/.test(c)));
    assert.equal(changes.filter((c) => /reclaimed/.test(c)).length, 1);
  });

  it("rescue: rescues the section in the barrier, then its paragraphs by expanding it", () => {
    const { timeline } = recordScenario("rescue");
    const link = timeline.frames.findIndex((f) => f.label === "Link section 1 from ROOT again");
    const marked = timeline.frame(link - 1);
    assert.equal(marked.kind, "mark", "the step before the link marked the section");
    assert.ok(marked.caption, "with its caption");
    const section = marked.ids[0];
    const atLink = describeFrame(timeline.stateAt(link), timeline.stateAt(link - 1), timeline.frame(link)).changes;
    assert.ok(atLink.includes(`${section} rescued, tree parent root`), atLink.join("\n"));
    const changes = allChanges(timeline);
    assert.ok(changes.filter((c) => /rescued/.test(c)).length >= 4, changes.join("\n"));
  });

  it("regions: splits, flags and merges", () => {
    const { timeline } = recordScenario("regions");
    const outcomes = timeline.frames.filter((f) => f.kind === "structure").map((f) => f.outcome);
    assert.ok(outcomes.includes("split"), outcomes.join());
    assert.ok(outcomes.includes("merged") || outcomes.includes("deleted"), outcomes.join());
    assert.ok(allChanges(timeline).some((c) => /flag .* added/.test(c)));
  });

  it("holds: the held document is pasted back without marking", () => {
    const { timeline } = recordScenario("holds");
    const changes = allChanges(timeline);
    assert.ok(changes.some((c) => /deferred until/.test(c)));
    assert.ok(timeline.frames.some((f) => f.kind === "check" && f.reclaimed), "the released one is collected");
  });

  it("random: records any seed", () => {
    for (const seed of [1, 2, 3]) {
      const { timeline } = recordScenario("random", { seed, transactions: 30 });
      assert.ok(timeline.length > 10);
    }
  });
});

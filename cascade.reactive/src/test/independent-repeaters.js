import { getWorld } from "../cascade.js";
import assert from "assert";

// repeat(action, {independent: true}): a repeater created from inside
// another repeater's run that is nonetheless a pipeline of its own - not a
// child, not part of the creator's partial chain, not retracted along with
// it - at the creator's own time level unless told otherwise. The two are
// then *parallel* pipelines (see parallel-pipelines.js): each reads the
// other's latest writings. The creator owns its lifecycle
// (retractRepeater()/restart()), and can pull a fresh result out of it
// mid-run with refreshIfNeeded().
describe("independent repeaters ({independent: true})", function () {
  function world() {
    return getWorld({ name: "independent-repeaters-" + Math.random() });
  }

  function childEntries(repeater) {
    const entries = [];
    for (let node = repeater.children.first; node !== null; node = node.nextSibling) entries.push(node);
    return entries;
  }

  it("is its own pipeline: no parent, its own chain, not among the creator's children", function () {
    const { repeat } = world();
    let independent;
    const creator = repeat(() => {
      if (!independent) independent = repeat(() => {}, { independent: true });
    });

    assert.equal(independent.parentRepeater, null);
    assert.notEqual(independent.chainHead, creator.chainHead);
    assert.equal(independent.chainHead.rootRepeater, independent);
    // Only the creator's own single partial - no child repeater, and no
    // extra partial boundary the way creating an ordinary child opens one.
    const entries = childEntries(creator);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].type, "partial");
  });

  it("takes the creator's time level, unless given one of its own", function () {
    const { repeat } = world();
    let inherited, explicit, topLevel;
    repeat(() => {
      if (!inherited) {
        inherited = repeat(() => {}, { independent: true });
        explicit = repeat(() => {}, { independent: true, time: 2 });
      }
    }, { time: 1 });
    topLevel = repeat(() => {}, { independent: true });

    assert.equal(inherited.time(), 1);
    assert.equal(explicit.time(), 2);
    assert.equal(topLevel.time(), 0);
  });

  it("survives its creator's reruns, and keeps reacting to its own dependencies", function () {
    const { observable, repeat } = world();
    const creatorInput = observable({ tick: 0 });
    const ownInput = observable({ n: 1 });
    let independent;
    let independentSaw = [];

    const creator = repeat(() => {
      void creatorInput.tick;
      if (!independent) {
        independent = repeat(() => { independentSaw.push(ownInput.n); }, { independent: true });
      }
    });

    creatorInput.tick = 1; // creator reruns without recreating or relinking it
    assert.ok(!independent.retracted, "not retracted with its creator's rerun, the way an unrelinked child would be");

    ownInput.n = 2;
    assert.deepEqual(independentSaw, [1, 2]);
    assert.ok(creator);
  });

  it("each sees the other's latest writings - creator writes its input, reads its output", function () {
    const { observable, repeat } = world();
    const model = observable({ request: 1 });
    const context = observable({ input: null });
    const component = observable({ output: null });
    let independent;
    const creatorSaw = [];

    repeat(() => {
      context.input = model.request * 10;
      if (!independent) {
        independent = repeat(() => { component.output = context.input + 1; }, { independent: true });
      }
      creatorSaw.push(component.output);
    });
    assert.deepEqual(creatorSaw, [11]);

    model.request = 2;
    assert.equal(component.output, 21);
    assert.equal(creatorSaw[creatorSaw.length - 1], 21);
  });

  it("refreshIfNeeded() pulls a pending result mid-run instead of reading a retracted one", function () {
    const { observable, repeat, postponeInvalidations, continueInvalidations, refreshIfNeeded } = world();
    const trigger = observable({ tick: 0 });
    const input = observable({ n: 1 });
    const component = observable({ output: null });
    let independent;
    let independentRuns = 0;
    const creatorSaw = [];

    repeat(() => {
      void trigger.tick;
      if (!independent) {
        independent = repeat(() => {
          independentRuns++;
          component.output = input.n + 1;
        }, { independent: true });
      }
      refreshIfNeeded(independent);
      creatorSaw.push(component.output);
    });
    assert.deepEqual(creatorSaw, [2]);

    // Both invalidated at once, the creator's trigger first - so the
    // creator's pipeline runs while the independent one is still queued,
    // its previous output already retracted.
    postponeInvalidations();
    trigger.tick = 1;
    input.n = 5;
    continueInvalidations();

    assert.deepEqual(creatorSaw, [2, 6], "the creator got the fresh result in the same run, never the retracted one");
    assert.equal(independentRuns, 2, "pulled once - the queued pipeline found nothing left to do");

    // Pulling it early must not leave it unschedulable afterwards.
    input.n = 7;
    assert.equal(independentRuns, 3);
    assert.equal(component.output, 8);
    assert.equal(creatorSaw[creatorSaw.length - 1], 8);
  });

  it("a pull right after the creator rewrites the repeater's input gets the fresh result, with no extra creator rerun", function () {
    // The creator's rewrite of an already-existing writing only notifies
    // readers when its partial closes - refreshIfNeeded() is a hand-over
    // point that settles it first, the same as a child boundary would.
    const { observable, repeat, refreshIfNeeded } = world();
    const model = observable({ request: 1 });
    const context = observable({ input: null });
    const component = observable({ output: null });
    let independent;
    const creatorSaw = [];

    repeat(() => {
      context.input = model.request * 10;
      if (!independent) {
        independent = repeat(() => { component.output = context.input + 1; }, { independent: true });
      }
      refreshIfNeeded(independent);
      creatorSaw.push(component.output);
    });

    model.request = 2;
    assert.deepEqual(creatorSaw, [11, 21]);
  });

  it("retractRepeater() stops it - its writings retracted - and restart() brings it back", function () {
    const { observable, repeat, retractRepeater } = world();
    const input = observable({ n: 1 });
    const component = observable({ output: "none" });
    let runs = 0;
    const independent = repeat(() => {
      runs++;
      component.output = input.n;
    }, { independent: true });

    retractRepeater(independent);
    assert.equal(component.output, "none", "its writing is retracted, the value below shows through");
    input.n = 2;
    assert.equal(runs, 1, "no longer reacting");

    independent.restart();
    assert.ok(!independent.retracted);
    assert.equal(runs, 2);
    assert.equal(component.output, 2);

    input.n = 3;
    assert.equal(runs, 3, "reacting again");
    assert.equal(component.output, 3);
  });
});

import { getWorld } from "../cascade.js";
import assert from "assert";

// Two pipelines (independent root repeaters, each with its own chainHead)
// at the same time level have no execution order relating them - they run
// in parallel, in a sense. See compareWritingToReader() in cascade.js for
// the rule:
//
//  - A reader sees a parallel pipeline's *latest* writing of a property -
//    regardless of which pipeline happened to be created first (before this
//    rule, same-level pipelines were ordered by their chains' creation ids,
//    so a pipeline created later - like a component's build repeater
//    created from inside its render - had its writes sorted after, and
//    invisible to, the pipeline that created it).
//  - Each property has at most one writer pipeline per time level at a
//    time; a second one writing it too throws.
//  - Different time levels, and external/initial-time writes (writer null,
//    the time-0 baseline), are unaffected.
describe("parallel pipelines (same time level, different root repeaters)", function () {
  function world() {
    return getWorld({ name: "parallel-pipelines-" + Math.random() });
  }

  it("a reader sees a parallel pipeline's latest writing, whichever pipeline was created first", function () {
    const { observable, repeat } = world();
    const model = observable({ value: 0 });

    // Reader first (the lower chain id), writer second.
    let seenByEarlierReader;
    repeat(() => { seenByEarlierReader = model.value; });
    const writer = repeat(() => {
      model.value = 1;
      model.value = 2;
    });
    assert.equal(seenByEarlierReader, 2);

    // And a reader created after the writer.
    let seenByLaterReader;
    repeat(() => { seenByLaterReader = model.value; });
    assert.equal(seenByLaterReader, 2);

    assert.ok(writer);
  });

  it("a parallel reader reruns when the writer pipeline's latest writing changes", function () {
    const { observable, repeat } = world();
    const input = observable({ n: 1 });
    const output = observable({ doubled: null });

    let readerRuns = 0;
    let seen;
    repeat(() => {
      readerRuns++;
      seen = output.doubled;
    });
    repeat(() => { output.doubled = input.n * 2; });
    assert.equal(seen, 2);

    input.n = 5;
    assert.equal(seen, 10);

    // Same value again: no rerun of the reader.
    const runsBefore = readerRuns;
    input.n = 5;
    assert.equal(readerRuns, runsBefore);
  });

  it("when the writer pipeline stops writing a property, a parallel reader falls back to whatever is below it", function () {
    const { observable, repeat } = world();
    const model = observable({ value: "baseline" });
    const control = observable({ writes: true });

    let seen;
    repeat(() => { seen = model.value; });
    repeat(() => {
      if (control.writes) model.value = "written";
    });
    assert.equal(seen, "written");

    control.writes = false;
    assert.equal(seen, "baseline");
  });

  it("a second pipeline writing the same property at the same time level throws", function () {
    const { observable, repeat } = world();
    const model = observable({ value: 0 });

    repeat("owner", () => { model.value = 1; });
    assert.throws(
      () => repeat("intruder", () => { model.value = 2; }),
      /'value'.*time level 0.*'owner'.*'intruder'/
    );
  });

  it("the claim lasts only while the owner's writing is live - once retracted, another pipeline may take the property over", function () {
    const { observable, repeat } = world();
    const model = observable({ value: 0 });
    const control = observable({ ownerWrites: true });

    repeat("owner", () => {
      if (control.ownerWrites) model.value = 1;
    });
    control.ownerWrites = false;

    let seen;
    assert.doesNotThrow(() => repeat("successor", () => { model.value = 2; }));
    repeat(() => { seen = model.value; });
    assert.equal(seen, 2);
  });

  it("pipelines at different time levels may write the same property, and external/initial-time writes claim nothing", function () {
    const { observable, repeat, accessInitialValues } = world();
    const model = observable({ value: 0 });

    repeat(() => { model.value = 1; }, { time: 0 });
    assert.doesNotThrow(() => repeat(() => { model.value = model.value + 10; }, { time: 1 }));

    assert.doesNotThrow(() => { model.value = 100; }); // external - the baseline
    assert.doesNotThrow(() => repeat(() => {
      accessInitialValues(() => { model.value = 200; }); // initial time - also the baseline
    }));
  });

  it("a pipeline created from inside another's run: each sees the other's latest writing (the build/render shape)", function () {
    // Stands in for a component's build repeater running as its own
    // pipeline, created from inside its render repeater - accessInitialValues
    // gives a top-level repeater from inside another one today (see
    // docs/plan-flagged-scheduling.md). Before the parallel-pipeline rule,
    // render read `newBuild` as undefined: the build pipeline's chain was
    // created later, so its writing sorted after render's read.
    const { observable, repeat, accessInitialValues } = world();
    const component = observable({ newBuild: undefined });
    const context = observable({ locator: null });
    let buildRepeater = null;
    let seenByRender;
    let seenByBuild;

    repeat("render", () => {
      context.locator = "L1"; // render writes its context...
      if (!buildRepeater) {
        accessInitialValues(() => {
          buildRepeater = repeat("build", () => {
            seenByBuild = context.locator; // ...the build reads it (latest)...
            component.newBuild = "built with " + context.locator;
          });
        });
      }
      seenByRender = component.newBuild; // ...and render reads the build's result (latest).
    });

    assert.equal(seenByBuild, "L1");
    assert.equal(seenByRender, "built with L1");
  });
});

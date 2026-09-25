import { getWorld } from "../cascade.js";
import assert from "assert";

// A repeater invalidated while it's running - reachable through the two
// eager kinds of notification: a write from a parallel pipeline (an
// independent repeater it pulled), or a write at initial time
// (accessInitialValues()). It's never disposed mid-run (that crashed it
// finishing); a read of its previous run it hasn't reached yet is simply
// superseded, and a read it has already made gets it rerun right after.
// The shape is a component's render: it pulls independent build repeaters,
// reads their results, and has children of its own.
describe("invalidated while running", function () {
  function world() {
    return getWorld({ name: "invalidated-while-running-" + Math.random() });
  }

  it("a read of its previous run, not reached yet, rewritten by a repeater it pulls: no crash, and no rerun for it", function () {
    const { observable, repeat, refreshIfNeeded } = world();
    const input = observable({ n: 1 });
    const shared = observable({ value: 0 });
    const out = observable({ read: null });
    let reader;
    let writer;
    const seen = [];
    // Null during its own first run - ordinary scheduling then.
    let puller = null;
    puller = repeat(() => {
      if (!reader) reader = repeat(() => { out.read = shared.value; }, { independent: true, pulledBy: () => puller });
      if (!writer) writer = repeat(() => { shared.value = input.n * 10; }, { independent: true });
      // A new, unkeyed child every run: reconciliation stops here, so the
      // previous run's partial after it keeps its sources until the end.
      repeat(() => { input.n; });
      refreshIfNeeded(reader);
      refreshIfNeeded(writer);
      refreshIfNeeded(reader); // rewrites out.read - read by that old partial
      seen.push(out.read);
    });
    assert.deepEqual(seen, [10]);

    input.n = 2;
    assert.deepEqual(seen, [10, 20], "ran once for it, and saw the new value");
    input.n = 3;
    assert.deepEqual(seen, [10, 20, 30]);
  });

  it("a read it has already made this run, changed later in the run by a repeater it pulls: rerun right after, not left stale", function () {
    const { observable, repeat, refreshIfNeeded } = world();
    const input = observable({ n: 1 });
    const shared = observable({ value: 0 });
    const out = observable({ read: null });
    let reader;
    let writer;
    const seen = [];
    let puller = null;
    puller = repeat(() => {
      if (!reader) reader = repeat(() => { out.read = shared.value; }, { independent: true, pulledBy: () => puller });
      // Only run when pulled, like a build - so it runs mid-run, not before.
      if (!writer) writer = repeat(() => { shared.value = input.n * 10; }, { independent: true, pulledBy: () => puller });
      refreshIfNeeded(reader);
      seen.push(out.read);     // read - then made stale by what follows
      refreshIfNeeded(writer);
      refreshIfNeeded(reader); // rewrites out.read, already read this run
    });
    assert.equal(seen[seen.length - 1], 10, "settled on the value it ended up with");

    input.n = 2;
    assert.equal(seen[seen.length - 1], 20);
  });

  it("the same, at initial time (accessInitialValues(), as setState() writes)", function () {
    const { observable, repeat, refreshIfNeeded, accessInitialValues } = world();
    const input = observable({ n: 1 });
    const shared = observable({ value: 0 });
    const seen = [];
    let writer;
    let puller = null;
    puller = repeat(() => {
      if (!writer) {
        writer = repeat(() => {
          const value = input.n * 10;
          accessInitialValues(() => { shared.value = value; });
        }, { independent: true, pulledBy: () => puller });
      }
      seen.push(shared.value); // read - then rewritten at initial time
      refreshIfNeeded(writer);
    });
    assert.equal(seen[seen.length - 1], 10);

    input.n = 2;
    assert.equal(seen[seen.length - 1], 20);
  });
});

import { getWorld } from "../cascade.js";
import assert from "assert";

// A repeater can be retracted by its own run: something its action brings
// up to date first decides it's gone - a component's render bringing its
// creator's build up to date (see cascade.component's renderOnto()), and
// that build no longer constructing the component at all. Found through
// cascade.ui's popover test: an overlay frame's sub-frame, dropped by the
// very rebuild its own frame element pulled. Its run then goes on, and
// finishes: whatever it does after the retraction - a child, a writing -
// must go with it, not be left behind, and refresh() must not finish a
// run whose partial is already disposed.
describe("a repeater retracted while it runs", function () {
  it("leaves nothing behind - neither what it did before, nor what it did after - and doesn't run again", function () {
    const { observable, repeat, retractRepeater } = getWorld({ name: "retracted-while-running-" + Math.random() });
    const model = observable({ before: 1, after: 1 });
    const output = observable({ value: "none" });
    let runs = 0;
    let childRuns = 0;
    let self = null;
    let child = null;
    repeat(() => {
      self = repeat(() => {
        runs++;
        // Read before the retraction...
        model.before;
        if (runs === 2) retractRepeater(self);
        // ...and after it: a child, and a writing.
        child = repeat(() => {
          childRuns++;
          model.after;
        });
        output.value = "written by run " + runs;
      });
    });
    assert.strictEqual(output.value, "written by run 1");

    // The second run retracts it - and finishes, without throwing.
    model.before = 2;
    assert.strictEqual(runs, 2);
    assert.ok(self.retracted, "retracted");
    assert.ok(child.retracted, "what it made after the retraction - retracted with it");
    assert.strictEqual(output.value, "none", "what it wrote - gone with it");

    // Subscribed to nothing: neither its own reads nor its child's run it again.
    const childRunsBefore = childRuns;
    model.before = 3;
    model.after = 2;
    assert.strictEqual(runs, 2);
    assert.strictEqual(childRuns, childRunsBefore);
  });
});

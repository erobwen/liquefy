import { getWorld } from "../cascade.js";
import assert from "assert";

// Retracting a tree of repeaters takes all of it down together: nothing in
// it runs again on the way - not even a repeater reading what another one,
// retracted before it, wrote. Retraction undoes a repeater's writings (its
// output is gone, so whoever read it has to recompute), and undoing them
// tells their readers. Retracted one repeater at a time, each undoing its
// writings as soon as it's done, the readers still standing in the same
// tree would rerun - against what was there before those writings, with
// the rest of what they depend on half gone. Found with Tabula's paper
// layout: a section writes where the next paragraph goes on the paper
// sequence it renders onto, a paragraph after it reads that - retracting
// the layout ran the paragraph again, from nowhere (null), and it threw.
describe("retracting a tree of repeaters", function () {
  function world() {
    return getWorld({ name: "retract-subtree-" + Math.random() });
  }

  it("runs nothing in it again - a reader after a retracted writer isn't rerun against what's undone", function () {
    const { observable, repeat, retractRepeater } = world();
    // A render target of sorts: where the next thing goes.
    const target = observable({ next: null });
    const placed = [];
    const root = repeat(() => {
      // A section starting its paper...
      repeat(() => {
        target.next = { y: 10 };
      });
      // ...and a paragraph after it, placing itself from there - which
      // can't, from nowhere.
      repeat(() => {
        const { y } = target.next;
        placed.push(y);
      });
    }, { independent: true });
    assert.deepStrictEqual(placed, [10]);

    retractRepeater(root);
    assert.deepStrictEqual(placed, [10], "nothing in the tree ran again");
    assert.strictEqual(target.next, null, "and what it wrote is undone");
  });

  it("still tells readers outside the tree - their input is gone, so they rerun", function () {
    const { observable, repeat, retractRepeater } = world();
    const target = observable({ next: null });
    const root = repeat(() => {
      repeat(() => {
        target.next = { y: 10 };
      });
    }, { independent: true });
    const seen = [];
    repeat(() => {
      seen.push(target.next && target.next.y);
    });
    assert.deepStrictEqual(seen, [10]);

    retractRepeater(root);
    assert.deepStrictEqual(seen, [10, null]);
  });

  it("can be relinked and run again after - as a retracted child always could", function () {
    const { observable, repeat } = world();
    const model = observable({ shown: true, y: 10 });
    const target = observable({ next: null });
    const placed = [];
    repeat(() => {
      if (!model.shown) return;
      repeat(() => {
        target.next = { y: model.y };
      });
      repeat(() => {
        placed.push(target.next.y);
      });
    });
    assert.deepStrictEqual(placed, [10]);

    // Dropped by its parent's rerun: retracted - nothing runs.
    model.shown = false;
    assert.deepStrictEqual(placed, [10]);

    // Back: built and run anew.
    model.y = 20;
    model.shown = true;
    assert.deepStrictEqual(placed, [10, 20]);
  });
});

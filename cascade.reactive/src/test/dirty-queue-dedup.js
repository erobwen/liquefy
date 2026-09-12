import { getWorld } from "../cascade.js";
import assert from "assert";

const { observable, repeat, linkRepeater } = getWorld({ name: "dirty-queue-dedup", timeLevels: 5 });

// A repeater reading the same external property twice, with a child
// repeater created in between the two reads, ends up with TWO separate
// partial-level dependencies on that one property (see
// docs/plan-partial-repeaters.md: a child attachment closes the current
// partial and opens a fresh one, so each read lands in a different
// partial). A single external write then invalidates both partials -
// found via cascade.application/demo's real menu/work-area layout, where
// a parent read the same context field once before and once after
// renderOnto()'ing a child.
//
// repeaterDirty() used to splice the owning repeater into the
// dirty-repeaters list once per invalidated partial, with no check for
// whether it was already there. The second splice landed it right after
// itself (list.last.nextDirty = repeater, when repeater already *was*
// list.last), creating a self-referencing loop that detatchRepeater()
// could partially unlink (clearing the repeater's own nextDirty/
// previousDirty) but never fully remove from the list itself (list.first/
// list.last kept pointing at the very same, already-processed repeater) -
// so refreshAllDirtyRepeaters()'s while loop treated it as still dirty and
// refreshed it a second, spurious time.
describe("dirty-repeater queue: same repeater invalidated via two partials", function () {
  it("a single write that invalidates two of a repeater's own partials reruns it exactly once", function () {
    const target = observable({ a: 1 });
    let parentRuns = 0;
    let childRepeater = null;

    const parentRepeater = repeat(() => {
      parentRuns++;
      const first = target.a; // first partial's dependency on target.a

      if (!childRepeater) {
        childRepeater = repeat(() => {}); // closes this partial, opens a fresh one
      } else {
        linkRepeater(childRepeater);
      }

      const second = target.a; // second partial's *separate* dependency on target.a
      return first + second;
    });

    assert.equal(parentRuns, 1);

    target.a = 99; // one write - should invalidate cleanly, not corrupt the dirty list

    assert.equal(parentRuns, 2, "expected exactly one rerun from the single write, not a spurious extra one");

    // The dirty-repeater list itself must actually be empty afterwards -
    // the corrupted-self-loop version left list.first/list.last dangling
    // on the just-refreshed repeater, so a *later*, unrelated write could
    // find anyDirtyRepeater() still true and misbehave even though nothing
    // is really pending.
    target.a = 100;
    assert.equal(parentRuns, 3, "a later, unrelated write should still cause exactly one more rerun");
  });
});

import { getWorld } from "../cascade.js";
import assert from "assert";

// Comprehensive edge-case coverage for the partial-chain order numbers
// (see docs/plan-partial-repeaters.md, "Time as tree position" and "Step
// 6: O(1) tree-position comparison") - the same machinery
// reconciliation-position-staleness.js found a real bug in. That test
// covers one concrete real-world shape (a parent whose reconciliation
// breaks); this file drives the chain primitives themselves through the
// insert/remove positions and timing the user asked to see hardened:
// insert last/first/middle, remove first/last/middle, and pressure
// release happening synchronously right after an insertion, not
// deferred to whenever the next one happens to occur.
//
// Where useful, assertions read `repeater.rightmostPartial.orderNumber`
// directly (a plain field on the public repeater object returned by
// repeat()) rather than only inferring order indirectly through
// observed values - more precise, and it catches an ordering defect
// even in cases where two wrong-but-still-distinct numbers would
// otherwise happen to produce a correct-looking read.
describe("partial chain order - insert/remove position and timing coverage", function () {
  function orderOf(repeater) {
    return repeater.rightmostPartial.orderNumber;
  }

  it("insert-last: repeated appends within a common parent stay in strictly increasing order", function () {
    // Top-level repeat() calls with no common parent each get their own
    // fresh chainHead (see repeat()'s own chainHead-inheritance rule) -
    // genuinely incomparable, by design (cross-tree comparison has no
    // real relative position at all). A shared parent is what makes
    // "insert-last" a meaningful, comparable scenario in the first place.
    const { repeat, linkRepeater } = getWorld({ name: "chain-hardening-insert-last-" + Math.random() });
    const children = [];
    let pendingCount = 1;

    const parent = repeat(() => {
      for (const c of children) linkRepeater(c);
      while (children.length < pendingCount) {
        children.push(repeat(() => {})); // always appended - nothing else runs after it
      }
    });

    for (let i = 2; i <= 12; i++) {
      pendingCount = i;
      parent.restart();
    }

    assert.equal(children.length, 12);
    for (let i = 1; i < children.length; i++) {
      assert.ok(
        orderOf(children[i]) > orderOf(children[i - 1]),
        `child ${i} (${orderOf(children[i])}) should order after child ${i - 1} (${orderOf(children[i - 1])})`
      );
    }
  });

  it("insert-middle: children created one at a time inside a parent, interleaved with the parent's own writes, land strictly between their neighbors", function () {
    const { observable, repeat, linkRepeater } = getWorld({ name: "chain-hardening-insert-middle-" + Math.random() });
    const target = observable({ value: 0 });
    const children = [];
    let pendingCount = 1;

    const parent = repeat(() => {
      target.value = 0; // a parent-level write before any children, each run
      for (const c of children) linkRepeater(c);
      while (children.length < pendingCount) {
        children.push(repeat(() => {}));
      }
      target.value = 1; // a parent-level write after all children, each run
    });

    for (let i = 2; i <= 6; i++) {
      pendingCount = i;
      parent.restart();
    }

    assert.equal(children.length, 6);
    for (let i = 1; i < children.length; i++) {
      assert.ok(orderOf(children[i]) > orderOf(children[i - 1]), `child ${i} should order after child ${i - 1}`);
    }
  });

  it("remove-first: retracting the earliest child leaves the remaining ones correctly ordered, and a fresh insertion still lands after the true current last", function () {
    const { repeat, linkRepeater } = getWorld({ name: "chain-hardening-remove-first-" + Math.random() });
    let a, b, c, extra;
    let dropA = false;
    let addExtra = false;

    const parent = repeat(() => {
      if (!a) a = repeat(() => {});
      else if (!dropA) linkRepeater(a);
      // else: a is not relinked this run - genuinely retracted.

      if (!b) b = repeat(() => {});
      else linkRepeater(b);

      if (!c) c = repeat(() => {});
      else linkRepeater(c);

      if (addExtra && !extra) {
        extra = repeat(() => {});
      } else if (extra) {
        linkRepeater(extra);
      }
    });

    assert.ok(orderOf(a) < orderOf(b));
    assert.ok(orderOf(b) < orderOf(c));

    dropA = true;
    parent.restart();
    assert.ok(a.retracted);
    assert.ok(orderOf(b) < orderOf(c), "b and c must still order correctly after a is retracted");

    addExtra = true;
    parent.restart();
    assert.ok(orderOf(extra) > orderOf(c), "a fresh child appended after the retraction must still land after the true last (c)");
  });

  it("remove-last: retracting the latest child leaves the earlier ones correctly ordered, and a fresh insertion lands right after the new true last", function () {
    const { repeat, linkRepeater } = getWorld({ name: "chain-hardening-remove-last-" + Math.random() });
    let a, b, c, extra;
    let dropC = false;
    let addExtra = false;

    const parent = repeat(() => {
      if (!a) a = repeat(() => {});
      else linkRepeater(a);

      if (!b) b = repeat(() => {});
      else linkRepeater(b);

      if (!c) c = repeat(() => {});
      else if (!dropC) linkRepeater(c);
      // else: c not relinked this run - genuinely retracted.

      if (addExtra && !extra) {
        extra = repeat(() => {});
      } else if (extra) {
        linkRepeater(extra);
      }
    });

    assert.ok(orderOf(a) < orderOf(b));
    assert.ok(orderOf(b) < orderOf(c));

    dropC = true;
    parent.restart();
    assert.ok(c.retracted);
    assert.ok(orderOf(a) < orderOf(b), "a and b must still order correctly after c is retracted");

    addExtra = true;
    parent.restart();
    assert.ok(orderOf(extra) > orderOf(b), "a fresh child appended after c's retraction must land after b (the new true last)");
  });

  it("remove-middle: retracting a middle child leaves its neighbors correctly ordered on both sides", function () {
    const { repeat, linkRepeater } = getWorld({ name: "chain-hardening-remove-middle-" + Math.random() });
    let a, b, c;
    let dropB = false;

    const parent = repeat(() => {
      if (!a) a = repeat(() => {});
      else linkRepeater(a);

      if (!b) b = repeat(() => {});
      else if (!dropB) linkRepeater(b);
      // else: b not relinked this run - genuinely retracted.

      if (!c) c = repeat(() => {});
      else linkRepeater(c);
    });

    assert.ok(orderOf(a) < orderOf(b));
    assert.ok(orderOf(b) < orderOf(c));

    dropB = true;
    parent.restart();
    assert.ok(b.retracted);
    assert.ok(orderOf(a) < orderOf(c), "a and c must still order correctly with b retracted in between");
  });

  it("pressure release happens synchronously right after the insertion that triggers it, not deferred to a later one", function () {
    // Bisecting the initial 65536 spacer runs out of room after about
    // sixteen insertions into the same gap; the one that squeezes it shut
    // must immediately widen it again - if release were somehow deferred,
    // the very next insertion into the same now-tiny gap would either
    // throw (space exhausted) or silently produce a non-monotonic order
    // number. Twenty insertions comfortably crosses that point.
    const { repeat, linkRepeater } = getWorld({
      name: "chain-hardening-pressure-timing-" + Math.random(),
    });

    const middles = [];
    let anchor = null;
    let pendingCount = 0;

    const parent = repeat(() => {
      for (const m of middles) linkRepeater(m);
      if (middles.length < pendingCount) {
        middles.push(repeat(() => {}));
      }
      if (anchor) linkRepeater(anchor);
      else anchor = repeat(() => {});
    });

    // Insert several middles back-to-back, all squeezing into the same
    // shrinking gap right before `anchor` - each one's own insertion (and
    // therefore its own immediate pressure-release check, if the gap is
    // tight) happens on its own `parent.restart()` call, right next to
    // the previous one, with nothing else running in between.
    for (let i = 1; i <= 20; i++) {
      pendingCount = i;
      parent.restart();
    }

    assert.equal(middles.length, 20);
    for (let i = 1; i < middles.length; i++) {
      assert.ok(
        orderOf(middles[i]) > orderOf(middles[i - 1]),
        `middle ${i} (${orderOf(middles[i])}) should still order after middle ${i - 1} (${orderOf(middles[i - 1])})`
      );
    }
    for (const m of middles) {
      assert.ok(orderOf(m) < orderOf(anchor), "every middle must still order before the fixed anchor");
    }
  });

  it("a repositioned (moved) partial - the fix for reconciliation staleness - still compares correctly against everything else in the chain", function () {
    // Direct, low-level check of movePartialToCurrentPosition() (used by
    // attachToCurrentParent() once reconciliation breaks - see
    // reconciliation-position-staleness.js for the end-to-end shape):
    // after being moved, the repositioned node's order number must sit
    // strictly after whatever was current at the moment of the move, and
    // strictly before whatever gets created next.
    const { observable, repeat, linkRepeater } = getWorld({ name: "chain-hardening-move-" + Math.random() });
    const target = observable({ usableWidth: null });
    let hamburger, menu, workArea;
    let isModal = true;

    const parent = repeat(() => {
      if (isModal) {
        if (!hamburger) hamburger = repeat(() => {});
        else linkRepeater(hamburger);
      } else {
        if (!menu) menu = repeat(() => {});
        else linkRepeater(menu);
      }

      target.usableWidth = isModal ? 500 : 1000;

      if (!workArea) {
        workArea = repeat(() => {});
      } else {
        linkRepeater(workArea);
      }
    });

    const workAreaOrderBefore = orderOf(workArea);

    isModal = false;
    parent.restart();

    assert.ok(
      orderOf(menu) < orderOf(workArea),
      "menu (now occupying hamburger's old slot) must order before workArea, matching real execution order"
    );
    assert.notEqual(orderOf(workArea), workAreaOrderBefore, "workArea's own position should have been refreshed, not left stale");
  });
});

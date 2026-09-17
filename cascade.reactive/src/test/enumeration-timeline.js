import { getWorld } from "../cascade.js";
import assert from "assert";

// The reserved enumeration timeline (key composition - Object.keys/for-in/
// hasOwnProperty) used to invalidate every current reader, at every
// position, on any key add/remove (see invalidateEnumerateObservers in
// defaultDependencyInterface.js): recordDependencyOnEnumeration never
// recorded a reader's own time/writer, and getOrCreateEnumerationTimelineWriting
// always sought the fixed (0, null) position regardless of who was asking.
// So a key added by a *later* repeater could reach a reader positioned
// *before* it - the exact backward-reach bug class flush.js's own tests
// are careful to route around via arrays instead. Now each reader's real
// position is recorded, and only readers positioned strictly after a given
// key add/remove are invalidated (see invalidateDownstreamEnumerationObservers
// in cascade.js) - the same forward-only rule a plain property write
// already gets.
const { observable, repeat } = getWorld({ name: "enumeration-timeline", timeLevels: 1 });

describe("enumeration dependency (position-aware: a key add/remove only invalidates readers positioned after it)", function () {

  it("a reader positioned before a key addition is left alone; one positioned after it reruns", function () {
    const model = observable({});
    const trigger = observable({ addKey: false });
    let earlyRunCount = 0;
    let lateRunCount = 0;
    let lateKeysSeen = null;

    repeat(() => { // root - single pipeline, so position is purely tree order
      repeat(() => { // "early" - structurally first; depends only on model's key composition
        earlyRunCount++;
        void Object.keys(model);
      });
      repeat(() => { // "middle" - structurally second; adds a key once triggered
        if (trigger.addKey) model.extra = "value";
      });
      repeat(() => { // "late" - structurally third; depends on model's key composition too
        lateRunCount++;
        lateKeysSeen = Object.keys(model);
      });
    });

    assert.equal(earlyRunCount, 1);
    assert.equal(lateRunCount, 1);
    assert.deepEqual(lateKeysSeen, []);

    trigger.addKey = true;

    assert.equal(earlyRunCount, 1, "early ran before the key was added and must not be invalidated by it");
    assert.equal(lateRunCount, 2, "late ran after the key was added and must be invalidated by it");
    assert.deepEqual(lateKeysSeen, ["extra"]);
  });

});

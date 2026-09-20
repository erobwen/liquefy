import { getWorld } from "../cascade.js";
import assert from "assert";

// declareState() (see cascade.js): some of an observable's properties are
// *state* rather than ordinary properties - initialized once, written
// afterwards only from outside any repeater (an event handler) or
// deliberately at initial time (accessInitialValues()), and never reset by
// a rebuild. See cascade.component/README.md, "Component state and
// properties", for the design this implements.
const { observable, repeat, declareState, accessInitialValues, retractRepeater, postponeInvalidations, continueInvalidations } =
  getWorld({ name: "state-properties", timeLevels: 3 });

describe("state properties (declareState)", function () {

  it("defaults are readable, and a write from outside any repeater (event-handler style) is allowed and invalidates readers", function () {
    const model = observable({ label: "x" });
    declareState(model, { count: 0 });

    let seen;
    repeat(() => { seen = model.count; });
    assert.equal(seen, 0);

    model.count = 1; // outside any repeater - the event-handler case
    assert.equal(seen, 1);
  });

  it("a write from inside a repeater, via accessInitialValues(), is allowed - the sanctioned way to write state from a pipeline", function () {
    const model = observable({});
    declareState(model, { openId: null });
    const trigger = observable({ fire: false });

    let seen;
    repeat(() => {
      repeat(() => { seen = model.openId; });
      repeat(() => {
        if (trigger.fire) accessInitialValues(() => { model.openId = "settings"; });
      });
    });
    assert.equal(seen, null);

    trigger.fire = true;
    assert.equal(seen, "settings");
  });

  it("a rebuild copies properties onto the established object but leaves state alone", function () {
    const source = observable({ label: "a" });
    class Item {
      constructor(label) { this.label = label; }
    }

    let item;
    repeat(() => {
      item = observable(new Item(source.label), "item"); // key -> reconciled on rerun
      declareState(item, { count: 0 });
    });
    const established = item;
    assert.equal(established.label, "a");
    assert.equal(established.count, 0);

    established.count = 7; // user interaction, outside any repeater

    source.label = "b"; // reruns the builder - a rebuild of "item"
    assert.equal(item, established, "same identity across the rebuild");
    assert.equal(established.label, "b", "a property is re-set from the fresh construction");
    assert.equal(established.count, 7, "state survives the rebuild - the twin's default is not copied back");
  });

});

// The throwing case gets its own world: an exception thrown from inside a
// repeater's own refresh() leaves that world's context stack where it was,
// which would corrupt every later test sharing the instance above.
describe("state properties - the write guard", function () {
  const throwing = getWorld({ name: "state-properties-throw", timeLevels: 3 });

  it("a plain write from inside a repeater throws", function () {
    const model = throwing.observable({});
    throwing.declareState(model, { count: 0 });
    assert.throws(
      () => { throwing.repeat(() => { model.count = 5; }); },
      /Cannot write state property 'count' from inside a repeater/
    );
  });
});

describe("retractRepeater()", function () {

  it("a repeater retracted before its already-queued rerun is processed never runs it; retracting twice is a no-op", function () {
    const model = observable({ v: 1 });
    let childRuns = 0;
    let child;
    repeat(() => {
      child = repeat(() => { childRuns++; model.v; });
    });
    assert.equal(childRuns, 1);

    postponeInvalidations();
    model.v = 2; // invalidates child, but processing is held back
    retractRepeater(child);
    retractRepeater(child); // idempotent
    continueInvalidations();

    assert.ok(child.retracted);
    assert.equal(childRuns, 1, "the queued rerun of a since-retracted repeater must be discarded, not run");
  });

});

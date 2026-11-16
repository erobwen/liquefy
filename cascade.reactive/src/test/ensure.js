import { getWorld } from "../cascade.js";
import assert from "assert";

// ensure() is repeat(), by what it's for rather than how it works: the
// same function, under the name to use. What it makes is a repeater.
describe("ensure()", function () {
  it("is repeat() - the same function", function () {
    const { ensure, repeat } = getWorld({ name: "ensureAlias" });
    assert.equal(typeof ensure, "function");
    assert.strictEqual(ensure, repeat);
  });

  it("ensures what its action says: so now, and still so whatever changes", function () {
    const { observable, ensure } = getWorld({ name: "ensureHolds" });
    const layout = observable({ width: 1000 });
    const content = observable({ width: 0 });
    ensure(() => { content.width = layout.width - 200; });
    assert.equal(content.width, 800);
    layout.width = 600;
    assert.equal(content.width, 400);
  });

  it("returns the repeater - described, if given a description", function () {
    const { observable, ensure } = getWorld({ name: "ensureRepeater" });
    const model = observable({ value: 1 });
    let runs = 0;
    const repeater = ensure("counting", () => { model.value; runs++; });
    assert.equal(repeater.description, "counting");
    assert.equal(runs, 1);
    model.value = 2;
    assert.equal(runs, 2);
  });
});

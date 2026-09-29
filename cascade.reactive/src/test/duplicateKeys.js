import { getWorld } from "../cascade.js";
import assert from "assert";

// One object per key and build: a second one with the same key would
// silently take the first one's place.
describe("duplicate keys in one build", function () {
  const { observable, repeat } = getWorld({ name: "duplicateKeys" });

  it("throws - naming the key", function () {
    assert.throws(() => repeat(() => {
      observable({ label: "first" }, "item");
      observable({ label: "second" }, "item");
    }), /Duplicate key "item"/);
  });

  it("the same key in two builds is fine, and so is it again in the next run of one", function () {
    const data = observable({ run: 1 });
    repeat(() => { observable({ label: "a" }, "item"); });
    repeat(() => { data.run; observable({ label: "b" }, "item"); });
    data.run = 2;
  });
});

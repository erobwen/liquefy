import { getWorld } from "../cascade.js";
import assert from "assert";

// One object per key and build: a second one with the same key would
// silently take the first one's place.
describe("duplicate keys in one build", function () {
  const { temporal, repeat } = getWorld({ name: "duplicateKeys" });

  it("throws - naming the key", function () {
    assert.throws(() => repeat(() => {
      temporal({ label: "first" }, "item");
      temporal({ label: "second" }, "item");
    }), /Duplicate key "item"/);
  });

  it("the same key in two builds is fine, and so is it again in the next run of one", function () {
    const data = temporal({ run: 1 });
    repeat(() => { temporal({ label: "a" }, "item"); });
    repeat(() => { data.run; temporal({ label: "b" }, "item"); });
    data.run = 2;
  });
});

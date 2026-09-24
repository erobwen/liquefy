import { getWorld } from "../cascade.js";
import assert from "assert";

// A build id identifies "the same thing, rebuilt" - but only while it's the
// same kind of thing. When a rebuild constructs a different class under an
// established build id (a theme swap turning key "save" from one button
// implementation into another), merging the new object into the
// established one would keep the old class's methods and behavior under
// the new data. It's a replacement: created fresh, and the established
// object disposed.
describe("rebuild: same build id, different class", function () {
  it("constructs a fresh object of the new class, and disposes the one it replaces", function () {
    const { observable, repeat } = getWorld({ name: "rebuild-class-change-" + Math.random() });

    const disposed = [];
    class Plain {
      constructor(label) { this.label = label; }
      kind() { return "plain"; }
      onDispose() { disposed.push("plain:" + this.label); }
    }
    class Fancy {
      constructor(label) { this.label = label; }
      kind() { return "fancy"; }
      onDispose() { disposed.push("fancy:" + this.label); }
    }

    const choice = observable({ fancy: false, label: "one" });
    let built = [];
    repeat(() => {
      const Kind = choice.fancy ? Fancy : Plain;
      built.push(observable(new Kind(choice.label), "save"));
    });
    const first = built[0];

    // Same class again: the established object is reused, with the new data.
    choice.label = "two";
    assert.equal(built[1], first);
    assert.equal(first.label, "two");
    assert.deepEqual(disposed, []);

    // Different class: a fresh object, and the old one is disposed.
    choice.fancy = true;
    const replacement = built[2];
    assert.notEqual(replacement, first);
    assert.equal(replacement.kind(), "fancy");
    assert.equal(replacement.label, "two");
    // (Its label reads back as constructed: this run no longer builds it, so
    // the repeater's previous-run merge into it is retracted - the same as
    // for any dropped keyed object.)
    assert.equal(disposed.length, 1);
    assert.ok(disposed[0].startsWith("plain:"), disposed[0]);

    // And the replacement is what the key reconciles to from then on.
    choice.label = "three";
    assert.equal(built[3], replacement);
    assert.equal(replacement.label, "three");
  });
});

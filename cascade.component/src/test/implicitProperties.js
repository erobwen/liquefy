import assert from "assert";
import { Component } from "../Component.js";
import { frozen } from "../frozen.js";
import { toPropertiesWithChildren } from "../implicitProperties.js";

// The argument list a component is constructed with is sorted into its
// properties - without touching what the caller passed: a properties
// object or a children array reused in the next build, or frozen, is left
// exactly as it was.
describe("implicit properties", function () {
  class Leaf extends Component {}

  it("a properties object is taken as a copy - its key is there for every construction", function () {
    const properties = { key: "save", label: "Save" };
    const first = new Leaf(properties);
    const second = new Leaf(properties);
    assert.equal(first.key, "save");
    assert.equal(second.key, "save", "the key wasn't taken out of the caller's object");
    assert.deepEqual(properties, { key: "save", label: "Save" });
  });

  it("a frozen properties object is fine", function () {
    const component = new Leaf(frozen({ key: "save", label: "Save" }));
    assert.equal(component.key, "save");
  });

  it("an array of children is copied - what follows it isn't pushed onto the caller's array", function () {
    const children = [new Leaf()];
    const footer = new Leaf();
    const properties = toPropertiesWithChildren([children, footer]);
    assert.equal(properties.children.length, 2);
    assert.equal(children.length, 1, "the caller's array is unchanged");

    const frozenChildren = frozen([new Leaf()]);
    assert.equal(toPropertiesWithChildren([frozenChildren, footer]).children.length, 2, "a frozen array is fine too");
  });

  it("the first loose lowercase string is the key - the rest are children", function () {
    const child = new Leaf();
    const properties = toPropertiesWithChildren(["header", { style: { padding: 1 } }, child]);
    assert.equal(properties.key, "header");
    assert.deepEqual(properties.children, [child]);
    assert.deepEqual(properties.style, { padding: 1 });
  });
});

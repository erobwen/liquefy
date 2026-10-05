import assert from "assert";
import { Component } from "../../index.js";
import { toPropertiesWithChildren } from "../implicitProperties.js";

// What goes wrong in a build is told in the app's own terms: which
// component's build() it was, and where that component comes from.
describe("error messages", function () {
  class Leaf extends Component {
    render() {}
  }

  class Box extends Component {
    setProperties({ children }) {
      this.children = children;
    }
    build() {
      return this.children;
    }
  }

  class Settings extends Component {
    setProperties({ build }) {
      this.buildContent = build;
    }
    build() {
      return this.buildContent();
    }
  }

  class Tab extends Component {
    setProperties({ build }) {
      this.buildContent = build;
    }
    build() {
      return new Settings({ key: "settings", build: this.buildContent });
    }
  }

  const renderTab = (build) => new Tab({ build }).renderOnto({});

  it("a duplicate key names the build, its path, and what the two components were", function () {
    const field = (key) => new Box({ key }, new Leaf({ key: "label" }));
    assert.throws(() => renderTab(() => [field("format"), field("metadata")]), (error) => {
      assert.match(error.message, /^Duplicate key "label" in Settings\.build\(\) \(Tab › Settings\(settings\)\): first on a Leaf, then on a Leaf\./);
      assert.match(error.message, /not just among siblings/);
      return true;
    });
  });

  it("an error thrown from a build() names the component it came from", function () {
    assert.throws(() => renderTab(() => { throw new Error("no plan"); }), (error) => {
      assert.equal(error.message, "no plan\n    in Settings.build() (Tab › Settings(settings))");
      return true;
    });
  });

  it("nested arrays of children are flattened", function () {
    const [a, b, c] = [new Leaf(), new Leaf(), new Leaf()];
    const properties = toPropertiesWithChildren([[a, [b, [c]]]]);
    assert.deepEqual(properties.children, [a, b, c]);
  });

  it("a child that isn't one is described, not printed", function () {
    assert.throws(() => renderTab(() => new Box(new Leaf(), { style: {} }, { title: "x" })), /two properties objects in one argument list in Settings\.build\(\)/);
    assert.throws(() => renderTab(() => new Box([new Leaf(), new Date(0)])), /a child that is a Date in Settings\.build\(\) \(Tab › Settings\(settings\)\)/);
  });

  it("a loose null holds its place among the children; trailing ones are dropped", function () {
    const [a, b] = [new Leaf(), new Leaf()];
    assert.deepEqual(toPropertiesWithChildren([null, a, undefined, b, null]).children, [null, a, null, b]);
    assert.equal(toPropertiesWithChildren([null, { style: {} }]).children, undefined, "only nulls: no children");
    assert.equal(toPropertiesWithChildren([null, "header", a]).key, "header", "a null before the key changes nothing");
  });

  it("a key with whitespace in it warns that it was probably meant as text", function () {
    const warnings = [];
    const warn = console.warn;
    console.warn = (message) => warnings.push(message);
    try {
      toPropertiesWithChildren(["save the file"]);
      toPropertiesWithChildren(["save the file"]);
      toPropertiesWithChildren(["save"]);
    } finally {
      console.warn = warn;
    }
    assert.equal(warnings.length, 1, "once, and only for the one with whitespace");
    assert.match(warnings[0], /"save the file" became a key, not text/);
  });
});

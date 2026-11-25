import assert from "assert";
import { observable } from "../Cascade.js";
import { Component } from "../Component.js";

// A component its creator owns itself - created in initialization, not
// built in a build() - has nothing but its owner to establish and dispose
// of it. Not disposed, one reading data that never changes again is never
// invalidated: its build stays subscribed to that data for good.
describe("the lifecycle of an owned component", function () {
  const context = () => ({ name: "target" });

  // Read by the owned component, and never changed while the owner is dropped.
  const global = observable({ text: "hello" });

  class Owned extends Component {
    initialPlain() {
      return { builds: 0, established: 0 };
    }
    onEstablish() {
      super.onEstablish();
      this.plain.established++;
    }
    build() {
      this.plain.builds++;
      this.plain.text = global.text;
      return null;
    }
  }

  class Owner extends Component {
    initialPlain() {
      return { owned: new Owned({ key: "owned" }).establish() };
    }
    onDispose() {
      this.plain.owned.dispose();
      super.onDispose();
    }
    build() {
      return this.plain.owned;
    }
  }

  class Parent extends Component {
    setProperties({ data }) {
      this.data = data;
    }
    build() {
      return this.data.showOwner ? new Owner({ key: "owner" }) : null;
    }
  }

  it("is established once, where it's created, and disposed with its owner", function () {
    const data = observable({ showOwner: true });
    const parent = new Parent({ data });
    parent.renderOnto(context());
    const owned = parent.currentBuild.plain.owned;
    assert.equal(owned.plain.established, 1);
    assert.equal(owned.plain.builds, 1);

    // Established already: nothing happens again.
    owned.establish();
    assert.equal(owned.plain.established, 1);

    // The owner is dropped - and the owned component with it: the data it
    // read changing no longer builds it.
    data.showOwner = false;
    assert.ok(owned.plain.buildRepeater.retracted, "disposed with its owner");
    global.text = "goodbye";
    assert.equal(owned.plain.builds, 1);
  });

  it("a component built in a build() is established by that build", function () {
    const data = observable({ showOwner: true });
    let established = 0;
    class Counted extends Component {
      onEstablish() {
        super.onEstablish();
        established++;
      }
      build() {
        return null;
      }
    }
    class Builder extends Component {
      build() {
        return data.showOwner ? new Counted({ key: "counted" }) : null;
      }
    }
    const builder = new Builder();
    builder.renderOnto(context());
    assert.equal(established, 1);
    // The same establish() the rebuild used: established already.
    builder.currentBuild.establish();
    assert.equal(established, 1);
    data.showOwner = false;
    data.showOwner = true;
    assert.equal(established, 2, "a new one, once the key came back");
  });
});

describe("development checks on components", function () {
  it("initialPlain() may not use a name Component keeps its own bookkeeping under", function () {
    class Clashing extends Component {
      initialPlain() {
        return { renderContext: "mine" };
      }
      render() {}
    }
    assert.throws(() => new Clashing().renderOnto({ name: "target" }), /"renderContext" is a name Component keeps/);
  });
});

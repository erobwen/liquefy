import assert from "assert";
import { observable } from "../Cascade.js";
import { Component } from "../Component.js";

// A build() or render() that throws on its very first run leaves nothing
// behind: the repeater made for it is retracted, so it doesn't rerun on its
// own once what it read changes, and the next renderOnto() starts afresh -
// instead of making a second repeater writing the same properties from
// another pipeline, which crashed the scheduler on the next change.
describe("A first build or render that throws", function () {
  const target = () => observable({ lastChild: null, timeless: null });

  it("a build: rendered again once the cause is gone, it builds - and follows changes", function () {
    const model = observable({ fail: true, n: 0 });
    let builds = 0;
    const seen = [];
    class Leaf extends Component {
      setProperties({ n }) {
        this.n = n;
      }
      render() {
        seen.push(this.n);
      }
    }
    class Failing extends Component {
      build() {
        builds++;
        const n = model.n;
        if (model.fail) throw new Error("boom");
        return new Leaf({ n });
      }
    }
    const component = new Failing().establish();
    assert.throws(() => component.renderOnto(target()), /boom/);

    // Nothing reruns on its own.
    model.fail = false;
    assert.equal(builds, 1);

    component.renderOnto(target());
    assert.deepEqual(seen, [0]);
    model.n = 1;
    assert.deepEqual(seen, [0, 1]);
  });

  it("a render: rendered again once the cause is gone, it renders - and follows changes", function () {
    const model = observable({ fail: true, n: 0 });
    let renders = 0;
    const seen = [];
    class Failing extends Component {
      render() {
        renders++;
        const n = model.n;
        if (model.fail) throw new Error("boom");
        seen.push(n);
      }
    }
    const component = new Failing().establish();
    assert.throws(() => component.renderOnto(target()), /boom/);
    model.fail = false;
    assert.equal(renders, 1);

    component.renderOnto(target());
    model.n = 1;
    assert.deepEqual(seen, [0, 1]);
  });
});

import { getWorld } from "../cascade.js";
import assert from "assert";

// onRemovedLastObserver is looked up and called without recording: an
// observer taken down while another one records - a parent's build
// disposing a child's repeater - must not leave that one observing the
// object, neither through the lookup nor through what the hook reads.
describe("onRemovedLastObserver", function () {
  const { temporal, repeat, retractRepeater } = getWorld({ name: "onRemovedLastObserver" });

  function disposedWhileRecording(object, read) {
    const inner = repeat(() => read(object));
    let outerRuns = 0;
    repeat(() => {
      outerRuns++;
      retractRepeater(inner);
    });
    return () => outerRuns;
  }

  it("as a property of the object: the recorder taking down the last observer observes nothing of it", function () {
    let removed = 0;
    const object = temporal({ a: 1, counter: 1 });
    object.onRemovedLastObserver = function () { removed++; return this.counter; };
    const outerRuns = disposedWhileRecording(object, (o) => o.a);
    assert.equal(removed, 1);
    object.counter = 2;
    object.onRemovedLastObserver = function () { removed++; };
    assert.equal(outerRuns(), 1, "neither what the hook read nor the hook itself was recorded");
  });

  it("as a method on the prototype, last reader of a prototype member gone", function () {
    const reports = [];
    class Thing {
      constructor() {
        this.counter = 1;
        return temporal(this);
      }
      area() { return 10; }
      onRemovedLastObserver(description, key) { reports.push([description, key]); return this.counter; }
    }
    const thing = new Thing();
    const outerRuns = disposedWhileRecording(thing, (t) => t.area());
    assert.deepEqual(reports, [["prototypeDependees", null]]);
    thing.counter = 2;
    thing.area = () => 20;
    assert.equal(outerRuns(), 1);
  });
});

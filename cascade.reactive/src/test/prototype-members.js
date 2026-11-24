import { getWorld } from "../cascade.js";
import assert from "assert";

// A read that finds a method or getter on an object's prototypes depends
// on nothing that changes - see cascade.js's "Prototype members". It's
// recorded once per reader per object, with no timeline for the name, and
// only a value of the object's own by that name tells its readers.
describe("Prototype members", function () {
  function setup() {
    const { temporal, repeat } = getWorld({ name: "prototype-members-" + Math.random() });
    class Thing {
      constructor() {
        this.size = 1;
        return temporal(this);
      }
      area() { return 10; }
      get doubled() { return this.size * 2; }
    }
    return { temporal, repeat, Thing };
  }

  it("calling a method gives its name no timeline", function () {
    const { repeat, Thing } = setup();
    const thing = new Thing();
    repeat(() => thing.area());
    assert.equal(typeof thing.timelines.area, "undefined");
  });

  it("a method replaced on the object itself is seen", function () {
    const { repeat, Thing } = setup();
    const thing = new Thing();
    let seen;
    repeat(() => { seen = thing.area(); });
    assert.equal(seen, 10);
    thing.area = () => 20;
    assert.equal(seen, 20);
  });

  it("a getter shadowed by a property defined on the object is seen", function () {
    const { repeat, Thing } = setup();
    const thing = new Thing();
    let seen;
    repeat(() => { seen = thing.doubled; });
    assert.equal(seen, 2);
    Object.defineProperty(thing, "doubled", { get() { return 99; }, configurable: true, enumerable: true });
    assert.equal(seen, 99);
  });

  it("what a getter reads is still a dependency of its own", function () {
    const { repeat, Thing } = setup();
    const thing = new Thing();
    let seen;
    repeat(() => { seen = thing.doubled; });
    thing.size = 5;
    assert.equal(seen, 10);
  });

  it("the very method written onto the object again changes nothing", function () {
    const { repeat, Thing } = setup();
    const thing = new Thing();
    let runs = 0;
    repeat(() => { runs++; thing.area(); });
    thing.area = Thing.prototype.area;
    assert.equal(runs, 1);
  });

  it("a reader taken down no longer hears of it", function () {
    const { temporal, repeat, Thing } = setup();
    const thing = new Thing();
    const shown = temporal({ on: true });
    let inner = 0;
    repeat((repeater) => {
      if (shown.on) repeat(() => { inner++; thing.area(); });
    });
    assert.equal(inner, 1);
    shown.on = false;
    assert.equal(thing.causality.handler.prototypeObservers.contentsCounter, 0);
    thing.area = () => 30;
    assert.equal(inner, 1);
  });
});

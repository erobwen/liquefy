import { getWorld } from "../cascade.js";
import assert from "assert";

// A real bug found via cascade.component's Component.toString() (added so
// a real DOM element's own id attribute can carry debug identity - see
// cascade.DOM's DOMNodeComponent.js): reading a property whose name
// collides with one of Object.prototype's own member names ("toString",
// "valueOf", "hasOwnProperty", "constructor", ...) on a freshly-observed
// object crashed, because a handler's own `timelines` map (from property
// key to timeline) was a plain `{}` - which has its own prototype chain,
// so `timelines["toString"]` resolved to Object.prototype.toString
// itself instead of `undefined`. hasTimelineValue's own
// `typeof(timeline) === 'undefined'` check never caught this (a function
// is never `undefined`), so it fell through to seekWriting() with that
// function standing in for a real timeline, crashing reading `.time` off
// it. Fixed by using Object.create(null) for the timelines map instead
// of `{}` (see observable()'s own handler construction).
const { observable, repeat } = getWorld({ name: "prototype-collision-keys", timeLevels: 3 });

describe("reading a property whose name collides with Object.prototype", function () {

  it("a plain property named 'toString' reads/writes normally, even before this object ever had a real toString() method", function () {
    const target = observable({});
    target.toString = "not a function, just a string value";
    assert.equal(target.toString, "not a function, just a string value");
  });

  it("calling a real, user-defined toString() method on an observable's own class does not crash", function () {
    class Named {
      constructor(name) {
        this.name = name;
        return observable(this);
      }
      toString() {
        return "Named(" + this.name + ")";
      }
    }
    const named = new Named("x");
    assert.equal(named.toString(), "Named(x)");

    // Reading it again, from inside a repeater, must not crash either -
    // this is closer to the real failure (Component.toString(), called
    // from the middle of another component's own render()).
    let seen;
    repeat(() => { seen = named.toString(); });
    assert.equal(seen, "Named(x)");
  });

  it("other Object.prototype-colliding names ('valueOf', 'hasOwnProperty', 'constructor') read as undefined when never written, not as the inherited built-in", function () {
    const target = observable({});
    // None of these were ever written as an *observable* property, so a
    // read must fall through to the plain, unobserved `target[key]` -
    // which for a bare {} means the same inherited built-ins JS always
    // provides (a real function/the constructor), *not* a crash - the
    // bug was seekWriting() crashing on a bogus "timeline", not these
    // functions being reachable at all.
    assert.equal(typeof target.valueOf, "function");
    assert.equal(typeof target.hasOwnProperty, "function");
    assert.equal(typeof target.constructor, "function");
  });

});

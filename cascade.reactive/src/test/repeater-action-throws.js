import { getWorld } from "../cascade.js";
import assert from "assert";

// Found via a cascade.component/cascade.DOM test that deliberately throws
// from a component's render() (see cascade.DOM/src/test/domNodeComponent.js)
// to check a build()-result guard: that alone was enough to break unrelated
// later tests in the same process. Root cause was in repeater.refresh()
// itself, not in Component.js (which has its own, separate try/finally
// around renderStack/creators - see Component.js's renderOnto()/
// reactiveBuildEquivalent()): enterContext(partial) was followed by
// repeater.repeaterAction(repeater) with no try/finally, so a throwing
// action left state.context - a single, module-level pointer, not scoped
// to this repeater or this call - permanently pointing at this run's own
// abandoned partial. Every read/write anywhere in the process afterward,
// in completely unrelated components, got mis-attributed to that defunct
// position. Fixed by unwinding state.context back to wherever it was
// before this run started (however many levels deep the throw happened,
// via leaveContext()'s own strict "must be the current context" check)
// before re-throwing - contained, not recovered: this repeater's own
// reconciliation for the failed run is still genuinely incomplete
// (finalizeStaleWritings/finalizeChildren/finishRebuilding never ran), but
// nothing else in the process is dragged down with it.
describe("a repeaterAction that throws does not corrupt state.context for anything else", function () {
  it("an unrelated, later repeater still reads/writes correctly after an earlier one's action threw", function () {
    const { observable, repeat } = getWorld({ name: "repeater-action-throws-" + Math.random() });

    assert.throws(() => {
      repeat(() => {
        throw new Error("boom");
      });
    }, /boom/);

    // If state.context were left pointing at the thrown repeater's own
    // (defunct) partial, later reads/writes would be mis-attributed to
    // that stale position instead of their own. A same-partial
    // read-after-write would trivially succeed regardless, since it
    // doesn't depend on cross-sibling tree-position comparison at all -
    // the real failure (cascade.DOM's own domTarget.js, run after a
    // throwing test) needed a *later sibling* reading what an *earlier*
    // one wrote, exactly like DOMTarget's own lastChild, so exercise that
    // shape directly.
    const target = observable({ last: null });
    let secondSaw;
    repeat(() => {
      repeat(() => { target.last = "first"; });
      repeat(() => { secondSaw = target.last; });
    });

    assert.equal(secondSaw, "first");
  });

  it("a throw nested several repeaters deep still fully unwinds state.context", function () {
    const { observable, repeat } = getWorld({ name: "repeater-action-throws-nested-" + Math.random() });

    assert.throws(() => {
      repeat(() => {
        repeat(() => {
          repeat(() => {
            throw new Error("deep boom");
          });
        });
      });
    }, /deep boom/);

    const target = observable({ last: null });
    let secondSaw;
    repeat(() => {
      repeat(() => { target.last = "first"; });
      repeat(() => { secondSaw = target.last; });
    });
    assert.equal(secondSaw, "first");
  });

  it("restarting a repeater whose action throws leaves later, unrelated repeaters unaffected", function () {
    const { observable, repeat } = getWorld({ name: "repeater-action-throws-restart-" + Math.random() });

    let shouldThrow = false;
    const flaky = repeat(() => {
      if (shouldThrow) throw new Error("restart boom");
    });

    shouldThrow = true;
    assert.throws(() => flaky.restart(), /restart boom/);

    const target = observable({ last: null });
    let secondSaw;
    repeat(() => {
      repeat(() => { target.last = "first"; });
      repeat(() => { secondSaw = target.last; });
    });
    assert.equal(secondSaw, "first");
  });
});

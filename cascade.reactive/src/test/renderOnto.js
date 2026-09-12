import { getWorld } from "../cascade.js";
import assert from "assert";

// DRAFT - sketches the toy component model discussed for exercising
// `linkRepeater` and partial-repeaters: a component "renders onto" a shared
// target that carries a runway of state (like available layout space), in
// order, so a later component can read what an earlier one committed.
//
// `linkRepeater(oldRepeater)` is pure reattachment - it puts the repeater
// back into its parent's child list at the right position. It never itself
// forces execution: if the repeater is already invalid, cascade's normal
// dirty-queue machinery refreshes it independent of when linkRepeater was
// called; if it's clean, linking is a no-op. A child that a rebuild simply
// never re-links (no longer in effect) needs to be retracted once its
// parent's run finishes - the same retract -> pending -> reconcile ->
// finalize shape already built for property writings, just one level up.
//
// Bookkeeping fields (which repeater a component owns, render counts, what
// it last saw) live under `this.unobservable`, not as plain observable
// properties - matching the escape hatch already used in flow.core's
// Component.js (`this.causality.unobservable`, lazily initialized). A
// component reading-then-conditionally-setting one of these as an
// observable property is exactly the shape that broke meta_repeaters.js:
// retraction can make a fresh read of it fall through, even though nothing
// about the component's actual identity changed. `this.causality` is
// cascade's reserved meta-property (`handler.meta`) - a plain, non-proxied
// object, so anything stashed on it is invisible to the reactive system
// entirely, not just untracked by it.
//
// Three things this needs to prove out:
//  1. A child's own input changes -> only that child (and whoever reads
//     its output) redoes work, with no parent involvement at all. This
//     should already work with the plain per-time-writing engine we have
//     today - no partials needed, since each child is its own independent
//     repeater.
//  2. The parent rebuilds for an unrelated reason -> children whose own
//     inputs didn't change get relinked as-is (state preserved, not
//     rerun), and a child no longer rendered gets retracted.
//  3. The parent's OWN writes, interleaved between children (here: padding
//     subtracted before/between/after), need distinct sub-positions per
//     interleaving point - without that, all of the parent's writes to
//     the same property collapse onto one slot, and a child has no way to
//     see "spaceLeft as of right before me" vs. "right after me". This is
//     a data-correctness gap, not just a missed optimization - it's the
//     concrete reason partials have to exist, not just linkRepeater.

const { observable, repeat, linkRepeater } = getWorld({ name: "renderOnto", timeLevels: 5 });

describe("renderOnto", function () {

  const PADDING = 5;

  class Leaf {
    get unobservable() {
      if (!this.causality.unobservable) {
        this.causality.unobservable = { repeater: null, renderCount: 0, seenSpaceLeft: null };
      }
      return this.causality.unobservable;
    }

    constructor(claim) {
      this.claim = claim; // how much of target.spaceLeft this leaf consumes - the one real reactive input
      return observable(this);
    }

    renderOnto(target) {
      const u = this.unobservable;
      if (u.repeater) {
        linkRepeater(u.repeater);
      } else {
        u.repeater = repeat(() => {
          u.renderCount++;
          u.seenSpaceLeft = target.spaceLeft;
          target.spaceLeft -= this.claim;
        });
      }
    }
  }

  class Panel {
    get unobservable() {
      if (!this.causality.unobservable) {
        this.causality.unobservable = { repeater: null, rebuildCount: 0, a: null, b: null };
      }
      return this.causality.unobservable;
    }

    constructor(a, b) {
      const wrapped = observable(this);
      wrapped.unobservable.a = a;
      wrapped.unobservable.b = b;
      return wrapped;
    }

    renderOnto(target) {
      const u = this.unobservable;
      if (u.repeater) {
        linkRepeater(u.repeater);
      } else {
        u.repeater = repeat(() => {
          u.rebuildCount++;
          target.spaceLeft -= PADDING;              // padding before
          if (u.a) u.a.renderOnto(target);
          target.spaceLeft -= PADDING;              // padding between
          if (u.b) u.b.renderOnto(target);
          target.spaceLeft -= PADDING;              // padding after
        });
      }
    }
  }

  it('initial render: each leaf sees the space left after everything before it, padding included', function () {
    const target = observable({ spaceLeft: 100 });
    const a = new Leaf(20);
    const b = new Leaf(0);
    const panel = new Panel(a, b);

    panel.renderOnto(target);

    assert.equal(a.unobservable.seenSpaceLeft, 95);   // 100 - padding before
    assert.equal(b.unobservable.seenSpaceLeft, 70);   // 95 - a.claim(20) - padding between
    assert.equal(target.spaceLeft, 65);               // 70 - padding after
    assert.equal(a.unobservable.renderCount, 1);
    assert.equal(b.unobservable.renderCount, 1);
  });

  it("case 1: a leaf's own input changes -> only its own partial and the specific downstream reader redo", function () {
    const target = observable({ spaceLeft: 100 });
    const a = new Leaf(20);
    const b = new Leaf(0);
    const panel = new Panel(a, b);
    panel.renderOnto(target);

    a.claim = 30; // a's own dependency changes - a's repeater reruns on its own

    assert.equal(a.unobservable.renderCount, 2);
    // b depends on the space left as panel's own "padding between" write
    // left it (not directly on a - that write sits between a and b), so
    // panel's action does have to run once more to redo that one specific
    // write with a's fresh output. Per-partial reconciliation is what keeps
    // this to exactly once: panel's "padding before"/"padding after" writes
    // reconcile away unchanged (same value as last time, no further
    // cascade), rather than the invalidation of "padding between" forcing
    // panel to re-settle repeatedly until everything downstream catches up.
    assert.equal(b.unobservable.renderCount, 2);
    assert.equal(b.unobservable.seenSpaceLeft, 60);   // 95 - a.claim(30) - padding between
    assert.equal(target.spaceLeft, 55);               // 60 - padding after
    assert.equal(panel.unobservable.rebuildCount, 2);
  });

  it('case 2: parent rebuilds for an unrelated reason -> unaffected children are relinked, not rerun', function () {
    const target = observable({ spaceLeft: 100 });
    const a = new Leaf(20);
    const b = new Leaf(0);
    const panel = new Panel(a, b);
    panel.renderOnto(target);

    // Force the panel to reconsider for a reason unrelated to a/b's own
    // data - simulating whatever external trigger the real component model
    // would eventually provide (e.g. the panel reading something of its
    // own). Using repeater.restart() directly as the harness's stand-in.
    panel.unobservable.repeater.restart();

    assert.equal(panel.unobservable.rebuildCount, 2);
    // a and b's own inputs never changed, so linking them back in should
    // be a no-op for them - no rerun, no state loss.
    assert.equal(a.unobservable.renderCount, 1);
    assert.equal(b.unobservable.renderCount, 1);
    assert.equal(target.spaceLeft, 65);
  });

  it('case 3: a child no longer rendered on rebuild is retracted (not disposed), rippling to unrelated observers', function () {
    // "Retracted" (per discussion) means: all its own effects/writings are
    // retracted, same as any repeater's writings would be, but it's not
    // gone forever - it stays re-linkable if a later rebuild renders it
    // again. Distinct from "disposed", which means never running again.
    const target = observable({ spaceLeft: 100 });
    const external = observable({ marker: null }); // touched only by b, read by something entirely outside this parent/child tree
    let retractedCount = 0;

    class TaggingLeaf extends Leaf {
      renderOnto(target) {
        const u = this.unobservable;
        if (u.repeater) {
          linkRepeater(u.repeater);
        } else {
          u.repeater = repeat(() => {
            u.renderCount++;
            u.seenSpaceLeft = target.spaceLeft;
            target.spaceLeft -= this.claim;
            external.marker = this;
          }, { onRetract: () => { retractedCount++; } });
        }
      }
    }

    const a = new Leaf(20);
    const b = new TaggingLeaf(0);
    const panel = new Panel(a, b);
    panel.renderOnto(target);

    let outsideRenderCount = 0;
    let outsideSawMarker;
    repeat(() => {
      outsideRenderCount++;
      outsideSawMarker = external.marker;
    });
    assert.equal(outsideRenderCount, 1);
    assert.equal(outsideSawMarker, b);

    panel.unobservable.b = null; // panel decides to stop rendering b
    panel.unobservable.repeater.restart();

    assert.equal(panel.unobservable.rebuildCount, 2);
    assert.equal(a.unobservable.renderCount, 1); // a is untouched

    // b was never re-linked this run, so its writings (including
    // external.marker) are retracted - and that ripples to the outside
    // observer despite it having nothing to do with panel's tree.
    assert.equal(outsideRenderCount, 2);
    assert.equal(outsideSawMarker, undefined);

    // Check that b is retracted but not disposed
    assert.ok(b.unobservable.repeater.retracted);
    assert.ok(!b.unobservable.repeater.disposed);

    // options.onRetract is the escape hatch for cleaning up side effects
    // the reactive system has no visibility into (e.g. a DOM node parented
    // outside any observable) - fires exactly once, right when b actually
    // gets retracted, not on every dispose()/rerun.
    assert.equal(retractedCount, 1);
  });

});

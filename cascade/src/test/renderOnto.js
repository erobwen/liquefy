import { getWorld } from "../cascade.js";
import assert from "assert";

// DRAFT / not runnable yet - `linkRepeater` and partial-repeaters don't
// exist in cascade.js. This sketches the toy component model discussed for
// exercising them: a component "renders onto" a shared target that carries
// a runway of state (like available layout space), in order, so a later
// component can read what an earlier one committed.
//
// `linkRepeater(oldRepeater)` is pure reattachment - it puts the repeater
// back into its parent's child list at the right position. It never itself
// forces execution: if the repeater is already dirty, cascade's normal
// dirty-queue machinery refreshes it independent of when linkRepeater was
// called; if it's clean, linking is a no-op. A child that a rebuild simply
// never re-links (no longer in effect) needs to be retracted once its
// parent's run finishes - the same retract -> pending -> reconcile ->
// finalize shape already built for property writings, just one level up:
// a repeater's `children` is the pending list, `linkRepeater` reconciles an
// entry back out of it, and whatever's left unclaimed at the end of the
// parent's run gets disposed.
//
// Three things this needs to prove out:
//  1. A child's own input changes -> only that child (and whoever reads
//     its output) redoes work, with no parent involvement at all. This
//     should already work with the plain per-time-writing engine we have
//     today - no partials needed, since each child is its own independent
//     repeater.
//  2. The parent rebuilds for an unrelated reason -> children whose own
//     inputs didn't change get relinked as-is (state preserved, not
//     rerun), and a child no longer rendered gets disposed.
//  3. The parent's OWN writes, interleaved between children (here: padding
//     subtracted before/between/after), need distinct sub-positions per
//     interleaving point - without that, all of the parent's writes to
//     the same property collapse onto one slot, and a child has no way to
//     see "spaceLeft as of right before me" vs. "right after me". This is
//     a data-correctness gap, not just a missed optimization - it's the
//     concrete reason partials have to exist, not just linkRepeater.

const { observable, repeat, linkRepeater } = getWorld({ name: "renderOnto", timeLevels: 5 });

describe("renderOnto (draft, not runnable)", function () {

  const PADDING = 5;

  class Leaf {
    constructor(claim) {
      this.claim = claim;       // how much of target.spaceLeft this leaf consumes
      this.repeater = null;
      this.renderCount = 0;
      this.seenSpaceLeft = null;
      return observable(this);
    }

    renderOnto(target) {
      if (this.repeater) {
        linkRepeater(this.repeater);
      } else {
        this.repeater = repeat(() => {
          this.renderCount++;
          this.seenSpaceLeft = target.spaceLeft;
          target.spaceLeft -= this.claim;
        });
      }
    }
  }

  class Panel {
    constructor(a, b) {
      this.a = a;
      this.b = b;
      this.repeater = null;
      this.rebuildCount = 0;
      return observable(this);
    }

    renderOnto(target) {
      if (this.repeater) {
        linkRepeater(this.repeater);
      } else {
        this.repeater = repeat(() => {
          this.rebuildCount++;
          target.spaceLeft -= PADDING;           // padding before
          if (this.a) this.a.renderOnto(target);
          target.spaceLeft -= PADDING;           // padding between
          if (this.b) this.b.renderOnto(target);
          target.spaceLeft -= PADDING;           // padding after
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

    assert.equal(a.seenSpaceLeft, 95);   // 100 - padding before
    assert.equal(b.seenSpaceLeft, 70);   // 95 - a.claim(20) - padding between
    assert.equal(target.spaceLeft, 65);  // 70 - padding after
    assert.equal(a.renderCount, 1);
    assert.equal(b.renderCount, 1);
  });

  it("case 1: a leaf's own input changes -> only it and its downstream reader redo, no parent involvement", function () {
    const target = observable({ spaceLeft: 100 });
    const a = new Leaf(20);
    const b = new Leaf(0);
    const panel = new Panel(a, b);
    panel.renderOnto(target);

    a.claim = 30; // a's own dependency changes - a's repeater reruns on its own

    assert.equal(a.renderCount, 2);
    // b depends on the space left as of right after a (through a's specific
    // writing at a's own sub-position), so it should have re-run too,
    // purely through normal reactivity - the panel's own rebuildCount
    // should never have been touched, and its own padding writes were
    // never invalidated (a's change doesn't affect them).
    assert.equal(b.renderCount, 2);
    assert.equal(b.seenSpaceLeft, 60);   // 95 - a.claim(30) - padding between
    assert.equal(target.spaceLeft, 55);  // 60 - padding after
    assert.equal(panel.rebuildCount, 1);
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
    panel.repeater.restart();

    assert.equal(panel.rebuildCount, 2);
    // a and b's own inputs never changed, so linking them back in should
    // be a no-op for them - no rerun, no state loss.
    assert.equal(a.renderCount, 1);
    assert.equal(b.renderCount, 1);
    assert.equal(target.spaceLeft, 65);
  });

  it('case 3: a child no longer rendered on rebuild is retracted (not disposed), rippling to unrelated observers', function () {
    // "Retracted" (per discussion) means: all its own effects/writings are
    // retracted, same as any repeater's writings would be, but it's not
    // gone forever - it stays re-linkable if a later rebuild renders it
    // again. Distinct from "disposed", which means never running again.
    const target = observable({ spaceLeft: 100 });
    const external = observable({ marker: null }); // touched only by b, read by something entirely outside this parent/child tree

    class TaggingLeaf extends Leaf {
      renderOnto(target) {
        if (this.repeater) {
          linkRepeater(this.repeater);
        } else {
          this.repeater = repeat(() => {
            this.renderCount++;
            this.seenSpaceLeft = target.spaceLeft;
            target.spaceLeft -= this.claim;
            external.marker = this;
          });
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

    panel.b = null; // panel decides to stop rendering b
    panel.repeater.restart();

    assert.equal(panel.rebuildCount, 2);
    assert.equal(a.renderCount, 1); // a is untouched

    // b was never re-linked this run, so its writings (including
    // external.marker) are retracted - and that ripples to the outside
    // observer despite it having nothing to do with panel's tree.
    assert.equal(outsideRenderCount, 2);
    assert.equal(outsideSawMarker, undefined);

    // Check that b is retracted but not disposed
    assert.ok(b.repeater.retracted);
    assert.ok(!b.repeater.disposed);
  });

});

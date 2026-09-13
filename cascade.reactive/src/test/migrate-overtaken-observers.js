import { getWorld } from "../cascade.js";
import assert from "assert";

// A reader can resolve its dependency to a writing that isn't really the
// closest one available - just the closest one that happened to exist yet,
// at the moment it read. Ordinary invalidation (invalidateWritingObservers)
// only ever notifies a writing's OWN observers, so a reader stuck on the
// wrong (farther) writing never learns a closer one showed up later; the
// farther writing can go on changing forever without the reader ever
// hearing about it, and the reader silently keeps depending on a value
// nothing downstream actually produces anymore.
//
// migrateOvertakenObserversFor() (cascade.js) closes this: whenever a
// writing is freshly spliced into a timeline (brand new, or a stale
// writing reused at a new position), it checks whether the immediate
// predecessor's own observers include anyone whose read position is
// strictly after the new writing's - if so, that dependency is
// re-pointed onto the new, closer writing (silently, if the value didn't
// actually change from the reader's perspective; with a fresh
// invalidation if it did).
//
// This is exactly the shape renderOnto.js's own case 1 test hits, one
// step removed: b's own writing gets unlinked (see repeater.dispose())
// the instant panel's "between" write changes - synchronously, before
// panel's own later "after" write runs - so panel's "after" read resolves
// to panel's own "between" writing instead of b's, for one step, until b
// reruns and this mechanism sweeps that dependency back onto b's own
// output. With b's own claim at 0 that misattribution happens to net out
// to the same number either way (see renderOnto.js's own comment on why
// its case 1 needs a third rebuild) - here b.claim is nonzero, so a
// version of cascade.js without this fix gives a final answer that is
// simply wrong, not just less efficient.
const { observable, repeat, linkRepeater } = getWorld({ name: "migrate-overtaken-observers", timeLevels: 5 });

describe("migrateOvertakenObserversFor (a farther-writing dependency catches up once a closer writing shows up)", function () {

  const PADDING = 5;

  class Leaf {
    get unobservable() {
      if (!this.causality.unobservable) {
        this.causality.unobservable = { repeater: null, renderCount: 0, seenSpaceLeft: null };
      }
      return this.causality.unobservable;
    }
    constructor(claim) {
      this.claim = claim;
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
          target.spaceLeft -= PADDING;              // padding after - reads whatever's linked right before it
        });
      }
    }
  }

  it("a nonzero downstream claim exposes the gap - without the fix the final value would be silently wrong", function () {
    const target = observable({ spaceLeft: 100 });
    const a = new Leaf(20);
    const b = new Leaf(7); // nonzero - the actual bug-revealing ingredient
    const panel = new Panel(a, b);
    panel.renderOnto(target);

    // 100 - 5(before) - 20(a) - 5(between) - 7(b) - 5(after) = 58
    assert.equal(target.spaceLeft, 58);

    a.claim = 30; // only a's own dependency changes

    // b must see the space left as panel's own "between" write settles to
    // with a's fresh output - 95 - 30 - 5 = 60.
    assert.equal(b.unobservable.seenSpaceLeft, 60);
    assert.equal(b.unobservable.renderCount, 2);

    // The only mathematically correct final answer: 60 - b.claim(7) -
    // PADDING(5) = 48. A version of this file's own migration logic that
    // only migrated silently (never actually notifying a genuinely
    // changed migrated reader), or didn't migrate at all, would leave
    // panel's "after" write pinned to whatever it read before b's own
    // rerun caught up - 60 (panel's own "between" value) - 5 = 55, not 48.
    assert.equal(target.spaceLeft, 48);

    // Confirms this needed panel's own dependency to actually be
    // re-pointed and re-triggered, not just the ordinary a -> panel
    // "between" -> b cascade already covered by renderOnto.js's case 1.
    assert.equal(panel.unobservable.rebuildCount, 3);
  });

  it("when the migrated value happens not to change, the migration itself does not force an extra notification", function () {
    // Same shape, but with b.claim === 0. Panel's "after" write ends up
    // flagged against b's own writing twice over the course of this
    // scenario (see settleOvertakenObservers's own `sameValue` check in
    // cascade.js): once when panel's own "between" write is retired (b
    // reads it, so it can't be reused in place - see retireWritingOnto)
    // and once when b itself finally reruns and its writing's value
    // genuinely changes from what it used to be. Both times, panel's
    // flagged dependency is compared fresh, on its own account, against
    // whatever's actually authoritative right then - with b.claim === 0,
    // b's own final output happens to already match what panel's
    // "between" write settled on, so that second comparison resolves as
    // "no real change" and panel's flag clears without ever promoting to
    // a third rebuild.
    const target = observable({ spaceLeft: 100 });
    const a = new Leaf(20);
    const b = new Leaf(0);
    const panel = new Panel(a, b);
    panel.renderOnto(target);

    a.claim = 30;

    // Matches renderOnto.js's own case 1 - included here too so this
    // file's own two tests read as a matched pair (bug-revealing vs
    // not), without needing to cross-reference renderOnto.js to see why
    // the numbers land where they do.
    assert.equal(target.spaceLeft, 55);
    assert.equal(panel.unobservable.rebuildCount, 2);
  });

});

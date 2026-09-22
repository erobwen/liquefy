import { getWorld } from "../cascade.js";
import assert from "assert";

// The "new predecessor appeared" half of the moved-predecessor problem -
// the complement to reconciliation-position-staleness.js's own case.
// That one handles a repeater that moved and still depends on something
// that used to precede it (a stale dependency on a predecessor that's now
// gone from in front). This is the mirror image, found via
// reorder-fuzz.js: a repeater that DIDN'T move, sitting behind a subtree
// that just moved to be in front of it, needs to newly depend on whatever
// that subtree's own last write was - and nothing ever tells it to, if
// the subtree's own writes all happen to keep the same value they always
// had (see retouchSubtreeWritings() in cascade.js for the full mechanics).
//
// Same "positional accumulator" pattern as renderOnto.js's own Leaf/Panel
// (spaceLeft) and DOMTarget's own lastChild: every node reads the shared
// target's current value, then writes its own updated value before its
// own children run.
const { observable, repeat, linkRepeater } = getWorld({
  name: "retouch-subtree-writings",
  timeLevels: 6,
  verifyChainOrderStructurally: true,
});

class Node {
  constructor(claim) {
    this.claim = claim;
    this.children = [];
    this.repeater = null;
    this.seenSpaceLeft = null;
  }
  renderOnto(target) {
    if (this.repeater) {
      linkRepeater(this.repeater);
    } else {
      this.repeater = repeat(() => {
        this.seenSpaceLeft = target.spaceLeft;
        target.spaceLeft -= this.claim;
        for (const child of this.children) child.renderOnto(target);
      });
    }
  }
}

describe("a new predecessor appearing in front of an untouched sibling", function () {
  it("a leaf left behind by a moved subtree picks up that subtree's own last write, even though the subtree's own root write kept the same value it always had", function () {
    // root
    // ├─ leftBehind  (claim 0)
    // └─ movedBranch (claim 0)
    //     └─ deepWrite (claim 3)   <- the one genuinely different value
    //
    // movedBranch's own write (0) is unchanged before and after the
    // reorder - it's deepWrite's write (3), buried one level inside it,
    // that leftBehind actually needs to see once movedBranch moves in
    // front of it.
    const target = observable({ spaceLeft: 1000 });
    const leftBehind = new Node(0);
    const deepWrite = new Node(3);
    const movedBranch = new Node(0);
    movedBranch.children = [deepWrite];
    const root = new Node(1);
    root.children = [leftBehind, movedBranch];

    root.renderOnto(target);
    assert.equal(leftBehind.seenSpaceLeft, 999);
    assert.equal(movedBranch.seenSpaceLeft, 999);
    assert.equal(deepWrite.seenSpaceLeft, 999);
    assert.equal(target.spaceLeft, 996);

    root.children = [movedBranch, leftBehind]; // movedBranch now precedes leftBehind
    root.repeater.restart();

    assert.equal(movedBranch.seenSpaceLeft, 999, "movedBranch still reads right after root - its own position relative to root is unaffected");
    assert.equal(deepWrite.seenSpaceLeft, 999, "deepWrite still reads right after movedBranch - their relative order to each other never changed");
    assert.equal(leftBehind.seenSpaceLeft, 996, "leftBehind must now see the whole moved subtree's final write (999 - 3), not its own stale pre-move value (999)");
    assert.equal(target.spaceLeft, 996);
  });

  it("the relay works through several same-value links in a row, not just a single hop", function () {
    // root
    // ├─ leftBehind   (claim 0)
    // └─ passThrough1 (claim 0)
    //     └─ passThrough2 (claim 0)
    //         └─ passThrough3 (claim 0)
    //             └─ deepWrite (claim 5)
    //
    // Every node between movedBranch's own root and the real write keeps
    // the same value - each one is its own "hop" migrateOvertakenObserversFor
    // has to relay through in turn (see retouchSubtreeWritings' own
    // comment on why touching only the subtree's last writing isn't
    // enough - reorder-fuzz.js is what actually caught this).
    const target = observable({ spaceLeft: 1000 });
    const leftBehind = new Node(0);
    const deepWrite = new Node(5);
    const passThrough3 = new Node(0);
    passThrough3.children = [deepWrite];
    const passThrough2 = new Node(0);
    passThrough2.children = [passThrough3];
    const passThrough1 = new Node(0);
    passThrough1.children = [passThrough2];
    const root = new Node(1);
    root.children = [leftBehind, passThrough1];

    root.renderOnto(target);
    assert.equal(leftBehind.seenSpaceLeft, 999);
    assert.equal(target.spaceLeft, 994);

    root.children = [passThrough1, leftBehind];
    root.repeater.restart();

    assert.equal(leftBehind.seenSpaceLeft, 994, "leftBehind must see straight through every same-value pass-through link to the one real write at the bottom");
    assert.equal(target.spaceLeft, 994);
  });
});

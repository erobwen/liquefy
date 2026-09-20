import { getWorld } from "../cascade.js";
import assert from "assert";

// Found via cascade.application/demo's RecursiveDemo (a List that builds an
// Item and recurses into a deeper List): every "More" click inserts a whole
// new level's worth of partials at the *same* spot in the chain - right
// after the deepest level's last partial and right before every ancestor's
// own trailing partial (the one attachToCurrentParent opens after a child
// boundary). That gap halves with every insertion until pressure release
// has to run. The existing pressure tests only ever squeeze *flat*
// siblings in front of one anchor at the tail, where the release window
// reaches the end of the chain and vents into the open number space; here
// the window never reaches the tail (a stack of ancestor partials sits
// behind the insertion point), so a release capped at a fixed number of
// visited nodes just respreads an already too-dense window over its own
// span - the numbers keep collapsing, eventually two partials share one,
// and two different writers' writings then reconcile onto each other as
// if they were the same position (findExactWriting compares by position,
// not identity). In the demo that showed up as a text node and an input
// swapping places after an unrelated rerun, four or more levels deep.
describe("partial chain pressure release inside deep nesting", function () {
  function build(options) {
    const { observable, repeat, linkRepeater } = getWorld({
      name: "nested-chain-pressure-" + Math.random(),
      ...options,
    });
    // One shared "target" per level, like DOMTarget.lastChild: each leaf
    // reads what its predecessor sibling wrote, then writes its own mark.
    const levels = [];
    const shape = observable({ maxDepth: 1 }); // like RecursiveDemo's own `levels` state
    const seen = {}; // `${depth}:${leaf}` -> what that leaf saw when it last ran

    function level(depth) {
      if (levels[depth]) { linkRepeater(levels[depth].repeater); return; }
      const target = observable({ last: null });
      const leaves = [];
      const repeater = repeat(() => {
        // three leaf children (like text/input/text), each its own repeater
        for (let i = 0; i < 3; i++) {
          if (leaves[i]) { linkRepeater(leaves[i]); continue; }
          leaves[i] = repeat(() => {
            seen[depth + ":" + i] = target.last;
            target.last = depth + ":" + i;
          });
        }
        // then the nested level, if any - followed by this level's own
        // trailing partial (the write below), like a parent's closing
        // work after its children
        if (depth < shape.maxDepth) level(depth + 1);
        target.closed = depth;
      });
      levels[depth] = { repeater, target, leaves };
    }

    const root = repeat(() => level(1));
    return { root, levels, seen, next: () => { shape.maxDepth = shape.maxDepth + 1; } };
  }

  function assertLeavesSawPredecessors(t, depth) {
    const { seen } = t;
    assert.equal(seen[depth + ":0"], null, `depth ${depth} leaf 0 should see nothing before it`);
    assert.equal(seen[depth + ":1"], depth + ":0", `depth ${depth} leaf 1 should see leaf 0's write`);
    assert.equal(seen[depth + ":2"], depth + ":1", `depth ${depth} leaf 2 should see leaf 1's write`);
  }

  it("order numbers stay unique and consistent with structural order as levels are added one at a time", function () {
    const t = build({ verifyChainOrderStructurally: true });
    for (let d = 2; d <= 14; d++) {
      assert.doesNotThrow(() => t.next(), `adding level ${d}`);
      assertLeavesSawPredecessors(t, d);
    }
    // No two live partials may ever share an order number.
    const numbers = new Set();
    let node = t.root.chainHead.first;
    let count = 0;
    while (node !== null) {
      assert.ok(!numbers.has(node.orderNumber), "duplicate order number " + node.orderNumber);
      numbers.add(node.orderNumber);
      count++;
      node = node.orderNext;
    }
    assert.equal(count, t.root.chainHead.count);
  });

  it("a leaf that reruns deep down still sees its predecessor sibling's write", function () {
    const t = build({});
    for (let d = 2; d <= 10; d++) t.next();
    // Rerun every level's middle leaf (like an inherited value changing
    // for every Item at once); each must still read its own predecessor.
    for (let d = 1; d <= 10; d++) {
      t.levels[d].leaves[1].restart();
      t.levels[d].leaves[2].restart();
      assertLeavesSawPredecessors(t, d);
    }
  });
});

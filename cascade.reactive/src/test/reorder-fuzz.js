import { getWorld } from "../cascade.js";
import assert from "assert";

// Property-based hardening for the moved-away-predecessor mechanism (see
// attachToCurrentParent()/flagOverlapWithMovedPredecessor() in cascade.js,
// and cascade.dom/src/test/domTarget.js's own hand-written reorder tests,
// which this generalizes): every hand-written test for this exercises one
// reorder point, one or two levels deep. This file instead builds random
// tree shapes, reorders/drops/reintroduces children at random depths many
// times over, and checks the *entire* tree against an independent,
// non-reactive oracle after every mutation - not just the couple of nodes
// a human thought to check.
//
// The shape under test is the same "positional accumulator" pattern as
// renderOnto.js's own Leaf/Panel (spaceLeft) and DOMTarget's own lastChild:
// every node reads the shared target's current value (what whoever ran
// immediately before it left behind), then writes its own updated value
// before its own children run. A node that moves relative to its former
// neighbors, anywhere in the tree, must end up seeing exactly what a
// fresh, from-scratch evaluation of the *current* structure would produce
// - never a stale value left over from its old position.
//
// verifyChainOrderStructurally is on throughout: a free, independent
// second check (order-number chain vs. structural parent/sibling walk)
// layered on top of the value-correctness oracle below - see
// structural-order-verifier.js for what it alone already catches.
const { observable, repeat, linkRepeater } = getWorld({
  name: "reorder-fuzz",
  timeLevels: 6,
  verifyChainOrderStructurally: true,
});

// mulberry32 - small, dependency-free, deterministic PRNG. Seeded so a
// failure here is reproducible from its seed alone (printed in every
// assertion message), the same way any fuzz failure needs to be rerunnable
// rather than "try again and hope".
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInt(random, maxExclusive) {
  return Math.floor(random() * maxExclusive);
}

function shuffle(array, random) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = randomInt(random, i + 1);
    const tmp = array[i]; array[i] = array[j]; array[j] = tmp;
  }
}

let nextNodeId;

// A plain, deliberately non-observable tree node - the only reactive state
// under test is `target`'s own accumulator (see the file's own top
// comment); nothing about a node's own identity/shape needs to be
// reactive. renderOnto() mirrors cascade.component's own Component.js
// renderOnto() exactly for the retracted case (linkRepeater() alone never
// re-executes a relinked repeater - only an explicit restart() redoes
// whatever retraction undid), so a node dropped and later reintroduced
// behaves the same way a real component would, not some harness-only
// shortcut.
class Node {
  constructor(claim) {
    this.id = nextNodeId++;
    this.claim = claim;
    this.children = [];
    this.repeater = null;
    this.seenSpaceLeft = null;
    this.expectedSeenSpaceLeft = null; // filled in by the oracle only
  }

  renderOnto(target) {
    if (this.repeater) {
      const wasRetracted = this.repeater.retracted;
      linkRepeater(this.repeater);
      if (wasRetracted) this.repeater.restart();
    } else {
      this.repeater = repeat(() => {
        this.seenSpaceLeft = target.spaceLeft;
        target.spaceLeft -= this.claim;
        for (const child of this.children) child.renderOnto(target);
      });
    }
  }
}

function buildRandomTree(random, depthRemaining, maxChildren) {
  const node = new Node(randomInt(random, 5));
  if (depthRemaining > 0) {
    const count = randomInt(random, maxChildren + 1);
    for (let i = 0; i < count; i++) {
      node.children.push(buildRandomTree(random, depthRemaining - 1, maxChildren));
    }
  }
  return node;
}

function collectAllNodes(node, into) {
  into.push(node);
  for (const child of node.children) collectAllNodes(child, into);
  return into;
}

// The correctness oracle: a plain, non-reactive re-walk of the tree exactly
// as it stands right now - no incremental machinery, no memory of any
// previous run. The reactive system under test is correct exactly when its
// own incrementally-reconciled seenSpaceLeft matches this from-scratch
// computation, everywhere, after every mutation.
function computeOracle(node, spaceLeft) {
  node.expectedSeenSpaceLeft = spaceLeft;
  spaceLeft -= node.claim;
  for (const child of node.children) {
    spaceLeft = computeOracle(child, spaceLeft);
  }
  return spaceLeft;
}

function assertTreeMatches(root, seed, label) {
  for (const node of collectAllNodes(root, [])) {
    assert.equal(
      node.seenSpaceLeft,
      node.expectedSeenSpaceLeft,
      `seed ${seed} (${label}): node #${node.id} saw spaceLeft ${node.seenSpaceLeft}, expected ${node.expectedSeenSpaceLeft}`
    );
  }
}

const ROOT_BUDGET = 1000000;
const SEEDS = 60;
const STEPS_PER_SEED = 10;
const MAX_DEPTH = 4;
const MAX_CHILDREN = 3;

describe("reordering fuzz (random tree shapes, checked against a from-scratch oracle every step)", function () {
  it("pure reordering: shuffling a random node's children, at random depths, always converges to the from-scratch answer", function () {
    for (let seed = 0; seed < SEEDS; seed++) {
      const random = mulberry32(seed * 7919 + 1);
      nextNodeId = 0;
      const target = observable({ spaceLeft: ROOT_BUDGET });
      const root = buildRandomTree(random, MAX_DEPTH, MAX_CHILDREN);

      root.renderOnto(target);
      computeOracle(root, ROOT_BUDGET);
      assertTreeMatches(root, seed, "initial render");

      for (let step = 0; step < STEPS_PER_SEED; step++) {
        const candidates = collectAllNodes(root, []).filter((n) => n.children.length >= 2);
        if (candidates.length === 0) continue;
        const node = candidates[randomInt(random, candidates.length)];
        // A full random permutation, not just a swap - deliberately courts
        // the "several simultaneously skipped predecessors in one attach"
        // case a two-element swap can never produce.
        shuffle(node.children, random);
        node.repeater.restart();

        computeOracle(root, ROOT_BUDGET);
        assertTreeMatches(root, seed, `step ${step}`);
      }
    }
  });

  it("reordering plus dropping/reintroducing children: a moved predecessor that turns out to be genuinely gone (or comes back later) is still handled correctly", function () {
    for (let seed = 0; seed < SEEDS; seed++) {
      const random = mulberry32(seed * 104729 + 17);
      nextNodeId = 0;
      const target = observable({ spaceLeft: ROOT_BUDGET });
      const root = buildRandomTree(random, MAX_DEPTH, MAX_CHILDREN);
      // Children set aside per parent - reused later, matching the
      // "shared child reused across branches" shape (see
      // reconciliation-position-staleness.js) rather than losing a
      // removed subtree for good every time.
      const setAside = new Map(); // parent -> [removed children]

      root.renderOnto(target);
      computeOracle(root, ROOT_BUDGET);
      assertTreeMatches(root, seed, "initial render");

      for (let step = 0; step < STEPS_PER_SEED; step++) {
        const parents = collectAllNodes(root, []).filter(
          (n) => n.children.length >= 1 || (setAside.get(n) || []).length >= 1
        );
        if (parents.length === 0) continue;
        const parent = parents[randomInt(random, parents.length)];
        const aside = setAside.get(parent) || [];

        const action = randomInt(random, 3);
        if (action === 0 && parent.children.length >= 2) {
          shuffle(parent.children, random);
        } else if (action === 1 && parent.children.length >= 1) {
          const index = randomInt(random, parent.children.length);
          const [removed] = parent.children.splice(index, 1);
          aside.push(removed);
        } else if (action === 2 && aside.length >= 1) {
          const index = randomInt(random, aside.length);
          const [restored] = aside.splice(index, 1);
          const insertAt = randomInt(random, parent.children.length + 1);
          parent.children.splice(insertAt, 0, restored);
        } else {
          continue; // no eligible action this draw - fine, just skip the step
        }
        setAside.set(parent, aside);

        parent.repeater.restart();

        // A node currently set aside isn't renderOnto()'d at all this pass,
        // so it's simply absent from `root`'s own current structure - the
        // oracle and the assertion walk both just follow `.children`, so
        // neither ever looks at it until (if) it's reintroduced.
        computeOracle(root, ROOT_BUDGET);
        assertTreeMatches(root, seed, `step ${step}`);
      }
    }
  });
});

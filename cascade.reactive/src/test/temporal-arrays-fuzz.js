import { getWorld } from "../cascade.js";
import assert from "assert";

// reorder-fuzz.js's shape, for a temporal array (see cascade.js's "Temporal
// arrays"): random trees whose nodes each read the last element of a shared
// array - what was pushed just before them - and push one of their own,
// before or after their children. Reordered, dropped, reintroduced and
// relabeled at random, and after every step checked against a plain,
// from-scratch walk: the array's latest elements, what every node saw, and
// that no node's writings pile up across reruns.
const { observable, repeat, linkRepeater } = getWorld({ name: "temporal-arrays-fuzz" });

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

class Node {
  constructor(pushAfterChildren) {
    this.id = nextNodeId++;
    this.pushAfterChildren = pushAfterChildren;
    this.children = [];
    this.repeater = null;
    this.seen = null;
    this.expectedSeen = null;
  }

  renderOnto(placed, labels) {
    if (this.repeater) {
      const wasRetracted = this.repeater.retracted;
      linkRepeater(this.repeater);
      if (wasRetracted) this.repeater.restart();
    } else {
      this.repeater = repeat(() => {
        const last = placed.at(-1);
        this.seen = last ? last.id + ":" + last.label : null;
        const own = Object.freeze({ id: this.id, label: labels[this.id] });
        if (!this.pushAfterChildren) placed.push(own);
        for (const child of this.children) child.renderOnto(placed, labels);
        if (this.pushAfterChildren) placed.push(own);
      });
    }
  }
}

function buildRandomTree(random, depthRemaining, maxChildren) {
  const node = new Node(random() < 0.3);
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

// The oracle: the tree walked as it stands, with a plain array.
function computeOracle(node, labels, placed) {
  const last = placed[placed.length - 1];
  node.expectedSeen = last ? last.id + ":" + last.label : null;
  const own = { id: node.id, label: labels[node.id] };
  if (!node.pushAfterChildren) placed.push(own);
  for (const child of node.children) computeOracle(child, labels, placed);
  if (node.pushAfterChildren) placed.push(own);
  return placed;
}

function linkedWritings(array) {
  let count = 0;
  for (let writing = array.causality.handler.elements.first; writing !== null; writing = writing.next) count++;
  return count;
}

function assertMatches(root, placed, labels, seed, label) {
  const expected = computeOracle(root, labels, []);
  assert.deepEqual(
    [...placed].map((own) => own.id + ":" + own.label),
    expected.map((own) => own.id + ":" + own.label),
    `seed ${seed} (${label}): the latest elements`
  );
  for (const node of collectAllNodes(root, [])) {
    assert.equal(node.seen, node.expectedSeen, `seed ${seed} (${label}): node #${node.id} saw ${node.seen}, expected ${node.expectedSeen}`);
  }
  // One writing per rendered node, plus the baseline - none left over
  // from earlier runs or positions.
  assert.equal(linkedWritings(placed), collectAllNodes(root, []).length + 1, `seed ${seed} (${label}): linked writings`);
}

const SEEDS = 60;
const STEPS_PER_SEED = 12;

describe("temporal arrays fuzz (random trees pushing onto one array, checked against a from-scratch walk every step)", function () {
  it("reordering, dropping, reintroducing and relabeling always converge to the from-scratch answer", function () {
    for (let seed = 0; seed < SEEDS; seed++) {
      const random = mulberry32(seed * 7919 + 3);
      nextNodeId = 0;
      const placed = observable([]);
      const root = buildRandomTree(random, 3, 3);
      const all = collectAllNodes(root, []);
      const labels = observable({});
      all.forEach((node) => { labels[node.id] = "a"; });
      const setAside = new Map();

      root.renderOnto(placed, labels);
      assertMatches(root, placed, labels, seed, "initial render");

      for (let step = 0; step < STEPS_PER_SEED; step++) {
        const action = randomInt(random, 4);
        const parents = collectAllNodes(root, []).filter(
          (n) => n.children.length >= 1 || (setAside.get(n) || []).length >= 1
        );
        if (action === 3 || parents.length === 0) {
          // Relabel a node somewhere in the tree as it stands.
          const nodes = collectAllNodes(root, []);
          const node = nodes[randomInt(random, nodes.length)];
          labels[node.id] = labels[node.id] === "a" ? "b" : "a";
        } else {
          const parent = parents[randomInt(random, parents.length)];
          const aside = setAside.get(parent) || [];
          if (action === 0 && parent.children.length >= 2) {
            shuffle(parent.children, random);
          } else if (action === 1 && parent.children.length >= 1) {
            const [removed] = parent.children.splice(randomInt(random, parent.children.length), 1);
            aside.push(removed);
          } else if (action === 2 && aside.length >= 1) {
            const [restored] = aside.splice(randomInt(random, aside.length), 1);
            parent.children.splice(randomInt(random, parent.children.length + 1), 0, restored);
          } else {
            continue;
          }
          setAside.set(parent, aside);
          parent.repeater.restart();
        }
        assertMatches(root, placed, labels, seed, `step ${step}`);
      }
    }
  });
});

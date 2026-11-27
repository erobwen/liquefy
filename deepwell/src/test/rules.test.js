import assert from "assert";
import { MemoryStore } from "@liquefy/aquifer";
import { open, load, transaction, Synchronized, synchronized, model, registerClasses, DataModelError } from "../index.js";

class Node extends Synchronized {
  key = 0;
  left = null;
  right = null;
  note = null;
}
class Note extends Synchronized {
  text = "";
  published = false;
}

const selectTree = {
  RuleNode: (node, selection) => selection.add(node.left, node.right),
};
function selectTreeWhole(node, selection) {
  if (!node) return;
  selection.add(node);
  selectTreeWhole(node.left, selection);
  selectTreeWhole(node.right, selection);
}

const wells = [];
function openWell(store = new MemoryStore(), options = {}) {
  const well = open({ store, classes: { RuleNode: Node, RuleNote: Note }, options });
  wells.push(well);
  return well;
}
afterEach(() => { while (wells.length) wells.pop().close(); });

function reopen(well, options) {
  well.close();
  wells.splice(wells.indexOf(well), 1);
  return openWell(well.db.store, options);
}

/** A full binary tree of the given depth, keys in search order. */
function tree(depth, low = 0, high = 2 ** depth - 1) {
  if (low >= high) return null;
  const node = new Node();
  const middle = (low + high - 1) / 2;
  node.key = middle;
  node.note = new Note();
  node.left = tree(depth - 1, low, middle);
  node.right = tree(depth - 1, middle + 1, high);
  return node;
}

function withTree(depth) {
  const well = openWell();
  transaction(() => { well.root.tree = tree(depth); });
  return well;
}

function keys(selection) {
  return [...selection].map((node) => node.key).sort((a, b) => a - b);
}

/** Counts the reads of the store, single and in batches. */
function countReads(well) {
  const counts = { get: 0, getMany: 0 };
  const { get, getMany } = well.db;
  well.db.getMany = function (ids) {
    counts.getMany++;
    const before = counts.get;
    const result = getMany.call(this, ids);
    counts.get = before; // the reads a batch makes are the batch's
    return result;
  };
  well.db.get = function (id) { counts.get++; return get.call(this, id); };
  return counts;
}

describe("selectors as local rules (design section 3.7)", function () {

  it("apply the rule transitively, and run the action with the selection held and pinned", function () {
    const well = reopen(withTree(3));
    let seen = null;
    const handle = load(well.root.tree, selectTree, (selection) => { seen = selection; });
    assert.strictEqual(seen, handle.selection);
    assert.ok(handle.loaded);
    assert.deepEqual(keys(handle.selection), [0, 1, 2, 3, 4, 5, 6]);
    for (const node of handle.selection) {
      assert.equal(well.holdsOf(node), 1);
      assert.ok(well.isPinned(node));
    }
    assert.equal(well.inMemory(model.identityOf(well.root.tree)).note instanceof Note, true, "a note can be followed, but was not selected");
    assert.ok(![...handle.selection].some((object) => object instanceof Note));
    const nodes = [...handle.selection];
    handle.release();
    assert.ok(nodes.every((node) => well.holdsOf(node) === 0 && !well.isPinned(node)));
  });

  it("select what the whole-function selector selects", function () {
    const well = reopen(withTree(4));
    const byRules = load(well.root.tree, selectTree);
    const whole = load(well.root.tree, selectTreeWhole);
    assert.deepEqual(keys(byRules.selection), keys(whole.selection));
    assert.equal(byRules.selection.size, 15);
  });

  it("ask the store once for each level, not once for each object", function () {
    const well = reopen(withTree(4));
    const start = well.root.tree;
    const counts = countReads(well);
    const handle = load(start, selectTree);
    assert.equal(handle.selection.size, 15);
    assert.equal(counts.getMany, 3, "three levels below the starting object");
    assert.equal(counts.get, 0, "no object was read by itself");
  });

  it("run the rule of the changed object only", function () {
    const well = reopen(withTree(3));
    const runs = [];
    const handle = load(well.root.tree, {
      RuleNode: (node, selection) => { runs.push(node.key); selection.add(node.left, node.right); },
    });
    assert.equal(runs.length, 7);
    runs.length = 0;
    const node = [...handle.selection].find((each) => each.key === 1);
    node.left = null;
    assert.deepEqual(runs, [1]);
    assert.deepEqual(keys(handle.selection), [1, 2, 3, 4, 5, 6]);
    runs.length = 0;
    node.key = 100; // not a field the rule's result depends on, but one it read
    assert.ok(runs.length <= 1);
    assert.equal(handle.selection.size, 6);
  });

  it("follow the graph: what joins is held and pinned, what leaves is let go", function () {
    const well = withTree(2);
    const top = well.root.tree;
    const handle = load(top, selectTree);
    assert.equal(handle.selection.size, 3);
    const left = top.left;
    const added = tree(2);
    left.left = added;
    assert.ok(handle.selection.has(added) && handle.selection.has(added.right), "a whole structure joined");
    assert.ok(well.isStored(added) && well.isPinned(added.right), "stored and pinned in the same transaction");
    top.left = null;
    assert.deepEqual(keys(handle.selection), [1, 2]);
    assert.equal(well.holdsOf(left), 0);
    assert.equal(well.holdsOf(added.right), 0);
    assert.ok(!well.isPinned(added));
  });

  it("let go of a cycle that is cut off, which counting references would keep", function () {
    const well = openWell();
    const a = new Node(), b = new Node(), c = new Node();
    transaction(() => {
      a.left = b; b.left = c; c.left = b; // b and c refer to each other
      well.root.tree = a;
    });
    const handle = load(a, selectTree);
    assert.equal(handle.selection.size, 3);
    a.left = null;
    assert.equal(handle.selection.size, 1);
    assert.equal(well.holdsOf(b), 0);
    assert.equal(well.holdsOf(c), 0);
  });

  it("can depend on data: the path to a key, one read for each level", function () {
    const well = reopen(withTree(5));
    const start = well.root.tree;
    const counts = countReads(well);
    const wanted = 22;
    const handle = load(start, {
      RuleNode: (node, selection) => {
        if (wanted < node.key) selection.add(node.left);
        else if (wanted > node.key) selection.add(node.right);
      },
    });
    assert.equal(handle.selection.size, 5, "one node on each level");
    assert.ok(keys(handle.selection).includes(22));
    assert.equal(counts.getMany, 4);
    assert.equal(counts.get, 0);
  });

  it("run a rule again when it read into an object that had not arrived", function () {
    const well = reopen((() => {
      const s = withTree(2);
      s.root.tree.left.note.published = true;
      return s;
    })());
    let runs = 0;
    const handle = load(well.root.tree, {
      RuleNode: (node, selection) => {
        runs++;
        selection.add(node.left, node.right);
        if (node.note.published) selection.add(node.note); // decides by a neighbour's contents
      },
    });
    const notes = [...handle.selection].filter((object) => object instanceof Note);
    assert.equal(notes.length, 1);
    assert.ok(notes[0].published);
    assert.equal(handle.selection.size, 4);
    assert.ok(runs > 3, "the rules that were stopped ran again");
    // And it is reactive, like any other read of the rule.
    well.root.tree.right.note.published = true;
    assert.equal(handle.selection.size, 5);
  });

  it("select arrays and classless objects by the rules named Array and Object", function () {
    const well = openWell();
    transaction(() => {
      well.root.shelf = synchronized({ books: synchronized([new Note(), new Note()]) });
    });
    const again = reopen(well);
    const handle = load(again.root, {
      Object: (object, selection) => selection.add(object.shelf, object.books),
      Array: (array, selection) => selection.add(...array),
    });
    assert.equal(handle.selection.size, 5, "the root, the shelf, the list, two notes");
  });

  it("pass only through what the filter lets through", function () {
    const well = reopen(withTree(3));
    const allowed = synchronized({ below: 5 });
    const handle = load(well.root.tree, selectTree, { filter: (node) => node.key < allowed.below });
    assert.deepEqual(keys(handle.selection), [0, 1, 2, 3], "5 is refused, and 4 and 6 are only reached through it");
    allowed.below = 6; // the filter is reactive too
    assert.deepEqual(keys(handle.selection), [0, 1, 2, 3, 4, 5]);
    allowed.below = 3;
    assert.deepEqual(keys(handle.selection), [], "the starting object itself is refused");
  });

  it("refuse a rule that selects something that is not a synchronized object", function () {
    const well = withTree(1);
    assert.throws(() => load(well.root, { Object: (root, selection) => selection.add({}) }), DataModelError);
    assert.throws(() => load(well.root, "selectTree"), /table of rules/);
  });

  it("stay equal to the whole-function selector under random changes", function () {
    const well = openWell();
    let seed = 12345;
    const random = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
    const nodes = [];
    transaction(() => {
      for (let i = 0; i < 12; i++) { const node = new Node(); node.key = i; nodes.push(node); }
      well.root.tree = nodes[0];
      well.root.all = synchronized([...nodes]); // keeps every node stored
    });
    const byRules = load(nodes[0], selectTree);
    const whole = load(nodes[0], function select(node, selection) {
      if (!node || selection.has(node)) return;
      selection.add(node);
      select(node.left, selection);
      select(node.right, selection);
    });
    for (let step = 0; step < 300; step++) {
      const node = nodes[random(nodes.length)];
      const target = random(4) === 0 ? null : nodes[random(nodes.length)];
      if (random(2) === 0) node.left = target;
      else node.right = target;
      assert.deepEqual(keys(byRules.selection), keys(whole.selection), "step " + step);
      for (const each of nodes) {
        assert.equal(well.holdsOf(each), byRules.selection.has(each) ? 2 : 0, "step " + step);
      }
    }
  });
});

describe("a store that waits (design section 3.7)", function () {

  const selectFromRoot = { Object: (root, selection) => selection.add(root.tree), ...selectTree };

  function waiting(well) {
    const reads = [];
    const again = reopen(well, { wait: (arrive) => reads.push(arrive) });
    return { well: again, reads, arrive: () => reads.shift()() };
  }

  it("runs the action when the selection has arrived, one read for each level", function () {
    const { well, reads, arrive } = waiting(withTree(3));
    let seen = null;
    const handle = load(well.root, selectFromRoot, (selection) => { seen = keys(selection); });
    assert.equal(seen, null, "the action has not run when load returns");
    assert.ok(!handle.loaded);
    assert.equal(handle.selection.size, 1, "only the root so far");
    let rounds = 0;
    while (reads.length > 0) {
      assert.equal(reads.length, 1, "one read at a time");
      assert.equal(seen, null);
      arrive();
      rounds++;
    }
    assert.equal(rounds, 3);
    assert.ok(handle.loaded);
    assert.equal(seen.length, 8, "the root and seven nodes");
    for (const object of handle.selection) assert.ok(well.isPinned(object));
  });

  it("follows no reference to what is not in memory, outside a rule", function () {
    const { well, reads, arrive } = waiting(withTree(2));
    assert.throws(() => well.root.tree, /not loaded/);
    const handle = load(well.root, selectFromRoot);
    while (reads.length > 0) arrive();
    const top = well.root.tree; // loaded now
    assert.equal(top.left.key, 0);
    assert.throws(() => top.note, /not loaded/, "the note was not selected");
    handle.release();
  });

  it("says that a selection is incomplete while what a write made it reach is on its way", function () {
    const { well, reads, arrive } = waiting(withTree(3));
    const want = synchronized({ key: 0 });
    const handle = load(well.root, {
      Object: (root, selection) => selection.add(root.tree),
      RuleNode: (node, selection) => {
        if (want.key < node.key) selection.add(node.left);
        else if (want.key > node.key) selection.add(node.right);
      },
    });
    while (reads.length > 0) arrive();
    assert.ok(handle.loaded);
    assert.deepEqual(keys(handle.selection).filter((key) => key !== undefined), [0, 1, 3]);
    want.key = 6; // the path now goes the other way, to nodes that were never read
    assert.ok(!handle.loaded);
    assert.equal(reads.length, 1);
    while (reads.length > 0) arrive();
    assert.ok(handle.loaded);
    assert.deepEqual(keys(handle.selection).filter((key) => key !== undefined), [3, 5, 6]);
  });

  it("makes an array with its elements, which are asked for before it is made", function () {
    const well = openWell();
    transaction(() => { well.root.list = synchronized([new Note(), new Note()]); });
    const { well: again, reads, arrive } = waiting(well);
    const handle = load(again.root, { Object: (root, selection) => selection.add(root.list) });
    arrive(); // the list's record
    assert.ok(!handle.loaded, "the list is not made before its elements have arrived");
    arrive(); // its elements
    assert.ok(handle.loaded);
    assert.equal(again.root.list.length, 2);
    assert.ok(again.root.list[1] instanceof Note);
    assert.equal(reads.length, 0);
  });

  it("drops a read that arrives after the load was released", function () {
    const { well, reads, arrive } = waiting(withTree(3));
    let acted = false;
    const handle = load(well.root, selectFromRoot, () => { acted = true; });
    arrive();
    handle.release();
    while (reads.length > 0) arrive();
    assert.ok(!acted);
    assert.equal(handle.selection.size, 0);
    assert.equal(well.holdsOf(well.root), 0);
  });
});

describe("rule loads: onChange", function () {

  it("is told what joins and leaves the selection, and everything as left on release", function () {
    const well = open({ store: new MemoryStore() });
    try {
      class Link extends Synchronized {
        constructor(name) { super(); this.name = name; this.next = null; }
      }
      registerClasses({ OnChangeLink: Link });
      const a = new Link("a");
      const b = new Link("b");
      const c = new Link("c");
      a.next = b;
      well.root.chain = a;
      const seen = [];
      const handle = well.load(a, { OnChangeLink: (link, selection) => selection.add(link.next) }, {
        onChange: (joined, left) => seen.push([joined.map((link) => link.name).sort(), left.map((link) => link.name).sort()]),
      });
      assert.deepEqual(seen, [[["a", "b"], []]]);
      b.next = c;
      assert.deepEqual(seen[1], [["c"], []]);
      a.next = c;
      assert.deepEqual(seen[2], [[], ["b"]]);
      handle.release();
      assert.deepEqual(seen[3], [[], ["a", "c"]]);
    } finally {
      well.close();
    }
  });

  it("follows the changes of an object that joined when a rule ran again", function () {
    // Its rule repeater was made while the load settled from inside another rule, where
    // recording was once paused: it read nothing, and never ran again.
    const well = open({ store: new MemoryStore() });
    try {
      class Step extends Synchronized {
        constructor(name) { super(); this.name = name; this.next = null; }
      }
      registerClasses({ JoinedStep: Step });
      const first = well.root.first = new Step("first");
      const handle = well.load(first, { JoinedStep: (step, selection) => selection.add(step.next) });
      const second = new Step("second");
      first.next = second; // joins on a rerun of the first rule
      const third = new Step("third");
      second.next = third; // its own rule must see this
      assert.equal(handle.selection.has(third), true);
      second.next = null;
      assert.equal(handle.selection.has(third), false);
    } finally {
      well.close();
    }
  });

  it("is told the same by a load with a whole selector", function () {
    const well = open({ store: new MemoryStore() });
    try {
      well.root.items = synchronized([synchronized({ name: "a" }), synchronized({ name: "b" })]);
      const seen = [];
      const handle = well.load(well.root, (root, selection) => { selection.add(root.items, ...root.items); }, {
        onChange: (joined, left) => seen.push([joined.length, left.length]),
      });
      assert.deepEqual(seen, [[3, 0]]);
      well.root.items.splice(0, 1);
      assert.deepEqual(seen[1], [0, 1]);
      handle.release();
      assert.deepEqual(seen[2], [0, 2]);
    } finally {
      well.close();
    }
  });
});

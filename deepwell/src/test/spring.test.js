import assert from "assert";
import { MemoryStore, checkIntegrity, reachableFromRoot } from "@liquefy/aquifer";
import { open, transaction, Synchronized, synchronized, weak, model, world, DataModelError } from "../index.js";

let constructed = 0;
class Document extends Synchronized {
  title = "Untitled";
  chapters = synchronized([]);
  constructor() {
    super();
    constructed++;
  }
  describe() { return this.title + " (" + this.chapters.length + " chapters)"; }
}
class Chapter extends Synchronized {
  title = "";
  document = null;
}
const classes = { Document, Chapter };

const springs = [];
function openSpring(store = new MemoryStore()) {
  const spring = open({ store, classes });
  springs.push(spring);
  return spring;
}
afterEach(() => { while (springs.length) springs.pop().close(); });

/** Opens the same store again, as a new process would: nothing in memory is shared. */
function reopen(spring) {
  spring.close();
  springs.splice(springs.indexOf(spring), 1);
  return openSpring(spring.db.store);
}

function recordsRead(store, action) {
  const read = new Set();
  const stop = store.observe({ read: (key) => { if (key.startsWith("o/")) read.add(key.slice(2)); } });
  try { action(); } finally { stop(); }
  return read;
}

describe("objects over records: writing and reading back", function () {

  it("stores what is written to the root, and reads it back after reopening", function () {
    const spring = openSpring();
    spring.root.title = "Library";
    spring.root.count = 3;
    spring.root.settings = Object.freeze({ margin: 20 });
    spring.root.when = new Date(1000);
    const again = reopen(spring);
    assert.equal(again.root.title, "Library");
    assert.equal(again.root.count, 3);
    assert.equal(again.root.settings.margin, 20);
    assert.equal(again.root.when.getTime(), 1000);
  });

  it("writes one Aquifer transaction per Cascade transaction", function () {
    const spring = openSpring();
    const before = spring.lastCommit;
    transaction(() => {
      spring.root.a = 1;
      spring.root.b = 2;
      spring.root.c = 3;
    });
    assert.equal(spring.lastCommit, before + 1);
    spring.root.d = 4; // a bare write is a transaction of its own
    assert.equal(spring.lastCommit, before + 2);
  });

  it("stores class instances, and makes them again without running the constructor", function () {
    const spring = openSpring();
    transaction(() => {
      const document = new Document();
      document.title = "Novel";
      const chapter = new Chapter();
      chapter.title = "One";
      chapter.document = document;
      document.chapters.push(chapter);
      spring.root.document = document;
    });
    const before = constructed;
    const again = reopen(spring);
    const document = again.root.document;
    assert.ok(document instanceof Document);
    assert.equal(document.describe(), "Novel (1 chapters)");
    assert.equal(constructed, before, "K1: a constructor runs once, where the object is made");
    assert.strictEqual(document.chapters[0].document, document, "a reference back finds the same object");
  });

  it("deletes fields", function () {
    const spring = openSpring();
    spring.root.gone = "soon";
    delete spring.root.gone;
    const again = reopen(spring);
    assert.ok(!("gone" in again.root));
    assert.deepEqual(Object.keys(again.root), []);
  });

  it("keeps maps, sets and weak references, with objects in them", function () {
    const spring = openSpring();
    transaction(() => {
      const target = new Chapter();
      target.title = "Target";
      spring.root.target = target;
      spring.root.byName = new Map([["t", target]]);
      spring.root.tags = new Set(["a", target]);
      spring.root.loose = weak(target);
    });
    const again = reopen(spring);
    const target = again.root.target;
    assert.strictEqual(again.root.byName.get("t"), target);
    assert.ok([...again.root.tags].includes(target));
    assert.strictEqual(again.root.loose.deref(), target);
  });
});

describe("persistence by reachability (data model O2)", function () {

  it("stores a local object, and what it refers to, when a stored object comes to refer to it", function () {
    const spring = openSpring();
    const document = new Document();
    const chapter = new Chapter();
    document.chapters.push(chapter);
    assert.equal(model.identityOf(document), undefined, "local where it was made");
    spring.root.document = document;
    assert.ok(spring.owns(document) && spring.owns(document.chapters) && spring.owns(chapter));
    const again = reopen(spring);
    assert.equal(again.root.document.chapters.length, 1);
  });

  it("does not store a local object that nothing stored refers to", function () {
    const spring = openSpring();
    const loose = synchronized({ never: "stored" });
    loose.more = 1;
    spring.root.other = 1;
    assert.equal(model.identityOf(loose), undefined);
    assert.equal(spring.db.objectIds().filter((id) => id !== "root").length, 0);
  });

  it("stores later writes to an object that became stored", function () {
    const spring = openSpring();
    const chapter = new Chapter();
    spring.root.chapter = chapter;
    chapter.title = "Changed afterwards";
    assert.equal(reopen(spring).root.chapter.title, "Changed afterwards");
  });

  it("refuses a weak reference to an object that will not be stored", function () {
    const spring = openSpring();
    assert.throws(() => { spring.root.loose = weak(new Chapter()); }, /not stored/);
  });
});

describe("references are resolved when they are read (data model K7)", function () {

  it("makes the root without reading what it refers to", function () {
    const spring = openSpring();
    transaction(() => {
      spring.root.documents = synchronized([]);
      for (let i = 0; i < 5; i++) spring.root.documents.push(new Document());
      spring.root.big = new Document();
    });
    const store = spring.db.store;
    spring.close();
    springs.pop();
    let again;
    const read = recordsRead(store, () => { again = openSpring(store); });
    assert.deepEqual([...read], ["root"], "opening reads the root, nothing else");
    const onFirstUse = recordsRead(store, () => again.root.big.title);
    assert.equal(onFirstUse.size, 1, "reading a field loads the one object it names");
  });

  it("writes a field before it was ever read, as an ordinary change", function () {
    const spring = openSpring();
    spring.root.chapter = new Chapter();
    const again = reopen(spring);
    const replacement = new Chapter();
    replacement.title = "New";
    again.root.chapter = replacement;
    assert.equal(reopen(again).root.chapter.title, "New");
  });

  it("writes an object without loading its unread references", function () {
    const spring = openSpring();
    transaction(() => {
      spring.root.a = new Chapter();
      spring.root.b = new Chapter();
    });
    const again = reopen(spring);
    again.root.title = "touched";
    assert.deepEqual([...again.objects.keys()], ["root"], "only the root is in memory: its unread references were copied");
    const third = reopen(again);
    assert.ok(third.root.a instanceof Chapter && third.root.b instanceof Chapter);
  });

  it("gives one object per identity, however it is reached (O4)", function () {
    const spring = openSpring();
    transaction(() => {
      const chapter = new Chapter();
      spring.root.first = chapter;
      spring.root.second = chapter;
      spring.root.list = synchronized([chapter]);
    });
    const again = reopen(spring);
    assert.strictEqual(again.root.first, again.root.second);
    assert.strictEqual(again.root.list[0], again.root.first);
  });
});

describe("reclaimed records (data model O3)", function () {

  it("makes an object in memory local again when its record is reclaimed, and stores it anew if it is linked in", function () {
    const spring = openSpring();
    const chapter = new Chapter();
    spring.root.chapter = chapter;
    const id = model.identityOf(chapter);
    delete spring.root.chapter;
    spring.workUntilIdle();
    assert.equal(spring.db.get(id), undefined, "reclaimed");
    assert.equal(model.identityOf(chapter), undefined, "local again");
    assert.ok(!spring.owns(chapter));
    chapter.title = "still usable";
    spring.root.again = chapter;
    assert.ok(spring.owns(chapter));
    assert.notEqual(model.identityOf(chapter), id, "a new identity");
    assert.equal(reopen(spring).root.again.title, "still usable");
  });

  it("clears weak references to what was reclaimed", function () {
    const spring = openSpring();
    transaction(() => {
      spring.root.target = new Chapter();
      spring.root.loose = weak(spring.root.target);
    });
    const loose = spring.root.loose;
    assert.ok(loose.deref());
    delete spring.root.target;
    spring.workUntilIdle();
    assert.equal(loose.deref(), undefined);
    assert.equal(reopen(spring).root.loose.deref(), undefined);
  });

  it("keeps Aquifer's invariants, and stores exactly what is reachable", function () {
    const spring = openSpring();
    for (let i = 0; i < 20; i++) {
      transaction(() => {
        const document = new Document();
        for (let j = 0; j < 3; j++) document.chapters.push(new Chapter());
        spring.root["d" + (i % 5)] = document;
      });
    }
    spring.workUntilIdle();
    assert.deepEqual(checkIntegrity(spring.db.store, { quiescent: true }), []);
    assert.equal(spring.db.objectIds().length, reachableFromRoot(spring.db.store).size);
  });
});

describe("refusals", function () {

  it("refuses what the data model refuses, before anything is stored", function () {
    const spring = openSpring();
    const before = spring.lastCommit;
    assert.throws(() => { spring.root.bad = { plain: true }; }, DataModelError);
    assert.equal(spring.lastCommit, before);
  });

  it("refuses a class that is not registered, and returns the objects in memory to what is stored", function () {
    const spring = openSpring();
    class Unregistered extends Synchronized {}
    spring.root.list = synchronized([1, 2]);
    spring.root.kept = "before";
    assert.throws(() => transaction(() => {
      spring.root.kept = "changed";
      delete spring.root.list;
      spring.root.x = new Unregistered();
    }), /not registered/);
    assert.equal(spring.root.kept, "before");
    assert.ok(!("x" in spring.root));
    assert.deepEqual([...spring.root.list], [1, 2]);
    assert.throws(() => transaction(() => {
      spring.root.list.push(3);
      spring.root.list.splice(0, 1, new Unregistered());
    }), /not registered/);
    assert.deepEqual([...spring.root.list], [1, 2]);
    spring.root.after = "fine";
    const again = reopen(spring);
    assert.equal(again.root.kept, "before");
    assert.equal(again.root.after, "fine");
    assert.deepEqual([...again.root.list], [1, 2]);
  });
});

describe("change notification", function () {

  it("reports each commit, with what was created and what changed", function () {
    const spring = openSpring();
    const changes = [];
    spring.onCommit((change) => changes.push(change));
    const chapter = new Chapter();
    spring.root.chapter = chapter;
    chapter.title = "x";
    assert.equal(changes.length, 2);
    assert.deepEqual(changes[0].created, [chapter]);
    assert.deepEqual(changes[0].changed, [spring.root]);
    assert.deepEqual(changes[1].changed, [chapter]);
    assert.equal(changes[1].events[0].type, "set");
    assert.ok(world.isObservable(changes[1].changed[0]));
  });
});

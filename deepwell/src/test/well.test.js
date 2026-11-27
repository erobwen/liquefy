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

const wells = [];
function openWell(store = new MemoryStore()) {
  const well = open({ store, classes });
  wells.push(well);
  return well;
}
afterEach(() => { while (wells.length) wells.pop().close(); });

/** Opens the same store again, as a new process would: nothing in memory is shared. */
function reopen(well) {
  well.close();
  wells.splice(wells.indexOf(well), 1);
  return openWell(well.db.store);
}

function recordsRead(store, action) {
  const read = new Set();
  const stop = store.observe({ read: (key) => { if (key.startsWith("o/")) read.add(key.slice(2)); } });
  try { action(); } finally { stop(); }
  return read;
}

describe("objects over records: writing and reading back", function () {

  it("stores what is written to the root, and reads it back after reopening", function () {
    const well = openWell();
    well.root.title = "Library";
    well.root.count = 3;
    well.root.settings = Object.freeze({ margin: 20 });
    well.root.when = new Date(1000);
    const again = reopen(well);
    assert.equal(again.root.title, "Library");
    assert.equal(again.root.count, 3);
    assert.equal(again.root.settings.margin, 20);
    assert.equal(again.root.when.getTime(), 1000);
  });

  it("writes one Aquifer transaction per Cascade transaction", function () {
    const well = openWell();
    const before = well.lastCommit;
    transaction(() => {
      well.root.a = 1;
      well.root.b = 2;
      well.root.c = 3;
    });
    assert.equal(well.lastCommit, before + 1);
    well.root.d = 4; // a bare write is a transaction of its own
    assert.equal(well.lastCommit, before + 2);
  });

  it("stores class instances, and makes them again without running the constructor", function () {
    const well = openWell();
    transaction(() => {
      const document = new Document();
      document.title = "Novel";
      const chapter = new Chapter();
      chapter.title = "One";
      chapter.document = document;
      document.chapters.push(chapter);
      well.root.document = document;
    });
    const before = constructed;
    const again = reopen(well);
    const document = again.root.document;
    assert.ok(document instanceof Document);
    assert.equal(document.describe(), "Novel (1 chapters)");
    assert.equal(constructed, before, "K1: a constructor runs once, where the object is made");
    assert.strictEqual(document.chapters[0].document, document, "a reference back finds the same object");
  });

  it("deletes fields", function () {
    const well = openWell();
    well.root.gone = "soon";
    delete well.root.gone;
    const again = reopen(well);
    assert.ok(!("gone" in again.root));
    assert.deepEqual(Object.keys(again.root), []);
  });

  it("keeps maps, sets and weak references, with objects in them", function () {
    const well = openWell();
    transaction(() => {
      const target = new Chapter();
      target.title = "Target";
      well.root.target = target;
      well.root.byName = new Map([["t", target]]);
      well.root.tags = new Set(["a", target]);
      well.root.loose = weak(target);
    });
    const again = reopen(well);
    const target = again.root.target;
    assert.strictEqual(again.root.byName.get("t"), target);
    assert.ok([...again.root.tags].includes(target));
    assert.strictEqual(again.root.loose.deref(), target);
  });
});

describe("persistence by reachability (data model O2)", function () {

  it("stores a local object, and what it refers to, when a stored object comes to refer to it", function () {
    const well = openWell();
    const document = new Document();
    const chapter = new Chapter();
    document.chapters.push(chapter);
    assert.equal(model.identityOf(document), undefined, "local where it was made");
    well.root.document = document;
    assert.ok(well.owns(document) && well.owns(document.chapters) && well.owns(chapter));
    const again = reopen(well);
    assert.equal(again.root.document.chapters.length, 1);
  });

  it("does not store a local object that nothing stored refers to", function () {
    const well = openWell();
    const loose = synchronized({ never: "stored" });
    loose.more = 1;
    well.root.other = 1;
    assert.equal(model.identityOf(loose), undefined);
    assert.equal(well.db.objectIds().filter((id) => id !== "root").length, 0);
  });

  it("stores later writes to an object that became stored", function () {
    const well = openWell();
    const chapter = new Chapter();
    well.root.chapter = chapter;
    chapter.title = "Changed afterwards";
    assert.equal(reopen(well).root.chapter.title, "Changed afterwards");
  });

  it("refuses a weak reference to an object that will not be stored", function () {
    const well = openWell();
    assert.throws(() => { well.root.loose = weak(new Chapter()); }, /not stored/);
  });
});

describe("references are resolved when they are read (data model K7)", function () {

  it("makes the root without reading what it refers to", function () {
    const well = openWell();
    transaction(() => {
      well.root.documents = synchronized([]);
      for (let i = 0; i < 5; i++) well.root.documents.push(new Document());
      well.root.big = new Document();
    });
    const store = well.db.store;
    well.close();
    wells.pop();
    let again;
    const read = recordsRead(store, () => { again = openWell(store); });
    assert.deepEqual([...read], ["root"], "opening reads the root, nothing else");
    const onFirstUse = recordsRead(store, () => again.root.big.title);
    assert.equal(onFirstUse.size, 1, "reading a field loads the one object it names");
  });

  it("writes a field before it was ever read, as an ordinary change", function () {
    const well = openWell();
    well.root.chapter = new Chapter();
    const again = reopen(well);
    const replacement = new Chapter();
    replacement.title = "New";
    again.root.chapter = replacement;
    assert.equal(reopen(again).root.chapter.title, "New");
  });

  it("writes an object without loading its unread references", function () {
    const well = openWell();
    transaction(() => {
      well.root.a = new Chapter();
      well.root.b = new Chapter();
    });
    const again = reopen(well);
    again.root.title = "touched";
    assert.deepEqual([...again.objects.keys()], ["root"], "only the root is in memory: its unread references were copied");
    const third = reopen(again);
    assert.ok(third.root.a instanceof Chapter && third.root.b instanceof Chapter);
  });

  it("gives one object per identity, however it is reached (O4)", function () {
    const well = openWell();
    transaction(() => {
      const chapter = new Chapter();
      well.root.first = chapter;
      well.root.second = chapter;
      well.root.list = synchronized([chapter]);
    });
    const again = reopen(well);
    assert.strictEqual(again.root.first, again.root.second);
    assert.strictEqual(again.root.list[0], again.root.first);
  });
});

describe("reclaimed records (data model O3)", function () {

  it("makes an object in memory local again when its record is reclaimed, and stores it anew if it is linked in", function () {
    const well = openWell();
    const chapter = new Chapter();
    well.root.chapter = chapter;
    const id = model.identityOf(chapter);
    delete well.root.chapter;
    well.workUntilIdle();
    assert.equal(well.db.get(id), undefined, "reclaimed");
    assert.equal(model.identityOf(chapter), undefined, "local again");
    assert.ok(!well.owns(chapter));
    chapter.title = "still usable";
    well.root.again = chapter;
    assert.ok(well.owns(chapter));
    assert.notEqual(model.identityOf(chapter), id, "a new identity");
    assert.equal(reopen(well).root.again.title, "still usable");
  });

  it("clears weak references to what was reclaimed", function () {
    const well = openWell();
    transaction(() => {
      well.root.target = new Chapter();
      well.root.loose = weak(well.root.target);
    });
    const loose = well.root.loose;
    assert.ok(loose.deref());
    delete well.root.target;
    well.workUntilIdle();
    assert.equal(loose.deref(), undefined);
    assert.equal(reopen(well).root.loose.deref(), undefined);
  });

  it("keeps Aquifer's invariants, and stores exactly what is reachable", function () {
    const well = openWell();
    for (let i = 0; i < 20; i++) {
      transaction(() => {
        const document = new Document();
        for (let j = 0; j < 3; j++) document.chapters.push(new Chapter());
        well.root["d" + (i % 5)] = document;
      });
    }
    well.workUntilIdle();
    assert.deepEqual(checkIntegrity(well.db.store, { quiescent: true }), []);
    assert.equal(well.db.objectIds().length, reachableFromRoot(well.db.store).size);
  });
});

describe("refusals", function () {

  it("refuses what the data model refuses, before anything is stored", function () {
    const well = openWell();
    const before = well.lastCommit;
    assert.throws(() => { well.root.bad = { plain: true }; }, DataModelError);
    assert.equal(well.lastCommit, before);
  });

  it("refuses a class that is not registered, and returns the objects in memory to what is stored", function () {
    const well = openWell();
    class Unregistered extends Synchronized {}
    well.root.list = synchronized([1, 2]);
    well.root.kept = "before";
    assert.throws(() => transaction(() => {
      well.root.kept = "changed";
      delete well.root.list;
      well.root.x = new Unregistered();
    }), /not registered/);
    assert.equal(well.root.kept, "before");
    assert.ok(!("x" in well.root));
    assert.deepEqual([...well.root.list], [1, 2]);
    assert.throws(() => transaction(() => {
      well.root.list.push(3);
      well.root.list.splice(0, 1, new Unregistered());
    }), /not registered/);
    assert.deepEqual([...well.root.list], [1, 2]);
    well.root.after = "fine";
    const again = reopen(well);
    assert.equal(again.root.kept, "before");
    assert.equal(again.root.after, "fine");
    assert.deepEqual([...again.root.list], [1, 2]);
  });
});

describe("change notification", function () {

  it("reports each commit, with what was created and what changed", function () {
    const well = openWell();
    const changes = [];
    well.onCommit((change) => changes.push(change));
    const chapter = new Chapter();
    well.root.chapter = chapter;
    chapter.title = "x";
    assert.equal(changes.length, 2);
    assert.deepEqual(changes[0].created, [chapter]);
    assert.deepEqual(changes[0].changed, [well.root]);
    assert.deepEqual(changes[1].changed, [chapter]);
    assert.equal(changes[1].events[0].type, "set");
    assert.ok(world.isObservable(changes[1].changed[0]));
  });
});

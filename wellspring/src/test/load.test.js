import assert from "assert";
import { MemoryStore, checkIntegrity } from "@liquefy/aquifer";
import { open, load, transaction, repeat, Synchronized, synchronized, model, world } from "../index.js";

class Document extends Synchronized {
  title = "Untitled";
  chapters = synchronized([]);
}
class Chapter extends Synchronized {
  title = "";
  note = null;
}
class Note extends Synchronized {
  text = "";
}

function selectDocument(document, selection) {
  selection.add(document);
  selection.add(document.chapters);
  for (const chapter of document.chapters) selection.add(chapter);
  // chapter.note is not followed.
}

const springs = [];
function openSpring(store = new MemoryStore()) {
  const spring = open({ store, classes: { LoadDocument: Document, LoadChapter: Chapter, LoadNote: Note } });
  springs.push(spring);
  return spring;
}
afterEach(() => { while (springs.length) springs.pop().close(); });

function reopen(spring) {
  spring.close();
  springs.splice(springs.indexOf(spring), 1);
  return openSpring(spring.db.store);
}

function withDocument(spring, chapters = 2) {
  transaction(() => {
    const document = new Document();
    document.title = "Novel";
    for (let i = 0; i < chapters; i++) {
      const chapter = new Chapter();
      chapter.title = "Chapter " + i;
      chapter.note = new Note();
      document.chapters.push(chapter);
    }
    spring.root.document = document;
  });
  return spring.root.document;
}

describe("load() (design section 3)", function () {

  it("runs the action with the selection in memory, and holds it", function () {
    const spring = reopen((() => { const s = openSpring(); withDocument(s); return s; })());
    const document = spring.root.document;
    let seen = null;
    const handle = load(document, selectDocument, (selection) => { seen = selection; });
    assert.strictEqual(seen, handle.selection);
    assert.equal(handle.selection.size, 4, "the document, its list, two chapters");
    assert.ok(handle.selection.has(document.chapters[1]));
    assert.equal(spring.holdsOf(document), 1);
    assert.ok([...handle.selection].every((object) => spring.isPinned(object)));
    handle.release();
    assert.equal(spring.holdsOf(document), 0);
    assert.ok([...document.chapters].every((object) => !spring.isPinned(object)));
  });

  it("keeps a held object though it is cut from everything, and lets it go when released", function () {
    const spring = openSpring();
    const document = withDocument(spring);
    const id = model.identityOf(document);
    const chapterId = model.identityOf(document.chapters[0]);
    const handle = load(document, selectDocument);
    delete spring.root.document;
    spring.workUntilIdle();
    assert.ok(spring.db.get(id), "pinned: not reclaimed");
    assert.ok(spring.db.get(chapterId));
    assert.equal(model.identityOf(document), id);
    assert.deepEqual(checkIntegrity(spring.db.store, { quiescent: true }), []);

    handle.release();
    spring.workUntilIdle();
    assert.equal(spring.db.get(id), undefined, "released: reclaimed");
    assert.equal(model.identityOf(document), undefined, "and local again");
  });

  it("can link a held object in again, anywhere, after cutting it", function () {
    const spring = openSpring();
    const document = withDocument(spring);
    const handle = load(document, selectDocument);
    delete spring.root.document;
    spring.workUntilIdle();
    spring.root.moved = document;
    handle.release();
    spring.workUntilIdle();
    const again = reopen(spring);
    assert.equal(again.root.moved.title, "Novel");
    assert.equal(again.root.moved.chapters.length, 2);
  });

  it("follows the graph: what joins is held and pinned, what leaves is let go", function () {
    const spring = openSpring();
    const document = withDocument(spring);
    const handle = load(document, selectDocument);
    const added = new Chapter();
    document.chapters.push(added);
    assert.ok(handle.selection.has(added), "joined");
    assert.ok(spring.owns(added) && spring.isPinned(added), "stored and pinned in the same transaction");
    const removed = document.chapters[0];
    document.chapters.splice(0, 1);
    assert.ok(!handle.selection.has(removed), "left");
    assert.equal(spring.holdsOf(removed), 0);
    assert.ok(!spring.isPinned(removed));
    spring.workUntilIdle();
    assert.equal(model.identityOf(removed), undefined, "no longer held, no longer referenced: reclaimed");
    handle.release();
  });

  it("counts overlapping loads, and unpins only when the last lets go", function () {
    const spring = openSpring();
    const document = withDocument(spring);
    const first = load(document, selectDocument);
    const second = load(document, (doc, selection) => selection.add(doc));
    assert.equal(spring.holdsOf(document), 2);
    first.release();
    assert.equal(spring.holdsOf(document), 1);
    assert.ok(spring.isPinned(document));
    assert.ok(!spring.isPinned(document.chapters[0]), "held only by the first");
    second.release();
    assert.ok(!spring.isPinned(document));
  });

  it("ends pins when the store is opened again, as pins are volatile", function () {
    const spring = openSpring();
    const document = withDocument(spring);
    const id = model.identityOf(document);
    load(document, selectDocument);
    delete spring.root.document;
    const again = reopen(spring);
    again.workUntilIdle();
    assert.equal(again.db.get(id), undefined);
  });

  it("can be made from inside a repeater, and loads what it reads there", function () {
    const spring = reopen((() => { const s = openSpring(); withDocument(s); return s; })());
    let handle = null;
    let runs = 0;
    const repeater = repeat(() => {
      runs++;
      if (handle === null) handle = load(spring.root.document, selectDocument);
    });
    assert.equal(handle.selection.size, 4);
    spring.root.document.title = "Changed";
    assert.equal(spring.root.document.title, "Changed");
    world.retractRepeater(repeater);
    handle.release();
    assert.equal(reopen(spring).root.document.title, "Changed");
  });

  it("refuses to start from an object that is not stored", function () {
    openSpring();
    assert.throws(() => load(synchronized({}), selectDocument), /stored object/);
  });
});

describe("unloading (design section 3.4)", function () {

  it("does not keep what a field refers to in memory: the field looks it up", function () {
    const spring = reopen((() => { const s = openSpring(); withDocument(s); return s; })());
    const root = spring.root;
    const target = world.meta(root).target;
    root.document.title; // read it
    const descriptor = Object.getOwnPropertyDescriptor(target, "document");
    assert.equal(typeof(descriptor.get), "function", "still an accessor after being read");
  });

  it("frees what nothing holds, and makes it again from its record when it is read", async function () {
    if (typeof(global.gc) !== "function") this.skip(); // run with --expose-gc
    const spring = reopen((() => { const s = openSpring(); withDocument(s); return s; })());
    const id = (() => model.identityOf(spring.root.document))();
    let collected = false;
    for (let attempt = 0; attempt < 20 && !collected; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      global.gc();
      const entry = spring.objects.get(id);
      collected = entry === undefined || entry.deref() === undefined;
    }
    assert.ok(collected, "unloaded once nothing held it");
    assert.equal(spring.root.document.title, "Novel", "made again from its record");
  });

  it("keeps what a load holds, however little else refers to it", async function () {
    if (typeof(global.gc) !== "function") this.skip();
    const spring = reopen((() => { const s = openSpring(); withDocument(s); return s; })());
    const id = model.identityOf(spring.root.document);
    const handle = (() => load(spring.root.document, selectDocument))();
    for (let attempt = 0; attempt < 5; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      global.gc();
    }
    const entry = spring.objects.get(id);
    assert.ok(entry && entry.deref() !== undefined, "held, so still in memory");
    handle.release();
  });
});

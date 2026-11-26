import assert from "assert";
import { MemoryStore, ROOT, ref } from "@liquefy/aquifer";
import { open, load, transaction, Synchronized, synchronized, model, DataModelError } from "../index.js";

const runs = { constructed: 0, migrated: [] };

class Author extends Synchronized {
  name = "";
}

class Book extends Synchronized {
  static version = 2;
  static migrations = {
    0(book) {
      runs.migrated.push("0:" + book.title);
      book.language = "en";
    },
    1(book) {
      runs.migrated.push("1:" + book.title);
      const author = new Author();
      author.name = book.authorName;
      book.author = author;
      delete book.authorName;
    },
  };
  title = "";
  language = "en";
  author = null;
  constructor() {
    super();
    runs.constructed++;
  }
}

// Version 1 with no migration at all, and one whose migration fails.
class Orphan extends Synchronized {
  static version = 1;
}
class Fragile extends Synchronized {
  static version = 1;
  static migrations = {
    0(object) {
      object.half = "done";
      throw new Error("The migration failed.");
    },
  };
}
class Stamped extends Synchronized {
  static version = 1;
  static migrations = { 0() {} };
}
class Shelf extends Synchronized {
  static version = 1;
  static migrations = {
    0(shelf) { shelf.count = shelf.first ? 1 : 0; }, // reads another object, which is migrated too
  };
}

const classes = { MigBook: Book, MigAuthor: Author, MigOrphan: Orphan, MigFragile: Fragile, MigStamped: Stamped, MigShelf: Shelf };

const springs = [];
function openSpring(store = new MemoryStore(), options = {}) {
  const spring = open({ store, classes, options });
  springs.push(spring);
  return spring;
}
afterEach(() => {
  while (springs.length) springs.pop().close();
  runs.constructed = 0;
  runs.migrated = [];
});

/** Writes records as an older version of the code would have, straight into Aquifer. */
function withOldRecords(make) {
  const spring = openSpring();
  const ids = {};
  spring.db.transaction((tx) => {
    const fields = make((record) => tx.create(record));
    for (const [name, id] of Object.entries(fields)) {
      ids[name] = id;
      tx.set(ROOT, name, ref(id));
    }
  });
  const store = spring.db.store;
  spring.close();
  springs.splice(springs.indexOf(spring), 1);
  return { store, ids };
}

function oldBook(create, title, version = 0) {
  const record = { $class: "MigBook", $version: version, title, authorName: "Anna" };
  if (version >= 1) record.language = "sv";
  return create(record);
}

describe("migrations (design section 8)", function () {

  it("are applied in order when an older record is loaded, before the object is seen", function () {
    const { store, ids } = withOldRecords((create) => ({ book: oldBook(create, "Old") }));
    const spring = openSpring(store);
    assert.deepEqual(runs.migrated, [], "nothing is migrated before it is loaded");
    const book = spring.root.book;
    assert.deepEqual(runs.migrated, ["0:Old", "1:Old"]);
    assert.ok(book instanceof Book);
    assert.equal(book.language, "en");
    assert.equal(book.author.name, "Anna");
    assert.ok(!("authorName" in book));
    assert.equal(runs.constructed, 0, "the constructor does not run (data model K1)");

    const record = spring.db.get(ids.book);
    assert.equal(record.$version, 2, "written back under the class's version");
    assert.equal(record.authorName, undefined);
    assert.ok(spring.isStored(book.author), "what the migration made is stored, by reachability");
  });

  it("start from the version the record was written under", function () {
    const { store } = withOldRecords((create) => ({ book: oldBook(create, "Newer", 1) }));
    const book = openSpring(store).root.book;
    assert.deepEqual(runs.migrated, ["1:Newer"]);
    assert.equal(book.language, "sv", "the first migration did not run");
  });

  it("run once: the object is at the class's version afterwards, also after reopening", function () {
    const { store } = withOldRecords((create) => ({ book: oldBook(create, "Once") }));
    const spring = openSpring(store);
    spring.root.book;
    spring.root.book;
    spring.close();
    springs.splice(springs.indexOf(spring), 1);
    const again = openSpring(store);
    assert.equal(again.root.book.author.name, "Anna");
    assert.equal(runs.migrated.length, 2);
  });

  it("do not run for an object made by the current code", function () {
    const spring = openSpring();
    spring.root.book = new Book();
    const store = spring.db.store;
    spring.close();
    springs.splice(springs.indexOf(spring), 1);
    openSpring(store).root.book;
    assert.deepEqual(runs.migrated, []);
  });

  it("write the new version though the migration changed nothing", function () {
    const { store, ids } = withOldRecords((create) => ({ stamped: create({ $class: "MigStamped", $version: 0, a: 1 }) }));
    const spring = openSpring(store);
    assert.equal(spring.root.stamped.a, 1);
    assert.equal(spring.db.get(ids.stamped).$version, 1);
  });

  it("are a transaction of their own, reported as a migration", function () {
    const { store } = withOldRecords((create) => ({ book: oldBook(create, "Own") }));
    const spring = openSpring(store);
    const changes = [];
    spring.onCommit((change) => changes.push(change));
    const before = spring.lastCommit;
    const book = spring.root.book;
    assert.equal(changes.length, 1);
    assert.ok(changes[0].migration);
    assert.deepEqual(changes[0].changed, [book]);
    assert.deepEqual(changes[0].created, [book.author]);
    assert.equal(spring.lastCommit, before + 1);
    book.title = "Changed";
    assert.equal(changes.length, 2);
    assert.ok(!changes[1].migration);
  });

  it("are kept though the transaction that loaded the object fails", function () {
    const { store, ids } = withOldRecords((create) => ({ book: oldBook(create, "Kept") }));
    const spring = openSpring(store);
    class Unregistered extends Synchronized {}
    assert.throws(() => transaction(() => {
      spring.root.note = "written before the load";
      spring.root.book.title = "Written in the failing transaction";
      spring.root.bad = new Unregistered();
    }));
    const record = spring.db.get(ids.book);
    assert.equal(record.$version, 2, "the migration is stored");
    assert.equal(record.title, "Kept", "the failed transaction's write is not");
    assert.equal(spring.root.book.title, "Kept", "and is undone in memory");
    assert.equal(spring.root.book.author.name, "Anna", "while the migration is not undone");
    assert.ok(!("note" in spring.root));
  });

  it("are not asked about by the checks before writes: they are no user's writes", function () {
    const { store } = withOldRecords((create) => ({ book: oldBook(create, "Unchecked") }));
    const spring = openSpring(store);
    spring.checkWrites(() => { throw new Error("Refused."); });
    assert.equal(spring.root.book.author.name, "Anna");
    assert.throws(() => { spring.root.book.title = "x"; }, /Refused/);
  });

  it("are not recorded as what a computation that caused the load read", function () {
    const { store } = withOldRecords((create) => ({ book: oldBook(create, "Quiet") }));
    const spring = openSpring(store);
    let ruleRuns = 0;
    const handle = load(spring.root, { Object: (root, selection) => { ruleRuns++; selection.add(root.book); } });
    assert.equal(handle.selection.size, 2);
    assert.deepEqual(runs.migrated, ["0:Quiet", "1:Quiet"], "migrated when the round arrived");
    const before = ruleRuns;
    spring.root.book.language = "sv"; // a field the migration wrote, and the rule never read
    assert.equal(ruleRuns, before);
  });

  it("migrate another object that a migration reads", function () {
    const { store, ids } = withOldRecords((create) => {
      const book = oldBook(create, "Inner");
      return { book, shelf: create({ $class: "MigShelf", $version: 0, first: ref(book) }) };
    });
    const spring = openSpring(store);
    assert.equal(spring.root.shelf.count, 1);
    assert.equal(spring.db.get(ids.shelf).$version, 1);
    assert.equal(spring.db.get(ids.book).$version, 2);
    assert.equal(spring.root.shelf.first.author.name, "Anna");
  });

  it("refuse an object that has no migration from its version, and leave its record alone", function () {
    const { store, ids } = withOldRecords((create) => ({ orphan: create({ $class: "MigOrphan", $version: 0, a: 1 }) }));
    const spring = openSpring(store);
    assert.throws(() => spring.root.orphan, /no migration from version 0/);
    assert.throws(() => spring.root.orphan, /no migration from version 0/, "and again: it was not left in memory");
    assert.equal(spring.db.get(ids.orphan).$version, 0);
  });

  it("undo a migration that fails, write nothing, and try again at the next read", function () {
    const { store, ids } = withOldRecords((create) => ({ fragile: create({ $class: "MigFragile", $version: 0, a: 1 }) }));
    const spring = openSpring(store);
    const before = spring.lastCommit;
    assert.throws(() => spring.root.fragile, /The migration failed/);
    assert.deepEqual(spring.db.get(ids.fragile), { $class: "MigFragile", $version: 0, a: 1 });
    assert.equal(spring.lastCommit, before);
    assert.equal(spring.inMemory(ids.fragile), undefined);
    assert.throws(() => spring.root.fragile, /The migration failed/);
    spring.root.other = 1; // the store still works
    assert.equal(spring.lastCommit, before + 1);
  });

  it("refuse a record of a newer version than the registered class", function () {
    const { store } = withOldRecords((create) => ({ book: create({ $class: "MigBook", $version: 7, title: "Future" }) }));
    assert.throws(() => openSpring(store).root.book, /newer than the registered version 2/);
  });

  it("refuse migrations that are not functions named by an older version", function () {
    class Bad extends Synchronized { static version = 1; static migrations = { 1() {} }; }
    assert.throws(() => model.registerClass(Bad, { name: "MigBad" }), DataModelError);
    class Worse extends Synchronized { static version = 1; static migrations = { 0: "rename" }; }
    assert.throws(() => model.registerClass(Worse, { name: "MigWorse" }), DataModelError);
  });
});

describe("completing migrations in the background (design sections 8 and 9.4)", function () {

  function library(count) {
    return withOldRecords((create) => {
      const fields = {};
      for (let i = 0; i < count; i++) fields["book" + i] = oldBook(create, "Book " + i, i % 2);
      return fields;
    });
  }

  it("migrates every older record, a batch for each step of work", function () {
    const { store, ids } = library(120);
    const spring = openSpring(store);
    assert.ok(!spring.work(1).migrating, "nothing is completed until it is asked for");
    spring.completeMigrations();
    let steps = 0;
    for (;;) {
      const result = spring.work(1);
      steps++;
      if (!result.migrating) break;
      assert.ok(result.remaining);
    }
    assert.ok(steps >= 3, "121 records at 50 for each step");
    for (const id of Object.values(ids)) assert.equal(spring.db.get(id).$version, 2);
    assert.equal(runs.migrated.length, 60 * 2 + 60 * 1);
  });

  it("is finished by workUntilIdle, and leaves what is current alone", function () {
    const { store, ids } = library(10);
    const spring = openSpring(store);
    spring.root.book0; // migrated by being loaded
    const before = runs.migrated.length;
    spring.completeMigrations();
    spring.workUntilIdle();
    assert.equal(spring.migrationScan, null);
    for (const id of Object.values(ids)) assert.equal(spring.db.get(id).$version, 2);
    assert.equal(runs.migrated.length - before, 5 * 2 + 5 * 1 - 2);
    const commit = spring.lastCommit;
    spring.completeMigrations();
    spring.workUntilIdle();
    assert.equal(spring.lastCommit, commit, "a second pass finds nothing to do");
  });
});

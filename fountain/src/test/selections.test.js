import assert from "assert";
import { MemoryStore } from "@liquefy/aquifer";
import { open, transaction, Synchronized, synchronized, registerClasses, model } from "@liquefy/deepwell";
import { createFountain, Session, AuthorizationError, applyDelivery } from "../index.js";

class Book extends Synchronized {
  constructor(owner, title) {
    super();
    this.owner = owner;
    this.title = title;
    this.isPublic = true;
    this.chapters = synchronized([]);
    this.settings = synchronized({ margin: 20, notes: synchronized([]) });
    this.author = null;
  }
  canRead(user) { return this.isPublic || this.owner === user; }
}
class Chapter extends Synchronized {
  constructor(title) {
    super();
    this.title = title;
    this.isPublic = true;
    this.paragraphs = synchronized([]);
    this.next = null;
    this.see = null;
  }
  canRead() { return this.isPublic; }
}
class Writer extends Synchronized {
  constructor(name) {
    super();
    this.name = name;
  }
}
registerClasses({ SelectedBook: Book, SelectedChapter: Chapter, SelectedWriter: Writer });

const SCRYPT = { N: 1 << 10, r: 8, p: 1 };
const bookRules = {
  SelectedBook: (book, selection) => selection.add(...book.chapters),
  SelectedChapter: (chapter, selection) => selection.add(chapter.next, chapter.see),
};

class LimitedSession extends Session {
  maySubscribe(selector, start) { return selector === "book"; }
  open() { return true; }
}

const opened = [];
function setUp(SessionClass = Session) {
  const well = open({ store: new MemoryStore() });
  const fountain = createFountain({ well, Session: SessionClass, superUser: { name: "admin", password: "secret" }, scrypt: SCRYPT });
  opened.push({ well, fountain });
  fountain.registerSelector("book", bookRules);
  fountain.registerSelector("bookWhole", bookRules, { whole: true });
  return { well, fountain };
}
afterEach(() => { while (opened.length) { const { well, fountain } = opened.pop(); fountain.close(); well.close(); } });

function reader(fountain) {
  const admin = fountain.sessionFor(fountain.superUser);
  const user = fountain.call(admin, "createUser", [{ name: "reader", password: "r" }]);
  return { user, session: fountain.sessionFor(user) };
}

const ids = (objects) => new Set([...objects].map((object) => model.identityOf(object)));

describe("selections: named selectors", function () {

  it("are what a client subscribes by", function () {
    const { fountain, well } = setUp();
    const { session } = reader(fountain);
    const book = well.root.book = new Book(null, "One");
    book.chapters.push(new Chapter("1"));
    session.home = book;
    const subscription = fountain.subscribe(session, book, "book");
    assert.equal(subscription.selector, "book");
    assert.ok(subscription.selection.has(book.chapters[0]));
    assert.throws(() => fountain.subscribe(session, book, "nothing"), /No selector/);
    assert.throws(() => fountain.registerSelector("book", bookRules), /already/);
  });

  it("are governed by the session", function () {
    const { fountain, well } = setUp(LimitedSession);
    const { session } = reader(fountain);
    const book = well.root.book = new Book(null, "One");
    session.home = book;
    fountain.subscribe(session, book, "book");
    assert.throws(() => fountain.subscribe(session, book, "bookWhole"), AuthorizationError);
    assert.equal(fountain.remoteMethods().includes("maySubscribe"), false);
    assert.equal(fountain.remoteMethods().includes("open"), true);
  });

  it("are numbered by the client, uniquely within the session", function () {
    const { fountain, well } = setUp();
    const { session } = reader(fountain);
    const book = well.root.book = new Book(null, "One");
    session.home = book;
    const first = fountain.subscribe(session, book, "book", { sub: 7 });
    assert.equal(first.sub, 7);
    assert.equal(fountain.subscription(session, 7), first);
    assert.throws(() => fountain.subscribe(session, book, "book", { sub: 7 }), /numbered 7/);
    first.release();
    fountain.subscribe(session, book, "book", { sub: 7 });
    assert.equal(typeof(fountain.subscribe(session, book, "book").sub), "number");
  });
});

describe("selections: parts come along", function () {

  it("selects the arrays and classless objects of what is selected, and theirs in turn", function () {
    const { fountain, well } = setUp();
    const { session } = reader(fountain);
    const book = well.root.book = new Book(null, "One");
    const note = synchronized({ text: "a", marks: synchronized([1, 2]) });
    book.settings.notes.push(note);
    book.chapters.push(new Chapter("1"));
    session.home = book;
    const selection = fountain.subscribe(session, book, { SelectedBook: () => {} }).selection;
    assert.deepEqual(ids(selection), ids([book, book.chapters, book.settings, book.settings.notes, note, note.marks]));
    assert.equal(selection.has(book.chapters[0]), false, "an object of a class comes only if a rule selects it");
  });

  it("follows parts as they are attached and removed", function () {
    const { fountain, well } = setUp();
    const { session } = reader(fountain);
    const book = well.root.book = new Book(null, "One");
    session.home = book;
    const subscription = fountain.subscribe(session, book, { SelectedBook: () => {} });
    const extra = synchronized({ nested: synchronized([]) });
    book.extra = extra;
    assert.ok(subscription.selection.has(extra));
    assert.ok(subscription.selection.has(extra.nested));
    delete book.extra;
    assert.equal(subscription.selection.has(extra), false);
    assert.equal(subscription.selection.has(extra.nested), false);
  });

  it("brings parts along after the store is opened anew, though they are not in memory", function () {
    const store = new MemoryStore();
    let well = open({ store });
    let fountain = createFountain({ well, Session, superUser: { name: "admin", password: "secret" }, scrypt: SCRYPT });
    const book = well.root.book = new Book(null, "One");
    book.settings.notes.push(synchronized({ text: "kept" }));
    fountain.close();
    well.close();
    well = open({ store });
    fountain = createFountain({ well, Session, scrypt: SCRYPT });
    opened.push({ well, fountain });
    const session = fountain.sessionFor(fountain.superUser);
    session.home = well.root.book;
    const selection = fountain.subscribe(session, well.root.book, { SelectedBook: () => {} }).selection;
    assert.equal(selection.size, 5, "the book, its chapters, its settings, the notes, and the note");
  });
});

describe("selections: which subscriptions hold what", function () {

  it("is told to the client, so that it can count without running selectors", function () {
    const { fountain, well } = setUp();
    const { session } = reader(fountain);
    const book = well.root.book = new Book(null, "One");
    const shared = new Chapter("shared");
    book.chapters.push(shared);
    session.home = book;
    const copy = new Map();
    const memberships = new Map();
    const take = () => { for (const delivery of fountain.takeDeliveries(session)) applyDelivery(copy, delivery, memberships); };
    const whole = fountain.subscribe(session, book, "book", { sub: 1 });
    take();
    assert.deepEqual(memberships.get(model.identityOf(shared)), [1]);
    const own = fountain.subscribe(session, shared, { SelectedChapter: () => {} }, { sub: 2 });
    take();
    assert.deepEqual(memberships.get(model.identityOf(shared)), [1, 2], "held by both: counted twice");
    assert.deepEqual(memberships.get(model.identityOf(book)), [1]);
    whole.release();
    take();
    assert.deepEqual(memberships.get(model.identityOf(shared)), [2], "still held by the other");
    assert.equal(copy.has(model.identityOf(shared)), true);
    assert.equal(copy.has(model.identityOf(book)), false);
    own.release();
    take();
    assert.equal(copy.has(model.identityOf(shared)), false);
    assert.deepEqual(fountain.membershipsOf(session), new Map());
  });
});

describe("selections: incremental against whole", function () {

  function random(seed) {
    let state = seed >>> 0;
    return () => {
      state = (state + 0x6D2B79F5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  for (const seed of [31, 32, 33, 34, 35]) {
    it("give the selection computed from nothing, through cycles, removals and rights (seed " + seed + ")", function () {
      this.timeout(30000);
      const next = random(seed);
      const pick = (list) => (list.length === 0 ? null : list[Math.floor(next() * list.length)]);
      const { fountain, well } = setUp();
      const { user, session } = reader(fountain);
      const book = well.root.book = new Book(user, "Book");
      well.root.spare = synchronized([]);
      const chapters = [];
      session.home = book;
      const incremental = fountain.subscribe(session, book, "book", { sub: 1 });
      const whole = fountain.subscribe(session, book, "bookWhole", { sub: 2 });
      const copy = new Map();
      const memberships = new Map();

      for (let step = 0; step < 300; step++) {
        transaction(() => {
          for (let i = 0; i < 1 + Math.floor(next() * 3); i++) {
            const choice = next();
            const chapter = pick(chapters);
            if (choice < 0.15 || chapter === null) {
              const made = new Chapter("c" + step);
              chapters.push(made);
              if (next() < 0.7) book.chapters.push(made);
              else well.root.spare.push(made);
            } else if (choice < 0.25) {
              const at = book.chapters.indexOf(chapter);
              if (at !== -1) book.chapters.splice(at, 1);
              else book.chapters.push(chapter);
            } else if (choice < 0.45) {
              chapter.next = next() < 0.8 ? pick(chapters) : null; // cycles among chapters
            } else if (choice < 0.55) {
              chapter.see = next() < 0.7 ? pick(chapters) : null;
            } else if (choice < 0.7) {
              chapter.isPublic = next() < 0.75;
            } else if (choice < 0.75) {
              book.isPublic = next() < 0.5;
            } else if (choice < 0.8) {
              book.owner = next() < 0.8 ? user : null;
            } else if (choice < 0.9) {
              const lines = chapter.paragraphs;
              if (lines.length > 0 && next() < 0.4) lines.splice(0, 1);
              else lines.push(synchronized({ text: "p" + step }));
            } else if (choice < 0.95) {
              book.settings.notes.push(synchronized([step]));
            } else {
              book.author = next() < 0.5 ? new Writer("w" + step) : null;
            }
          }
        });
        const expected = ids(fountain.recomputeSelection(session, incremental));
        assert.deepEqual(ids(incremental.selection), expected, "the incremental selection, at step " + step);
        assert.deepEqual(ids(whole.selection), expected, "the whole selection, at step " + step);
        assert.ok(!incremental.selection.has(book.author) || book.author === null, "a reference that the selector does not follow is not followed");

        for (const delivery of fountain.takeDeliveries(session)) applyDelivery(copy, delivery, memberships);
        assert.deepEqual(memberships, fountain.membershipsOf(session), "what the client counts, at step " + step);
        assert.deepEqual(new Set(copy.keys()), new Set(fountain.clientView(session).keys()), "what the client holds, at step " + step);
      }
    });
  }
});

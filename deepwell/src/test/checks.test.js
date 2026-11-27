import assert from "assert";
import { MemoryStore } from "@liquefy/aquifer";
import { open, transaction, Synchronized, synchronized, weak, model, DataModelError } from "../index.js";

class Paper extends Synchronized {
  title = "";
  lockedBy = null;
  owner = "";
}
class Cursor extends Synchronized {
  static volatile = true;
  offset = 0;
  paper = null;
}

const springs = [];
function openSpring(store = new MemoryStore()) {
  const spring = open({ store, classes: { CheckPaper: Paper, CheckCursor: Cursor } });
  springs.push(spring);
  return spring;
}
afterEach(() => { while (springs.length) springs.pop().close(); });

function reopen(spring) {
  spring.close();
  springs.splice(springs.indexOf(spring), 1);
  return openSpring(spring.db.store);
}

describe("checks before writes (design section 4)", function () {

  it("are asked about every write to an object of the store, with the operation", function () {
    const spring = openSpring();
    transaction(() => {
      spring.root.paper = new Paper();
      spring.root.list = synchronized([1, 2]);
    });
    const seen = [];
    spring.checkWrites(({ object, key, value, operation }) => seen.push([object === spring.root.list ? "list" : "paper", key, value, operation]));
    const paper = spring.root.paper;
    const list = spring.root.list;
    paper.title = "T";
    delete paper.owner;
    list.push(3);
    list.sort();
    list.pop();
    assert.deepEqual(seen, [
      ["paper", "title", "T", "set"],
      ["paper", "owner", undefined, "delete"],
      ["list", undefined, undefined, "push"], ["list", undefined, 3, "add"],
      ["list", undefined, undefined, "sort"],
      ["list", undefined, undefined, "pop"],
    ]);
  });

  it("are not asked about local objects, nor about loading or rolling back", function () {
    const spring = openSpring();
    let asked = 0;
    spring.checkWrites(() => { asked++; });
    const local = synchronized({});
    local.a = 1;
    assert.equal(asked, 0, "local");
    spring.root.a = 1;
    assert.equal(asked, 1);
    const again = reopen(spring);
    asked = 0;
    again.checkWrites(() => { asked++; });
    again.root.a; // loading the root and reading a field writes nothing
    assert.equal(asked, 0);
  });

  it("refuse a write by throwing, before it is made: nothing to undo, nothing stored", function () {
    const spring = openSpring();
    spring.root.paper = new Paper();
    const paper = spring.root.paper;
    const before = spring.lastCommit;
    spring.checkWrites(({ key }) => { if (key === "owner") throw new Error("Not yours."); });
    assert.throws(() => { paper.owner = "me"; }, /Not yours/);
    assert.equal(paper.owner, "");
    assert.equal(spring.lastCommit, before);
    paper.title = "allowed";
    assert.equal(reopen(spring).root.paper.title, "allowed");
  });

  it("see the state before the write, which is what makes a lock work", function () {
    const spring = openSpring();
    spring.root.paper = new Paper();
    const paper = spring.root.paper;
    let user = "anna";
    spring.checkWrites(({ object, key, value }) => {
      if (object !== paper) return;
      if (paper.lockedBy !== null && paper.lockedBy !== user) throw new Error("Locked by " + paper.lockedBy + ".");
      if (key === "lockedBy" && value !== null && paper.lockedBy !== null && paper.lockedBy !== value) throw new Error("Taken.");
    });
    paper.lockedBy = "anna";
    paper.title = "Anna's";
    user = "bert";
    assert.throws(() => { paper.lockedBy = "bert"; }, /Locked by anna/);
    assert.throws(() => { paper.title = "Bert's"; }, /Locked by anna/);
    user = "anna";
    paper.lockedBy = null;
    user = "bert";
    paper.lockedBy = "bert";
    paper.title = "Bert's";
    assert.equal(reopen(spring).root.paper.title, "Bert's");
  });

  it("are asked once for a write to a field that was never read", function () {
    const spring = openSpring();
    spring.root.paper = new Paper();
    const again = reopen(spring);
    let asked = 0;
    again.checkWrites(() => { asked++; });
    again.root.paper = new Paper();
    assert.equal(asked, 1);
  });

  it("can be removed", function () {
    const spring = openSpring();
    const remove = spring.checkWrites(() => { throw new Error("No."); });
    assert.throws(() => { spring.root.a = 1; }, /No/);
    remove();
    spring.root.a = 1;
  });
});

describe("volatile objects (design section 2)", function () {

  it("are synchronized and identified, but never stored", function () {
    const spring = openSpring();
    const session = spring.volatile(synchronized({ user: null }));
    assert.match(model.identityOf(session), /^v\d+$/);
    assert.ok(spring.isVolatile(session) && !spring.isStored(session));
    const changes = [];
    spring.onCommit((change) => changes.push(change));
    const before = spring.lastCommit;
    session.user = "anna";
    assert.equal(spring.lastCommit, before, "no Aquifer transaction");
    assert.equal(changes.length, 1);
    assert.equal(changes[0].commit, null, "changes to volatile objects have no commit number");
    assert.deepEqual(changes[0].volatileChanged, [session]);
    assert.equal(spring.db.objectIds().length, 1, "only the root is stored");
  });

  it("may refer to stored objects, and make local objects they refer to volatile", function () {
    const spring = openSpring();
    spring.root.paper = new Paper();
    const connection = spring.volatile(synchronized({ cursors: synchronized([]) }));
    assert.ok(spring.isVolatile(connection.cursors), "made volatile with it");
    const cursor = new Cursor();
    cursor.paper = spring.root.paper;
    connection.cursors.push(cursor);
    assert.ok(spring.isVolatile(cursor), "became volatile when a volatile object came to refer to it");
    assert.strictEqual(cursor.paper, spring.root.paper);
    assert.ok(spring.isStored(spring.root.paper));
  });

  it("are never referred to by stored objects", function () {
    const spring = openSpring();
    const session = spring.volatile(synchronized({}));
    assert.throws(() => { spring.root.session = session; }, /volatile/);
    assert.throws(() => { spring.root.map = new Map([["s", session]]); }, /volatile/);
    assert.throws(() => { spring.root.loose = weak(session); }, /volatile/);
    assert.ok(!("session" in spring.root));
  });

  it("refuse, through a local object, to be referred to by what is stored", function () {
    const spring = openSpring();
    const session = spring.volatile(synchronized({}));
    const local = synchronized({ session });
    assert.throws(() => { spring.root.holder = local; }, /volatile/);
    assert.ok(!("holder" in spring.root), "rolled back");
    assert.equal(model.identityOf(local), undefined);
  });

  it("of a volatile class are refused where they would be stored", function () {
    const spring = openSpring();
    const cursor = new Cursor();
    assert.throws(() => { spring.root.cursor = cursor; }, /volatile class/);
    assert.ok(!("cursor" in spring.root));
    assert.equal(model.identityOf(cursor), undefined);
  });

  it("are checked before writes, like stored objects", function () {
    const spring = openSpring();
    const session = spring.volatile(synchronized({ user: null }));
    spring.checkWrites(({ object, key }) => { if (object === session && key === "user") throw new Error("Sign in through a method."); });
    assert.throws(() => { session.user = "anna"; }, /Sign in/);
  });

  it("are gone after reopening, while what they referred to stays", function () {
    const spring = openSpring();
    spring.root.paper = new Paper();
    const cursor = spring.volatile(new Cursor());
    cursor.paper = spring.root.paper;
    const again = reopen(spring);
    assert.ok(again.root.paper instanceof Paper);
    assert.equal(again.objectFor(model.identityOf(cursor)), null);
  });

  it("refuse volatile() for what is stored or volatile already", function () {
    const spring = openSpring();
    spring.root.paper = new Paper();
    assert.throws(() => spring.volatile(spring.root.paper), /local object/);
    const session = spring.volatile(synchronized({}));
    assert.throws(() => spring.volatile(session), /local object/);
    assert.throws(() => spring.volatile({}), DataModelError);
  });
});

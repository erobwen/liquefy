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

const wells = [];
function openWell(store = new MemoryStore()) {
  const well = open({ store, classes: { CheckPaper: Paper, CheckCursor: Cursor } });
  wells.push(well);
  return well;
}
afterEach(() => { while (wells.length) wells.pop().close(); });

function reopen(well) {
  well.close();
  wells.splice(wells.indexOf(well), 1);
  return openWell(well.db.store);
}

describe("checks before writes (design section 4)", function () {

  it("are asked about every write to an object of the store, with the operation", function () {
    const well = openWell();
    transaction(() => {
      well.root.paper = new Paper();
      well.root.list = synchronized([1, 2]);
    });
    const seen = [];
    well.checkWrites(({ object, key, value, operation }) => seen.push([object === well.root.list ? "list" : "paper", key, value, operation]));
    const paper = well.root.paper;
    const list = well.root.list;
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
    const well = openWell();
    let asked = 0;
    well.checkWrites(() => { asked++; });
    const local = synchronized({});
    local.a = 1;
    assert.equal(asked, 0, "local");
    well.root.a = 1;
    assert.equal(asked, 1);
    const again = reopen(well);
    asked = 0;
    again.checkWrites(() => { asked++; });
    again.root.a; // loading the root and reading a field writes nothing
    assert.equal(asked, 0);
  });

  it("refuse a write by throwing, before it is made: nothing to undo, nothing stored", function () {
    const well = openWell();
    well.root.paper = new Paper();
    const paper = well.root.paper;
    const before = well.lastCommit;
    well.checkWrites(({ key }) => { if (key === "owner") throw new Error("Not yours."); });
    assert.throws(() => { paper.owner = "me"; }, /Not yours/);
    assert.equal(paper.owner, "");
    assert.equal(well.lastCommit, before);
    paper.title = "allowed";
    assert.equal(reopen(well).root.paper.title, "allowed");
  });

  it("see the state before the write, which is what makes a lock work", function () {
    const well = openWell();
    well.root.paper = new Paper();
    const paper = well.root.paper;
    let user = "anna";
    well.checkWrites(({ object, key, value }) => {
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
    assert.equal(reopen(well).root.paper.title, "Bert's");
  });

  it("are asked once for a write to a field that was never read", function () {
    const well = openWell();
    well.root.paper = new Paper();
    const again = reopen(well);
    let asked = 0;
    again.checkWrites(() => { asked++; });
    again.root.paper = new Paper();
    assert.equal(asked, 1);
  });

  it("can be removed", function () {
    const well = openWell();
    const remove = well.checkWrites(() => { throw new Error("No."); });
    assert.throws(() => { well.root.a = 1; }, /No/);
    remove();
    well.root.a = 1;
  });
});

describe("volatile objects (design section 2)", function () {

  it("are synchronized and identified, but never stored", function () {
    const well = openWell();
    const session = well.volatile(synchronized({ user: null }));
    assert.match(model.identityOf(session), /^v\d+$/);
    assert.ok(well.isVolatile(session) && !well.isStored(session));
    const changes = [];
    well.onCommit((change) => changes.push(change));
    const before = well.lastCommit;
    session.user = "anna";
    assert.equal(well.lastCommit, before, "no Aquifer transaction");
    assert.equal(changes.length, 1);
    assert.equal(changes[0].commit, null, "changes to volatile objects have no commit number");
    assert.deepEqual(changes[0].volatileChanged, [session]);
    assert.equal(well.db.objectIds().length, 1, "only the root is stored");
  });

  it("may refer to stored objects, and make local objects they refer to volatile", function () {
    const well = openWell();
    well.root.paper = new Paper();
    const connection = well.volatile(synchronized({ cursors: synchronized([]) }));
    assert.ok(well.isVolatile(connection.cursors), "made volatile with it");
    const cursor = new Cursor();
    cursor.paper = well.root.paper;
    connection.cursors.push(cursor);
    assert.ok(well.isVolatile(cursor), "became volatile when a volatile object came to refer to it");
    assert.strictEqual(cursor.paper, well.root.paper);
    assert.ok(well.isStored(well.root.paper));
  });

  it("are never referred to by stored objects", function () {
    const well = openWell();
    const session = well.volatile(synchronized({}));
    assert.throws(() => { well.root.session = session; }, /volatile/);
    assert.throws(() => { well.root.map = new Map([["s", session]]); }, /volatile/);
    assert.throws(() => { well.root.loose = weak(session); }, /volatile/);
    assert.ok(!("session" in well.root));
  });

  it("refuse, through a local object, to be referred to by what is stored", function () {
    const well = openWell();
    const session = well.volatile(synchronized({}));
    const local = synchronized({ session });
    assert.throws(() => { well.root.holder = local; }, /volatile/);
    assert.ok(!("holder" in well.root), "rolled back");
    assert.equal(model.identityOf(local), undefined);
  });

  it("of a volatile class are refused where they would be stored", function () {
    const well = openWell();
    const cursor = new Cursor();
    assert.throws(() => { well.root.cursor = cursor; }, /volatile class/);
    assert.ok(!("cursor" in well.root));
    assert.equal(model.identityOf(cursor), undefined);
  });

  it("are checked before writes, like stored objects", function () {
    const well = openWell();
    const session = well.volatile(synchronized({ user: null }));
    well.checkWrites(({ object, key }) => { if (object === session && key === "user") throw new Error("Sign in through a method."); });
    assert.throws(() => { session.user = "anna"; }, /Sign in/);
  });

  it("are gone after reopening, while what they referred to stays", function () {
    const well = openWell();
    well.root.paper = new Paper();
    const cursor = well.volatile(new Cursor());
    cursor.paper = well.root.paper;
    const again = reopen(well);
    assert.ok(again.root.paper instanceof Paper);
    assert.equal(again.objectFor(model.identityOf(cursor)), null);
  });

  it("refuse volatile() for what is stored or volatile already", function () {
    const well = openWell();
    well.root.paper = new Paper();
    assert.throws(() => well.volatile(well.root.paper), /local object/);
    const session = well.volatile(synchronized({}));
    assert.throws(() => well.volatile(session), /local object/);
    assert.throws(() => well.volatile({}), DataModelError);
  });
});

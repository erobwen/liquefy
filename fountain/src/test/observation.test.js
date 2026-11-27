import assert from "assert";
import { MemoryStore } from "@liquefy/aquifer";
import { open, transaction, Synchronized, synchronized, registerClasses, model } from "@liquefy/deepwell";
import { createFountain, Session, ALL, applyDelivery } from "../index.js";
import { recordReferences } from "../observation.js";

class Folder extends Synchronized {
  constructor(name) {
    super();
    this.name = name;
    this.documents = synchronized([]);
  }
}
class Page extends Synchronized {
  constructor(owner, title) {
    super();
    this.owner = owner;
    this.title = title;
    this.isPublic = false;
    this.lines = synchronized([]);
    this.related = null;
  }
  canRead(user) { return this.isPublic || this.owner === user; }
}
class Remark extends Synchronized {
  constructor(text) {
    super();
    this.text = text;
  }
}
registerClasses({ ObservedFolder: Folder, ObservedPage: Page, ObservedRemark: Remark });

const SCRYPT = { N: 1 << 10, r: 8, p: 1 };
const rules = {
  ObservedFolder: (folder, selection) => selection.add(folder.documents),
  Array: (array, selection) => selection.add(...array.filter((item) => item instanceof Page)),
  ObservedPage: (page, selection) => selection.add(page.lines),
};

const opened = [];
function setUp() {
  const well = open({ store: new MemoryStore() });
  const fountain = createFountain({ well, Session, superUser: { name: "admin", password: "secret" }, scrypt: SCRYPT });
  opened.push({ well, fountain });
  return { well, fountain };
}
afterEach(() => { while (opened.length) { const { well, fountain } = opened.pop(); fountain.close(); well.close(); } });

function users(fountain) {
  const admin = fountain.sessionFor(fountain.superUser);
  const alice = fountain.call(admin, "createUser", [{ name: "alice", password: "a" }]);
  const bob = fountain.call(admin, "createUser", [{ name: "bob", password: "b" }]);
  return { alice, bob };
}

/** A client: its copy of what it holds, by identity, and the stubs it has been told of. */
function client(fountain, session) {
  const copy = new Map();
  const stubs = new Map();
  const deliveries = [];
  const take = () => {
    for (const delivery of fountain.takeDeliveries(session)) {
      deliveries.push(delivery);
      applyDelivery(copy, delivery);
      for (const stub of delivery.stubs) stubs.set(stub.id, stub.class);
    }
    return copy;
  };
  return { copy, stubs, deliveries, take };
}

describe("observation: change sets", function () {

  it("say which objects and fields a commit wrote, and which objects it stored", function () {
    const { well, fountain } = setUp();
    const sets = [];
    fountain.onChangeSet((set) => sets.push(set));
    well.root.folder = new Folder("f");
    const folder = well.root.folder;
    const id = model.identityOf(folder);
    assert.ok(sets.at(-1).created.has(id));
    transaction(() => {
      folder.name = "g";
      folder.name = "h";
      folder.documents.push(new Remark("x"));
    });
    const last = sets.at(-1);
    assert.equal(last.commit, well.lastCommit);
    assert.deepEqual([...last.objects.get(id)], ["name"]);
    assert.equal(last.objects.get(model.identityOf(folder.documents)), ALL);
    assert.equal(last.has(id, "name"), true);
    assert.equal(last.has(id, "documents"), false);
  });
});

describe("observation: observers", function () {

  it("run again when a commit writes what they read, and only then", function () {
    const { well, fountain } = setUp();
    well.root.page = new Page(null, "One");
    const page = well.root.page;
    const seen = [];
    const observer = fountain.observe(() => page.title + "/" + page.lines.length, (value, set) => seen.push([value, set.commit]));
    assert.equal(observer.value, "One/0");
    page.isPublic = true;
    assert.deepEqual(seen, [], "a field it did not read");
    page.title = "Two";
    page.lines.push("a");
    assert.deepEqual(seen.map(([value]) => value), ["Two/0", "Two/1"]);
    assert.equal(seen[1][1], well.lastCommit);
    observer.stop();
    page.title = "Three";
    assert.equal(seen.length, 2);
  });

  it("read by identity, so what they read may be unloaded in between", function () {
    const { well, fountain } = setUp();
    well.root.pages = synchronized([new Page(null, "Kept")]);
    const id = model.identityOf(well.root.pages[0]);
    const observer = fountain.observe(() => well.root.pages[0].title);
    assert.equal(observer.reads.get(id).has("title"), true);
    assert.equal(observer.reads.has(model.identityOf(well.root)), true);
    assert.equal(observer.reads.get(model.identityOf(well.root.pages)), ALL, "an array's elements");
  });

  it("see an object's new fields when they read its keys", function () {
    const { well, fountain } = setUp();
    well.root.bag = synchronized({ a: 1 });
    const bag = well.root.bag;
    let runs = 0;
    fountain.observe(() => Object.keys(bag).length, () => runs++);
    bag.b = 2;
    assert.equal(runs, 1);
  });
});

describe("observation: what a session is sent", function () {

  function library(fountain, well) {
    const { alice, bob } = users(fountain);
    const folder = well.root.folder = new Folder("Shared");
    const open = new Page(alice, "Open");
    open.isPublic = true;
    open.lines.push("first");
    const closed = new Page(alice, "Closed");
    folder.documents.push(open, closed);
    return { alice, bob, folder, open, closed };
  }

  it("starts with the session itself", function () {
    const { fountain } = setUp();
    const session = fountain.createSession();
    const [first] = fountain.takeDeliveries(session);
    assert.equal(first.joined.length, 1);
    assert.equal(first.joined[0].id, model.identityOf(session));
    assert.equal(first.joined[0].record.$class, "Fountain.Session");
    assert.deepEqual(fountain.takeDeliveries(session), []);
  });

  it("sends what joins a selection whole, with stubs for what it refers to and does not hold", function () {
    const { fountain, well } = setUp();
    const { bob, folder, open, closed } = library(fountain, well);
    const session = fountain.sessionFor(bob);
    session.home = folder;
    fountain.takeDeliveries(session);
    fountain.subscribe(session, folder, rules);
    well.root.touch = 1; // a commit, after which the session's delivery is made
    const [delivery] = fountain.takeDeliveries(session);
    const ids = delivery.joined.map((joined) => joined.id);
    for (const object of [folder, folder.documents, open, open.lines]) assert.ok(ids.includes(model.identityOf(object)));
    assert.equal(ids.includes(model.identityOf(closed)), false, "not readable: not sent");
    assert.deepEqual(delivery.stubs.find((stub) => stub.id === model.identityOf(closed)), { id: model.identityOf(closed), class: "ObservedPage" }, "its existence is visible (E1)");
  });

  it("sends the fields a commit wrote to what the session held, once each, with their last value", function () {
    const { fountain, well } = setUp();
    const { bob, folder, open } = library(fountain, well);
    const session = fountain.sessionFor(bob);
    session.home = folder;
    fountain.subscribe(session, folder, rules);
    fountain.takeDeliveries(session);
    transaction(() => {
      open.title = "Renamed";
      open.title = "Renamed again";
      delete open.related;
      open.lines.push("second");
      open.lines.splice(0, 1);
    });
    const [delivery] = fountain.takeDeliveries(session);
    assert.equal(delivery.commit, well.lastCommit);
    const page = delivery.changed.find((change) => change.id === model.identityOf(open));
    assert.deepEqual(page.fields, { title: "Renamed again" });
    assert.deepEqual(page.deleted, ["related"]);
    const lines = delivery.changed.find((change) => change.id === model.identityOf(open.lines));
    assert.deepEqual(lines.splices, [{ index: 1, removed: 0, added: ["second"] }, { index: 0, removed: 1, added: [] }]);
  });

  it("sends nothing for a commit that wrote nothing the session holds", function () {
    const { fountain, well } = setUp();
    const { bob, folder, closed } = library(fountain, well);
    const session = fountain.sessionFor(bob);
    session.home = folder;
    fountain.subscribe(session, folder, rules);
    fountain.takeDeliveries(session);
    closed.title = "Not his";
    well.root.elsewhere = new Remark("unrelated");
    assert.deepEqual(fountain.takeDeliveries(session), []);
  });

  it("tells the client to drop what leaves, as a right is taken away, and what joins as one is given", function () {
    const { fountain, well } = setUp();
    const { bob, folder, open, closed } = library(fountain, well);
    const session = fountain.sessionFor(bob);
    session.home = folder;
    fountain.subscribe(session, folder, rules);
    fountain.takeDeliveries(session);
    transaction(() => {
      open.isPublic = false;
      closed.isPublic = true;
    });
    const [delivery] = fountain.takeDeliveries(session);
    assert.deepEqual(new Set(delivery.left), new Set([model.identityOf(open), model.identityOf(open.lines)]));
    assert.ok(delivery.joined.some((joined) => joined.id === model.identityOf(closed)));
  });

  it("sends nothing of what joined and left within one transaction", function () {
    const { fountain, well } = setUp();
    const { bob, folder, closed } = library(fountain, well);
    const session = fountain.sessionFor(bob);
    session.home = folder;
    fountain.subscribe(session, folder, rules);
    fountain.takeDeliveries(session);
    transaction(() => {
      closed.isPublic = true;
      closed.isPublic = false;
    });
    assert.deepEqual(fountain.takeDeliveries(session), []);
  });

  it("drops everything when the session signs out", function () {
    const { fountain, well } = setUp();
    const { folder } = library(fountain, well);
    const session = fountain.createSession();
    fountain.call(session, "signIn", ["bob", "b"]);
    session.home = folder;
    fountain.subscribe(session, folder, rules);
    const mirror = client(fountain, session);
    mirror.take();
    assert.ok(mirror.copy.size > 1);
    fountain.call(session, "signOut");
    mirror.take();
    assert.deepEqual([...mirror.copy.keys()], [model.identityOf(session)], "only the session is left");
    assert.equal(mirror.copy.get(model.identityOf(session)).user, null);
  });
});

describe("observation: a client that applies what it is sent", function () {

  /** A small deterministic random number generator. */
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

  function sameAsServer(fountain, session, mirror, step) {
    const view = fountain.clientView(session);
    assert.deepEqual(new Set(mirror.copy.keys()), new Set(view.keys()), "what it holds, at step " + step);
    for (const [id, record] of view) assert.deepEqual(mirror.copy.get(id), record, "the record of " + id + ", at step " + step);
    for (const record of mirror.copy.values()) {
      for (const id of recordReferences(record)) {
        assert.ok(mirror.copy.has(id) || mirror.stubs.has(id), "a reference to " + id + " that the client was not told of, at step " + step);
      }
    }
  }

  for (const seed of [21, 22, 23, 24]) {
    it("converges with what the server holds for it, after every commit (seed " + seed + ")", function () {
      this.timeout(20000);
      const next = random(seed);
      const pick = (list) => list[Math.floor(next() * list.length)];
      const { fountain, well } = setUp();
      const { alice, bob } = users(fountain);
      const folder = well.root.folder = new Folder("Shared");
      const people = [alice, bob, null];
      const sessions = [fountain.sessionFor(alice), fountain.sessionFor(bob)];
      const mirrors = sessions.map((session) => client(fountain, session));
      for (const session of sessions) {
        session.home = folder;
        fountain.subscribe(session, folder, rules);
      }
      for (let step = 0; step < 250; step++) {
        const pages = [...folder.documents];
        transaction(() => {
          for (let i = 0; i < 1 + Math.floor(next() * 3); i++) {
            const choice = next();
            if (choice < 0.2 || pages.length === 0) {
              const page = new Page(pick(people), "p" + step);
              page.isPublic = next() < 0.5;
              folder.documents.push(page);
            } else if (choice < 0.3) {
              const page = pick(pages);
              const at = folder.documents.indexOf(page);
              if (at !== -1) folder.documents.splice(at, 1);
            } else if (choice < 0.45) {
              pick(pages).title = "t" + Math.floor(next() * 100);
            } else if (choice < 0.6) {
              pick(pages).isPublic = next() < 0.5;
            } else if (choice < 0.7) {
              pick(pages).owner = pick(people);
            } else if (choice < 0.85) {
              const lines = pick(pages).lines;
              if (lines.length > 0 && next() < 0.4) lines.splice(Math.floor(next() * lines.length), 1);
              else lines.splice(Math.floor(next() * (lines.length + 1)), 0, "l" + step);
            } else if (choice < 0.95) {
              pick(pages).related = next() < 0.7 ? new Remark("r" + step) : pick(pages);
            } else {
              folder.name = "f" + step;
            }
          }
        });
        if (next() < 0.03) {
          const index = Math.floor(next() * 2);
          for (const subscription of fountain.subscriptionsOf(sessions[index])) subscription.release();
          fountain.subscribe(sessions[index], folder, rules);
        }
        for (let i = 0; i < sessions.length; i++) {
          mirrors[i].take();
          sameAsServer(fountain, sessions[i], mirrors[i], step);
        }
      }
      for (const mirror of mirrors) {
        const commits = mirror.deliveries.map((delivery) => delivery.commit).filter((commit) => commit !== null);
        assert.deepEqual(commits, [...commits].sort((a, b) => a - b), "deliveries come in the order of their commits");
      }
    });
  }
});

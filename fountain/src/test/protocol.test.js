import assert from "assert";
import { MemoryStore } from "@liquefy/aquifer";
import { open, transaction, Synchronized, synchronized, registerClasses, model } from "@liquefy/deepwell";
import { createFountain, Session, RemoteError, classesDigest, PROTOCOL } from "../index.js";
import { PlainClient } from "../plainClient.js";

class Shelf extends Synchronized {
  constructor(name) {
    super();
    this.name = name;
    this.notes = synchronized([]);
  }
}
class Note extends Synchronized {
  constructor(owner, text) {
    super();
    this.owner = owner;
    this.text = text;
    this.isPublic = true;
    this.tags = synchronized([]);
    this.link = null;
  }
  canRead(user) { return this.isPublic || this.owner === user; }
}
registerClasses({ WireShelf: Shelf, WireNote: Note });

class WireSession extends Session {
  signedIn() { this.home = this.fountain.well.root.shelf || null; }
  shelf() { return this.fountain.well.root.shelf; }
  rename(note, text) { note.text = text; return text.length; }
  refuse() { throw new RemoteError("Not allowed."); }
  crash() { return null.secret; }
}

const SCRYPT = { N: 1 << 10, r: 8, p: 1 };
const shelfRules = {
  WireShelf: (shelf, selection) => selection.add(...shelf.notes),
  WireNote: (note, selection) => selection.add(note.link),
};

/*------------------------------------------------------------------
 *  A server, and channels to clients
 *-----------------------------------------------------------------*/

function server(store = new MemoryStore(), options = {}) {
  const well = open({ store });
  const fountain = createFountain({ well, Session: WireSession, superUser: { name: "admin", password: "secret" }, scrypt: SCRYPT, ...options });
  fountain.registerSelector("shelf", shelfRules);
  return { well, fountain, store };
}

/**
 * A link between a server and a client: messages are copied through JSON, as a socket would,
 * and queued in each direction until delivered. `seen` records every message the client was
 * sent, with what the server state allowed at the moment it was sent (for P3).
 */
function link(world, client, onSend = () => {}) {
  const channel = { toClient: [], toServer: [], connection: null, cut: false };
  channel.connection = world.fountain.connect((message) => {
    const copy = JSON.parse(JSON.stringify(message));
    onSend(channel, copy);
    channel.toClient.push(copy);
  });
  client.connect((message) => channel.toServer.push(JSON.parse(JSON.stringify(message))));
  return channel;
}

/** Delivers every queued message, in order on each channel, in a random order between them. */
function pump(channels, next = Math.random, client = null) {
  for (;;) {
    const ready = channels.filter((channel) => !channel.cut && (channel.toClient.length > 0 || channel.toServer.length > 0));
    if (ready.length === 0) return;
    const channel = ready[Math.floor(next() * ready.length)];
    const toServer = channel.toServer.length > 0 && (channel.toClient.length === 0 || next() < 0.5);
    if (toServer) channel.connection.receive(channel.toServer.shift());
    else channel.client.receive(channel.toClient.shift());
  }
}

function connectClient(world, options = {}) {
  const client = new PlainClient({ classes: classesDigest(), ...options });
  const channel = link(world, client);
  channel.client = client;
  return { client, channel };
}

const opened = [];
afterEach(() => {
  while (opened.length) {
    const { well, fountain } = opened.pop();
    fountain.close();
    well.close();
  }
});
function started(store, options) {
  const world = server(store, options);
  opened.push(world);
  return world;
}

function users(fountain) {
  const admin = fountain.sessionFor(fountain.superUser);
  const alice = fountain.call(admin, "createUser", [{ name: "alice", password: "a" }]);
  const bob = fountain.call(admin, "createUser", [{ name: "bob", password: "b" }]);
  return { alice, bob };
}

function stocked(fountain, well) {
  const { alice, bob } = users(fountain);
  const shelf = well.root.shelf = new Shelf("Shelf");
  const open = new Note(alice, "open");
  const closed = new Note(alice, "closed");
  closed.isPublic = false;
  shelf.notes.push(open, closed);
  return { alice, bob, shelf, open, closed };
}

/** Signs a client in over the connection, and returns its token. */
function signIn(client, channel, name, password) {
  let token;
  client.call("signIn", [name, password], (error, value) => { token = value; });
  pump([channel]);
  client.token = token;
  return token;
}

const id = (object) => model.identityOf(object);

/*------------------------------------------------------------------
 *  Tests of each message
 *-----------------------------------------------------------------*/

describe("protocol: hello", function () {

  it("is answered with welcome, and then the session", function () {
    const world = started();
    const { client, channel } = connectClient(world);
    pump([channel]);
    assert.equal(client.open, true);
    assert.equal(typeof(client.session), "string");
    assert.ok(client.session.startsWith("v"), "a volatile identity (VO1)");
    assert.deepEqual(client.methods, world.fountain.remoteMethods());
    assert.equal(client.objects.get(client.session).$class, "Fountain.Session");
    assert.equal(client.objects.get(client.session).user, undefined, "anonymous");
  });

  it("is refused for another protocol, or a token that is not good; and told to reload for other code or classes", function () {
    const world = started(undefined, { code: "v2" });
    const answers = [];
    for (const options of [{ code: "v2", protocol: 99 }, { code: "v2", token: "nonsense" }, { code: "v1" }, { code: "v2", classes: "other" }]) {
      const client = new PlainClient({ classes: options.classes || classesDigest(), code: options.code, token: options.token || null });
      const channel = link(world, client);
      channel.client = client;
      if (options.protocol) channel.toServer[0].protocol = options.protocol;
      pump([channel]);
      answers.push([client.closedWith.type, client.closedWith.reason]);
      assert.equal(channel.connection.phase, "closed");
    }
    assert.deepEqual(answers, [["refused", "protocol"], ["refused", "token"], ["reload", "code"], ["reload", "classes"]]);
  });

  it("closes a connection that sends anything before hello", function () {
    const world = started();
    const sent = [];
    const connection = world.fountain.connect((message) => sent.push(message));
    connection.receive({ type: "subscribe", sub: 1, selector: "shelf", start: "n1" });
    assert.equal(sent[0].type, "protocolError");
    assert.equal(connection.phase, "closed");
  });
});

describe("protocol: signing in, and sessions across connections", function () {

  it("signs in with a call, whose effect arrives before its result", function () {
    const world = started();
    stocked(world.fountain, world.well);
    const { client, channel } = connectClient(world);
    pump([channel]);
    const order = [];
    const receive = client.receive.bind(client);
    client.receive = (message) => { order.push(message.type); receive(message); };
    const token = signIn(client, channel, "alice", "a");
    assert.equal(typeof(token), "string");
    assert.ok(client.objects.get(client.session).user, "the session's user arrived");
    assert.ok(order.indexOf("volatile") < order.indexOf("result"), "effects before the result (M1): " + order);
  });

  it("gives a second connection with the same token the same session, and both its changes", function () {
    const world = started();
    stocked(world.fountain, world.well);
    const first = connectClient(world);
    pump([first.channel]);
    const token = signIn(first.client, first.channel, "alice", "a");
    const second = connectClient(world, { token });
    pump([first.channel, second.channel]);
    assert.equal(second.client.session, first.client.session, "one session, two tabs");
    first.client.call("signOut", []);
    pump([first.channel, second.channel]);
    assert.equal(second.client.objects.get(second.client.session).user, undefined, "signing out reached the other tab");
  });

  it("makes a session anew from a token after the server restarts", function () {
    const store = new MemoryStore();
    let world = started(store);
    stocked(world.fountain, world.well);
    const { client, channel } = connectClient(world);
    pump([channel]);
    const token = signIn(client, channel, "bob", "b");
    world.fountain.close();
    world.well.close();
    opened.pop();
    world = started(store, { superUser: undefined });
    client.disconnected();
    const again = link(world, client);
    again.client = client;
    pump([again]);
    assert.equal(client.open, true);
    assert.ok(client.objects.get(client.session).user, "signed in again, as the token's user");
    assert.equal(token, client.token);
  });
});

describe("protocol: subscriptions", function () {

  function signedInClient(world, name, password) {
    const { client, channel } = connectClient(world);
    pump([channel]);
    signIn(client, channel, name, password);
    let shelf;
    client.call("shelf", [], (error, value) => { shelf = value.$ref; });
    pump([channel]);
    return { client, channel, shelf };
  }

  it("answers a subscription with its selection, whole, and the stubs it refers to", function () {
    const world = started();
    const { open, closed } = stocked(world.fountain, world.well);
    const { client, channel, shelf } = signedInClient(world, "bob", "b");
    assert.ok(client.stubs.has(shelf), "a reference a method returned is a stub");
    client.subscribe(1, "shelf", shelf);
    pump([channel]);
    const members = client.subscriptions.get(1).members;
    assert.ok(members.has(shelf) && members.has(id(open)));
    assert.equal(members.has(id(closed)), false, "not readable (S3)");
    assert.equal(client.objects.get(id(open)).text, "open");
    assert.equal(client.stubs.get(id(closed)), "WireNote", "its existence is visible (E1)");
    assert.deepEqual(client.unresolved(), [], "S2");
  });

  it("refuses with a reason that never says whether an identity exists", function () {
    const world = started();
    const { closed } = stocked(world.fountain, world.well);
    const { client, channel, shelf } = signedInClient(world, "bob", "b");
    const reasons = [];
    const receive = client.receive.bind(client);
    client.receive = (message) => { if (message.type === "subscribeRefused") reasons.push(message.reason); receive(message); };
    client.subscribe(1, "nothing", shelf);
    client.subscribe(2, "shelf", "n99999");
    client.subscribe(3, "shelf", id(world.fountain.superUser)); // exists, and is not known to him
    pump([channel]);
    client.subscribe(4, "shelf", shelf);
    pump([channel]);
    client.subscribe(5, "shelf", id(closed)); // known, as a stub, and not readable
    client.subscribe(4, "shelf", shelf);
    pump([channel]);
    assert.deepEqual(reasons, ["selector", "missing", "missing", "start", "sub"]);
  });

  it("sends what a commit changed, and what joined and left each subscription", function () {
    const world = started();
    const { shelf: shelfObject, open, closed } = stocked(world.fountain, world.well);
    const { client, channel, shelf } = signedInClient(world, "bob", "b");
    client.subscribe(1, "shelf", shelf);
    pump([channel]);
    transaction(() => {
      open.text = "changed";
      open.tags.push("x");
      closed.isPublic = true;
    });
    pump([channel]);
    assert.equal(client.objects.get(id(open)).text, "changed");
    assert.deepEqual(client.objects.get(id(open.tags)).$elements, ["x"]);
    assert.ok(client.subscriptions.get(1).members.has(id(closed)));
    assert.equal(client.objects.get(id(closed)).text, "closed");
    open.isPublic = false;
    pump([channel]);
    assert.equal(client.objects.has(id(open)), false, "left");
    assert.equal(client.stubs.get(id(open)), "WireNote", "a stub, since the shelf refers to it (8.3)");
    assert.deepEqual(client.commits, [...client.commits].sort((a, b) => a - b), "in order (C1)");
    assert.ok(shelfObject);
  });

  it("answers unsubscribe with what left", function () {
    const world = started();
    stocked(world.fountain, world.well);
    const { client, channel, shelf } = signedInClient(world, "bob", "b");
    client.subscribe(1, "shelf", shelf);
    pump([channel]);
    const held = client.objects.size;
    client.unsubscribe(1);
    pump([channel]);
    assert.ok(held > 1);
    assert.deepEqual([...client.objects.keys()], [client.session]);
  });
});

describe("protocol: calls", function () {

  it("answer with the result, the effects first, and with only what a method chose to say when it fails", function () {
    const world = started();
    const { open } = stocked(world.fountain, world.well);
    const { client, channel } = connectClient(world);
    pump([channel]);
    signIn(client, channel, "alice", "a");
    let shelf;
    client.call("shelf", [], (error, value) => { shelf = value.$ref; });
    pump([channel]);
    client.subscribe(1, "shelf", shelf);
    pump([channel]);
    const answers = [];
    client.call("rename", [{ $ref: id(open) }, "renamed"], (error, value) => answers.push(["rename", error && error.message, value, client.objects.get(id(open)).text]));
    client.call("refuse", [], (error) => answers.push(["refuse", error.message]));
    client.call("crash", [], (error) => answers.push(["crash", error.message]));
    client.call("grant", [], (error) => answers.push(["grant", error.message]));
    client.call("rename", [{ $ref: "n99999" }, "x"], (error) => answers.push(["missing", error.message]));
    pump([channel]);
    assert.deepEqual(answers, [
      ["rename", null, 7, "renamed"],
      ["refuse", "Not allowed."],
      ["crash", "The call failed."],
      ["grant", "A session has no remote method \"grant\"."],
      ["missing", "missing"],
    ]);
  });

  it("answers ping with the latest commit", function () {
    const world = started();
    const { client, channel } = connectClient(world);
    pump([channel]);
    world.well.root.touched = true;
    channel.toServer.push({ type: "ping" });
    pump([channel]);
    assert.equal(client.lastCommit, world.well.lastCommit);
  });

  it("does not take writes yet: clients are read-only", function () {
    const world = started();
    const { channel } = connectClient(world);
    pump([channel]);
    const sent = [];
    const receive = channel.client.receive.bind(channel.client);
    channel.client.receive = (message) => { sent.push(message.type); receive(message); };
    channel.toServer.push({ type: "transaction", tx: "x.1", writes: [] });
    pump([channel]);
    assert.deepEqual(sent, ["protocolError"]);
    assert.equal(channel.connection.phase, "open");
  });
});

describe("protocol: reconnecting", function () {

  it("sends again only what changed or what the client does not hold, and converges", function () {
    const world = started();
    const { shelf: shelfObject, open } = stocked(world.fountain, world.well);
    const unchanged = [];
    for (let i = 0; i < 20; i++) unchanged.push(new Note(null, "n" + i));
    shelfObject.notes.push(...unchanged);
    const { client, channel } = connectClient(world);
    pump([channel]);
    signIn(client, channel, "bob", "b");
    let shelf;
    client.call("shelf", [], (error, value) => { shelf = value.$ref; });
    pump([channel]);
    client.subscribe(1, "shelf", shelf);
    pump([channel]);
    // The connection is lost; the data changes meanwhile.
    channel.cut = true;
    channel.connection.close();
    client.disconnected();
    transaction(() => {
      open.text = "while away";
      shelfObject.notes.push(new Note(null, "new"));
      unchanged[0].isPublic = false;
    });
    const objectsSent = [];
    const again = link(world, client, (ch, message) => { if (message.type === "selection") objectsSent.push(...message.objects.map((object) => object.id)); });
    again.client = client;
    pump([again]);
    assert.equal(client.objects.get(id(open)).text, "while away");
    assert.equal(client.objects.has(id(unchanged[0])), false, "what left while it was away");
    assert.ok(objectsSent.length <= 4, "the changed ones only, not " + objectsSent.length);
    assert.deepEqual(new Set(client.objects.keys()), new Set(world.fountain.clientView(again.connection).keys()));
  });

  it("is told what was reclaimed while it was away", function () {
    const world = started();
    const { shelf: shelfObject } = stocked(world.fountain, world.well);
    const doomed = new Note(null, "doomed");
    shelfObject.notes.push(doomed);
    const doomedId = id(doomed);
    const { client, channel } = connectClient(world);
    pump([channel]);
    signIn(client, channel, "bob", "b");
    let shelf;
    client.call("shelf", [], (error, value) => { shelf = value.$ref; });
    pump([channel]);
    client.subscribe(1, "shelf", shelf);
    pump([channel]);
    channel.cut = true;
    channel.connection.close();
    client.disconnected();
    shelfObject.notes.splice(shelfObject.notes.indexOf(doomed), 1);
    world.well.workUntilIdle();
    const again = link(world, client);
    again.client = client;
    pump([again]);
    assert.equal(client.objects.has(doomedId), false);
    assert.equal(client.stubs.has(doomedId), false);
  });
});

/*------------------------------------------------------------------
 *  The simulator (protocol section 14)
 *-----------------------------------------------------------------*/

describe("protocol: the simulator", function () {

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

  /** P3: what an independent oracle says a user may read. */
  function oracleMayRead(fountain, session, object) {
    if (Array.isArray(object) || Object.getPrototypeOf(object) === Object.prototype) return true;
    if (object instanceof Session) return object === session;
    if (object.constructor.serverOnly === true) return false;
    if (session.user === fountain.superUser) return true;
    return typeof(object.canRead) !== "function" || object.canRead(session.user) === true;
  }

  for (const seed of [41, 42, 43]) {
    it("keeps clients converged through cuts and restarts (seed " + seed + ")", function () {
      this.timeout(60000);
      const next = random(seed);
      const pick = (list) => (list.length === 0 ? null : list[Math.floor(next() * list.length)]);
      const store = new MemoryStore();
      let world = started(store);
      const { alice, bob, shelf } = stocked(world.fountain, world.well);
      const people = [alice, bob, null];
      const names = [["alice", "a"], ["bob", "b"], ["bob", "b"]];
      const violations = [];

      // P3 at the moment each message is sent: every record and change is of something the
      // client's user may read now.
      const check = (channel, message) => {
        const records = [...(message.objects || []).map((object) => object.id), ...(message.changes || []).map((change) => change.id)];
        for (const objectId of records) {
          const object = world.fountain.objectFor(objectId);
          if (object && !oracleMayRead(world.fountain, channel.connection.view.session, object)) violations.push("sent " + objectId + " to a user who may not read it");
        }
      };
      const clients = names.map(() => new PlainClient({ classes: classesDigest() }));
      const channels = clients.map((client) => {
        const channel = link(world, client, check);
        channel.client = client;
        return channel;
      });
      pump(channels, next);
      clients.forEach((client, i) => signIn(client, channels[i], ...names[i]));
      // Each starts from the root its session refers to (whitepaper section 4.5).
      const home = (client) => client.objects.get(client.session).home.$ref;
      for (const client of clients) {
        assert.equal(home(client), id(shelf));
        client.subscribe(1, "shelf", home(client));
        if (next() < 0.5) client.subscribe(2, "shelf", home(client)); // overlapping (P5)
      }
      pump(channels, next);
      for (const client of clients) assert.ok(client.subscriptions.get(1).members.size > 2, "the simulation has something to check");

      const reconnect = (i) => {
        clients[i].disconnected();
        channels[i] = link(world, clients[i], check);
        channels[i].client = clients[i];
      };

      const done = { cuts: 0, restarts: 0, calls: 0, commits: 0 };
      for (let step = 0; step < 200; step++) {
        const notes = [...world.well.root.shelf.notes];
        const choice = next();
        if (choice < 0.55) {
          transaction(() => {
            for (let i = 0; i < 1 + Math.floor(next() * 3); i++) {
              const what = next();
              const note = pick(notes);
              if (what < 0.2 || note === null) world.well.root.shelf.notes.push(new Note(pick(people), "s" + step));
              else if (what < 0.3) {
                const at = world.well.root.shelf.notes.indexOf(note);
                if (at !== -1) world.well.root.shelf.notes.splice(at, 1);
              } else if (what < 0.5) note.text = "t" + step;
              else if (what < 0.65) note.isPublic = next() < 0.5;
              else if (what < 0.75) note.owner = pick(people);
              else if (what < 0.9) note.tags.splice(Math.floor(next() * (note.tags.length + 1)), 0, "g" + step);
              else note.link = next() < 0.6 ? pick(notes) : null;
            }
          });
        } else if (choice < 0.7) {
          // A client renames a note it holds, through a call.
          const i = Math.floor(next() * clients.length);
          const held = [...clients[i].objects.entries()].filter(([, record]) => record.$class === "WireNote").map(([objectId]) => objectId);
          const target = pick(held);
          if (target !== null && !channels[i].cut) {
            clients[i].call("rename", [{ $ref: target }, "r" + step]);
            done.calls++;
          }
        } else if (choice < 0.8) {
          const i = Math.floor(next() * clients.length);
          const client = clients[i];
          if (client.subscriptions.has(2)) client.unsubscribe(2);
          else client.subscribe(2, "shelf", home(client));
        } else if (choice < 0.93) {
          // A connection is cut, with what was on its way lost; the client reconnects.
          const i = Math.floor(next() * clients.length);
          channels[i].cut = true;
          channels[i].connection.close();
          done.cuts++;
          if (next() < 0.5) pump(channels, next); // the world goes on before it is back
          reconnect(i);
        } else {
          // The server restarts: every connection is lost, and the clients come back.
          pump(channels, next);
          for (const channel of channels) channel.cut = true;
          world.fountain.close();
          world.well.close();
          opened.pop();
          world = started(store, { superUser: undefined });
          clients.forEach((client, i) => reconnect(i));
          done.restarts++;
        }
        pump(channels, next);

        // A quiet point: nothing in flight.
        for (let i = 0; i < clients.length; i++) {
          const client = clients[i];
          const connection = channels[i].connection;
          const where = "client " + i + ", step " + step;
          assert.equal(client.open, true, where);
          const view = world.fountain.clientView(connection);
          // P1: what the client holds is what the server holds for it, record for record.
          assert.deepEqual(new Set(client.objects.keys()), new Set(view.keys()), "what it holds (P1), " + where);
          for (const [objectId, record] of view) assert.deepEqual(client.objects.get(objectId), record, "the record of " + objectId + " (P1), " + where);
          // P2: its subscriptions hold what the server computes now, and every reference resolves.
          for (const [sub, { members }] of client.subscriptions) {
            const subscription = world.fountain.subscription(connection, sub);
            const expected = new Set([...world.fountain.recomputeSelection(connection, subscription)].map(id));
            assert.deepEqual(members, expected, "subscription " + sub + " (P2), " + where);
          }
          assert.deepEqual(client.unresolved(), [], "every reference resolves (S2), " + where);
          // P5: what it counts is what the server holds.
          for (const [objectId, subs] of world.fountain.membershipsOf(connection)) assert.equal(client.countOf(objectId), subs.length, "counts (P5), " + where);
          // P7: commits in order.
          const commits = client.commits;
          for (let k = 1; k < commits.length; k++) assert.ok(commits[k] >= commits[k - 1], "commits in order (P7), " + where);
        }
        assert.deepEqual(violations, [], "P3");
      }
      for (const client of clients) done.commits += client.commits.length;
      assert.ok(done.cuts >= 5 && done.restarts >= 2 && done.calls >= 5 && done.commits >= 100, "the simulation did what it is for: " + JSON.stringify(done));
    });
  }
});

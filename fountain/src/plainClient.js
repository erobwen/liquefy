/**
 * A client of the protocol that keeps plain records: what a client holds, by identity, as the
 * server sends it, with its stubs, its subscriptions and what each holds. It is read-only, and
 * has no Cascade world. It is the reference the simulator checks the server against, and what
 * a script in Node can use; the client store of the roadmap's step 8 does the same in Cascade.
 *
 *   const client = new PlainClient({ classes: classesDigest() });
 *   client.connect((message) => socket.send(JSON.stringify(message)));
 *   socket.on("message", (text) => client.receive(JSON.parse(text)));
 */

import { randomBytes } from "node:crypto";
import { recordReferences } from "./observation.js";

const PROTOCOL = 1;

function isVolatileId(id) {
  return typeof(id) === "string" && id.startsWith("v");
}

export class PlainClient {
  constructor({ client = randomBytes(8).toString("hex"), token = null, code = null, classes = null } = {}) {
    this.client = client;
    this.token = token;
    this.code = code;
    this.classes = classes;
    this.objects = new Map(); // identity → record, without its id: what the client holds
    this.stubs = new Map(); // identity → class
    this.subscriptions = new Map(); // number → { selector, start, members: Set, answered }
    this.lastCommit = 0;
    this.commits = []; // the commit numbers of the commit messages received, in order
    this.session = null;
    this.methods = [];
    this.calls = new Map(); // number → callback(error, value)
    this.nextCall = 1;
    this.send = null;
    this.open = false;
    this.closedWith = null; // the reload or refused message, if the server sent one
    this.resuming = new Set(); // subscriptions asked for again, not yet answered
  }

  /** Opens a connection: `send(message)` is how messages leave. Resumes if the client held anything. */
  connect(send) {
    this.send = send;
    this.open = false;
    this.closedWith = null;
    const hello = { type: "hello", protocol: PROTOCOL, code: this.code, classes: this.classes, client: this.client };
    if (this.token !== null) hello.token = this.token;
    if (this.subscriptions.size > 0 || this.objects.size > 0) hello.resume = this.resumeState();
    send(hello);
  }

  /** The connection is gone: calls in flight fail, and nothing more is sent until connect(). */
  disconnected() {
    this.send = null;
    this.open = false;
    for (const [call, done] of this.calls) done(new Error("The connection was lost."));
    this.calls.clear();
  }

  resumeState() {
    return {
      commit: this.lastCommit,
      subscriptions: [...this.subscriptions].map(([sub, { selector, start }]) => ({ sub, selector, start })),
      held: [...this.objects.keys()].filter((id) => !isVolatileId(id)),
      stubs: [...this.stubs.keys()],
    };
  }

  subscribe(sub, selector, start) {
    this.subscriptions.set(sub, { selector, start, members: new Set(), answered: false });
    this.send({ type: "subscribe", sub, selector, start });
  }

  unsubscribe(sub) {
    this.send({ type: "unsubscribe", sub });
  }

  /** Calls a method of the session: `done(error, value)` is called with its answer. */
  call(method, args, done = () => {}) {
    const call = this.nextCall++;
    this.calls.set(call, done);
    this.send({ type: "call", call, method, args });
    return call;
  }

  /** How many of the client's subscriptions hold an object (protocol section 13, `subscriptions`). */
  countOf(id) {
    let count = 0;
    for (const { members } of this.subscriptions.values()) if (members.has(id)) count++;
    return count;
  }

  /** Every reference in what the client holds names what it holds or knows as a stub (S2). */
  unresolved() {
    const missing = [];
    for (const record of this.objects.values()) {
      for (const id of recordReferences(record)) if (!this.objects.has(id) && !this.stubs.has(id)) missing.push(id);
    }
    return missing;
  }

  receive(message) {
    switch (message.type) {
      case "welcome": {
        this.open = true;
        // Volatile objects are gone with the old connection (protocol section 12).
        for (const id of [...this.objects.keys()]) if (isVolatileId(id)) this.objects.delete(id);
        this.session = message.session;
        this.methods = message.methods;
        this.lastCommit = Math.max(this.lastCommit, message.commit);
        for (const [sub, subscription] of this.subscriptions) {
          subscription.answered = false;
          this.resuming.add(sub);
        }
        return;
      }
      case "reload":
      case "refused":
        this.closedWith = message;
        return;
      case "volatile":
        this.applyObjects(message.objects);
        this.applyChanges(message.changes);
        for (const id of message.left || []) this.objects.delete(id);
        this.applyStubs(message.stubs);
        return;
      case "selection": {
        const subscription = this.subscriptions.get(message.sub);
        if (subscription === undefined) return;
        this.applyObjects(message.objects);
        this.applyStubs(message.stubs);
        subscription.members = new Set(message.members);
        subscription.answered = true;
        this.resuming.delete(message.sub);
        for (const id of message.reclaimed || []) this.reclaim(id);
        this.lastCommit = Math.max(this.lastCommit, message.commit);
        this.leave();
        return;
      }
      case "subscribeRefused":
        this.subscriptions.delete(message.sub);
        this.resuming.delete(message.sub);
        this.leave();
        return;
      case "commit": {
        this.commits.push(message.commit);
        this.applyChanges(message.changes);
        this.applyObjects(message.objects);
        this.applyStubs(message.stubs);
        for (const [sub, ids] of Object.entries(message.joined || {})) {
          const subscription = this.subscriptions.get(Number(sub)) || this.subscriptions.get(sub);
          if (subscription !== undefined) for (const id of ids) subscription.members.add(id);
        }
        for (const [sub, ids] of Object.entries(message.left || {})) {
          const subscription = this.subscriptions.get(Number(sub)) || this.subscriptions.get(sub);
          if (subscription !== undefined) for (const id of ids) subscription.members.delete(id);
        }
        for (const id of message.reclaimed || []) this.reclaim(id);
        this.lastCommit = Math.max(this.lastCommit, message.commit);
        this.leave();
        return;
      }
      case "left":
        this.subscriptions.delete(message.sub);
        this.leave();
        return;
      case "at":
        for (const id of message.reclaimed || []) this.reclaim(id);
        this.lastCommit = Math.max(this.lastCommit, message.commit);
        return;
      case "pong":
        this.lastCommit = Math.max(this.lastCommit, message.commit);
        return;
      case "result":
      case "error": {
        const done = this.calls.get(message.call);
        this.calls.delete(message.call);
        this.applyStubs(message.stubs);
        if (done) done(message.type === "error" ? new Error(message.message) : null, message.value);
        return;
      }
      default:
        return;
    }
  }

  applyObjects(objects) {
    for (const { id, ...record } of objects || []) {
      this.objects.set(id, record);
      this.stubs.delete(id);
    }
  }

  applyStubs(stubs) {
    for (const [id, name] of Object.entries(stubs || {})) if (!this.objects.has(id)) this.stubs.set(id, name);
  }

  applyChanges(changes) {
    for (const change of changes || []) {
      const record = this.objects.get(change.id);
      if (record === undefined) throw new Error("A change to an object the client does not hold: " + change.id);
      if (change.insert || change.remove || change.splice) {
        const elements = record.$elements || (record.$elements = []);
        if (change.insert) elements.splice(change.insert.at, 0, ...change.insert.elements);
        else if (change.remove) elements.splice(change.remove.at, change.remove.count);
        else elements.splice(change.splice.at, change.splice.remove, ...change.splice.elements);
        continue;
      }
      for (const key of change.delete || []) delete record[key];
      Object.assign(record, change.set || {});
    }
  }

  reclaim(id) {
    this.objects.delete(id);
    this.stubs.delete(id);
  }

  /**
   * Objects in none of the selections leave (protocol section 8.3): a stub if something held
   * refers to it, dropped otherwise. Not while subscriptions asked for again are unanswered.
   */
  leave() {
    if (this.resuming.size > 0) return;
    const members = new Set();
    for (const { members: ids } of this.subscriptions.values()) for (const id of ids) members.add(id);
    const leaving = [...this.objects.keys()].filter((id) => !isVolatileId(id) && !members.has(id));
    if (leaving.length === 0) return;
    const classes = new Map(leaving.map((id) => [id, this.objects.get(id).$class]));
    for (const id of leaving) this.objects.delete(id);
    const referred = new Set();
    for (const record of this.objects.values()) recordReferences(record, referred);
    for (const id of leaving) if (referred.has(id)) this.stubs.set(id, classes.get(id));
  }
}

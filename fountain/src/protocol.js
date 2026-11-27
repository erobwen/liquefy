/**
 * The server's side of the protocol: one connection per client, whatever carries its messages.
 * Specified in documents/protocol.md; what is implemented of it is listed in
 * documents/protocol-status.md.
 *
 *   const connection = fountain.connect((message) => socket.send(JSON.stringify(message)));
 *   socket.on("message", (text) => connection.receive(JSON.parse(text)));
 *   socket.on("close", () => connection.close());
 *
 * Messages are plain JSON values; values inside them are encoded as in the data model.
 */

import { createHash } from "node:crypto";
import { model } from "@liquefy/deepwell";
import { recordReferences } from "./observation.js";

export const PROTOCOL = 1;

/** The key under which a connection gives its view: see index.js. */
const VIEW = Symbol.for("fountain.view");

/** Why a reference in a message could not be followed. Never says whether the object exists (F1). */
class Missing extends Error {
  constructor() {
    super("missing");
  }
}

/** Whether an identity is a volatile object's (protocol VO1). */
function isVolatileId(id) {
  return typeof(id) === "string" && id.startsWith("v");
}

/**
 * The digest of the classes a client should have registered: every registered class, except
 * those that are the server's only and the application's session class (protocol section 4.1).
 */
export function classesDigest() {
  const names = model.classesSignature().split(",").filter((entry) => {
    if (entry === "") return false;
    const name = entry.slice(0, entry.lastIndexOf(":"));
    const Class = model.classByName(name).Class;
    return Class.serverOnly !== true && Class.volatile !== true;
  });
  return createHash("sha256").update(names.join(",")).digest("hex");
}

/** A delivery's array change as the protocol's insert, remove or splice (protocol section 8.1). */
function arrayChange(id, splice) {
  if (splice.removed === 0) return { id, insert: { at: splice.index, elements: splice.added } };
  if (splice.added.length === 0) return { id, remove: { at: splice.index, count: splice.removed } };
  return { id, splice: { at: splice.index, remove: splice.removed, elements: splice.added } };
}

/** What may be said of a failed call (protocol M3): what the method chose to say, nothing internal. */
function publicMessage(error) {
  return error && error.isPublic === true ? String(error.message) : "The call failed.";
}

export class ServerConnection {
  constructor(fountain, send) {
    this.fountain = fountain;
    this.transmit = send;
    this.phase = "hello"; // "hello", "open", "closed"
    this.view = null;
    this.client = null;
    this.stubs = new Set(); // identities the client knows as stubs, as far as this connection told it
    this.memberships = new Map(); // stored identity → Set of subscription numbers, as the client was told
    this.lastCommit = 0; // the last commit the client was told of
    this.answering = null; // deliveries gathered while a subscription is answered
    this.removeDeliveryListener = null;
    this.reclaimed = null; // what resume found gone, for the first selection after it
  }

  /** The connection's view, so that the Fountain's functions take a connection as they take a session. */
  get [VIEW]() {
    return this.view;
  }

  send(message) {
    if (this.phase !== "closed") this.transmit(message);
  }

  /** Takes one message from the client. Never throws: what goes wrong is answered, or closes the connection. */
  receive(message) {
    if (this.phase === "closed") return;
    try {
      if (message === null || typeof(message) !== "object" || typeof(message.type) !== "string") throw new Error("A message is an object with a type.");
      if (this.phase === "hello") {
        if (message.type !== "hello") throw new Error("Nothing before hello (protocol L1).");
        return this.hello(message);
      }
      switch (message.type) {
        case "ping": return this.send({ type: "pong", commit: this.fountain.well.lastCommit });
        case "subscribe": return this.subscribe(message);
        case "unsubscribe": return this.unsubscribe(message);
        case "call": return this.call(message);
        case "transaction": return this.send({ type: "protocolError", message: "Writes from clients are not implemented yet: clients are read-only (protocol-status.md)." });
        default: throw new Error("No message of type \"" + message.type + "\".");
      }
    } catch (error) {
      this.send({ type: "protocolError", message: String(error && error.message) });
      this.close();
    }
  }

  close() {
    if (this.phase === "closed") return;
    this.phase = "closed";
    if (this.removeDeliveryListener) this.removeDeliveryListener();
    if (this.view !== null) this.fountain.closeConnection(this);
  }

  /*------------------------------------------------------------------
   *  Hello (protocol section 4)
   *-----------------------------------------------------------------*/

  hello(message) {
    const fountain = this.fountain;
    const refuse = (type, reason) => {
      this.send({ type, reason });
      this.close();
    };
    if (message.protocol !== PROTOCOL) return refuse("refused", "protocol");
    if (fountain.code !== null && message.code !== fountain.code) return refuse("reload", "code");
    if (message.classes !== classesDigest()) return refuse("reload", "classes");
    let session;
    if (message.token !== undefined && message.token !== null) {
      session = fountain.sessionForToken(message.token);
      if (session === null) return refuse("refused", "token");
    } else {
      session = fountain.createSession();
    }
    this.client = typeof(message.client) === "string" ? message.client : null;
    this.view = fountain.openConnection(this, session);
    this.phase = "open";
    this.removeDeliveryListener = fountain.onDelivery(this.view, (delivery) => this.delivered(delivery));
    this.lastCommit = fountain.well.lastCommit;
    this.send({ type: "welcome", commit: this.lastCommit, session: model.identityOf(session), methods: fountain.remoteMethods(session.constructor) });
    fountain.takeDeliveries(this.view); // the session, in a volatile message (protocol section 4.3)
    if (message.resume) this.resume(message.resume);
  }

  /*------------------------------------------------------------------
   *  Deliveries as messages (protocol sections 8 and 12)
   *-----------------------------------------------------------------*/

  delivered(delivery) {
    if (this.answering !== null) {
      this.answering.push(delivery);
      return;
    }
    this.sendDelivery(delivery);
  }

  /** The changes of a delivery, as the protocol's: set and delete, insert, remove and splice. */
  changesOf(delivery, volatile) {
    const changes = [];
    for (const change of delivery.changed) {
      if (isVolatileId(change.id) !== volatile) continue;
      if (change.splices) {
        for (const splice of change.splices) changes.push(arrayChange(change.id, splice));
        continue;
      }
      const entry = { id: change.id };
      if (Object.keys(change.fields).length > 0) entry.set = change.fields;
      if (change.deleted.length > 0) entry.delete = change.deleted;
      changes.push(entry);
    }
    return changes;
  }

  /** Stubs the client is not yet told of, among a delivery's. */
  newStubs(stubs) {
    const result = {};
    for (const { id, class: name } of stubs) {
      if (this.stubs.has(id) || this.memberships.has(id)) continue;
      this.stubs.add(id);
      result[id] = name;
    }
    return result;
  }

  /**
   * Updates what the client was told of which subscriptions hold what, from a delivery, and
   * returns what joined and left each subscription.
   */
  membershipChanges(delivery) {
    const joined = {};
    const left = {};
    const add = (table, sub, id) => {
      const key = String(sub);
      (table[key] || (table[key] = [])).push(id);
    };
    for (const id of delivery.left) {
      if (isVolatileId(id)) continue;
      const before = this.memberships.get(id);
      if (before !== undefined) for (const sub of before) add(left, sub, id);
      this.memberships.delete(id);
    }
    for (const [id, subs] of Object.entries(delivery.memberships || {})) {
      const before = this.memberships.get(id) || new Set();
      const after = new Set(subs);
      for (const sub of after) if (!before.has(sub)) add(joined, sub, id);
      for (const sub of before) if (!after.has(sub)) add(left, sub, id);
      this.memberships.set(id, after);
      this.stubs.delete(id);
    }
    return { joined, left };
  }

  sendDelivery(delivery) {
    const storedObjects = delivery.joined.filter(({ id }) => !isVolatileId(id)).map(({ id, record }) => ({ id, ...record }));
    const volatileObjects = delivery.joined.filter(({ id }) => isVolatileId(id)).map(({ id, record }) => ({ id, ...record }));
    const storedChanges = this.changesOf(delivery, false);
    const volatileChanges = this.changesOf(delivery, true);
    const { joined, left } = this.membershipChanges(delivery);
    const stubs = this.newStubs(delivery.stubs);
    const volatileLeft = delivery.left.filter(isVolatileId);

    if (storedObjects.length > 0 || storedChanges.length > 0 || Object.keys(joined).length > 0 || Object.keys(left).length > 0) {
      // A delivery made for something other than a commit, such as a selection that changed
      // with a volatile object, is sent at the last commit: commit numbers never go back.
      const commit = delivery.commit === null ? this.lastCommit : Math.max(delivery.commit, this.lastCommit);
      this.lastCommit = commit;
      const message = { type: "commit", commit, changes: storedChanges, objects: storedObjects, stubs, joined, left };
      this.send(message);
    } else if (Object.keys(stubs).length > 0 && volatileObjects.length === 0 && volatileChanges.length === 0) {
      this.send({ type: "volatile", objects: [], changes: [], left: [], stubs });
      return;
    }
    if (volatileObjects.length > 0 || volatileChanges.length > 0 || volatileLeft.length > 0) {
      const message = { type: "volatile", objects: volatileObjects, changes: volatileChanges, left: volatileLeft };
      if (storedObjects.length === 0 && storedChanges.length === 0) message.stubs = stubs;
      this.send(message);
    }
  }

  /*------------------------------------------------------------------
   *  Subscriptions (protocol section 6)
   *-----------------------------------------------------------------*/

  /** The object a client names by an identity, if the client may name it (F1). */
  known(id) {
    const object = typeof(id) === "string" ? this.fountain.objectFor(id) : null;
    if (object === null || object === undefined || !this.fountain.knows(this.view, object)) throw new Missing();
    return object;
  }

  subscribe(message, resume = null) {
    const fountain = this.fountain;
    const sub = message.sub;
    const refuse = (reason) => this.send({ type: "subscribeRefused", sub, reason });
    if (typeof(message.selector) !== "string" || !fountain.selectors.has(message.selector)) return refuse("selector");
    if (fountain.subscription(this.view, sub) !== undefined) return refuse("sub");
    let start;
    try {
      start = this.known(message.start);
    } catch (error) {
      return refuse("missing");
    }
    if (!fountain.mayRead(this.view, start)) return refuse("start");
    if (this.view.session.maySubscribe(message.selector, start) !== true) return refuse("selector");

    this.answering = [];
    let subscription;
    let gathered;
    try {
      // The client's options are its own (gated and send are not implemented here); none of
      // them chooses how the server computes the selection.
      subscription = fountain.subscribe(this.view, start, message.selector, { sub });
      fountain.takeDeliveries(this.view);
    } finally {
      gathered = this.answering;
      this.answering = null;
    }
    // What a commit made meanwhile changed of what the client held is sent first, as commits;
    // what joined is the selection.
    const joinedObjects = [];
    const stubs = [];
    for (const delivery of gathered) {
      joinedObjects.push(...delivery.joined);
      stubs.push(...delivery.stubs);
      this.membershipChanges(delivery);
      if (delivery.changed.length > 0 || delivery.left.length > 0) this.sendDelivery({ ...delivery, joined: [], memberships: {}, stubs: [] });
    }
    const members = [...subscription.selection].map((object) => model.identityOf(object)).filter((id) => id !== undefined);
    const objects = [];
    for (const { id, record } of joinedObjects) {
      if (isVolatileId(id)) continue;
      // On resuming, the client keeps what it holds unless it changed while it was away (R1).
      if (resume !== null && resume.held.has(id) && !(this.fountain.well.db.lastChanged(id) > resume.commit)) continue;
      objects.push({ id, ...record });
    }
    for (const id of members) {
      if (!this.memberships.has(id)) this.memberships.set(id, new Set());
      this.memberships.get(id).add(sub);
    }
    this.lastCommit = Math.max(this.lastCommit, fountain.well.lastCommit);
    const selection = { type: "selection", sub, commit: this.lastCommit, members, objects, stubs: this.newStubs(stubs) };
    if (this.reclaimed !== null) {
      selection.reclaimed = this.reclaimed;
      this.reclaimed = null;
    }
    this.send(selection);
  }

  unsubscribe(message) {
    const subscription = this.fountain.subscription(this.view, message.sub);
    if (subscription === undefined) return this.send({ type: "left", sub: message.sub, ids: [] });
    this.answering = [];
    let gathered;
    try {
      subscription.release();
      this.fountain.takeDeliveries(this.view);
    } finally {
      gathered = this.answering;
      this.answering = null;
    }
    const ids = [];
    for (const delivery of gathered) {
      for (const id of delivery.left) {
        if (isVolatileId(id)) continue;
        ids.push(id);
        this.memberships.delete(id);
      }
      for (const [id, subs] of Object.entries(delivery.memberships || {})) this.memberships.set(id, new Set(subs));
    }
    for (const [id, subs] of this.memberships) subs.delete(message.sub);
    this.send({ type: "left", sub: message.sub, ids });
  }

  /*------------------------------------------------------------------
   *  Reconnecting (protocol section 11)
   *-----------------------------------------------------------------*/

  resume(resume) {
    const db = this.fountain.well.db;
    const held = new Set(Array.isArray(resume.held) ? resume.held : []);
    const known = [...held, ...(Array.isArray(resume.stubs) ? resume.stubs : [])];
    this.reclaimed = known.filter((id) => !isVolatileId(id) && db.lastChanged(id) === undefined);
    const context = { held, commit: typeof(resume.commit) === "number" ? resume.commit : -1 };
    // What the client knew as stubs it may still name, as far as it knows them; the server
    // tells it again what it needs.
    const subscriptions = Array.isArray(resume.subscriptions) ? resume.subscriptions : [];
    for (const subscription of subscriptions) this.subscribe({ type: "subscribe", ...subscription }, context);
    if (this.reclaimed !== null && this.reclaimed.length > 0) {
      this.send({ type: "at", commit: this.lastCommit, reclaimed: this.reclaimed });
    }
    this.reclaimed = null;
  }

  /*------------------------------------------------------------------
   *  Calls (protocol section 9)
   *-----------------------------------------------------------------*/

  call(message) {
    const fountain = this.fountain;
    let args;
    try {
      args = (Array.isArray(message.args) ? message.args : []).map((arg) => model.decodeValue(arg, {
        strong: (id) => this.known(id),
        weak: (id) => new model.WeakReference(this.known(id)),
      }));
    } catch (error) {
      return this.send({ type: "error", call: message.call, message: error instanceof Missing ? "missing" : "The arguments could not be read." });
    }
    let value;
    try {
      value = fountain.call(this.view, message.method, args);
    } catch (error) {
      return this.send({ type: "error", call: message.call, message: publicMessage(error) });
    }
    // A reference that a method returns gives the client an identity, and a root it may
    // subscribe from (whitepaper section 4.5), not access.
    const stubs = [];
    let encoded;
    try {
      encoded = model.encodeValue(value, {
        identify: (object) => {
          const id = model.identityOf(object);
          if (id === undefined) throw new Error("A method returned an object that is not stored.");
          fountain.give(this.view, object);
          stubs.push({ id, class: model.classNameOf(object) });
          return id;
        },
      });
    } catch (error) {
      return this.send({ type: "error", call: message.call, message: "The result could not be sent." });
    }
    this.send({ type: "result", call: message.call, value: encoded === undefined ? null : encoded, stubs: this.newStubs(stubs) });
  }
}

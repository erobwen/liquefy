/**
 * Observation on the server: change sets, observers that match their reads against them, and
 * what each session is to be sent after each commit. Specified in documents/observation.md;
 * designed in the whitepaper, section 3.6.
 *
 * Everything here runs after a commit, from what Deepwell reports of it. Nothing is stored.
 */

import { model, world } from "@liquefy/deepwell";

/*------------------------------------------------------------------
 *  Change sets (observation.md section 2)
 *-----------------------------------------------------------------*/

/** Every field of an object: what a change to an array, or a read of an object's keys, stands for. */
export const ALL = "*";

/**
 * What one transaction wrote: for each object, by identity, the names of the fields written, or
 * ALL for an array whose elements changed. `commit` is the transaction's commit number, or null
 * for a change to volatile objects only.
 */
export class ChangeSet {
  constructor(commit) {
    this.commit = commit;
    this.objects = new Map(); // identity → Set of field names, or ALL
    this.created = new Set(); // identities of the objects this transaction stored
  }

  add(id, field) {
    if (field === ALL) {
      this.objects.set(id, ALL);
      return;
    }
    const fields = this.objects.get(id);
    if (fields === ALL) return;
    if (fields === undefined) this.objects.set(id, new Set([field]));
    else fields.add(field);
  }

  has(id, field) {
    const fields = this.objects.get(id);
    if (fields === undefined) return false;
    return fields === ALL || field === ALL || fields.has(field);
  }

  get size() {
    return this.objects.size;
  }

  /** The change set of one Deepwell commit. */
  static fromCommit(change) {
    const set = new ChangeSet(change.commit);
    for (const object of change.created) {
      const id = model.identityOf(object);
      if (id !== undefined) set.created.add(id);
    }
    for (const event of change.events) {
      const id = model.identityOf(event.object);
      if (id === undefined) continue;
      if (event.type === "splice") set.add(id, ALL);
      else set.add(id, String(event.property));
    }
    return set;
  }
}

/*------------------------------------------------------------------
 *  Reads, and observers (observation.md section 3)
 *-----------------------------------------------------------------*/

/**
 * Runs `compute`, and records what it read, by identity: a Map from identity to the Set of
 * field names read, or ALL where it read an array's elements or an object's keys. A read of a
 * method or a getter of a class is no read of state. An object without an identity, which is
 * not stored and not volatile, cannot be named, and what was read of it is not recorded.
 */
export function recordReads(compute) {
  let value;
  let sources;
  const invalidator = world.invalidateOnChange("observed", () => { value = compute(); }, () => {});
  try {
    sources = world.sourcesOf(invalidator);
  } finally {
    invalidator.dispose();
  }
  const reads = new Map();
  for (const source of sources) {
    if (source.kind === "prototype") continue;
    const id = model.identityOf(source.object);
    if (id === undefined) continue;
    const field = source.kind === "property" ? String(source.key) : ALL;
    if (field === ALL) reads.set(id, ALL);
    else if (reads.get(id) !== ALL) {
      if (!reads.has(id)) reads.set(id, new Set());
      reads.get(id).add(field);
    }
  }
  return { value, reads };
}

/** Whether a change set wrote anything that was read. */
export function touches(changeSet, reads) {
  const [smaller, larger] = reads.size <= changeSet.objects.size ? [reads, changeSet.objects] : [changeSet.objects, reads];
  for (const [id, fields] of smaller) {
    const other = larger.get(id);
    if (other === undefined) continue;
    if (fields === ALL || other === ALL) return true;
    for (const field of fields) if (other.has(field)) return true;
  }
  return false;
}

/*------------------------------------------------------------------
 *  What a client is sent (observation.md section 4)
 *-----------------------------------------------------------------*/

/** Whether an object is a session: its class is the application's, which clients do not have. */
function isSession(object) {
  for (let scan = Object.getPrototypeOf(object); scan !== null; scan = Object.getPrototypeOf(scan)) {
    if (scan.constructor && scan.constructor.remote !== undefined && scan.constructor.volatile === true) return true;
  }
  return false;
}

/** A record as a client is given it: the stored encoding, without what is Deepwell's own. */
export function clientRecord(well, object) {
  const identify = (other) => {
    const id = model.identityOf(other);
    if (id === undefined) throw new Error("A held object refers to an object that has no identity.");
    return id;
  };
  const record = well.encode(object, identify, (other) => model.identityOf(other));
  delete record.$indexes;
  delete record.$dependents;
  if (isSession(object)) record.$class = "Fountain.Session";
  return record;
}

/** The identities a record refers to, strongly or weakly. */
export function recordReferences(encoded, into = new Set()) {
  if (encoded === null || typeof(encoded) !== "object") return into;
  if (Array.isArray(encoded)) {
    for (const item of encoded) recordReferences(item, into);
    return into;
  }
  const keys = Object.keys(encoded);
  if (keys.length === 1 && (keys[0] === "$ref" || keys[0] === "$weak")) into.add(encoded[keys[0]]);
  else for (const key of keys) recordReferences(encoded[key], into);
  return into;
}

/** The class of an object by its identity, without making it: what a stub is given. */
function classOf(well, id) {
  const object = well.inMemory(id);
  if (object !== undefined) return model.classNameOf(object);
  const record = well.db.get(id);
  return record === undefined || record.$class === undefined ? "Object" : record.$class;
}

/**
 * Makes the delivery of one session for one commit, from what joined and left its selections
 * during the transaction, and what the transaction wrote to what it held before. Returns null
 * if there is nothing to send.
 *
 *   { commit, joined: [{ id, record }], left: [id], changed: [{ id, fields, deleted } | { id, splices }],
 *     stubs: [{ id, class }], memberships: { [id]: [sub, ...] } }
 *
 * `memberships` gives, for each object whose subscriptions changed and that is still held, the
 * numbers of the subscriptions that hold it (selections.md section 4).
 */
export function makeDelivery(well, state, commit, eventsByObject) {
  const joined = [];
  const left = [];
  const changed = [];
  const sent = new Set(); // what the client will hold once it has applied this

  for (const object of state.pendingLeft) {
    const id = state.sentIds.get(object);
    if (id !== undefined) left.push(id);
    state.sentIds.delete(object);
  }
  for (const object of state.pendingJoined) {
    const id = model.identityOf(object);
    if (id === undefined) continue;
    joined.push({ id, record: clientRecord(well, object) });
    state.sentIds.set(object, id);
  }
  for (const [object, events] of eventsByObject) {
    if (state.pendingJoined.has(object) || !state.sentIds.has(object)) continue;
    const id = state.sentIds.get(object);
    if (Array.isArray(object)) {
      const splices = [];
      for (const event of events) {
        if (event.type !== "splice") continue;
        const encode = (value) => model.encodeValue(value, { identify: (other) => model.identityOf(other) });
        splices.push({ index: Number(event.index), removed: (event.removed || []).length, added: (event.added || []).map(encode) });
      }
      if (splices.length > 0) changed.push({ id, splices });
      continue;
    }
    const record = clientRecord(well, object);
    const fields = {};
    const deleted = [];
    const names = new Set(events.filter((event) => event.type === "set" || event.type === "delete").map((event) => String(event.property)));
    for (const name of names) {
      const key = name.startsWith("$") ? "$" + name : name;
      if (key in record) fields[key] = record[key];
      else deleted.push(key);
    }
    if (Object.keys(fields).length > 0 || deleted.length > 0) changed.push({ id, fields, deleted });
  }
  state.pendingJoined.clear();
  state.pendingLeft.clear();

  const memberships = {};
  let membershipCount = 0;
  for (const object of state.pendingMemberships) {
    const holders = state.holders.get(object);
    const id = model.identityOf(object);
    if (holders === undefined || id === undefined) continue;
    memberships[id] = [...holders].map((subscription) => subscription.sub).sort((a, b) => (typeof(a) === "number" && typeof(b) === "number" ? a - b : String(a) < String(b) ? -1 : 1));
    membershipCount++;
  }
  state.pendingMemberships.clear();

  // Stubs: what what is sent refers to, that the client will not hold and has not been told of.
  for (const id of state.sentIds.values()) sent.add(id);
  const referred = new Set();
  for (const { record } of joined) recordReferences(record, referred);
  for (const change of changed) {
    if (change.fields) recordReferences(change.fields, referred);
    else for (const splice of change.splices) recordReferences(splice.added, referred);
  }
  // What left, and is still referred to from what is held, becomes a stub (data model S5).
  for (const id of left) if (state.incoming.has(id)) referred.add(id);
  const stubs = [];
  for (const id of referred) {
    if (sent.has(id)) continue;
    stubs.push({ id, class: classOf(well, id) });
  }

  if (joined.length === 0 && left.length === 0 && changed.length === 0 && membershipCount === 0) return null;
  return { commit, joined, left, changed, stubs, memberships };
}

/**
 * Applies a delivery to a client's copy: a Map from identity to record, and, if given, a Map
 * from identity to the numbers of the subscriptions that hold it. For tests, and the client
 * store.
 */
export function applyDelivery(copy, delivery, memberships = null) {
  for (const id of delivery.left) {
    copy.delete(id);
    if (memberships !== null) memberships.delete(id);
  }
  if (memberships !== null && delivery.memberships) {
    for (const [id, subs] of Object.entries(delivery.memberships)) memberships.set(id, subs.slice());
  }
  for (const { id, record } of delivery.joined) copy.set(id, structuredClone(record));
  for (const change of delivery.changed) {
    const record = copy.get(change.id);
    if (record === undefined) throw new Error("A change to an object the client does not hold: " + change.id);
    if (change.splices) {
      const elements = record.$elements || (record.$elements = []);
      for (const { index, removed, added } of change.splices) elements.splice(index, removed, ...structuredClone(added));
    } else {
      for (const key of change.deleted) delete record[key];
      for (const [key, value] of Object.entries(change.fields)) record[key] = structuredClone(value);
    }
  }
  return copy;
}

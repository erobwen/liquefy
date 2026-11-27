/**
 * A load whose selector is a table of local rules (design section 3.7, whitepaper section 3.5):
 *
 *   const selectTree = { Node: (node, selection) => selection.add(node.left, node.right) };
 *
 * A rule says, for one object, which of the objects it refers to are selected along with it.
 * The engine here applies the rules transitively, in rounds: it runs the rule of every selected
 * object that is in memory, asks the store for all the objects they added that are not, in one
 * read, and goes on when they have arrived. A rule never waits, and neither does a property
 * read; only the load does.
 *
 * Each application of a rule is a Cascade repeater of its own, so a change to one object runs
 * the rule of that object only. What the selection then contains is found by following, from
 * the starting object, what the rules last gave: reachability over the selected references,
 * without running any rule again.
 */

import { DataModelError } from "./values.js";

/** Thrown at a rule that reads into an object that is not in memory. The engine catches it. */
export class NotLoaded extends Error {
  constructor(id) {
    super("Object " + id + " is not loaded. A rule may add it to the selection, but not read it before it has arrived.");
    this.id = id;
  }
}

/** A selection: a Set whose add() takes any number of objects, and ignores null and undefined. */
export class Selection extends Set {
  add(...objects) {
    for (const object of objects) {
      if (object !== null && object !== undefined) super.add(object);
    }
    return this;
  }
}

export class RuleLoad {
  constructor(well, start, rules, action, options = {}) {
    this.well = well;
    this.world = well.world;
    this.start = start;
    this.rules = rules;
    this.action = action;
    this.filter = options.filter || null;

    this.entries = new Map(); // object → { repeater, selects, needs, excluded, started }
    this.held = new Set();
    this.arrivals = []; // keeps what a read made in memory until the selection holds it
    this.settling = false;
    this.fetching = false;
    this.dirty = false;
    this.acted = false;

    this.handle = {
      selection: new Selection(),
      loaded: false, // false while objects the selection reaches are on their way
      released: false,
      release: () => this.release(),
    };
    this.settle();
  }

  /**
   * Brings the selection up to date with what the rules give. Returns when it is complete, or
   * when it waits for a read; the read's arrival continues it.
   */
  settle() {
    if (this.handle.released) return;
    if (this.settling || this.fetching) {
      this.dirty = true;
      return;
    }
    let complete = false;
    this.settling = true;
    try {
      for (;;) {
        this.dirty = false;
        const missing = this.close();
        if (missing.size > 0) {
          this.handle.loaded = false;
          if (!this.fetch([...missing])) return; // waits
        } else if (!this.dirty) {
          complete = true;
          break;
        }
      }
    } finally {
      this.settling = false;
    }
    this.arrivals = [];
    this.handle.loaded = complete;
    if (complete && !this.acted) {
      this.acted = true;
      if (this.action) this.action(this.handle.selection);
    }
  }

  /**
   * Follows the selected references from the starting object, applying the rule to each object
   * met that has no application yet. Holds what is reached, lets go of what no longer is, and
   * returns the identities of the objects selected that are not in memory.
   */
  close() {
    const well = this.well;
    const reached = new Selection();
    const visited = new Set();
    const missing = new Set();
    const want = (id) => {
      const object = well.inMemory(id);
      if (object !== undefined) return object;
      if (!well.gone.has(id)) missing.add(id);
      return undefined;
    };
    const queue = [this.start];
    while (queue.length > 0) {
      const object = queue.pop();
      if (visited.has(object)) continue;
      visited.add(object);
      let entry = this.entryFor(object);
      if (entry.needs !== null && (well.inMemory(entry.needs) !== undefined || well.gone.has(entry.needs))) {
        // What stopped the rule has arrived: apply it again.
        this.drop(object);
        entry = this.entryFor(object);
      }
      if (entry.excluded) continue;
      reached.add(object);
      if (entry.needs !== null) want(entry.needs);
      for (const item of entry.selects) {
        const selected = typeof(item) === "string" ? want(item) : item;
        if (selected !== undefined) queue.push(selected);
      }
    }

    for (const object of reached) if (!this.held.has(object)) well.hold(object);
    for (const object of this.held) if (!reached.has(object)) well.release(object);
    for (const object of [...this.entries.keys()]) if (!visited.has(object)) this.drop(object);
    this.held = reached;
    this.handle.selection = reached;
    return missing;
  }

  /** The application of the rule to one object: a repeater, made when the object is first met. */
  entryFor(object) {
    let entry = this.entries.get(object);
    if (entry !== undefined) return entry;
    const well = this.well;
    entry = { repeater: null, selects: [], needs: null, excluded: false, started: false };
    this.entries.set(object, entry);
    const rule = this.rules[well.model.classNameOf(object)];
    entry.repeater = this.world.repeat("select", () => {
      const selection = new Selection();
      let excluded = false;
      let needs = null;
      well.inRule++;
      try {
        if (this.filter && !this.filter(object)) excluded = true;
        else if (rule) rule(object, selection);
      } catch (error) {
        if (!(error instanceof NotLoaded)) throw error;
        needs = error.id;
      } finally {
        well.inRule--;
      }
      entry.excluded = excluded;
      entry.needs = needs;
      if (needs === null) {
        // A rule that was stopped keeps what it gave before, until it has run to its end.
        entry.selects = [...selection].map((item) => {
          const id = well.stubIds.get(item);
          if (id !== undefined) return id;
          if (!well.model.isSynchronized(item)) throw new DataModelError("A rule selects synchronized objects only.");
          return item;
        });
      }
      if (entry.started) this.world.withoutRecording(() => this.settle());
      entry.started = true;
    }, { independent: true });
    return entry;
  }

  drop(object) {
    const entry = this.entries.get(object);
    if (entry === undefined) return;
    this.entries.delete(object);
    if (entry.repeater) this.world.retractRepeater(entry.repeater);
  }

  /** Asks for a round of objects. True if they arrived at once. */
  fetch(ids) {
    let arrived = false;
    let returned = false;
    this.fetching = true;
    this.well.readMany(ids, (made) => {
      this.fetching = false;
      this.arrivals.push(...made);
      arrived = true;
      if (returned && !this.handle.released) {
        this.settle();
        this.well.writePins();
      }
    });
    returned = true;
    return arrived;
  }

  release() {
    if (this.handle.released) return;
    this.handle.released = true;
    for (const object of [...this.entries.keys()]) this.drop(object);
    for (const object of this.held) this.well.release(object);
    this.held = new Set();
    this.arrivals = [];
    this.handle.selection = new Selection();
    this.handle.loaded = false;
    this.well.writePins();
  }
}

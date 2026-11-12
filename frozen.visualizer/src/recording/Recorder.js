/**
 * Records what a database and its collector do, as a timeline of frames.
 *
 * A frame is one committed store transaction: either a user transaction or one collector step.
 * It holds the transaction's writes (so the store can be rebuilt at any frame), the committed
 * keys it read, and a description of what happened. Frames are plain JSON, so that a live
 * database could later stream the same frames to the visualizer (see the README).
 *
 *   const session = new Recorder({ options });
 *   session.transaction("Create a document", (tx) => { ... });
 *   session.collect();
 *   const timeline = session.timeline();
 */

import { Database, MemoryStore } from "@liquefy/frozen";
import { Timeline } from "./Timeline.js";

/**
 * The objects a frame looked at: those whose record it read, or, with the edge index, whose
 * outgoing edge keys (y/<region>/<object>/<target>) it read.
 */
function readObjects(keys) {
  const ids = new Set();
  for (const key of keys) {
    if (key.startsWith("o/")) ids.add(key.slice(2));
    else if (key.startsWith("y/")) ids.add(key.split("/")[2]);
  }
  return [...ids];
}

export class Recorder {
  constructor({ options = {}, title = "" } = {}) {
    this.store = new MemoryStore();
    this.frames = [];
    this.reads = new Set();
    this.writes = null;
    this.caption = null;
    this.store.observe({
      read: (key) => this.reads.add(key),
      commit: (writes) => {
        // A step or transaction commits once; anything else (the database's own setup) is
        // recorded as a frame of its own.
        if (this.writes !== null) throw new Error("Recorder: two commits in one frame");
        this.writes = writes.map(([key, value]) => [key, value === undefined ? null : structuredClone(value)]);
      },
    });
    this.db = new Database({ store: this.store, options });
    this.endFrame({ kind: "start", label: title || "The empty database: ROOT in region r0" });
  }

  /** Whether cuts are deferred and holds honored (the deferCuts option). */
  get deferCuts() {
    return this.db.options.deferCuts !== false;
  }

  /** Starts collecting a frame's reads and writes. */
  beginFrame() {
    this.reads = new Set();
    this.writes = null;
  }

  /** Ends a frame. Frames that wrote nothing are dropped. */
  endFrame(step) {
    const writes = this.writes ?? [];
    if (writes.length > 0) {
      this.frames.push({
        ...step,
        caption: this.caption,
        writes,
        reads: readObjects(this.reads),
      });
      this.caption = null;
    }
    this.reads = new Set();
    this.writes = null;
  }

  /** An explanation shown with the next recorded frame. */
  explain(text) {
    this.caption = text;
  }

  /** Runs a user transaction as one frame. Returns what `fn` returns. */
  transaction(label, fn) {
    this.beginFrame();
    const result = this.db.transaction(fn);
    this.endFrame({ kind: "transaction", label });
    return result;
  }

  /** Runs one collector step as one frame. Returns false if the collector had nothing to do. */
  step({ flush = true } = {}) {
    this.beginFrame();
    const worked = this.db.collector.step({ flush });
    this.endFrame({ ...(this.db.collector.lastStep ?? { kind: "gc" }) });
    return worked;
  }

  /** Runs up to `limit` collector steps, each a frame. Returns the number of steps run. */
  collect({ limit = 10_000, flush = true } = {}) {
    let steps = 0;
    while (steps < limit && this.step({ flush })) steps++;
    return steps;
  }

  /**
   * Runs collector steps until one that `test(lastStep)` accepts has run, so that scenarios can
   * stop at a point of interest regardless of the structure tasks in between. A pending
   * explanation goes with that step.
   */
  stepUntil(test, { limit = 10_000, flush = true } = {}) {
    const caption = this.caption;
    this.caption = null;
    for (let i = 0; i < limit; i++) {
      if (!this.step({ flush })) throw new Error("stepUntil: the collector ran out of work first");
      if (test(this.db.collector.lastStep)) {
        if (caption !== null) this.frames.at(-1).caption = caption;
        return;
      }
    }
    throw new Error("stepUntil: step limit reached");
  }

  timeline() {
    return new Timeline(this.frames);
  }
}

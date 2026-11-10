/**
 * The incremental collector (documents/persistent-garbage-collection.md §10), single-region
 * version: object items only.
 *
 * Each call to step() runs one unit of work in its own store transaction:
 *
 *   0. a due deferred cut: retry quick swap, otherwise start a cohort with it (§9.3)
 *
 * or, for an active cohort picked round-robin, one step of its ladder:
 *
 *   1. expand  a rescued object: rescue the unstable objects it references
 *   2. mark    an unstable object: its tree children become unstable in the same cohort,
 *              except shared children that find a verified replacement parent (§10.2)
 *   3. check   all unchecked members at once: look for a stable referrer of each
 *   4. reclaim when all lists are empty, the cohort is closed under "is referenced by"
 *
 * Referrers are found with GcState.referrersOf, which with a single region scans every record
 * (O(database) per call). Regions are what make it local.
 */

import { GcState, STABLE, keys } from "./GcState.js";
import { strongReferences } from "../model.js";
import { runStructureTask } from "./regions.js";

export class Collector {
  /**
   * @param store      the MemoryStore
   * @param onReclaim  optional hook, called inside the reclaim step with the ids about to be
   *                   deleted, before anything is written. Tests use it to check safety
   *                   against the committed state.
   * @param options    collector options (GcState.defaultOptions)
   */
  constructor(store, { onReclaim, options = {} } = {}) {
    this.store = store;
    this.onReclaim = onReclaim;
    this.options = options;
    this.lastCohort = null;
    /** What the last step did, for tools such as the visualizer: { kind, ... }, or null. */
    this.lastStep = null;
    this.stats = {
      steps: 0,
      expand: 0,
      mark: 0,
      check: 0,
      reclaim: 0,
      reclaimed: 0,
      deferralsResolved: 0,
      deferralsSwapped: 0,
      replacementParents: 0,
      structure: {},
    };
  }

  gc(tx) {
    return new GcState(tx, this.options);
  }

  /** True when there is no active cohort and no pending deferral. */
  isIdle() {
    return (
      this.store.range("c/").every(([, cohort]) => cohort.mergedInto) &&
      this.store.keys("d/").length === 0 &&
      this.store.keys("h/").length === 0 &&
      this.store.keys("s/").length === 0
    );
  }

  /**
   * Runs up to `maxSteps` steps. Returns the number of steps run.
   * With `flush`, deferrals are resolved even before their deadline.
   */
  run(maxSteps = Infinity, { flush = false } = {}) {
    let steps = 0;
    while (steps < maxSteps && this.step({ flush })) steps++;
    return steps;
  }

  /**
   * Runs until idle, resolving deferrals regardless of their deadline. Throws if that takes
   * more than `limit` steps.
   */
  runUntilIdle(limit = 1_000_000) {
    const steps = this.run(limit, { flush: true });
    if (!this.isIdle()) throw new Error(`Collector not idle after ${limit} steps`);
    return steps;
  }

  /** Runs one unit of work. Returns false if there was nothing to do. */
  step({ flush = false } = {}) {
    this.lastStep = null;
    return this.store.transaction((tx) => {
      const gc = this.gc(tx);

      const deferred = gc.dueDeferral(flush);
      if (deferred !== null) {
        this.stats.steps++;
        const swapped = this.resolveDeferral(gc, deferred);
        this.lastStep = { kind: "deferral", id: deferred, outcome: swapped ? "swapped" : "cohort" };
        return true;
      }

      const structure = gc.tx.keys("s/")[0];
      if (structure !== undefined) {
        this.stats.steps++;
        const outcome = runStructureTask(gc, structure.slice(2));
        this.stats.structure[outcome] = (this.stats.structure[outcome] ?? 0) + 1;
        this.lastStep = { kind: "structure", region: structure.slice(2), outcome };
        return true;
      }

      const cohorts = gc.activeCohorts();
      if (cohorts.length === 0) return false;
      const next = cohorts.find((cohort) => this.lastCohort === null || cohort.id > this.lastCohort) ?? cohorts[0];
      this.lastCohort = next.id;
      this.stats.steps++;
      this.ladder(gc, next.id);
      return true;
    });
  }

  /** A deferred cut is due: retry quick swap, otherwise it becomes the start of a new cohort. */
  resolveDeferral(gc, id) {
    this.stats.deferralsResolved++;
    if (gc.quickSwap(id)) {
      this.stats.deferralsSwapped++;
      return true;
    }
    gc.makeUnstable(id, gc.newCohort());
    return false;
  }

  ladder(gc, cohortId) {
    const cohort = gc.cohort(cohortId);
    if (cohort.expand.length > 0) {
      const id = cohort.expand.shift();
      gc.saveCohort(cohort);
      this.stats.expand++;
      this.lastStep = { kind: "expand", cohort: cohortId, ids: [id] };
      this.expand(gc, id, cohortId);
    } else if (cohort.mark.length > 0) {
      const id = cohort.mark.shift();
      gc.saveCohort(cohort);
      this.stats.mark++;
      this.lastStep = { kind: "mark", cohort: cohortId, ids: [id] };
      this.mark(gc, id, cohortId);
    } else if (cohort.check.length > 0) {
      const batch = cohort.check;
      cohort.check = [];
      gc.saveCohort(cohort);
      this.stats.check++;
      this.lastStep = { kind: "check", cohort: cohortId, ids: batch };
      this.check(gc, batch, cohortId);
    } else {
      this.stats.reclaim++;
      this.lastStep = { kind: "reclaim", cohort: cohortId, ids: [] };
      this.reclaim(gc, cohortId);
    }
  }

  /**
   * A newly stable object rescues the unstable objects it references.
   *
   * The expand item is an obligation of this cohort: members of it may have been checked while
   * this object was still a member, counting it as a referrer inside the cohort. If the object
   * has meanwhile become unstable in another cohort, its eventual rescue will queue its
   * expansion there, out of this cohort's sight. So the two cohorts' fates are now linked, and
   * they merge.
   */
  expand(gc, id, cohortId) {
    if (!gc.meta(id)) return; // reclaimed since; its own cohort's checks covered its referrers
    const state = gc.state(id);
    if (state !== STABLE) {
      gc.merge(cohortId, state);
      return;
    }
    const record = gc.record(id);
    for (const target of strongReferences(record).keys()) {
      // An unmarked target is left to its pending check (GcState.canRescue).
      if (gc.state(target) !== STABLE && gc.canRescue(target)) gc.rescue(target, id);
    }
  }

  /**
   * An unstable object's tree children become unstable in the same cohort.
   *
   * A shared child first looks for a replacement parent: another referrer that passes the
   * verified walk (§10.2, invariant W1). If it finds one, it is re-parented there and marking
   * does not descend into it. This keeps a cut from marking a structure that is still reachable
   * some other way, such as the rest of a queue after a dequeue.
   */
  mark(gc, id, cohortId) {
    if (!gc.meta(id)) return; // reclaimed by another cohort since it was queued
    if (gc.state(id) !== cohortId) return; // rescued since it was queued (only possible once marked)

    const children = gc.treeChildren(id);
    const shared = children.filter((child) => gc.meta(child).shared);
    const referrers = shared.length > 0 ? gc.referrersOf(shared) : new Map();

    for (const child of children) {
      if (referrers.has(child)) {
        const candidates = referrers.get(child).filter((source) => source !== id);
        const parent = gc.findVerifiedReferrer(child, candidates);
        if (parent !== null) {
          gc.reparent(child, parent);
          this.stats.replacementParents++;
          continue;
        }
      }
      gc.makeUnstable(child, cohortId);
    }
  }

  /**
   * Looks for a stable referrer of every member in the batch. A stable referrer rescues; a
   * referrer in another active cohort merges the two cohorts; referrers in this cohort leave the
   * member checked.
   */
  check(gc, batch, cohortId) {
    // Items may be stale: rescued since, or rescued, cut again and reclaimed by another cohort.
    const members = new Set(batch.filter((id) => gc.meta(id) && gc.state(id) === gc.findCohort(cohortId)));
    if (members.size === 0) return;

    const referrers = gc.referrersOf(members);
    for (const member of members) {
      for (const source of referrers.get(member)) {
        const current = gc.findCohort(cohortId);
        if (gc.state(member) !== current) break; // already rescued in this batch
        const sourceState = gc.state(source);
        if (sourceState === STABLE) {
          gc.rescue(member, source);
          break;
        }
        if (sourceState !== current) gc.merge(current, sourceState);
      }
    }
  }

  /** Deletes every member of a closed cohort, and the cohort itself. */
  reclaim(gc, cohortId) {
    const root = gc.findCohort(cohortId);
    const cohort = gc.cohort(root);
    cohort.state = "reclaiming";
    gc.saveCohort(cohort);

    const doomed = [];
    for (const familyId of gc.cohortFamily(root)) {
      for (const key of gc.tx.keys(keys.memberPrefix(familyId))) {
        const id = key.slice(keys.memberPrefix(familyId).length);
        if (gc.state(id) !== root) throw new Error(`Member key of ${id} in ${familyId} is stale`);
        if (gc.treeChildren(id).length > 0) throw new Error(`Reclaiming ${id}, which has tree children`);
        doomed.push({ id, key });
      }
    }

    this.onReclaim?.(doomed.map(({ id }) => id));

    for (const { id, key } of doomed) {
      const region = gc.regionOf(id);
      gc.tx.delete(keys.regionMemberKey(region, id));
      gc.scheduleStructure(region);
      gc.tx.delete(keys.objectKey(id));
      gc.tx.delete(keys.metaKey(id));
      gc.tx.delete(key);
    }
    for (const familyId of gc.cohortFamily(root)) gc.tx.delete(keys.cohortKey(familyId));
    this.stats.reclaimed += doomed.length;
  }
}

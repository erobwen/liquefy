/**
 * The incremental collector (documents/persistent-garbage-collection.md §10), basic version:
 * one region, object items only.
 *
 * A scheduler picks an active cohort round-robin, and runs one step of its ladder in its own
 * store transaction:
 *
 *   1. expand  a rescued object: rescue the unstable objects it references
 *   2. mark    an unstable object: make its tree children unstable in the same cohort
 *   3. check   all unchecked members at once: look for a stable referrer of each
 *   4. reclaim when all lists are empty, the cohort is closed under "is referenced by"
 *
 * Checks find referrers with edgesOfRegion. With a single region, that is every edge in the
 * store, read from the object records (implementation A of §5.5). It is O(database) per check
 * batch, which is what regions are for in later steps.
 */

import { GcState, STABLE, keys } from "./GcState.js";
import { strongReferences } from "../model.js";

export class Collector {
  /**
   * @param store      the MemoryStore
   * @param onReclaim  optional hook, called inside the reclaim step with the ids about to be
   *                   deleted, before anything is written. Tests use it to check safety
   *                   against the committed state.
   */
  constructor(store, { onReclaim } = {}) {
    this.store = store;
    this.onReclaim = onReclaim;
    this.lastCohort = null;
    this.stats = { steps: 0, expand: 0, mark: 0, check: 0, reclaim: 0, reclaimed: 0 };
  }

  /** True when there is no active cohort. */
  isIdle() {
    return this.store.range("c/").every(([, cohort]) => cohort.mergedInto);
  }

  /** Runs up to `maxSteps` steps. Returns the number of steps run. */
  run(maxSteps = Infinity) {
    let steps = 0;
    while (steps < maxSteps && this.step()) steps++;
    return steps;
  }

  /** Runs until idle. Throws if that takes more than `limit` steps. */
  runUntilIdle(limit = 1_000_000) {
    const steps = this.run(limit);
    if (!this.isIdle()) throw new Error(`Collector not idle after ${limit} steps`);
    return steps;
  }

  /** Runs one step of one cohort. Returns false if there was nothing to do. */
  step() {
    return this.store.transaction((tx) => {
      const gc = new GcState(tx);
      const cohorts = gc.activeCohorts();
      if (cohorts.length === 0) return false;
      const next = cohorts.find((cohort) => this.lastCohort === null || cohort.id > this.lastCohort) ?? cohorts[0];
      this.lastCohort = next.id;
      this.stats.steps++;
      this.ladder(gc, next.id);
      return true;
    });
  }

  ladder(gc, cohortId) {
    const cohort = gc.cohort(cohortId);
    if (cohort.expand.length > 0) {
      const id = cohort.expand.shift();
      gc.saveCohort(cohort);
      this.stats.expand++;
      this.expand(gc, id, cohortId);
    } else if (cohort.mark.length > 0) {
      const id = cohort.mark.shift();
      gc.saveCohort(cohort);
      this.stats.mark++;
      this.mark(gc, id, cohortId);
    } else if (cohort.check.length > 0) {
      const batch = cohort.check;
      cohort.check = [];
      gc.saveCohort(cohort);
      this.stats.check++;
      this.check(gc, batch, cohortId);
    } else {
      this.stats.reclaim++;
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

  /** An unstable object's tree children become unstable in the same cohort. */
  mark(gc, id, cohortId) {
    if (!gc.meta(id)) return; // reclaimed by another cohort since it was queued
    if (gc.state(id) !== cohortId) return; // rescued since it was queued (only possible once marked)
    gc.markChildren(id, cohortId);
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

    const referrers = new Map([...members].map((id) => [id, []]));
    for (const { source, target } of this.edgesOfRegion(gc)) {
      if (referrers.has(target)) referrers.get(target).push(source);
    }

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

  /** All strong edges in the (single) region, read from the object records. */
  edgesOfRegion(gc) {
    const edges = [];
    for (const [key, record] of gc.tx.range("o/")) {
      const source = key.slice(2);
      for (const target of strongReferences(record).keys()) edges.push({ source, target });
    }
    return edges;
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
      gc.tx.delete(keys.objectKey(id));
      gc.tx.delete(keys.metaKey(id));
      gc.tx.delete(key);
    }
    for (const familyId of gc.cohortFamily(root)) gc.tx.delete(keys.cohortKey(familyId));
    this.stats.reclaimed += doomed.length;
  }
}

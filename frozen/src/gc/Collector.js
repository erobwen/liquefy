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

import { GcState, STABLE, ROOT_REGION, keys, isRegionItem, regionOfItem } from "./GcState.js";
import { strongReferences } from "../model.js";
import { runStructureTask, deleteRegion } from "./regions.js";

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
      suspended: 0,
      regionsReclaimed: 0,
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

  /**
   * Runs one unit of work. Returns false if there was nothing to do.
   *
   * The order finishes what can be finished first, so that cohorts live as short as possible
   * (fewer merges, fewer rescues of objects in long-waiting cohorts, space freed sooner):
   *
   *   1. a ready cohort - nothing left to expand or mark - is checked, and reclaimed in the
   *      same step if the check rescued nothing
   *   2. a due deferral
   *   3. structure tasks and the other cohorts' ladders, alternately (cohorts round-robin)
   *
   * Ready cohorts only come from work done in 2 and 3, so they cannot starve the rest; and
   * alternating keeps structure tasks (pure housekeeping) from delaying marking, and the
   * reverse.
   */
  step({ flush = false } = {}) {
    const previous = this.lastStep?.kind ?? null;
    this.lastStep = null;
    return this.store.transaction((tx) => {
      const gc = this.gc(tx);
      const cohorts = gc.activeCohorts();

      const ready = cohorts.find((cohort) => cohort.expand.length === 0 && cohort.mark.length === 0);
      if (ready) {
        this.stats.steps++;
        this.finish(gc, ready);
        return true;
      }

      const deferred = gc.dueDeferral(flush);
      if (deferred !== null) {
        this.stats.steps++;
        const swapped = this.resolveDeferral(gc, deferred);
        this.lastStep = { kind: "deferral", id: deferred, outcome: swapped ? "swapped" : "cohort" };
        return true;
      }

      const structure = gc.tx.keys("s/")[0];
      if (structure !== undefined && (cohorts.length === 0 || previous !== "structure")) {
        this.stats.steps++;
        const outcome = runStructureTask(gc, structure.slice(2));
        this.stats.structure[outcome] = (this.stats.structure[outcome] ?? 0) + 1;
        this.lastStep = { kind: "structure", region: structure.slice(2), outcome };
        return true;
      }

      if (cohorts.length === 0) return false;
      const next = cohorts.find((cohort) => this.lastCohort === null || cohort.id > this.lastCohort) ?? cohorts[0];
      this.lastCohort = next.id;
      this.stats.steps++;
      this.ladder(gc, next.id);
      return true;
    });
  }

  /**
   * A ready cohort: check what is left to check, and if that rescued nothing (no expand items,
   * nothing to mark), the cohort is closed under "is referenced by": reclaim it in the same
   * transaction. The check has just read what the reclaim relies on.
   */
  finish(gc, cohort) {
    if (cohort.check.length > 0) {
      const batch = cohort.check;
      cohort.check = [];
      gc.saveCohort(cohort);
      this.stats.check++;
      this.lastStep = { ...checkStep(cohort.id, batch), reclaimed: false };
      this.check(gc, batch, cohort.id);
      const root = gc.cohort(gc.findCohort(cohort.id));
      if (root.expand.length > 0 || root.mark.length > 0 || root.check.length > 0) return;
      this.lastStep.reclaimed = true;
    } else {
      this.lastStep = { kind: "reclaim", cohort: cohort.id, ids: [] };
    }
    this.stats.reclaim++;
    this.reclaim(gc, cohort.id);
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
      this.lastStep = isRegionItem(id)
        ? { kind: "expand", cohort: cohortId, ids: [], region: regionOfItem(id) }
        : { kind: "expand", cohort: cohortId, ids: [id] };
      this.expand(gc, id, cohortId);
    } else if (cohort.mark.length > 0) {
      const id = cohort.mark.shift();
      gc.saveCohort(cohort);
      this.stats.mark++;
      this.lastStep = isRegionItem(id)
        ? { kind: "mark", cohort: cohortId, ids: [], region: regionOfItem(id) }
        : { kind: "mark", cohort: cohortId, ids: [id] };
      this.mark(gc, id, cohortId);
    } else if (cohort.check.length > 0) {
      const batch = cohort.check;
      cohort.check = [];
      gc.saveCohort(cohort);
      this.stats.check++;
      this.lastStep = checkStep(cohortId, batch);
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
    if (isRegionItem(id)) {
      // A resumed region (§8.2): every member that is still stable expands.
      const region = regionOfItem(id);
      if (!gc.regionExists(region)) return;
      for (const member of gc.regionMembers(region)) this.expand(gc, member, cohortId);
      gc.tx.put(keys.regionKey(region), { ...gc.tx.get(keys.regionKey(region)), expanding: false });
      gc.scheduleStructure(region);
      return;
    }
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
    if (isRegionItem(id)) {
      this.markRegion(gc, regionOfItem(id), cohortId);
      return;
    }
    if (!gc.meta(id)) return; // reclaimed by another cohort since it was queued
    if (gc.state(id) !== gc.findCohort(cohortId)) return; // rescued since it was queued (only possible once marked)
    if (gc.isImplicit(id)) return; // its region was suspended since: the region item marks it

    // Suspension (§8.1): if everything in this object's region is condemned to this cohort,
    // the whole region is marked at once instead of object by object.
    if (gc.options.suspension) {
      const root = gc.findCohort(cohortId);
      const region = gc.regionOf(id);
      const anchors = gc.suspendable(region, root);
      if (anchors !== null) {
        gc.suspend(region, root, anchors);
        this.stats.suspended++;
        if (this.lastStep) this.lastStep.suspended = region;
        return;
      }
    }

    this.detach(gc, gc.treeChildren(id).map((child) => [id, child]), cohortId);
  }

  /**
   * Cuts tree edges [parent, child] whose parents are unstable in the cohort: each child
   * becomes unstable too. A shared child first looks for a replacement parent: another
   * referrer that passes the verified walk (§10.2, invariant W1). If it finds one, it is
   * re-parented there and marking does not descend into it. This keeps a cut from marking a
   * structure that is still reachable some other way, such as the rest of a queue after a
   * dequeue.
   */
  detach(gc, edges, cohortId) {
    const shared = edges.map(([, child]) => child).filter((child) => gc.meta(child).shared);
    const referrers = shared.length > 0 ? gc.referrersOf(shared) : new Map();
    for (const [parent, child] of edges) {
      if (referrers.has(child)) {
        const candidates = referrers.get(child).filter((source) => source !== parent);
        const replacement = gc.findVerifiedReferrer(child, candidates);
        if (replacement !== null) {
          gc.reparent(child, replacement);
          this.stats.replacementParents++;
          continue;
        }
      }
      gc.makeUnstable(child, cohortId);
    }
  }

  /**
   * Marks a suspended region (§8.1): the tree edges that leave it are cut, as marking its
   * members one by one would have done; the edges inside it stay. Then the region is queued
   * for its check. Costs one pass over the region, not one step per member.
   */
  markRegion(gc, region, cohortId) {
    const suspended = gc.regionExists(region) ? gc.suspension(region) : null;
    if (suspended === null || gc.findCohort(suspended.cohort) !== gc.findCohort(cohortId)) return; // materialized since
    const members = new Set(gc.regionMembers(region));
    const exits = [];
    for (const member of members) {
      for (const child of gc.treeChildren(member)) if (!members.has(child)) exits.push([member, child]);
    }
    this.detach(gc, exits, cohortId);
    gc.setSuspension(region, { ...suspended, marked: true });
    gc.push(gc.findCohort(cohortId), "check", "@" + region);
  }

  /**
   * Checks a suspended region (§10.2, region item): looks for referrers of its implicit
   * members. Referrers inside the cohort leave it suspended; one in another cohort merges the
   * two; a stable one means the region is not entirely garbage, and it is materialized, so that
   * marking proceeds object by object and the referrer becomes a replacement parent.
   */
  checkRegion(gc, region, cohortId) {
    const suspended = gc.regionExists(region) ? gc.suspension(region) : null;
    if (suspended === null || gc.findCohort(suspended.cohort) !== gc.findCohort(cohortId)) return;
    const implicit = gc.regionMembers(region).filter((id) => gc.meta(id).cohort === null);
    if (implicit.length === 0) return;
    const referrers = gc.referrersOf(implicit);
    for (const member of implicit) {
      for (const source of referrers.get(member)) {
        const current = gc.findCohort(cohortId);
        const sourceState = gc.state(source);
        if (sourceState === STABLE) {
          gc.materialize(region);
          return;
        }
        if (sourceState !== current) gc.merge(current, sourceState);
      }
    }
  }

  /**
   * Looks for a stable referrer of every member in the batch. A stable referrer rescues; a
   * referrer in another active cohort merges the two cohorts; referrers in this cohort leave the
   * member checked.
   */
  check(gc, batch, cohortId) {
    this.checkObjects(gc, batch.filter((item) => !isRegionItem(item)), cohortId);
    for (const item of batch.filter(isRegionItem)) this.checkRegion(gc, regionOfItem(item), cohortId);
  }

  checkObjects(gc, batch, cohortId) {
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
          // An earlier rescue in this batch may have materialized the member's region, making
          // it unmarked again; materialize queued its check again, which will rescue it.
          if (gc.canRescue(member)) gc.rescue(member, source);
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

    // Explicit members, by their membership keys; and suspended regions, whole (§8.3). A
    // suspended region holds only implicit members and explicit members of this cohort.
    const doomed = new Map(); // id → its membership key, or null for an implicit member
    for (const familyId of gc.cohortFamily(root)) {
      for (const key of gc.tx.keys(keys.memberPrefix(familyId))) {
        const id = key.slice(keys.memberPrefix(familyId).length);
        if (gc.state(id) !== root) throw new Error(`Member key of ${id} in ${familyId} is stale`);
        doomed.set(id, key);
      }
    }
    const regions = [];
    for (const familyId of gc.cohortFamily(root)) {
      for (const region of gc.suspendedRegions(familyId)) {
        regions.push({ region, key: keys.suspendedKey(familyId, region) });
        for (const id of gc.regionMembers(region)) {
          if (gc.state(id) !== root) throw new Error(`Suspended region ${region} holds ${id}, not in ${root}`);
          if (!doomed.has(id)) doomed.set(id, null);
        }
      }
    }
    for (const id of doomed.keys()) {
      for (const child of gc.treeChildren(id)) {
        if (!doomed.has(child)) throw new Error(`Reclaiming ${id}, which has the surviving tree child ${child}`);
      }
    }

    this.onReclaim?.([...doomed.keys()]);

    const deletedRegions = new Set(regions.map(({ region }) => region));
    for (const [id, key] of doomed) {
      const meta = gc.meta(id);
      gc.tx.delete(keys.regionMemberKey(meta.region, id));
      if (!deletedRegions.has(meta.region)) gc.scheduleStructure(meta.region);
      if (meta.treeParent !== null) gc.tx.delete(keys.treeKey(meta.treeParent, id));
      gc.tx.delete(keys.objectKey(id));
      gc.tx.delete(keys.metaKey(id));
      if (key !== null) gc.tx.delete(key);
    }
    for (const { region, key } of regions) {
      gc.tx.delete(key);
      gc.tx.delete(keys.structureKey(region));
      deleteRegion(gc, region);
    }
    for (const familyId of gc.cohortFamily(root)) gc.tx.delete(keys.cohortKey(familyId));
    this.stats.reclaimed += doomed.size;
    this.stats.regionsReclaimed += regions.length;
    if (this.lastStep) this.lastStep.regions = regions.map(({ region }) => region);
  }
}

/** The description of a check step: its object items and its region items. */
function checkStep(cohortId, batch) {
  return {
    kind: "check",
    cohort: cohortId,
    ids: batch.filter((item) => !isRegionItem(item)),
    regions: batch.filter(isRegionItem).map(regionOfItem),
  };
}

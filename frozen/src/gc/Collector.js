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

import { GcState, STABLE, keys, isRegionItem, regionOfItem } from "./GcState.js";
import { strongReferences } from "../model.js";
import { runStructureTask, runRehomeTask } from "./regions.js";

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
      suspendedMeta: 0,
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
      this.store.keys("s/").length === 0 &&
      this.store.keys("x/").length === 0
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

      // Re-home tasks wait until no other structure task is pending: they are the lazy ones.
      const structure = gc.tx.keys("s/")[0] ?? gc.tx.keys("x/")[0];
      if (structure !== undefined && (cohorts.length === 0 || previous !== "structure")) {
        this.stats.steps++;
        const outcome = (structure.startsWith("s/") ? runStructureTask : runRehomeTask)(gc, structure.slice(2));
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
      // A resumed cluster (§8.2): every object in it that is still stable expands.
      const cluster = regionOfItem(id);
      if (!gc.regionExists(cluster)) return;
      for (const member of gc.objectsIn(cluster)) this.expand(gc, member, cohortId);
      gc.patchCluster(cluster, { expanding: false });
      gc.scheduleInside(cluster);
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
    // In a suspended cluster since it was queued: the cluster's item marks it.
    if (gc.suspensionOf(gc.regionOf(id)) !== null) return;

    // Suspension (§8.1): if everything in a cluster containing this object is condemned to this
    // cohort, the whole cluster is marked at once instead of object by object. The highest
    // such cluster is taken: a whole branch of meta-regions is suspended at the top level where
    // it is complete.
    if (gc.options.suspension) {
      const root = gc.findCohort(cohortId);
      const chain = gc.chain(gc.regionOf(id));
      for (let level = chain.length - 1; level >= 0; level--) {
        if (!gc.suspendable(chain[level], root)) continue;
        gc.suspend(chain[level], root);
        this.stats.suspended++;
        if (level > 0) this.stats.suspendedMeta++;
        if (this.lastStep) this.lastStep.suspended = chain[level];
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
   * Marks a suspended cluster (§8.1): the tree edges that leave it are cut, as marking its
   * objects one by one would have done; the edges inside it stay. Then the cluster is queued
   * for its check.
   *
   * The exits are found from the T/ counts: from a meta-region, only the members with tree
   * edges leaving it are descended into, down to the level-0 regions where those edges start,
   * whose objects' tree children are read. The cost follows the boundary, not the size.
   */
  markRegion(gc, cluster, cohortId) {
    const suspended = gc.regionExists(cluster) ? gc.suspension(cluster) : null;
    if (suspended === null || gc.findCohort(suspended.cohort) !== gc.findCohort(cohortId)) return; // materialized since
    const exits = [];
    const visit = (id) => {
      if (gc.cluster(id).level === 0) {
        const members = new Set(gc.regionMembers(id));
        for (const member of members) {
          for (const child of gc.treeChildren(member)) {
            if (!members.has(child) && !gc.isInside(gc.regionOf(child), cluster)) exits.push([member, child]);
          }
        }
        return;
      }
      for (const member of gc.regionMembers(id)) {
        if (gc.treeExits(member).some(([to]) => !gc.isInside(to, cluster))) visit(member);
      }
    };
    visit(cluster);
    this.detach(gc, exits, cohortId);
    gc.setSuspension(cluster, { ...suspended, marked: true });
    gc.push(gc.findCohort(cohortId), "check", "@" + cluster);
  }

  /**
   * Checks a suspended cluster (§10.2, region item): looks for referrers of its implicit
   * objects from outside it. Edges inside it come from the same cohort and are never read.
   *
   * Edges from outside are covered by the flags on the cluster at its own level (invariant G2).
   * A flagged source at level k can be as big as the cluster, or much bigger (the top-level
   * cluster that holds the parent of a deleted branch), so it is not scanned whole. Instead each
   * pair (target cluster, source cluster) is narrowed one level down: the target's members'
   * flags that name clusters inside the source. At level 0 the source region is scanned for
   * edges into the target region. By G2, a pair with no narrower pair below it has no edge at
   * all, and its flag is stale and is deleted, as is a level-0 flag whose scan found nothing.
   * A source inside a cluster suspended in this cohort is skipped wholesale: everything in it
   * is in the cohort.
   *
   * Referrers inside the cohort leave the cluster suspended; one in another cohort merges the
   * two; a stable one means the cluster is not entirely garbage, and it is materialized, so that
   * marking proceeds object by object and the referrer becomes a replacement parent.
   */
  checkRegion(gc, cluster, cohortId) {
    const suspended = gc.regionExists(cluster) ? gc.suspension(cluster) : null;
    if (suspended === null || gc.findCohort(suspended.cohort) !== gc.findCohort(cohortId)) return;
    const NONE = 0;
    const FOUND = 1;
    const STOP = 2;
    const seen = new Set();
    const visit = (target, source) => {
      if (!gc.regionExists(source)) {
        gc.deleteFlag(target, source);
        return NONE;
      }
      if (gc.isInside(source, cluster)) return FOUND; // inside: not a referrer from outside
      const sourceSuspension = gc.suspensionOf(source);
      if (sourceSuspension && gc.findCohort(sourceSuspension.cohort) === gc.findCohort(cohortId)) return FOUND;
      const key = `${target}|${source}`;
      if (seen.has(key)) return FOUND;
      seen.add(key);
      let found = false;
      if (gc.cluster(target).level === 0) {
        for (const region of gc.levelZeroRegions(source)) {
          for (const { source: from, target: to } of gc.edgesOfRegion(region)) {
            const meta = gc.meta(to);
            if (!meta || meta.region !== target) continue;
            found = true;
            if (meta.cohort !== null) continue; // explicit objects have checks of their own
            const current = gc.findCohort(cohortId);
            const sourceState = gc.state(from);
            if (sourceState === STABLE) {
              gc.materialize(cluster);
              return STOP;
            }
            if (sourceState !== current) gc.merge(current, sourceState);
          }
        }
      } else {
        for (const member of gc.regionMembers(target)) {
          for (const narrower of gc.flagSources(member)) {
            if (!gc.regionExists(narrower)) {
              gc.deleteFlag(member, narrower);
              continue;
            }
            const next = gc.isInside(narrower, source) ? narrower : gc.isInside(source, narrower) ? source : null;
            if (next === null) continue;
            const result = visit(member, next);
            if (result === STOP) return STOP;
            if (result === FOUND) found = true;
          }
        }
      }
      if (!found) gc.deleteFlag(target, source);
      return found ? FOUND : NONE;
    };
    for (const source of gc.flagSources(cluster)) if (visit(cluster, source) === STOP) return;
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

    // Suspended clusters, whole (§8.3): they hold only implicit objects and explicit members
    // of this cohort. Then the explicit members outside them, by their membership keys.
    const clusters = [];
    for (const familyId of gc.cohortFamily(root)) {
      for (const cluster of gc.suspendedRegions(familyId)) clusters.push({ cluster, key: keys.suspendedKey(familyId, cluster) });
    }
    const clusterIds = new Set(clusters.map(({ cluster }) => cluster));
    const inSuspended = (region) => gc.chain(region).some((id) => clusterIds.has(id));
    const doomed = [];
    for (const { cluster } of clusters) {
      for (const id of gc.objectsIn(cluster)) {
        if (gc.state(id) !== root) throw new Error(`Suspended cluster ${cluster} holds ${id}, not in ${root}`);
        for (const child of gc.treeChildren(id)) {
          if (!gc.isInside(gc.regionOf(child), cluster)) throw new Error(`Reclaiming ${cluster}, which has the tree exit ${id} → ${child}`);
        }
        doomed.push(id);
      }
    }
    const single = [];
    for (const familyId of gc.cohortFamily(root)) {
      for (const key of gc.tx.keys(keys.memberPrefix(familyId))) {
        const id = key.slice(keys.memberPrefix(familyId).length);
        if (gc.state(id) !== root) throw new Error(`Member key of ${id} in ${familyId} is stale`);
        if (inSuspended(gc.regionOf(id))) continue;
        if (gc.treeChildren(id).length > 0) throw new Error(`Reclaiming ${id}, which has tree children`);
        single.push(id);
      }
    }
    doomed.push(...single);

    this.onReclaim?.(doomed);

    for (const id of single) gc.deleteObject(id);
    for (const { cluster, key } of clusters) {
      gc.tx.delete(key);
      gc.deleteClusterWhole(cluster);
    }
    for (const familyId of gc.cohortFamily(root)) gc.tx.delete(keys.cohortKey(familyId));
    this.stats.reclaimed += doomed.length;
    this.stats.regionsReclaimed += clusters.length;
    if (this.lastStep) this.lastStep.regions = clusters.map(({ cluster }) => cluster);
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

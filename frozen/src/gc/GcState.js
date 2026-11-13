/**
 * The collector's persistent state, and the operations on it that the write barrier and the
 * collector share. Every method works inside one store transaction. The invariants these
 * operations maintain are stated in documents/invariants.md.
 *
 * Keys (documents/persistent-garbage-collection.md §4.2):
 *
 *   o/<obj>                 the object record (application data)
 *   g/<obj>                 { region, treeParent, cohort, shared, deferred }: GC metadata
 *   t/<parent>/<child>      spanning-tree child edges
 *   c/<cohort>              cohort record: state, merge links, the sizes of its worklists
 *   w/<cohort>/<list>/<item> a worklist item of a root cohort; list is expand, mark or check
 *   C/<cohort>/<obj>        cohort membership, under the cohort id the object joined
 *   d/<deadline>/<obj>      deferred cuts with a deadline on the logical clock
 *   h/<deadline>/<obj>      deferred cuts with a wall-clock deadline (holds)
 *   r/<cluster>             cluster record, at every level (below)
 *   R/<cluster>             the clusters of the top level, which have no container
 *   S/<cohort>/<cluster>    a cluster suspended in a cohort, under the cohort id it joined
 *   m/<cluster>/<member>    membership: objects in a level-0 region, clusters in a meta-region
 *   e/<target>/<source>     entry flag: something in cluster source may reference into target.
 *                           Its value is true, or "copy" for a flag that was copied when
 *                           objects moved and has not been verified since
 *   z/<region>              pending scrub: verify the copied flags on the region, one a step
 *   E/<source>/<target>     mirror of an entry flag whose source is a meta-region (§6.6)
 *   T/<from>/<to>           number of tree edges from cluster from into cluster to, at the
 *                           level where the two differ (every level up to where they meet)
 *   P/<to>/<from>           mirror of T/<from>/<to>: where cluster to hangs from
 *   y/<region>/<src>/<tgt>  with the edgeIndex option: how many times src, in that level-0
 *                           region, references tgt strongly (§5.5, implementation B)
 *   s/<cluster>             pending structure task: re-evaluate the cluster
 *   x/<cluster>             pending re-home task: does all of it hang from one place? (§6.7)
 *   meta/nextId             id counter
 *   meta/clock              logical clock: the number of application transactions
 *
 * Clusters (§6.9): level-0 clusters are regions of objects; a level-k cluster (a meta-region)
 * holds level k-1 clusters. Every level-0 region has a chain of containers of the same length,
 * ending at a top-level cluster. A cluster record is
 *   { id, level, container, objects, deferred, explicit: { cohortId: n }, weight, flags,
 *     suspended, materializedIn, expanding, pinned }
 * where objects, deferred and explicit count the objects anywhere inside it (aggregated
 * counters, §6.8): all objects, deferred ones, and explicitly unstable ones per cohort id.
 * A level-0 region also keeps its weight: its objects plus their outgoing strong edges (§6.1).
 * `flags` is the number of entry flags on the cluster. `pinned` marks a region made for one
 * heavily referenced object (§14).
 *
 * State of an object (§7.1):
 *   - STABLE: no cohort. It has a tree parent, is ROOT, or is deferred. It may be stale-stable,
 *     that is, below a cut whose marking or deferral is still pending (§7.3).
 *   - unstable in cohort C, explicitly: its cohort field is set. It has no tree parent and,
 *     once marked, no tree children (unless it is in a suspended cluster, below).
 *   - unstable in cohort C, implicitly: no cohort field, but a cluster containing it (its region
 *     or a meta-region above it) is suspended in C (§8.1). It keeps its tree parent, which is
 *     inside that cluster: a suspended cluster keeps its internal tree, hanging from explicit
 *     members of C (its anchors).
 *
 * Cohorts merge by union-find: a merged cohort record points at the cohort it was merged into.
 */

import { strongReferences } from "../model.js";

export const ROOT = "root";
export const ROOT_REGION = "r0";
export const STABLE = "STABLE";

const objectKey = (id) => `o/${id}`;
const metaKey = (id) => `g/${id}`;
const treeKey = (parent, child) => `t/${parent}/${child}`;
const treePrefix = (parent) => `t/${parent}/`;
const cohortKey = (id) => `c/${id}`;
const memberKey = (cohort, id) => `C/${cohort}/${id}`;
const memberPrefix = (cohort) => `C/${cohort}/`;
const workKey = (cohort, list, item) => `w/${cohort}/${list}/${item}`;
const workPrefix = (cohort, list) => `w/${cohort}/${list}/`;
/** The deadline key of a deferral `{ kind, at }`: d/ for the logical clock, h/ for wall-clock. */
const regionKey = (region) => `r/${region}`;
const regionMemberKey = (region, id) => `m/${region}/${id}`;
const regionMemberPrefix = (region) => `m/${region}/`;
const flagKey = (target, source) => `e/${target}/${source}`;
const flagPrefix = (target) => `e/${target}/`;
const structureKey = (region) => `s/${region}`;
const suspendedKey = (cohort, region) => `S/${cohort}/${region}`;
const suspendedPrefix = (cohort) => `S/${cohort}/`;
const edgeKey = (region, source, target) => `y/${region}/${source}/${target}`;
const edgePrefix = (region, source) => (source === undefined ? `y/${region}/` : `y/${region}/${source}/`);
const topKey = (cluster) => `R/${cluster}`;
const rehomeKey = (cluster) => `x/${cluster}`;
const scrubKey = (region) => `z/${region}`;
const mirrorKey = (source, target) => `E/${source}/${target}`;
const mirrorPrefix = (source) => `E/${source}/`;
const treeOutKey = (from, to) => `T/${from}/${to}`;
const treeOutPrefix = (from) => `T/${from}/`;
const treeInKey = (to, from) => `P/${to}/${from}`;
const treeInPrefix = (to) => `P/${to}/`;
const deferralKey = (deferred, id) => `${deferred.kind === "ms" ? "h" : "d"}/${String(deferred.at).padStart(16, "0")}/${id}`;

export const keys = {
  objectKey, metaKey, treeKey, treePrefix, cohortKey, memberKey, memberPrefix, deferralKey,
  regionKey, regionMemberKey, regionMemberPrefix, flagKey, flagPrefix, structureKey,
  suspendedKey, suspendedPrefix, edgeKey, edgePrefix, topKey, rehomeKey, scrubKey, workKey, workPrefix, mirrorKey, mirrorPrefix, treeOutKey, treeOutPrefix,
  treeInKey, treeInPrefix,
};

/** A new, empty cluster record. */
export function clusterRecord(id, level, container) {
  return { id, level, container, objects: 0, deferred: 0, explicit: {}, weight: 0, flags: 0, suspended: null };
}

/**
 * Worklist items are object ids, or region items for suspended regions (§7.2): "@<region>".
 * Object and region ids never start with "@" or "~".
 */
export const regionItem = (region) => "@" + region;
/** A mark item that stands for the rest of a materialized cluster's settling: "~<cluster>". */
export const settleItem = (cluster) => "~" + cluster;
export const isSettleItem = (item) => item.startsWith("~");
export const isRegionItem = (item) => item.startsWith("@");
export const regionOfItem = (item) => item.slice(1);

export const defaultOptions = {
  /**
   * Whether cuts that find no quick swap are deferred (§9.3) and holds honored. Off, such a cut
   * starts a cohort at once: the core algorithm without the deferral add-on.
   */
  deferCuts: true,
  /** Application transactions a cut is deferred before marking starts (§9.3). */
  deferral: 2,
  /** Maximum steps of a verified walk (§9.5). */
  walkBudget: 64,
  /** Maximum referrers tried by quick swap and the replacement-parent search. */
  candidates: 8,
  /** Whether marking suspends whole regions (§8.1). */
  suspension: true,
  /** Wall-clock time source for holds with a duration in milliseconds. */
  now: () => Date.now(),
  /** Region weight (members + outgoing edges) above which a region splits (§6.4). */
  regionCap: 100,
  /**
   * Members above which a meta-region splits, and top-level clusters above which a new level
   * is added (§6.9).
   */
  clusterCap: 32,
  /**
   * Whether parts of a cluster that have come to hang from another cluster are moved there, by
   * low-priority structure tasks (§6.7). Off, clusters stop being branches as data is moved.
   */
  rehome: true,
  /**
   * How much one collector step may take on: the number of items in a check batch, and of
   * objects deleted by one reclaim step. It bounds the size of a step's store transaction.
   */
  stepBudget: 200,
  /**
   * Whether the strong references are also kept as y/ keys, clustered by the source's region
   * (§5.5, implementation B). With it the collector reads small edge keys in one range per
   * region and never an object record; without it, it reads the records of a region's members.
   * It is a property of a store: set it when the database is created, and keep it.
   */
  edgeIndex: true,
  /**
   * Entry flags on a region above which its most referenced object is pinned: moved, with its
   * subtree, to a region of its own (§14). Checks of its former neighbours then no longer scan
   * its many referrers.
   */
  flagCap: 32,
};

/** Adds to a count in a { key: n } map, deleting it at zero. */
export function addCount(counts, key, delta) {
  const value = (counts[key] ?? 0) + delta;
  if (value < 0) throw new Error(`Negative count for ${key}`);
  if (value === 0) delete counts[key];
  else counts[key] = value;
}

export class GcState {
  constructor(transaction, options = {}) {
    this.tx = transaction;
    this.options = { ...defaultOptions, ...options };
  }

  // ---- Ids and clock ----

  nextId(prefix) {
    const next = this.tx.get("meta/nextId") ?? 1;
    this.tx.put("meta/nextId", next + 1);
    return `${prefix}${next.toString(36)}`;
  }

  clock() {
    return this.tx.get("meta/clock") ?? 0;
  }

  tick() {
    this.tx.put("meta/clock", this.clock() + 1);
  }

  // ---- Objects ----

  record(id) {
    return this.tx.get(objectKey(id));
  }

  meta(id) {
    return this.tx.get(metaKey(id));
  }

  /**
   * Updates some metadata fields, keeping the others (such as the shared bit). This is the one
   * place where an object's region, tree parent, cohort or deferral changes, so it also keeps
   * the aggregated counters of its clusters and the T/ and P/ tree-edge counts up to date
   * (invariants A1, A2): O(levels) writes.
   */
  updateMeta(id, patch) {
    const before = this.meta(id) ?? {};
    const after = { ...before, ...patch };
    this.tx.put(metaKey(id), after);
    const regionChanged = before.region !== after.region;
    if (regionChanged || Boolean(before.deferred) !== Boolean(after.deferred) || (before.cohort ?? null) !== (after.cohort ?? null)) {
      if (before.region) this.contribute(before.region, before, -1);
      if (after.region) this.contribute(after.region, after, 1);
    }
    if (regionChanged || (before.treeParent ?? null) !== (after.treeParent ?? null)) {
      if (before.region && before.treeParent) this.countTreeEdge(this.regionOf(before.treeParent), before.region, -1);
      if (after.region && after.treeParent) this.countTreeEdge(this.regionOf(after.treeParent), after.region, 1);
    }
    // A new tree parent in another region: the region may no longer be one branch (§6.7).
    if (after.treeParent && before.region && after.region && (before.treeParent ?? null) !== after.treeParent && this.regionOf(after.treeParent) !== after.region) {
      this.scheduleRehome(after.region);
    }
    if (regionChanged && before.region) {
      // The object's tree children now hang from another region.
      for (const child of this.treeChildren(id)) {
        const childRegion = this.regionOf(child);
        this.countTreeEdge(before.region, childRegion, -1);
        this.countTreeEdge(after.region, childRegion, 1);
      }
    }
  }

  /** Adds (sign 1) or removes (sign -1) an object's share of its clusters' counters. */
  contribute(region, meta, sign) {
    for (const id of this.chain(region)) {
      const record = this.cluster(id);
      record.objects += sign;
      if (meta.deferred) record.deferred += sign;
      if (meta.cohort) addCount(record.explicit, meta.cohort, sign);
      this.putCluster(record);
    }
  }

  /**
   * Counts a tree edge from an object in region `from` to one in region `to` (sign 1), or stops
   * counting it (sign -1), at every level where their clusters differ.
   */
  countTreeEdge(from, to, sign) {
    while (from !== to) {
      if (from === null || to === null) throw new Error("Clusters at different depths");
      this.bump(treeOutKey(from, to), sign);
      this.bump(treeInKey(to, from), sign);
      from = this.cluster(from).container;
      to = this.cluster(to).container;
    }
  }

  /** Adds to a count key, deleting it at zero. */
  bump(key, delta) {
    const value = (this.tx.get(key) ?? 0) + delta;
    if (value < 0) throw new Error(`Negative count ${key}`);
    if (value === 0) this.tx.delete(key);
    else this.tx.put(key, value);
  }

  /** Deletes an object's records: the reclaim of one object outside a suspended cluster. */
  deleteObject(id) {
    const meta = this.meta(id);
    if (this.treeChildren(id).length > 0) throw new Error(`Deleting ${id}, which has tree children`);
    this.contribute(meta.region, meta, -1);
    if (meta.treeParent !== null) {
      this.countTreeEdge(this.regionOf(meta.treeParent), meta.region, -1);
      this.tx.delete(treeKey(meta.treeParent, id));
    }
    this.tx.delete(regionMemberKey(meta.region, id));
    if (meta.cohort !== null) this.tx.delete(memberKey(meta.cohort, id));
    const outgoing = this.outgoing(id);
    this.addWeight(meta.region, -1 - outgoing.length);
    if (this.options.edgeIndex) for (const target of outgoing) this.tx.delete(edgeKey(meta.region, id, target));
    this.tx.delete(objectKey(id));
    this.tx.delete(metaKey(id));
  }

  /**
   * STABLE, or the id of the (root) cohort the object is unstable in: explicitly (its cohort
   * field), or implicitly (a cluster containing it is suspended).
   */
  state(id) {
    const meta = this.meta(id);
    if (!meta) throw new Error(`No GC metadata for object ${id}`);
    if (meta.cohort !== null) return this.findCohort(meta.cohort);
    const suspended = this.suspensionOf(meta.region);
    return suspended ? this.findCohort(suspended.cohort) : STABLE;
  }

  /** Unstable only because a cluster containing it is suspended. */
  isImplicit(id) {
    const meta = this.meta(id);
    return meta.cohort === null && this.suspensionOf(meta.region) !== null;
  }

  treeChildren(parent) {
    return this.tx.keys(treePrefix(parent)).map((key) => key.slice(treePrefix(parent).length));
  }

  markShared(id) {
    const meta = this.meta(id);
    if (meta && !meta.shared) this.updateMeta(id, { shared: true });
  }

  /**
   * The strong referrers of each of the given objects, as a Map from id to source ids.
   *
   * Region-local (design §5): for a target in region T, the referrers can only be in T itself
   * or in a region flagged on T (invariant G2). Those regions are read with edgesOfRegion and
   * filtered. A flagged source that turns out to have no edge into T at all, or that no longer
   * exists, has its flag deleted: the scan was complete, in this transaction.
   */
  referrersOf(ids) {
    const referrers = new Map();
    const targetsByRegion = new Map();
    for (const id of ids) {
      const meta = this.meta(id);
      if (!meta) continue;
      referrers.set(id, []);
      if (!targetsByRegion.has(meta.region)) targetsByRegion.set(meta.region, new Set());
      targetsByRegion.get(meta.region).add(id);
    }

    const edgeCache = new Map();
    const edgesOf = (region) => {
      if (!edgeCache.has(region)) edgeCache.set(region, this.edgesOfRegion(region));
      return edgeCache.get(region);
    };

    for (const [target, targetIds] of targetsByRegion) {
      const targetMembers = new Set(this.regionMembers(target));
      for (const source of [target, ...this.flagSources(target)]) {
        if (source !== target && !this.regionExists(source)) {
          this.deleteFlag(target, source);
          continue;
        }
        let referencesTarget = false;
        for (const region of this.levelZeroRegions(source)) {
          for (const edge of edgesOf(region)) {
            if (!targetMembers.has(edge.target)) continue;
            referencesTarget = true;
            if (targetIds.has(edge.target)) referrers.get(edge.target).push(edge.source);
          }
        }
        if (source !== target && !referencesTarget) this.deleteFlag(target, source);
      }
    }
    return referrers;
  }

  /**
   * All strong edges whose source is in the region (design §5.5): one range read of the edge
   * index (implementation B), or, without it, the records of the region's members (A).
   */
  edgesOfRegion(region) {
    if (this.options.edgeIndex) {
      return this.tx.keys(edgePrefix(region)).map((key) => {
        const [, , source, target] = key.split("/");
        return { source, target };
      });
    }
    const edges = [];
    for (const source of this.regionMembers(region)) {
      for (const target of strongReferences(this.record(source)).keys()) edges.push({ source, target });
    }
    return edges;
  }

  /** The objects an object references strongly: from the edge index, or from its record. */
  outgoing(id) {
    if (!this.options.edgeIndex) return [...strongReferences(this.record(id)).keys()];
    const prefix = edgePrefix(this.regionOf(id), id);
    return this.tx.keys(prefix).map((key) => key.slice(prefix.length));
  }

  /**
   * Brings the edge index in line with a changed reference count (invariant Y1): `count`
   * is how many times `source` now references `target` strongly.
   */
  indexEdge(source, target, count) {
    if (!this.options.edgeIndex) return;
    const key = edgeKey(this.regionOf(source), source, target);
    if (count > 0) this.tx.put(key, count);
    else this.tx.delete(key);
  }

  // ---- Regions ----

  regionOf(id) {
    return this.meta(id).region;
  }

  regionExists(region) {
    return this.tx.has(regionKey(region));
  }

  regionMembers(region) {
    const prefix = regionMemberPrefix(region);
    return this.tx.keys(prefix).map((key) => key.slice(prefix.length));
  }

  /**
   * Puts an object in a region, on placement or on a move. `weight` is the object's own: one
   * plus its outgoing strong edges (a new object is placed before its edges are counted).
   */
  setRegion(id, region, weight = 1) {
    const previous = this.meta(id)?.region;
    if (previous === region) return;
    if (previous) {
      this.tx.delete(regionMemberKey(previous, id));
      this.addWeight(previous, -weight);
      // The edge index is clustered by the source's region: the object's edge keys follow it.
      if (this.options.edgeIndex) {
        for (const [key, count] of this.tx.range(edgePrefix(previous, id))) {
          this.tx.delete(key);
          this.tx.put(edgeKey(region, id, key.slice(edgePrefix(previous, id).length)), count);
        }
      }
    }
    this.updateMeta(id, { region });
    this.tx.put(regionMemberKey(region, id), true);
    this.addWeight(region, weight);
  }

  /**
   * Changes a region's weight (invariant A3), and schedules a structure task only when it may
   * have something to do: the region is over the cap, or has shrunk below a quarter of it.
   */
  addWeight(region, delta) {
    const record = this.cluster(region);
    record.weight += delta;
    this.putCluster(record);
    const cap = this.options.regionCap;
    if (record.weight > cap || (delta < 0 && record.weight < cap / 4)) this.scheduleStructure(region);
  }

  // ---- Clusters: regions at every level (§6.9) ----

  cluster(id) {
    return this.tx.get(regionKey(id));
  }

  putCluster(record) {
    this.tx.put(regionKey(record.id), record);
  }

  patchCluster(id, patch) {
    this.putCluster({ ...this.cluster(id), ...patch });
  }

  /** A new, empty cluster in `container` (null: at the top level). */
  newCluster(level, container) {
    const id = this.nextId("r");
    this.putCluster(clusterRecord(id, level, container));
    if (container === null) this.tx.put(topKey(id), true);
    else {
      this.tx.put(regionMemberKey(container, id), true);
      this.scheduleStructure(container);
    }
    this.scheduleStructure(id);
    return id;
  }

  /** The cluster and its containers, bottom up. */
  chain(cluster) {
    const chain = [];
    for (let id = cluster; id !== null; id = this.cluster(id).container) chain.push(id);
    return chain;
  }

  /** Whether `cluster` is `container` or inside it. */
  isInside(cluster, container) {
    for (let id = cluster; id !== null; id = this.cluster(id).container) if (id === container) return true;
    return false;
  }

  topClusters() {
    return this.tx.keys("R/").map((key) => key.slice(2));
  }

  /** The level-0 regions inside a cluster. */
  levelZeroRegions(cluster) {
    if (this.cluster(cluster).level === 0) return [cluster];
    return this.regionMembers(cluster).flatMap((member) => this.levelZeroRegions(member));
  }

  /** The objects inside a cluster, at any depth. */
  objectsIn(cluster) {
    return this.levelZeroRegions(cluster).flatMap((region) => this.regionMembers(region));
  }

  /** [cluster, count] of the tree edges from this cluster into others at its level. */
  treeExits(cluster) {
    return this.tx.range(treeOutPrefix(cluster)).map(([key, count]) => [key.slice(treeOutPrefix(cluster).length), count]);
  }

  /** [cluster, count] of the tree edges into this cluster from others at its level. */
  treeEntries(cluster) {
    return this.tx.range(treeInPrefix(cluster)).map(([key, count]) => [key.slice(treeInPrefix(cluster).length), count]);
  }

  flagSources(target) {
    const prefix = flagPrefix(target);
    return this.tx.keys(prefix).map((key) => key.slice(prefix.length));
  }

  /** The targets of the flags that name a meta-region as their source, from the mirrors. */
  mirrorTargets(source) {
    const prefix = mirrorPrefix(source);
    return this.tx.keys(prefix).map((key) => key.slice(prefix.length));
  }

  /**
   * Makes sure the flag "source may reference into target" exists (invariant G2), with its
   * mirror if the source is a meta-region (invariant G5).
   */
  ensureFlag(target, source, copied = false) {
    if (target === source || this.tx.has(flagKey(target, source))) return false;
    const record = this.cluster(source);
    if (!record) return false; // a stale flag being copied: its source is gone
    // A flag written for an edge is true. One copied when objects move (invariant G2) may be
    // stale from the start: it is marked, so that a scrub can verify it (regions.js).
    this.tx.put(flagKey(target, source), copied ? "copy" : true);
    if (record.level > 0) this.tx.put(mirrorKey(source, target), true);
    const targetRecord = this.cluster(target);
    targetRecord.flags++;
    this.putCluster(targetRecord);
    // Too many flags on a region: one of its objects may be worth pinning (regions.js).
    if (targetRecord.level === 0 && targetRecord.flags > this.options.flagCap) this.scheduleStructure(target);
    return true;
  }

  deleteFlag(target, source) {
    if (!this.tx.has(flagKey(target, source))) return;
    this.tx.delete(flagKey(target, source));
    this.tx.delete(mirrorKey(source, target));
    const record = this.cluster(target);
    if (record) this.putCluster({ ...record, flags: record.flags - 1 });
  }

  scheduleScrub(region) {
    this.tx.put(scrubKey(region), true);
  }

  /**
   * Deletes the flags on a cluster, and the flags that name it where mirrors list them. Flags
   * naming a level-0 region have no mirror and are left stale (lookups delete them, G2).
   */
  dropFlags(cluster) {
    for (const source of this.flagSources(cluster)) this.deleteFlag(cluster, source);
    for (const target of this.mirrorTargets(cluster)) this.deleteFlag(target, cluster);
  }

  /**
   * Covers the edge source → target with flags, at every level where their clusters differ
   * (invariant G2): the target's cluster at that level needs a flag naming the source's cluster
   * at that level, or one of its containers. O(levels) lookups, usually no write (§6.6).
   */
  coverEdge(source, target) {
    const sourceMeta = this.meta(source);
    const targetMeta = this.meta(target);
    if (!sourceMeta || !targetMeta) return;
    const sources = this.chain(sourceMeta.region);
    let to = targetMeta.region;
    for (let level = 0; to !== null && sources[level] !== to; level++) {
      if (!sources.slice(level).some((from) => this.tx.has(flagKey(to, from))) && this.ensureFlag(to, sources[level]) && level === 0) {
        // The target drew a new source region to its region. Counted only then, so that a
        // popular object costs one write per referring region, not per reference.
        this.tx.put(metaKey(target), { ...this.meta(target), attracts: (targetMeta.attracts ?? 0) + 1 });
      }
      to = this.cluster(to).container;
    }
  }

  scheduleStructure(region) {
    this.tx.put(structureKey(region), true);
  }

  /** Schedules a check of whether the cluster still hangs from one place (regions.js). */
  scheduleRehome(cluster) {
    if (this.options.rehome) this.tx.put(rehomeKey(cluster), true);
  }

  /** Schedules a cluster and every cluster inside it (not their objects). */
  scheduleInside(cluster) {
    this.scheduleStructure(cluster);
    const record = this.cluster(cluster);
    // A re-home task that was skipped while the cluster was busy gets its turn now.
    if (record.rehomeSkipped) {
      this.putCluster({ ...record, rehomeSkipped: false });
      this.scheduleRehome(cluster);
    }
    if (record.level > 0) for (const member of this.regionMembers(cluster)) this.scheduleInside(member);
  }

  // ---- Cohorts ----

  cohort(id) {
    return this.tx.get(cohortKey(id));
  }

  saveCohort(cohort) {
    this.tx.put(cohortKey(cohort.id), cohort);
  }

  findCohort(id) {
    let cohort = this.cohort(id);
    if (!cohort) throw new Error(`No cohort ${id}`);
    while (cohort.mergedInto) cohort = this.cohort(cohort.mergedInto);
    return cohort.id;
  }

  isReclaiming(cohortId) {
    return this.cohort(this.findCohort(cohortId)).state === "reclaiming";
  }

  /**
   * Whether an object is dead: a member of a cohort that is being reclaimed (§10.3). It is
   * proven unreachable and is deleted within a few steps; until then it is treated as gone.
   */
  isDead(id) {
    const meta = this.meta(id);
    if (!meta) return false;
    const state = this.state(id);
    return state !== STABLE && this.isReclaiming(state);
  }

  newCohort() {
    const id = this.nextId("k");
    this.saveCohort({
      id,
      state: "active",
      mergedInto: null,
      absorbed: [],
      pending: { expand: 0, mark: 0, check: 0 },
    });
    return id;
  }

  // Worklists are sets of keys, w/<root cohort>/<list>/<item>, so that adding or removing an
  // item costs the same whatever the size of the list. The cohort record holds their sizes.
  // Items come out in key order.

  /** Adds `item` to one of the cohort's worklists: "expand", "mark" or "check". */
  push(cohortId, list, item) {
    const root = this.findCohort(cohortId);
    if (this.tx.has(workKey(root, list, item))) return;
    this.tx.put(workKey(root, list, item), true);
    const cohort = this.cohort(root);
    cohort.pending[list]++;
    this.saveCohort(cohort);
  }

  /** Removes an item from a root cohort's worklist, if it is there. */
  unqueue(root, list, item) {
    if (!this.tx.has(workKey(root, list, item))) return;
    this.tx.delete(workKey(root, list, item));
    const cohort = this.cohort(root);
    cohort.pending[list]--;
    this.saveCohort(cohort);
  }

  /** The items of a root cohort's worklist. */
  queued(root, list) {
    const prefix = workPrefix(root, list);
    return this.tx.keys(prefix).map((key) => key.slice(prefix.length));
  }

  /** Removes and returns up to `limit` items of a root cohort's worklist. */
  take(root, list, limit = 1) {
    const first = limit === 1 ? this.tx.first(workPrefix(root, list)) : undefined;
    const items = limit === 1 ? (first === undefined ? [] : [first.slice(workPrefix(root, list).length)]) : this.queued(root, list).slice(0, limit);
    for (const item of items) this.tx.delete(workKey(root, list, item));
    const cohort = this.cohort(root);
    cohort.pending[list] -= items.length;
    this.saveCohort(cohort);
    return items;
  }

  /** Merges two cohorts whose fates depend on each other (§7.2). Returns the surviving id. */
  merge(a, b) {
    const rootA = this.findCohort(a);
    const rootB = this.findCohort(b);
    if (rootA === rootB) return rootA;
    const survivor = this.cohort(rootA);
    const absorbed = this.cohort(rootB);
    if (survivor.state !== "active" || absorbed.state !== "active") {
      throw new Error("Cannot merge a cohort that is being reclaimed");
    }
    for (const list of ["expand", "mark", "check"]) {
      for (const item of this.queued(rootB, list)) {
        this.tx.delete(workKey(rootB, list, item));
        if (this.tx.has(workKey(rootA, list, item))) continue;
        this.tx.put(workKey(rootA, list, item), true);
        survivor.pending[list]++;
      }
      absorbed.pending[list] = 0;
    }
    survivor.absorbed.push(absorbed.id, ...absorbed.absorbed);
    absorbed.mergedInto = survivor.id;
    absorbed.absorbed = [];
    this.saveCohort(survivor);
    this.saveCohort(absorbed);
    return survivor.id;
  }

  /** All cohort ids whose membership keys belong to this (root) cohort. */
  cohortFamily(rootId) {
    return [rootId, ...this.cohort(rootId).absorbed];
  }

  /** Active, unmerged cohorts, in id order. */
  activeCohorts() {
    return this.tx
      .range("c/")
      .map(([, cohort]) => cohort)
      .filter((cohort) => !cohort.mergedInto);
  }

  // ---- Deferred cuts ----

  isDeferred(id) {
    return Boolean(this.meta(id)?.deferred);
  }

  /**
   * The deferral for a cut: the default delay on the logical clock, or the lifetime of a hold
   * (invariant H1): `{ transactions }` or `{ milliseconds }`.
   */
  deferralFor(hold) {
    if (hold?.milliseconds !== undefined) return { kind: "ms", at: this.options.now() + hold.milliseconds };
    return { kind: "tx", at: this.clock() + (hold?.transactions ?? this.options.deferral) };
  }

  /** Records a cut without marking anything yet (§9.3, invariant F1). */
  defer(id, deferred = this.deferralFor()) {
    const meta = this.meta(id);
    if (meta.treeParent !== null) this.tx.delete(treeKey(meta.treeParent, id));
    this.clearDeferral(id);
    this.updateMeta(id, { treeParent: null, deferred });
    this.tx.put(deferralKey(deferred, id), true);
  }

  clearDeferral(id) {
    const meta = this.meta(id);
    if (!meta.deferred) return;
    this.tx.delete(deferralKey(meta.deferred, id));
    this.updateMeta(id, { deferred: null });
  }

  /** Makes a deferral due at once (a released hold). No effect if the object is not deferred. */
  expireNow(id) {
    if (this.isDeferred(id)) this.defer(id, { kind: "tx", at: this.clock() });
  }

  /** A deferral whose deadline has passed (or any, if `flush`), as an id, or null. */
  dueDeferral(flush = false) {
    const due = (prefix, now) => {
      const first = this.tx.first(prefix);
      if (first === undefined) return null;
      const [, deadline, id] = first.split("/");
      return flush || Number(deadline) <= now ? id : null;
    };
    return due("d/", this.clock()) ?? due("h/", this.options.now());
  }

  hasDeferrals() {
    return this.tx.first("d/") !== undefined || this.tx.first("h/") !== undefined;
  }

  // ---- Verified walk and re-parenting ----

  /**
   * The verified walk (§9.5, invariant W1): may `object` be hung under `parent` without marking?
   *
   * Follows tree parents from `parent`. Succeeds at ROOT or at a deferred object. Fails on
   * meeting `object` (that would make a cycle), on any unstable object, on revisiting an object,
   * or when the step budget runs out.
   */
  verifiedWalk(parent, object) {
    const seen = new Set();
    let current = parent;
    for (let steps = 0; steps < this.options.walkBudget; steps++) {
      if (current === object || seen.has(current)) return false;
      seen.add(current);
      if (current === ROOT) return true;
      const meta = this.meta(current);
      if (!meta || meta.cohort !== null || this.suspensionOf(meta.region) !== null) return false;
      if (meta.treeParent === null) return Boolean(meta.deferred);
      current = meta.treeParent;
    }
    return false;
  }

  /** Hangs a stable object under a new parent; clears a deferral. Caller has done the walk. */
  reparent(id, parent) {
    const meta = this.meta(id);
    if (meta.cohort !== null) throw new Error(`Re-parenting unstable object ${id}`);
    if (meta.treeParent !== null) this.tx.delete(treeKey(meta.treeParent, id));
    this.clearDeferral(id);
    this.updateMeta(id, { treeParent: parent });
    this.tx.put(treeKey(parent, id), true);
  }

  /**
   * A referrer of `id` that passes the verified walk, or null. Tries at most `candidates`
   * referrers. `referrers` may be passed in when the caller has already looked them up.
   */
  findVerifiedReferrer(id, referrers = this.referrersOf([id]).get(id)) {
    let tried = 0;
    for (const source of referrers) {
      if (tried++ >= this.options.candidates) break;
      if (source !== id && this.verifiedWalk(source, id)) return source;
    }
    return null;
  }

  /** Quick swap (§9.2): re-parent a shared object under another verified referrer. */
  quickSwap(id) {
    if (!this.meta(id).shared) return false;
    const parent = this.findVerifiedReferrer(id);
    if (parent === null) return false;
    this.reparent(id, parent);
    return true;
  }

  // ---- Transitions ----

  /** A new object attached below a stable parent, in the parent's region (§6.3). */
  attachNew(id, parent) {
    this.updateMeta(id, { treeParent: parent, cohort: null, shared: false, deferred: null });
    this.setRegion(id, this.regionOf(parent));
    this.tx.put(treeKey(parent, id), true);
  }

  /**
   * A new object that is only referenced from members of a cohort joins that cohort, in the
   * region of the member that references it.
   */
  joinCohort(id, cohortId, source) {
    const root = this.findCohort(cohortId);
    this.updateMeta(id, { treeParent: null, cohort: root, shared: false, deferred: null });
    this.setRegion(id, this.regionOf(source));
    this.tx.put(memberKey(root, id), true);
    this.push(root, "check", id);
  }

  /**
   * Makes a stable object unstable in a cohort: it loses its tree parent (or its deferral) and
   * is queued for checking (its referrers) and, if it has tree children, for marking. An object
   * without tree children is marked already (invariant M1), and it never gets any: only a
   * stable object is given tree children.
   */
  makeUnstable(id, cohortId) {
    const root = this.findCohort(cohortId);
    const meta = this.meta(id);
    if (meta.treeParent !== null) this.tx.delete(treeKey(meta.treeParent, id));
    this.clearDeferral(id);
    this.updateMeta(id, { treeParent: null, cohort: root });
    this.tx.put(memberKey(root, id), true);
    if (this.treeChildren(id).length > 0) this.push(root, "mark", id);
    this.push(root, "check", id);
  }

  /**
   * Whether an unstable object may be rescued now. Only once it has been marked, that is, once
   * it has no tree children left.
   *
   * Before that, the would-be parent may be one of its own stale-stable descendants, and
   * re-parenting there would close a tree cycle that no marking ever reaches. Skipping the
   * rescue loses nothing: the object is still on its cohort's check list, checks run only after
   * marking is complete, and the check finds the same referrer. If that referrer was a
   * descendant, marking has made it unstable by then, so it rescues nothing.
   *
   * (Detaching the pending children eagerly instead does not work: two garbage objects that
   * reference each other can then rescue each other in turn forever.)
   */
  canRescue(id) {
    const meta = this.meta(id);
    const suspended = this.suspensionOf(meta.region);
    // An implicit member: "rescuing" it materializes its cluster (see rescue).
    if (meta.cohort === null) return suspended !== null;
    // An anchor of a suspended cluster whose exits have been cut (markRegion): its tree
    // children are all implicit members of the cluster, none of them stable, so none of them
    // can be the would-be parent.
    if (suspended !== null && suspended.marked) return true;
    return this.treeChildren(id).length === 0;
  }

  /**
   * An unstable object that has been marked gets a stable referrer: it becomes stable under that
   * referrer and is queued for expansion in its former cohort, so that whatever it references
   * is rescued too.
   */
  rescue(id, parent) {
    const meta = this.meta(id);
    const suspended = this.suspensionOf(meta.region);
    if (meta.cohort === null) {
      if (suspended === null) throw new Error(`Rescue of stable object ${id}`);
      // An implicit member: its cluster is materialized, which makes it stale-stable under its
      // anchor. It is shared (its tree parent and `parent` both reference it, invariant W2), so
      // when marking reaches it, the replacement-parent search finds `parent` again (§8.2).
      this.materialize(suspended.cluster);
      return;
    }
    if (!this.canRescue(id)) throw new Error(`Rescue of unmarked object ${id}`);
    if (suspended !== null) {
      // The cluster's anchor gets a parent. If it is the only one, the whole cluster comes back
      // with its internal tree (resume); otherwise the rest must be marked object by object.
      if (this.isSoleAnchor(id, suspended.cluster)) this.resume(suspended.cluster);
      else this.materialize(suspended.cluster);
    }
    const root = this.findCohort(meta.cohort);
    this.tx.delete(memberKey(meta.cohort, id));
    this.updateMeta(id, { treeParent: parent, cohort: null });
    this.tx.put(treeKey(parent, id), true);
    this.push(root, "expand", id);
  }

  // ---- Suspension (design §8), at every level ----

  /** The cluster's own suspension, { cohort, marked }, or null. */
  suspension(cluster) {
    return this.cluster(cluster)?.suspended ?? null;
  }

  /**
   * The suspension that covers a region: { cluster, cohort, marked } of the cluster in its
   * chain that is suspended (there is at most one, invariant U5), or null.
   */
  suspensionOf(region) {
    for (let id = region; id !== null; ) {
      const record = this.cluster(id);
      if (record.suspended) return { cluster: id, ...record.suspended };
      id = record.container;
    }
    return null;
  }

  setSuspension(cluster, suspended) {
    this.patchCluster(cluster, { suspended });
  }

  /** Clusters suspended in a cohort, under that cohort id (not its root). */
  suspendedRegions(cohortId) {
    return this.tx.keys(suspendedPrefix(cohortId)).map((key) => key.slice(suspendedPrefix(cohortId).length));
  }

  /**
   * Whether a cluster may be suspended in a cohort now (§8.1): everything in it is already
   * condemned to be marked by that cohort. Read from its aggregated counters (§6.8), O(1):
   *   - no tree edge enters it from outside (no P/ key): every stable object in it hangs from
   *     inside it, so its tree path ends at an explicit member;
   *   - nothing in it is deferred;
   *   - every explicitly unstable object in it is in this cohort;
   *   - something in it is not explicit yet, so that suspending saves work.
   * The cluster holding ROOT never qualifies, and neither does a cluster this cohort has
   * materialized before (which would otherwise suspend and materialize it forever).
   */
  suspendable(cluster, root) {
    const record = this.cluster(cluster);
    if (record.suspended || record.expanding || record.settling || record.deferred > 0) return false;
    if (record.materializedIn && this.cohort(record.materializedIn) && this.findCohort(record.materializedIn) === root) return false;
    let explicit = 0;
    for (const [cohortId, count] of Object.entries(record.explicit)) {
      if (this.findCohort(cohortId) !== root) return false;
      explicit += count;
    }
    if (record.objects <= explicit) return false;
    if (this.tx.first(treeInPrefix(cluster)) !== undefined) return false;
    return !this.isInside(this.regionOf(ROOT), cluster);
  }

  /**
   * Suspends a cluster in a cohort (§8.1): all its stable objects become implicitly unstable at
   * once. Clusters inside it that were suspended in the same cohort are now covered by it
   * (invariant U5). Mark items inside it (its anchors) leave the mark list, and inner cluster
   * items the check list. The caller then cuts the tree edges that leave the cluster, in the
   * same step (Collector.markRegion), which queues the cluster's own item for its check.
   */
  suspend(cluster, root) {
    for (const familyId of this.cohortFamily(root)) {
      for (const inner of this.suspendedRegions(familyId)) {
        if (inner === cluster || !this.isInside(inner, cluster)) continue;
        this.setSuspension(inner, null);
        this.tx.delete(suspendedKey(familyId, inner));
      }
    }
    this.setSuspension(cluster, { cohort: root, marked: false });
    this.tx.put(suspendedKey(root, cluster), true);
    const inside = (item) => {
      if (isRegionItem(item)) return this.regionExists(regionOfItem(item)) && this.isInside(regionOfItem(item), cluster);
      return Boolean(this.meta(item)) && this.isInside(this.regionOf(item), cluster);
    };
    for (const item of this.queued(root, "mark")) if (inside(item)) this.unqueue(root, "mark", item);
    for (const item of this.queued(root, "check")) if (isRegionItem(item) && inside(item)) this.unqueue(root, "check", item);
  }

  /** Ends a suspension, keeping the cluster's internal tree. Returns the root cohort. */
  unsuspend(cluster) {
    const suspended = this.suspension(cluster);
    this.setSuspension(cluster, null);
    this.tx.delete(suspendedKey(suspended.cohort, cluster));
    this.scheduleInside(cluster); // structure tasks skip suspended clusters and what is inside them
    return this.findCohort(suspended.cohort);
  }

  /** Whether `id` is the only explicit member of the cluster with tree children. */
  isSoleAnchor(id, cluster) {
    const counts = Object.values(this.cluster(cluster).explicit);
    if (counts.reduce((sum, count) => sum + count, 0) === 1) return true; // only `id` itself
    for (const familyId of this.cohortFamily(this.findCohort(this.meta(id).cohort))) {
      for (const key of this.tx.keys(memberPrefix(familyId))) {
        const member = key.slice(memberPrefix(familyId).length);
        if (member === id || this.treeChildren(member).length === 0) continue;
        if (this.isInside(this.regionOf(member), cluster)) return false;
      }
    }
    return true;
  }

  /**
   * Resume (§8.2): the cluster's sole anchor is being rescued, so its whole internal tree is
   * certified again. Every object in it is stable again; the cluster is queued for expansion,
   * so that what its objects reference is rescued too.
   */
  resume(cluster) {
    const root = this.unsuspend(cluster);
    // Until the cluster item has expanded every object, structure tasks must not move objects
    // out of it: they would never be expanded (Collector.expand clears this).
    this.patchCluster(cluster, { expanding: true, expanded: null });
    this.push(root, "expand", regionItem(cluster));
  }

  /**
   * Materialize (§8.2): the cluster is partly rescued, or changes. The suspension ends, which
   * at once makes its implicit objects stale-stable under their anchors. What then has to
   * follow is done a level-0 region at a time (settle), so that a big cluster does not make one
   * big step: the first region now, the rest by a settle item on the cohort's mark list.
   */
  materialize(cluster) {
    if (this.suspension(cluster) === null) return;
    const root = this.unsuspend(cluster);
    // The cohort found a reason to look at this cluster object by object: it must not suspend
    // it again, or marking an anchor would suspend it, the check would materialize it, and so on
    // forever.
    this.patchCluster(cluster, { materializedIn: root, settling: root, settled: null });
    this.settle(cluster);
  }

  /**
   * Settles the next level-0 region of a materialized cluster (invariant U6), in the order of
   * their ids:
   *   - its anchors that are still unstable go back on the mark list, so that marking proceeds
   *     object by object, with replacement parents. They are unmarked again, so their check
   *     must be pending again too: the barrier and expansion skip rescuing an unmarked object
   *     and rely on its check to find the referrer (§7.3);
   *   - its formerly implicit objects turned stale-stable without being expanded. Whatever of
   *     this cohort they reference may already have been checked counting on them being
   *     unstable, so it is checked again (invariant M3). If such an object stays garbage,
   *     marking makes it unstable again before that check; if it is rescued or re-parented, the
   *     check finds it.
   * Until the last region is done, the cluster is `settling`: structure tasks leave it alone
   * (an object moved out would be missed), and the settle item keeps the cohort open.
   */
  settle(cluster) {
    const record = this.cluster(cluster);
    if (!record?.settling) return;
    const root = this.findCohort(record.settling);
    // Suspended again from above meanwhile: that suspension covers everything in it.
    const covered = this.suspensionOf(cluster) !== null;
    const regions = covered ? [] : this.levelZeroRegions(cluster).sort();
    const next = regions.find((region) => record.settled === null || region > record.settled);
    if (next === undefined) {
      this.patchCluster(cluster, { settling: null, settled: null });
      this.scheduleInside(cluster); // structure tasks skipped it meanwhile
      return;
    }
    for (const id of this.regionMembers(next)) {
      const meta = this.meta(id);
      if (meta.cohort !== null) {
        if (this.findCohort(meta.cohort) === root && this.treeChildren(id).length > 0) {
          this.push(root, "mark", id);
          this.push(root, "check", id);
        }
        continue;
      }
      for (const target of this.outgoing(id)) {
        const targetMeta = this.meta(target);
        if (!targetMeta) continue;
        if (targetMeta.cohort !== null) {
          if (this.findCohort(targetMeta.cohort) === root) this.push(root, "check", target);
          continue;
        }
        const suspended = this.suspensionOf(targetMeta.region);
        if (suspended && suspended.marked && this.findCohort(suspended.cohort) === root) {
          this.push(root, "check", regionItem(suspended.cluster));
        }
      }
    }
    if (regions[regions.length - 1] === next) {
      this.patchCluster(cluster, { settling: null, settled: null });
      this.scheduleInside(cluster);
    } else {
      this.patchCluster(cluster, { settled: next });
      this.push(root, "mark", settleItem(cluster));
    }
  }

  /**
   * Deletes a cluster suspended in a reclaimed cohort, whole (§8.3): every object in it, every
   * cluster inside it, and their keys. Its counters are taken off its containers at once.
   * Nothing outside it is read: no tree edge crosses its boundary (U3, and nothing enters it).
   * Returns the ids of the objects deleted.
   *
   * Reclaim also uses it on one region at a time inside a bigger suspended cluster. Tree-edge
   * counts between that region and the rest of the suspended cluster are then left stale; they
   * go when the rest is deleted, and nothing reads them meanwhile.
   */
  deleteClusterWhole(cluster) {
    const record = this.cluster(cluster);
    for (let id = record.container; id !== null; ) {
      const above = this.cluster(id);
      above.objects -= record.objects;
      above.deferred -= record.deferred;
      for (const [cohortId, count] of Object.entries(record.explicit)) addCount(above.explicit, cohortId, -count);
      this.putCluster(above);
      id = above.container;
    }
    const deleted = [];
    const visit = (id) => {
      const level = this.cluster(id).level;
      for (const member of this.regionMembers(id)) {
        if (level === 0) {
          const meta = this.meta(member);
          if (meta.treeParent !== null) this.tx.delete(treeKey(meta.treeParent, member));
          if (meta.cohort !== null) this.tx.delete(memberKey(meta.cohort, member));
          this.tx.delete(objectKey(member));
          this.tx.delete(metaKey(member));
          deleted.push(member);
        } else {
          visit(member);
        }
        this.tx.delete(regionMemberKey(id, member));
      }
      this.dropFlags(id);
      if (level === 0 && this.options.edgeIndex) for (const key of this.tx.keys(edgePrefix(id))) this.tx.delete(key);
      for (const key of this.tx.keys(treeOutPrefix(id))) this.tx.delete(key);
      for (const key of this.tx.keys(treeInPrefix(id))) this.tx.delete(key);
      this.tx.delete(structureKey(id));
      this.tx.delete(regionKey(id));
    };
    visit(cluster);
    this.detachCluster(cluster, record.container);
    return deleted;
  }

  /** Removes a deleted cluster from its container (or from the top level). */
  detachCluster(cluster, container) {
    if (container === null) {
      this.tx.delete(topKey(cluster));
      // Fewer top-level clusters: a single one left may be dissolved (regions.js).
      for (const top of this.topClusters()) this.scheduleStructure(top);
    } else {
      this.tx.delete(regionMemberKey(container, cluster));
      this.scheduleStructure(container);
    }
  }

}

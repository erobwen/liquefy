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
 *   c/<cohort>              cohort record: worklists, merge links
 *   C/<cohort>/<obj>        cohort membership, under the cohort id the object joined
 *   d/<deadline>/<obj>      deferred cuts with a deadline on the logical clock
 *   h/<deadline>/<obj>      deferred cuts with a wall-clock deadline (holds)
 *   r/<region>              region record: { id, suspended: { cohort, marked } | null }
 *   S/<cohort>/<region>     a region suspended in a cohort, under the cohort id it joined
 *   m/<region>/<obj>        region membership
 *   e/<target>/<source>     entry flag: something in region source may reference into target
 *   s/<region>              pending structure task: re-evaluate the region's weight
 *   meta/nextId             id counter
 *   meta/clock              logical clock: the number of application transactions
 *
 * State of an object (§7.1):
 *   - STABLE: no cohort. It has a tree parent, is ROOT, or is deferred. It may be stale-stable,
 *     that is, below a cut whose marking or deferral is still pending (§7.3).
 *   - unstable in cohort C, explicitly: its cohort field is set. It has no tree parent and,
 *     once marked, no tree children (unless its region is suspended, below).
 *   - unstable in cohort C, implicitly: no cohort field, but its region is suspended in C
 *     (§8.1). It keeps its tree parent, which is in the same region: a suspended region keeps
 *     its internal tree, hanging from explicit members of C (its anchors).
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
/** The deadline key of a deferral `{ kind, at }`: d/ for the logical clock, h/ for wall-clock. */
const regionKey = (region) => `r/${region}`;
const regionMemberKey = (region, id) => `m/${region}/${id}`;
const regionMemberPrefix = (region) => `m/${region}/`;
const flagKey = (target, source) => `e/${target}/${source}`;
const flagPrefix = (target) => `e/${target}/`;
const structureKey = (region) => `s/${region}`;
const suspendedKey = (cohort, region) => `S/${cohort}/${region}`;
const suspendedPrefix = (cohort) => `S/${cohort}/`;
const deferralKey = (deferred, id) => `${deferred.kind === "ms" ? "h" : "d"}/${String(deferred.at).padStart(16, "0")}/${id}`;

export const keys = {
  objectKey, metaKey, treeKey, treePrefix, cohortKey, memberKey, memberPrefix, deferralKey,
  regionKey, regionMemberKey, regionMemberPrefix, flagKey, flagPrefix, structureKey,
  suspendedKey, suspendedPrefix,
};

/**
 * Worklist items are object ids, or region items for suspended regions (§7.2): "@<region>".
 * Object and region ids never start with "@".
 */
export const regionItem = (region) => "@" + region;
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
};

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

  /** Updates some metadata fields, keeping the others (such as the shared bit). */
  updateMeta(id, patch) {
    this.tx.put(metaKey(id), { ...(this.meta(id) ?? {}), ...patch });
  }

  /**
   * STABLE, or the id of the (root) cohort the object is unstable in: explicitly (its cohort
   * field), or implicitly (its region is suspended).
   */
  state(id) {
    const meta = this.meta(id);
    if (!meta) throw new Error(`No GC metadata for object ${id}`);
    if (meta.cohort !== null) return this.findCohort(meta.cohort);
    const suspended = this.suspension(meta.region);
    return suspended ? this.findCohort(suspended.cohort) : STABLE;
  }

  /** Unstable only because its region is suspended. */
  isImplicit(id) {
    const meta = this.meta(id);
    return meta.cohort === null && this.suspension(meta.region) !== null;
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
          this.tx.delete(flagKey(target, source));
          continue;
        }
        let referencesTarget = false;
        for (const edge of edgesOf(source)) {
          if (!targetMembers.has(edge.target)) continue;
          referencesTarget = true;
          if (targetIds.has(edge.target)) referrers.get(edge.target).push(edge.source);
        }
        if (source !== target && !referencesTarget) this.tx.delete(flagKey(target, source));
      }
    }
    return referrers;
  }

  /**
   * All strong edges whose source is in the region (design §5.5, implementation A: read from
   * the members' records).
   */
  edgesOfRegion(region) {
    const edges = [];
    for (const source of this.regionMembers(region)) {
      for (const target of strongReferences(this.record(source)).keys()) edges.push({ source, target });
    }
    return edges;
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

  newRegion() {
    const region = this.nextId("r");
    this.tx.put(regionKey(region), { id: region });
    return region;
  }

  /** Puts an object in a region, on placement or on a move. Schedules both regions. */
  setRegion(id, region) {
    const previous = this.meta(id)?.region;
    if (previous === region) return;
    if (previous) {
      this.tx.delete(regionMemberKey(previous, id));
      this.scheduleStructure(previous);
    }
    this.updateMeta(id, { region });
    this.tx.put(regionMemberKey(region, id), true);
    this.scheduleStructure(region);
  }

  flagSources(target) {
    const prefix = flagPrefix(target);
    return this.tx.keys(prefix).map((key) => key.slice(prefix.length));
  }

  /** Makes sure the flag "source may reference into target" exists (invariant G2). */
  ensureFlag(target, source) {
    if (target !== source && !this.tx.has(flagKey(target, source))) this.tx.put(flagKey(target, source), true);
  }

  /** Covers the edge source → target with a flag, if it crosses regions (invariant G2). */
  coverEdge(source, target) {
    const sourceMeta = this.meta(source);
    const targetMeta = this.meta(target);
    if (sourceMeta && targetMeta) this.ensureFlag(targetMeta.region, sourceMeta.region);
  }

  scheduleStructure(region) {
    this.tx.put(structureKey(region), true);
  }

  /** The weight of a region: members plus their outgoing strong edges (design §6.1). */
  regionWeight(region) {
    let weight = 0;
    for (const id of this.regionMembers(region)) weight += 1 + strongReferences(this.record(id)).size;
    return weight;
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

  newCohort() {
    const id = this.nextId("k");
    this.saveCohort({
      id,
      state: "active",
      mergedInto: null,
      absorbed: [],
      expand: [],
      mark: [],
      check: [],
    });
    return id;
  }

  /** Appends `item` to one of the cohort's worklists: "expand", "mark" or "check". */
  push(cohortId, list, item) {
    const cohort = this.cohort(this.findCohort(cohortId));
    cohort[list].push(item);
    this.saveCohort(cohort);
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
    survivor.expand.push(...absorbed.expand);
    survivor.mark.push(...absorbed.mark);
    survivor.check.push(...absorbed.check);
    survivor.absorbed.push(absorbed.id, ...absorbed.absorbed);
    absorbed.mergedInto = survivor.id;
    absorbed.expand = [];
    absorbed.mark = [];
    absorbed.check = [];
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
      const first = this.tx.keys(prefix)[0];
      if (first === undefined) return null;
      const [, deadline, id] = first.split("/");
      return flush || Number(deadline) <= now ? id : null;
    };
    return due("d/", this.clock()) ?? due("h/", this.options.now());
  }

  hasDeferrals() {
    return this.tx.keys("d/").length > 0 || this.tx.keys("h/").length > 0;
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
      if (!meta || meta.cohort !== null || this.suspension(meta.region) !== null) return false;
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
   * is queued for marking (its tree children) and checking (its referrers).
   */
  makeUnstable(id, cohortId) {
    const root = this.findCohort(cohortId);
    const meta = this.meta(id);
    if (meta.treeParent !== null) this.tx.delete(treeKey(meta.treeParent, id));
    this.clearDeferral(id);
    this.updateMeta(id, { treeParent: null, cohort: root });
    this.tx.put(memberKey(root, id), true);
    const cohort = this.cohort(root);
    cohort.mark.push(id);
    cohort.check.push(id);
    this.saveCohort(cohort);
  }

  /** The mark step of one object: its tree children become unstable in its cohort. */
  markChildren(id, cohortId) {
    for (const child of this.treeChildren(id)) this.makeUnstable(child, cohortId);
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
    const suspended = this.suspension(meta.region);
    // An implicit member: "rescuing" it materializes its region (see rescue).
    if (meta.cohort === null) return suspended !== null;
    // An anchor of a suspended region whose exits have been cut (markRegion): its tree
    // children are all implicit members of the region, none of them stable, so none of them can
    // be the would-be parent.
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
    const suspended = this.suspension(meta.region);
    if (meta.cohort === null) {
      if (suspended === null) throw new Error(`Rescue of stable object ${id}`);
      // An implicit member: its region is materialized, which makes it stale-stable under its
      // anchor. It is shared (its tree parent and `parent` both reference it, invariant W2), so
      // when marking reaches it, the replacement-parent search finds `parent` again (§8.2).
      this.materialize(meta.region);
      return;
    }
    if (!this.canRescue(id)) throw new Error(`Rescue of unmarked object ${id}`);
    if (suspended !== null) {
      // The region's anchor gets a parent. If it is the only one, the whole region comes back
      // with its internal tree (resume); otherwise the rest must be marked object by object.
      if (this.isSoleAnchor(id, meta.region)) this.resume(meta.region);
      else this.materialize(meta.region);
    }
    const root = this.findCohort(meta.cohort);
    this.tx.delete(memberKey(meta.cohort, id));
    this.updateMeta(id, { treeParent: parent, cohort: null });
    this.tx.put(treeKey(parent, id), true);
    this.push(root, "expand", id);
  }

  // ---- Suspension (design §8) ----

  /** The region's suspension, { cohort, marked }, or null. */
  suspension(region) {
    return this.tx.get(regionKey(region))?.suspended ?? null;
  }

  setSuspension(region, suspended) {
    this.tx.put(regionKey(region), { ...this.tx.get(regionKey(region)), suspended });
  }

  /** Regions suspended in a cohort, under that cohort id (not its root). */
  suspendedRegions(cohortId) {
    return this.tx.keys(suspendedPrefix(cohortId)).map((key) => key.slice(suspendedPrefix(cohortId).length));
  }

  /**
   * Whether a region may be suspended in a cohort now (§8.1): everything in it is already
   * condemned to be marked by that cohort. Every member is either an explicit member of the
   * cohort, or a stable member whose tree parent is inside the region, so that its tree path
   * ends at an explicit member. Nothing is deferred, nothing belongs to another cohort, and no
   * member hangs from outside (that would be a stable anchor: the region is still attached).
   *
   * The design keeps counters for this (stableAnchors, pendingMark, §6.8); the prototype reads
   * the region instead, which costs one region (at most the region cap).
   * Returns the anchors (explicit members with tree children), or null.
   */
  suspendable(region, root) {
    if (region === ROOT_REGION || this.suspension(region) !== null) return null;
    const materializedIn = this.tx.get(regionKey(region))?.materializedIn;
    if (materializedIn && this.cohort(materializedIn) && this.findCohort(materializedIn) === root) return null;
    const anchors = [];
    let implicit = 0;
    for (const id of this.regionMembers(region)) {
      const meta = this.meta(id);
      if (meta.deferred) return null;
      if (meta.cohort !== null) {
        if (this.findCohort(meta.cohort) !== root) return null;
        if (this.treeChildren(id).length > 0) anchors.push(id);
        continue;
      }
      if (meta.treeParent === null || this.regionOf(meta.treeParent) !== region) return null;
      implicit++;
    }
    return implicit > 0 ? anchors : null;
  }

  /**
   * Suspends a region in a cohort (§8.1): all its stable members become implicitly unstable at
   * once. Its anchors leave the mark list; the region item takes their place, and marking it
   * cuts the tree edges that leave the region (Collector.markRegion).
   */
  suspend(region, root, anchors) {
    this.setSuspension(region, { cohort: root, marked: false });
    this.tx.put(suspendedKey(root, region), true);
    const cohort = this.cohort(root);
    cohort.mark = cohort.mark.filter((item) => !anchors.includes(item));
    cohort.mark.push(regionItem(region));
    this.saveCohort(cohort);
  }

  /** Ends a suspension, keeping the region's internal tree. Returns the root cohort. */
  unsuspend(region) {
    const suspended = this.suspension(region);
    this.setSuspension(region, null);
    this.tx.delete(suspendedKey(suspended.cohort, region));
    this.scheduleStructure(region); // structure tasks skip suspended regions
    return this.findCohort(suspended.cohort);
  }

  /** Whether `id` is the only explicit member of its region with tree children. */
  isSoleAnchor(id, region) {
    return this.regionMembers(region).every(
      (member) => member === id || this.meta(member).cohort === null || this.treeChildren(member).length === 0,
    );
  }

  /**
   * Resume (§8.2): the region's sole anchor is being rescued, so its whole internal tree is
   * certified again. Every member is stable again; the region is queued for expansion, so that
   * what its members reference is rescued too.
   */
  resume(region) {
    const root = this.unsuspend(region);
    // Until the region item has expanded every member, structure tasks must not move members
    // out of it: they would never be expanded (Collector.expand clears this).
    this.tx.put(regionKey(region), { ...this.tx.get(regionKey(region)), expanding: true });
    this.push(root, "expand", regionItem(region));
  }

  /**
   * Materialize (§8.2): the region is partly rescued, or changes. The suspension ends; implicit
   * members become stale-stable under their anchors, and the anchors that are still unstable go
   * back on the mark list, so that marking proceeds object by object, with replacement parents.
   */
  materialize(region) {
    if (this.suspension(region) === null) return;
    const implicit = this.regionMembers(region).filter((id) => this.meta(id).cohort === null);
    const root = this.unsuspend(region);
    // The cohort found a reason to look at this region object by object: it must not suspend
    // it again, or marking an anchor would suspend it, the check would materialize it, and so on
    // forever.
    this.tx.put(regionKey(region), { ...this.tx.get(regionKey(region)), materializedIn: root });
    const cohort = this.cohort(root);
    for (const id of this.regionMembers(region)) {
      const meta = this.meta(id);
      if (meta.cohort === null || this.findCohort(meta.cohort) !== root) continue;
      if (this.treeChildren(id).length === 0) continue;
      // Unmarked again, so its check must be pending again too: the barrier and expansion skip
      // rescuing an unmarked object and rely on its check to find the referrer (§7.3).
      if (!cohort.mark.includes(id)) cohort.mark.push(id);
      if (!cohort.check.includes(id)) cohort.check.push(id);
    }
    // The implicit members turn stale-stable without being expanded. Whatever of this cohort
    // they reference may already have been checked counting on them being unstable, so it is
    // checked again (invariant M3). If such a member stays garbage, marking makes it unstable
    // again before that check; if it is rescued or re-parented, the check finds it.
    for (const id of implicit) {
      for (const target of strongReferences(this.record(id)).keys()) {
        const meta = this.meta(target);
        if (!meta) continue;
        if (meta.cohort !== null) {
          if (this.findCohort(meta.cohort) === root && !cohort.check.includes(target)) cohort.check.push(target);
          continue;
        }
        const suspended = meta.region !== region ? this.suspension(meta.region) : null;
        const item = regionItem(meta.region);
        if (suspended && suspended.marked && this.findCohort(suspended.cohort) === root && !cohort.check.includes(item)) {
          cohort.check.push(item);
        }
      }
    }
    this.saveCohort(cohort);
  }
}

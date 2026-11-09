/**
 * The collector's persistent state, and the operations on it that the write barrier and the
 * collector share. Every method works inside one store transaction. The invariants these
 * operations maintain are stated in documents/invariants.md.
 *
 * Keys (documents/persistent-garbage-collection.md §4.2):
 *
 *   o/<obj>                 the object record (application data)
 *   g/<obj>                 { treeParent, cohort, shared, deferred }: the object's GC metadata
 *   t/<parent>/<child>      spanning-tree child edges
 *   c/<cohort>              cohort record: worklists, merge links
 *   C/<cohort>/<obj>        cohort membership, under the cohort id the object joined
 *   d/<deadline>/<obj>      deferred cuts, ordered by deadline
 *   meta/nextId             id counter
 *   meta/clock              logical clock: the number of application transactions
 *
 * State of an object (§7.1):
 *   - STABLE: no cohort. It has a tree parent, is ROOT, or is deferred. It may be stale-stable,
 *     that is, below a cut whose marking or deferral is still pending (§7.3).
 *   - unstable in cohort C: it has no tree parent and, once marked, no tree children.
 *
 * Cohorts merge by union-find: a merged cohort record points at the cohort it was merged into.
 */

import { strongReferences } from "../model.js";

export const ROOT = "root";
export const STABLE = "STABLE";

const objectKey = (id) => `o/${id}`;
const metaKey = (id) => `g/${id}`;
const treeKey = (parent, child) => `t/${parent}/${child}`;
const treePrefix = (parent) => `t/${parent}/`;
const cohortKey = (id) => `c/${id}`;
const memberKey = (cohort, id) => `C/${cohort}/${id}`;
const memberPrefix = (cohort) => `C/${cohort}/`;
const deferralKey = (deadline, id) => `d/${String(deadline).padStart(12, "0")}/${id}`;

export const keys = { objectKey, metaKey, treeKey, treePrefix, cohortKey, memberKey, memberPrefix, deferralKey };

export const defaultOptions = {
  /** Application transactions a cut is deferred before marking starts (§9.3). */
  deferral: 2,
  /** Maximum steps of a verified walk (§9.5). */
  walkBudget: 64,
  /** Maximum referrers tried by quick swap and the replacement-parent search. */
  candidates: 8,
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

  /** STABLE, or the id of the (root) cohort the object is unstable in. */
  state(id) {
    const meta = this.meta(id);
    if (!meta) throw new Error(`No GC metadata for object ${id}`);
    if (meta.cohort === null) return STABLE;
    return this.findCohort(meta.cohort);
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
   * This is where edgesOfRegion (§5.5) is used. With a single region, it is every edge in the
   * store, read from the object records (implementation A): O(database) per call. Regions
   * replace it with the object's own region plus its flagged source regions.
   */
  referrersOf(ids) {
    const referrers = new Map([...ids].map((id) => [id, []]));
    for (const [key, record] of this.tx.range("o/")) {
      const source = key.slice(2);
      for (const target of strongReferences(record).keys()) {
        if (referrers.has(target)) referrers.get(target).push(source);
      }
    }
    return referrers;
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

  /** Records a cut without marking anything yet (§9.3, invariant F1). */
  defer(id) {
    const meta = this.meta(id);
    if (meta.treeParent !== null) this.tx.delete(treeKey(meta.treeParent, id));
    const deadline = this.clock() + this.options.deferral;
    this.updateMeta(id, { treeParent: null, deferred: deadline });
    this.tx.put(deferralKey(deadline, id), true);
  }

  clearDeferral(id) {
    const meta = this.meta(id);
    if (!meta.deferred) return;
    this.tx.delete(deferralKey(meta.deferred, id));
    this.updateMeta(id, { deferred: null });
  }

  /** The earliest deferral whose deadline has passed (or any, if `flush`), as an id. */
  dueDeferral(flush = false) {
    const first = this.tx.keys("d/")[0];
    if (first === undefined) return null;
    const [, deadline, id] = first.split("/");
    return flush || Number(deadline) <= this.clock() ? id : null;
  }

  hasDeferrals() {
    return this.tx.keys("d/").length > 0;
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
      if (!meta || meta.cohort !== null) return false;
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

  /** A new object attached below a stable parent. */
  attachNew(id, parent) {
    this.updateMeta(id, { treeParent: parent, cohort: null, shared: false, deferred: null });
    this.tx.put(treeKey(parent, id), true);
  }

  /** A new object that is only referenced from members of a cohort joins that cohort. */
  joinCohort(id, cohortId) {
    const root = this.findCohort(cohortId);
    this.updateMeta(id, { treeParent: null, cohort: root, shared: false, deferred: null });
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
    return this.treeChildren(id).length === 0;
  }

  /**
   * An unstable object that has been marked gets a stable referrer: it becomes stable under that
   * referrer and is queued for expansion in its former cohort, so that whatever it references
   * is rescued too.
   */
  rescue(id, parent) {
    const meta = this.meta(id);
    if (meta.cohort === null) throw new Error(`Rescue of stable object ${id}`);
    if (!this.canRescue(id)) throw new Error(`Rescue of unmarked object ${id}`);
    const root = this.findCohort(meta.cohort);
    this.tx.delete(memberKey(meta.cohort, id));
    this.updateMeta(id, { treeParent: parent, cohort: null });
    this.tx.put(treeKey(parent, id), true);
    this.push(root, "expand", id);
  }
}

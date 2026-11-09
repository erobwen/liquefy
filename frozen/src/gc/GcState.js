/**
 * The collector's persistent state, and the operations on it that the write barrier and the
 * collector share. Every method works inside one store transaction.
 *
 * Keys (documents/persistent-garbage-collection.md §4.2):
 *
 *   o/<obj>             the object record (application data)
 *   g/<obj>             { treeParent, cohort }: the object's GC metadata
 *   t/<parent>/<child>  spanning-tree child edges
 *   c/<cohort>          cohort record: worklists, merge links
 *   C/<cohort>/<obj>    cohort membership, under the cohort id the object joined
 *   meta/nextId         id counter
 *
 * State of an object (§7.1):
 *   - STABLE: no cohort. It has a tree parent, or is ROOT. It may be stale-stable, that is,
 *     below a cut whose marking has not reached it yet (§7.3).
 *   - unstable in cohort C: it has no tree parent and, once marked, no tree children.
 *
 * Cohorts merge by union-find: a merged cohort record points at the cohort it was merged into.
 */

export const ROOT = "root";
export const STABLE = "STABLE";

const objectKey = (id) => `o/${id}`;
const metaKey = (id) => `g/${id}`;
const treeKey = (parent, child) => `t/${parent}/${child}`;
const treePrefix = (parent) => `t/${parent}/`;
const cohortKey = (id) => `c/${id}`;
const memberKey = (cohort, id) => `C/${cohort}/${id}`;
const memberPrefix = (cohort) => `C/${cohort}/`;

export const keys = { objectKey, metaKey, treeKey, treePrefix, cohortKey, memberKey, memberPrefix };

export class GcState {
  constructor(transaction) {
    this.tx = transaction;
  }

  // ---- Ids ----

  nextId(prefix) {
    const next = this.tx.get("meta/nextId") ?? 1;
    this.tx.put("meta/nextId", next + 1);
    return `${prefix}${next.toString(36)}`;
  }

  // ---- Objects ----

  record(id) {
    return this.tx.get(objectKey(id));
  }

  meta(id) {
    return this.tx.get(metaKey(id));
  }

  setMeta(id, meta) {
    this.tx.put(metaKey(id), meta);
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

  /** Ids of active, unmerged cohorts, in id order. */
  activeCohorts() {
    return this.tx
      .range("c/")
      .map(([, cohort]) => cohort)
      .filter((cohort) => !cohort.mergedInto);
  }

  // ---- Transitions ----

  /** A new object attached below a stable parent. */
  attachNew(id, parent) {
    this.setMeta(id, { treeParent: parent, cohort: null });
    this.tx.put(treeKey(parent, id), true);
  }

  /** A new object that is only referenced from members of a cohort joins that cohort. */
  joinCohort(id, cohortId) {
    const root = this.findCohort(cohortId);
    this.setMeta(id, { treeParent: null, cohort: root });
    this.tx.put(memberKey(root, id), true);
    this.push(root, "check", id);
  }

  /**
   * Makes a stable object unstable in a cohort: it loses its tree parent and is queued for
   * marking (its tree children) and checking (its referrers).
   */
  makeUnstable(id, cohortId) {
    const root = this.findCohort(cohortId);
    const meta = this.meta(id);
    if (meta.treeParent !== null) this.tx.delete(treeKey(meta.treeParent, id));
    this.setMeta(id, { treeParent: null, cohort: root });
    this.tx.put(memberKey(root, id), true);
    const cohort = this.cohort(root);
    cohort.mark.push(id);
    cohort.check.push(id);
    this.saveCohort(cohort);
  }

  /** The tree edge parent → child was removed: start a new cohort with the child (§9.2). */
  cut(child) {
    const cohortId = this.newCohort();
    this.makeUnstable(child, cohortId);
    return cohortId;
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
    this.setMeta(id, { treeParent: parent, cohort: null });
    this.tx.put(treeKey(parent, id), true);
    this.push(root, "expand", id);
  }
}

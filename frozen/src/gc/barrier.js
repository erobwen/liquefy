/**
 * The write barrier (documents/persistent-garbage-collection.md §9), single-region version. It
 * runs at commit, inside the same store transaction as the mutations, on the net edge diff of
 * the transaction:
 *
 *   1. added edges, so that a move (remove A → B, add C → B) can rescue or swap before it
 *      detaches anything;
 *   2. removed edges: a removed tree edge is resolved by a quick swap, or deferred.
 *
 * New objects are placed while added edges are processed. A new object that no placed object
 * references by the end of the commit is never persisted.
 */

import { GcState, STABLE } from "./GcState.js";

/**
 * @param tx       the store transaction
 * @param created  Set of ids created in this transaction
 * @param added    Array of { source, target }: strong edges whose count went from 0 to > 0
 * @param removed  Array of { source, target }: strong edges whose count went to 0
 * @param holds    Map from id to hold lifetime ({ transactions } or { milliseconds }), for
 *                 objects whose cut in this transaction should be held (invariant H1)
 * @param releases Set of ids whose hold should expire now
 * @param options  collector options (GcState.defaultOptions)
 */
export function applyBarrier(tx, { created, added, removed, holds = new Map(), releases = new Set() }, options = {}) {
  const gc = new GcState(tx, options);
  gc.tick();

  const addedBySource = new Map();
  for (const edge of added) {
    if (!addedBySource.has(edge.source)) addedBySource.set(edge.source, []);
    addedBySource.get(edge.source).push(edge.target);
  }

  const placed = new Set();
  const placementQueue = [];

  const handleAdd = (source, target) => {
    const sourceState = gc.state(source);
    if (sourceState !== STABLE && gc.isReclaiming(sourceState)) {
      throw new Error(`Object ${source} is being reclaimed and cannot be modified`);
    }

    if (created.has(target) && !placed.has(target)) {
      if (sourceState === STABLE) gc.attachNew(target, source);
      else gc.joinCohort(target, sourceState, source);
      placed.add(target);
      placementQueue.push(target);
      return;
    }

    // The target already had a referrer (invariant W2).
    gc.markShared(target);

    const targetState = gc.state(target);
    if (targetState !== STABLE && gc.isReclaiming(targetState)) {
      throw new Error(`Object ${target} is being reclaimed and cannot be referenced`);
    }
    if (sourceState === STABLE && targetState !== STABLE) {
      // Not yet marked: its pending check will find this edge (GcState.canRescue).
      if (gc.canRescue(target)) gc.rescue(target, source);
    } else if (sourceState !== STABLE && targetState !== STABLE && sourceState !== targetState) {
      gc.merge(sourceState, targetState);
    } else if (sourceState === STABLE && gc.isDeferred(target) && gc.verifiedWalk(source, target)) {
      // A relink of a deferred cut cancels it (§9.3); nothing was marked.
      gc.reparent(target, source);
    }
  };

  // Added edges from objects that existed before this transaction.
  for (const [source, targets] of addedBySource) {
    if (created.has(source)) continue;
    for (const target of targets) handleAdd(source, target);
  }

  // Added edges from new objects, in the order the new objects get placed.
  while (placementQueue.length > 0) {
    const source = placementQueue.shift();
    for (const target of addedBySource.get(source) ?? []) handleAdd(source, target);
  }

  // New objects nothing references are never written.
  for (const id of created) {
    if (!placed.has(id)) tx.delete(`o/${id}`);
  }

  // Cover every added cross-region edge with an entry flag (invariant G2), before removals:
  // quick swap must be able to find a referrer added in this same transaction. Every source
  // whose edges changed gets its region's weight re-evaluated (invariant G3).
  for (const { source, target } of added) {
    if (!gc.meta(source)) continue; // a dropped new object
    gc.coverEdge(source, target);
    gc.scheduleStructure(gc.regionOf(source));
  }
  for (const { source } of removed) {
    if (gc.meta(source)) gc.scheduleStructure(gc.regionOf(source));
  }

  // Removed edges: a removed tree edge is a cut. Try a quick swap; otherwise defer it, for the
  // default delay or for the lifetime of a hold. With deferCuts off, holds are ignored and the
  // cut starts a cohort at once.
  // A hold on an object whose tree edge is not cut here has no effect: the object is still
  // attached, and which of its references is the tree edge is not the application's concern.
  for (const { source, target } of removed) {
    const meta = gc.meta(target);
    if (!meta || meta.treeParent !== source) continue;
    // A tree edge inside a suspended cluster: the cluster's tree changes, so it is materialized
    // first, and the cut is then handled like any other (§8.2).
    if (gc.isImplicit(target)) gc.materialize(gc.suspensionOf(meta.region).cluster);
    if (gc.quickSwap(target)) continue;
    if (gc.options.deferCuts) gc.defer(target, gc.deferralFor(holds.get(target)));
    else gc.makeUnstable(target, gc.newCohort());
  }

  for (const id of releases) gc.expireNow(id);

  return { dropped: [...created].filter((id) => !placed.has(id)) };
}

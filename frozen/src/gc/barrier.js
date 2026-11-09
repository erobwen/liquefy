/**
 * The write barrier (documents/persistent-garbage-collection.md §9), basic version: no quick swap,
 * no deferred cuts, no regions. It runs at commit, inside the same store transaction as the
 * mutations, on the net edge diff of the transaction:
 *
 *   1. added edges, so that a move (remove A → B, add C → B) can rescue before it detaches;
 *   2. removed edges;
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
 */
export function applyBarrier(tx, { created, added, removed }) {
  const gc = new GcState(tx);

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
      else gc.joinCohort(target, sourceState);
      placed.add(target);
      placementQueue.push(target);
      return;
    }

    const targetState = gc.state(target);
    if (targetState !== STABLE && gc.isReclaiming(targetState)) {
      throw new Error(`Object ${target} is being reclaimed and cannot be referenced`);
    }
    if (sourceState === STABLE && targetState !== STABLE) {
      // Not yet marked: its pending check will find this edge (GcState.canRescue).
      if (gc.canRescue(target)) gc.rescue(target, source);
    } else if (sourceState !== STABLE && targetState !== STABLE && sourceState !== targetState) {
      gc.merge(sourceState, targetState);
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

  // Removed edges: a removed tree edge is a cut.
  for (const { source, target } of removed) {
    const meta = gc.meta(target);
    if (meta && meta.treeParent === source) gc.cut(target);
  }

  return { dropped: [...created].filter((id) => !placed.has(id)) };
}

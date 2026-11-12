/**
 * Structure tasks for clusters at every level (documents/persistent-garbage-collection.md
 * §6.3–6.5, §6.9): split a cluster that is too heavy, merge one that is too light, delete one
 * that is empty, and add or remove a level at the top.
 *
 * Level 0: regions of objects, weighed by objects plus outgoing edges, against regionCap.
 * Level k ≥ 1: meta-regions of level k-1 clusters, weighed by their number of members, against
 * clusterCap. The top level is the set of clusters without a container (R/ keys); when it has
 * more than clusterCap of them, they are all put in a new cluster one level up (as the root of
 * a B-tree splits), and a top level left with a single meta-region is dissolved. Splits and
 * merges stay inside one container, so every level-0 region keeps a chain of the same length.
 *
 * A structure task runs as one collector step. It only moves membership and maintains entry
 * flags, counters and tree-edge counts (invariants G1, G2, G4, A1, A2): it never changes a tree
 * parent, a cohort or a deferral.
 */

import { ROOT_REGION, keys } from "./GcState.js";
import { strongReferences } from "../model.js";

/** Re-evaluates a cluster whose membership or edges changed (invariant G3). */
export function runStructureTask(gc, cluster) {
  gc.tx.delete(keys.structureKey(cluster));
  if (!gc.regionExists(cluster)) return "gone";
  for (const id of gc.chain(cluster)) {
    const record = gc.cluster(id);
    // A suspended cluster keeps its membership: moving objects out of it would make them
    // stable. It is scheduled again when its suspension ends.
    if (record.suspended) return "suspended";
    // A resumed cluster whose objects are still to be expanded (GcState.resume).
    if (record.expanding) return "expanding";
  }
  const record = gc.cluster(cluster);
  const members = gc.regionMembers(cluster);
  if (members.length === 0 && cluster !== ROOT_REGION) {
    deleteCluster(gc, cluster);
    return "deleted";
  }
  if (record.container === null) {
    const tops = gc.topClusters();
    if (tops.length > gc.options.clusterCap) {
      addLevel(gc, tops, record.level);
      gc.scheduleStructure(cluster); // its own weight is still to be evaluated
      return "level added";
    }
    // A single top meta-region that is still too big splits first (below).
    if (tops.length === 1 && record.level > 0 && members.length <= gc.options.clusterCap) {
      removeLevel(gc, cluster);
      return "level removed";
    }
  }
  if (record.level === 0) {
    const weight = gc.regionWeight(cluster);
    const cap = gc.options.regionCap;
    if (weight > cap) return splitRegion(gc, cluster) ? "split" : "unsplittable";
    if (weight < cap / 4 && cluster !== ROOT_REGION) return mergeRegion(gc, cluster, weight) ? "merged" : "kept";
    return "kept";
  }
  const cap = gc.options.clusterCap;
  if (members.length > cap) return splitCluster(gc, cluster, members) ? "split" : "unsplittable";
  // A single member always tries to merge: with a small cap, a quarter of it is below one.
  if (members.length < cap / 4 || members.length === 1) return mergeCluster(gc, cluster, members) ? "merged" : "kept";
  return "kept";
}

/** Deletes an empty cluster, with its flags and the flags its mirrors list. */
function deleteCluster(gc, cluster) {
  const { container } = gc.cluster(cluster);
  gc.dropFlags(cluster);
  // An empty cluster has no tree edges; these are only cleared for safety.
  for (const key of gc.tx.keys(keys.treeOutPrefix(cluster))) gc.tx.delete(key);
  for (const key of gc.tx.keys(keys.treeInPrefix(cluster))) gc.tx.delete(key);
  gc.tx.delete(keys.regionKey(cluster));
  gc.detachCluster(cluster, container);
  // Flags elsewhere that name a deleted level-0 region are now stale; lookups delete them (G2).
}

/** Puts every top-level cluster into one new cluster, one level up. */
function addLevel(gc, tops, level) {
  const top = gc.newCluster(level + 1, null);
  const record = gc.cluster(top);
  for (const id of tops) {
    const member = gc.cluster(id);
    record.objects += member.objects;
    record.deferred += member.deferred;
    for (const [cohortId, count] of Object.entries(member.explicit)) record.explicit[cohortId] = (record.explicit[cohortId] ?? 0) + count;
    gc.patchCluster(id, { container: top });
    gc.tx.delete(keys.topKey(id));
    gc.tx.put(keys.regionMemberKey(top, id), true);
  }
  gc.putCluster(record);
  // The new level has a single cluster: no flags or tree-edge counts are needed at it.
}

/** The top level is a single meta-region: its members become the top level. */
function removeLevel(gc, top) {
  for (const id of gc.regionMembers(top)) {
    gc.patchCluster(id, { container: null });
    gc.tx.delete(keys.regionMemberKey(top, id));
    gc.tx.put(keys.topKey(id), true);
    gc.scheduleStructure(id);
  }
  gc.dropFlags(top);
  gc.tx.delete(keys.regionKey(top));
  gc.tx.delete(keys.topKey(top));
}

/** Whether a cluster may receive members now (§10.1: not while suspended or expanding). */
function canReceive(gc, cluster) {
  const record = gc.cluster(cluster);
  return !record.suspended && !record.expanding;
}

// ---- Level 0 ----

/** The members of a region with their records' edges, weights and in-region tree structure. */
function loadRegion(gc, region) {
  const members = gc.regionMembers(region);
  const memberSet = new Set(members);
  const targets = new Map(); // id → strong targets
  const weight = new Map();
  const parent = new Map();
  for (const id of members) {
    const outgoing = [...strongReferences(gc.record(id)).keys()];
    targets.set(id, outgoing);
    weight.set(id, 1 + outgoing.length);
    const treeParent = gc.meta(id).treeParent;
    parent.set(id, treeParent !== null && memberSet.has(treeParent) ? treeParent : null);
  }
  return { members, memberSet, targets, weight, parent };
}

/**
 * Splits a region at the centroid of its internal spanning forest (§6.4): moves a group of
 * whole subtrees, between a third and two thirds of the weight, into a new region in the same
 * container. Returns false if no such group exists (a single object heavier than the cap).
 */
function splitRegion(gc, region) {
  const loaded = loadRegion(gc, region);
  const moved = centroidGroup(loaded.members, (id) => loaded.parent.get(id), (id) => loaded.weight.get(id));
  if (moved === null) return false;
  const to = gc.newCluster(0, gc.cluster(region).container);
  moveObjects(gc, loaded, moved, to, region);
  return true;
}

/**
 * Merges a light region into the region its anchors hang from, if that is in the same
 * container and the result stays at most two thirds of the cap (§6.5). Returns false if there
 * is no such region or no room.
 */
function mergeRegion(gc, region, weight) {
  const loaded = loadRegion(gc, region);
  const { container } = gc.cluster(region);
  const parentRegion = loaded.members
    .filter((id) => loaded.parent.get(id) === null)
    .map((id) => gc.meta(id).treeParent)
    .filter((parent) => parent !== null && gc.meta(parent))
    .map((parent) => gc.regionOf(parent))
    .find((candidate) => candidate !== region && gc.regionExists(candidate));
  if (parentRegion === undefined || gc.cluster(parentRegion).container !== container) return false;
  if (!canReceive(gc, parentRegion)) return false; // objects moved in would become unstable
  if (weight + gc.regionWeight(parentRegion) > (2 * gc.options.regionCap) / 3) return false;

  moveObjects(gc, loaded, new Set(loaded.members), parentRegion, region);
  deleteCluster(gc, region);
  return true;
}

/**
 * Moves `moved` (a subset of the loaded region `from`) into region `to`, in the same container,
 * keeping flag coverage (invariant G2). Above level 0 nothing changes. At level 0:
 *   - target side: edges into the moved objects from other regions were covered by flags on
 *     `from`; `to` gets copies of all of them (conservative);
 *   - edges between the moved objects and the rest of `from` become cross-region;
 *   - the moved objects' edges to other regions now come from `to`.
 * Counters and tree-edge counts follow in GcState.updateMeta.
 */
function moveObjects(gc, loaded, moved, to, from) {
  for (const source of gc.flagSources(from)) gc.ensureFlag(to, source);

  for (const id of moved) gc.setRegion(id, to);

  for (const id of loaded.members) {
    for (const target of loaded.targets.get(id)) gc.coverEdge(id, target);
  }
}

// ---- Level k ≥ 1 ----

/**
 * The member a meta-region member hangs from in the contracted tree (§6.9): the sibling with the
 * most tree edges into it, read from its P/ keys, or null if it hangs from outside.
 */
function contractedParent(gc, cluster, member) {
  let best = null;
  let bestCount = 0;
  for (const [from, count] of gc.treeEntries(member)) {
    if (count > bestCount && gc.cluster(from)?.container === cluster) {
      best = from;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Splits a meta-region that has too many members, at the centroid of the contracted tree: a
 * group of between a third and two thirds of its members moves to a new meta-region in the same
 * container. Reads only the members' records and P/ keys, nothing below them (§6.9).
 */
function splitCluster(gc, cluster, members) {
  const moved = centroidGroup(members, (id) => contractedParent(gc, cluster, id), () => 1);
  if (moved === null) return false;
  const { level, container } = gc.cluster(cluster);
  const to = gc.newCluster(level, container);
  moveClusters(gc, moved, cluster, to, true);
  return true;
}

/**
 * Merges a light meta-region into the sibling it hangs from most (by its P/ keys), if the
 * result has at most two thirds of the cap.
 */
function mergeCluster(gc, cluster, members) {
  const { container } = gc.cluster(cluster);
  let target = null;
  let best = 0;
  for (const [from, count] of gc.treeEntries(cluster)) {
    if (count > best && from !== cluster && gc.cluster(from)?.container === container) {
      target = from;
      best = count;
    }
  }
  if (target === null || !canReceive(gc, target)) return false;
  if (members.length + gc.regionMembers(target).length > (2 * gc.options.clusterCap) / 3) return false;
  moveClusters(gc, new Set(members), cluster, target, false);
  deleteCluster(gc, cluster);
  return true;
}

/**
 * Moves member clusters from meta-region `from` to `to`, in the same container. Flags are copied,
 * not recomputed (§6.6), and nothing below the moved members is read:
 *   - target side: `to` gets copies of the flags on `from`;
 *   - source side: every flag naming `from` (found through its E/ mirrors) gets a copy naming
 *     `to`;
 *   - on a split, edges between the two may now cross, so each gets a flag naming the other.
 */
function moveClusters(gc, moved, from, to, split) {
  for (const source of gc.flagSources(from)) if (source !== to) gc.ensureFlag(to, source);
  for (const target of gc.mirrorTargets(from)) if (target !== to) gc.ensureFlag(target, to);
  if (split) {
    gc.ensureFlag(from, to);
    gc.ensureFlag(to, from);
  }
  for (const id of moved) moveCluster(gc, id, from, to);
  gc.scheduleStructure(from);
  gc.scheduleStructure(to);
}

/**
 * Moves one member cluster: the counters of `from` and `to` (their containers are the same, so
 * nothing above changes), and the tree-edge counts at their level, from the member's own T/ and
 * P/ keys one level down.
 */
function moveCluster(gc, id, from, to) {
  const member = gc.cluster(id);
  const fromRecord = gc.cluster(from);
  const toRecord = gc.cluster(to);
  fromRecord.objects -= member.objects;
  toRecord.objects += member.objects;
  fromRecord.deferred -= member.deferred;
  toRecord.deferred += member.deferred;
  for (const [cohortId, count] of Object.entries(member.explicit)) {
    fromRecord.explicit[cohortId] -= count;
    if (fromRecord.explicit[cohortId] === 0) delete fromRecord.explicit[cohortId];
    toRecord.explicit[cohortId] = (toRecord.explicit[cohortId] ?? 0) + count;
  }
  gc.putCluster(fromRecord);
  gc.putCluster(toRecord);

  const edge = (parent, child, count) => {
    gc.bump(keys.treeOutKey(parent, child), count);
    gc.bump(keys.treeInKey(child, parent), count);
  };
  for (const [source, count] of gc.treeEntries(id)) {
    const above = gc.cluster(source).container;
    if (above !== from) edge(above, from, -count);
    if (above !== to) edge(above, to, count);
  }
  for (const [target, count] of gc.treeExits(id)) {
    const above = gc.cluster(target).container;
    if (above !== from) edge(from, above, -count);
    if (above !== to) edge(to, above, count);
  }

  gc.patchCluster(id, { container: to });
  gc.tx.delete(keys.regionMemberKey(from, id));
  gc.tx.put(keys.regionMemberKey(to, id), true);
}

// ---- Choosing what to split off ----

/**
 * A group of whole subtrees of a forest, between a third and two thirds of its weight (§6.4):
 * walk down from a virtual root to the centroid, then take its largest child subtrees. Returns
 * the moved set, or null if there is none (one member heavier than the cap).
 *
 * `parentOf(id)` gives a member's parent among the members, or null. Cycles (possible in the
 * contracted tree of a region that is not a clean branch) are broken by treating a member on
 * them as a root.
 */
function centroidGroup(members, parentOf, weightOf) {
  const memberSet = new Set(members);
  const children = new Map(members.map((id) => [id, []]));
  const parent = new Map();
  const roots = [];
  for (const id of members) {
    const p = parentOf(id);
    if (p !== null && p !== id && memberSet.has(p)) {
      parent.set(id, p);
      children.get(p).push(id);
    } else roots.push(id);
  }
  const reached = new Set();
  const reach = (start) => {
    const stack = [start];
    while (stack.length > 0) {
      const id = stack.pop();
      if (reached.has(id)) continue;
      reached.add(id);
      stack.push(...children.get(id));
    }
  };
  roots.forEach(reach);
  for (const id of members) {
    if (reached.has(id)) continue;
    const p = parent.get(id);
    children.set(p, children.get(p).filter((child) => child !== id));
    roots.push(id);
    reach(id);
  }

  // Subtree weights, iteratively (post-order over the forest).
  const subtree = new Map();
  const order = [];
  const stack = [...roots];
  while (stack.length > 0) {
    const id = stack.pop();
    order.push(id);
    stack.push(...children.get(id));
  }
  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i];
    subtree.set(id, weightOf(id) + children.get(id).reduce((sum, child) => sum + subtree.get(child), 0));
  }
  const total = roots.reduce((sum, id) => sum + subtree.get(id), 0);

  // Walk down from a virtual root to the centroid: the node whose child subtrees are all ≤ half.
  // On the way, a subtree of at most two thirds of the weight is taken whole: a balanced split
  // with a single root.
  let kids = roots;
  let whole = null;
  for (;;) {
    const heavy = kids.find((id) => subtree.get(id) > total / 2);
    if (heavy === undefined) break;
    if (subtree.get(heavy) <= (2 * total) / 3) {
      whole = heavy;
      break;
    }
    kids = children.get(heavy);
  }

  // Otherwise a group of the centroid's child subtrees, between a third and two thirds of the
  // weight: the largest one alone if it is big enough, else several siblings.
  const sorted = whole !== null ? [whole] : [...kids].sort((a, b) => subtree.get(b) - subtree.get(a));
  const group = [];
  let groupWeight = 0;
  for (const id of sorted) {
    if (groupWeight >= total / 3) break;
    group.push(id);
    groupWeight += subtree.get(id);
    if (subtree.get(id) >= total / 3) break; // one big enough child alone
  }
  if (group.length === 0 || groupWeight >= total) return null;

  const moved = new Set();
  const collect = [...group];
  while (collect.length > 0) {
    const id = collect.pop();
    moved.add(id);
    collect.push(...children.get(id));
  }
  return moved;
}

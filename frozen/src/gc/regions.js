/**
 * Structure tasks for clusters at every level (documents/persistent-garbage-collection.md
 * §6.3–6.5, §6.9): split a cluster that is too heavy, merge one that is too light, delete one
 * that is empty, add or remove a level at the top, and re-home what hangs from elsewhere.
 *
 * Level 0: regions of objects, weighed by objects plus outgoing edges, against regionCap.
 * Level k ≥ 1: meta-regions of level k-1 clusters, weighed by their number of members, against
 * clusterCap. The top level is the set of clusters without a container (R/ keys); when it has
 * more than clusterCap of them, they are all put in a new cluster one level up (as the root of
 * a B-tree splits), and a top level left with a single meta-region is dissolved. Members only
 * ever move between clusters of the same level, so every level-0 region keeps a chain of the
 * same length.
 *
 * A structure task runs as one collector step. It only moves membership and maintains entry
 * flags, counters and tree-edge counts (invariants G1, G2, G4, A1, A2): it never changes a tree
 * parent, a cohort or a deferral.
 */

import { ROOT, ROOT_REGION, keys, addCount } from "./GcState.js";
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
    const { weight } = record;
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
  if (weight + gc.cluster(parentRegion).weight > (2 * gc.options.regionCap) / 3) return false;

  moveObjects(gc, loaded, new Set(loaded.members), parentRegion, region);
  deleteCluster(gc, region);
  return true;
}

/**
 * Moves `moved` (a subset of the loaded region `from`) into region `to`, keeping flag coverage
 * (invariant G2). A split or merge stays in one container, and then nothing changes above level
 * 0; a re-home may cross meta-regions, and then the same holds at every level where the two
 * regions' containers differ (copyFlags for the target side, coverEdge for the edges):
 *   - target side: edges into the moved objects from other regions were covered by flags on
 *     `from`; `to` gets copies of all of them (conservative);
 *   - edges between the moved objects and the rest of `from` become cross-region;
 *   - the moved objects' edges to other regions now come from `to`.
 * Counters and tree-edge counts follow in GcState.updateMeta.
 */
function moveObjects(gc, loaded, moved, to, from) {
  copyFlags(gc, from, to, false);

  for (const id of moved) gc.setRegion(id, to, loaded.weight.get(id));

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
  moveClusters(gc, moved, cluster, to);
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
  moveClusters(gc, new Set(members), cluster, target);
  deleteCluster(gc, cluster);
  return true;
}

/**
 * Moves member clusters from meta-region `from` to `to`. Nothing below the moved members is
 * read: flags are copied (copyFlags), and counters and tree-edge counts come from the members'
 * own records and T/ and P/ keys.
 */
function moveClusters(gc, moved, from, to) {
  copyFlags(gc, from, to, true);
  for (const id of moved) moveCluster(gc, id, from, to);
  gc.scheduleStructure(from);
  gc.scheduleStructure(to);
}

/**
 * Keeps flag coverage (invariant G2) when members move from `from` to `to`, by copying
 * instead of recomputing (§6.6). At their level, and at every level above where their
 * containers still differ (a move across meta-regions):
 *   - target side: `to` gets copies of the flags on `from`, and a flag naming `from`;
 *   - source side (cluster moves; object moves cover their edges one by one instead): every
 *     flag naming `from`, found through its E/ mirrors, gets a copy naming `to`, and since
 *     edges between the two may now cross, each gets a flag naming the other.
 */
function copyFlags(gc, from, to, sourceSide) {
  while (from !== to && from !== null && to !== null) {
    for (const source of gc.flagSources(from)) if (source !== to) gc.ensureFlag(to, source);
    // What stays in `from` may reference what moved: that edge crosses now. (Found by the
    // fuzzer, for a re-home across meta-regions: the referrer was in another region of the
    // old meta-region, so nothing at level 0 changed for it.)
    gc.ensureFlag(to, from);
    if (sourceSide) {
      for (const target of gc.mirrorTargets(from)) if (target !== to) gc.ensureFlag(target, to);
      gc.ensureFlag(from, to);
    }
    from = gc.cluster(from).container;
    to = gc.cluster(to).container;
  }
}

/**
 * Moves one member cluster: its counters leave every container of `from` and join every
 * container of `to`, and the tree-edge counts above it follow, from its own T/ and P/ keys.
 */
function moveCluster(gc, id, from, to) {
  const member = gc.cluster(id);
  const transfer = (cluster, sign) => {
    for (const above of gc.chain(cluster)) {
      const record = gc.cluster(above);
      record.objects += sign * member.objects;
      record.deferred += sign * member.deferred;
      for (const [cohortId, count] of Object.entries(member.explicit)) addCount(record.explicit, cohortId, sign * count);
      gc.putCluster(record);
    }
  };
  transfer(from, -1);
  transfer(to, 1);

  for (const [source, count] of gc.treeEntries(id)) {
    const above = gc.cluster(source).container;
    gc.countTreeEdge(above, from, -count);
    gc.countTreeEdge(above, to, count);
  }
  for (const [target, count] of gc.treeExits(id)) {
    const above = gc.cluster(target).container;
    gc.countTreeEdge(from, above, -count);
    gc.countTreeEdge(to, above, count);
  }

  gc.patchCluster(id, { container: to });
  gc.tx.delete(keys.regionMemberKey(from, id));
  gc.tx.put(keys.regionMemberKey(to, id), true);
}

// ---- Re-homing (§6.7) ----

/** Whether a cluster, or one containing it, is suspended or waiting to expand. */
function blocked(gc, cluster) {
  return gc.chain(cluster).some((id) => {
    const record = gc.cluster(id);
    return record.suspended || record.expanding;
  });
}

/**
 * Re-homes what no longer belongs in a cluster. Quick swap, a rescue, a cancelled deferral or a
 * replacement parent can give an object a tree parent in another region; its region then hangs
 * from two places, and can no longer be suspended when one of them is deleted.
 *
 * The cluster's P/ keys say where it hangs from. The source with the most tree edges into it
 * is its home (the cluster holding ROOT has none: it hangs from nothing). The part hanging from
 * another source moves to that source: one source per task. At level 0 that part is the
 * internal subtrees of the objects whose tree parent is there; above, the members that hang from
 * it, with the members hanging from those. The same question is then asked of the container.
 *
 * Like every structure task, this only moves membership (invariant G4).
 */
export function runRehomeTask(gc, cluster) {
  gc.tx.delete(keys.rehomeKey(cluster));
  if (!gc.regionExists(cluster)) return "gone";
  if (blocked(gc, cluster)) return "re-home skipped";
  const { level, container } = gc.cluster(cluster);
  if (container !== null) gc.scheduleRehome(container);

  const entries = gc.treeEntries(cluster).filter(([from]) => gc.regionExists(from));
  let home = null;
  if (!gc.isInside(gc.regionOf(ROOT), cluster)) {
    let best = 0;
    for (const [from, count] of entries) {
      if (count > best) {
        home = from;
        best = count;
      }
    }
  }
  const foreign = entries.map(([from]) => from).filter((from) => from !== home && !blocked(gc, from));
  for (const [index, source] of foreign.entries()) {
    const moved = level === 0 ? rehomeObjects(gc, cluster, source) : rehomeMembers(gc, cluster, source);
    if (!moved) continue;
    if (index < foreign.length - 1) gc.scheduleRehome(cluster);
    return "re-homed";
  }
  return "at home";
}

/**
 * Moves the internal subtrees of the objects of `region` whose tree parent is in region
 * `source`: into `source` if they fit, else into a small region that hangs only from
 * `source`, else into a new region next to it.
 */
function rehomeObjects(gc, region, source) {
  const loaded = loadRegion(gc, region);
  const children = new Map(loaded.members.map((id) => [id, []]));
  for (const id of loaded.members) if (loaded.parent.get(id) !== null) children.get(loaded.parent.get(id)).push(id);
  const moved = new Set();
  const collect = loaded.members.filter((id) => {
    const parent = gc.meta(id).treeParent;
    return loaded.parent.get(id) === null && parent !== null && gc.regionOf(parent) === source;
  });
  while (collect.length > 0) {
    const id = collect.pop();
    moved.add(id);
    collect.push(...children.get(id));
  }
  if (moved.size === 0 || moved.size === loaded.members.length) return false;

  let weight = 0;
  for (const id of moved) weight += loaded.weight.get(id);
  const cap = gc.options.regionCap;
  const sourceContainer = gc.cluster(source).container;
  let to = null;
  if (weight + gc.cluster(source).weight <= cap) to = source;
  else {
    // A sibling: a region in the same container that hangs only from `source`, with room
    // (judged by its object count, to avoid reading it).
    for (const [candidate] of gc.treeExits(source).slice(0, 8)) {
      const record = gc.cluster(candidate);
      if (candidate === region || record.container !== sourceContainer || record.suspended || record.expanding) continue;
      if (gc.treeEntries(candidate).length !== 1 || record.objects + moved.size > cap / 3) continue;
      to = candidate;
      break;
    }
  }
  if (to === null) to = gc.newCluster(0, sourceContainer);
  moveObjects(gc, loaded, moved, to, region);
  return true;
}

/**
 * Moves the members of meta-region `cluster` that hang from meta-region `source`, with the
 * members hanging from those: into `source` if it has room, else into a new meta-region next
 * to it. Reads only the members' P/ keys.
 */
function rehomeMembers(gc, cluster, source) {
  const members = gc.regionMembers(cluster);
  const memberSet = new Set(members);
  // Where each member hangs from most: a fellow member, or a cluster elsewhere.
  const parent = new Map();
  for (const id of members) {
    let best = 0;
    for (const [from, count] of gc.treeEntries(id)) {
      if (count > best && gc.regionExists(from)) {
        parent.set(id, from);
        best = count;
      }
    }
  }
  const children = new Map(members.map((id) => [id, []]));
  for (const [id, from] of parent) if (memberSet.has(from)) children.get(from).push(id);
  const moved = new Set();
  const collect = members.filter((id) => parent.has(id) && !memberSet.has(parent.get(id)) && gc.cluster(parent.get(id)).container === source);
  while (collect.length > 0) {
    const id = collect.pop();
    if (moved.has(id)) continue;
    moved.add(id);
    collect.push(...children.get(id));
  }
  if (moved.size === 0 || moved.size === members.length) return false;

  const { level, container } = gc.cluster(source);
  const fits = moved.size + gc.regionMembers(source).length <= gc.options.clusterCap;
  moveClusters(gc, moved, cluster, fits ? source : gc.newCluster(level, container));
  return true;
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

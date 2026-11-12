/**
 * The test oracle: a full trace from ROOT over strong references, on committed state.
 * Not part of the collector (documents/persistent-garbage-collection.md §16.1).
 */

import { ROOT, ROOT_REGION, STABLE, keys } from "./gc/GcState.js";
import { strongReferences } from "./model.js";

export function reachableFromRoot(store) {
  const reachable = new Set([ROOT]);
  const queue = [ROOT];
  while (queue.length > 0) {
    const id = queue.pop();
    const record = store.get(keys.objectKey(id));
    if (record === undefined) throw new Error(`Reachable object ${id} is missing`);
    for (const target of strongReferences(record).keys()) {
      if (!reachable.has(target)) {
        reachable.add(target);
        queue.push(target);
      }
    }
  }
  return reachable;
}

/**
 * Checks the collector's metadata against the object records. Returns a list of problems
 * (empty if consistent). `quiescent` adds the checks that hold once the collector is idle.
 */
export function checkIntegrity(store, { quiescent = false } = {}) {
  const problems = [];
  const objectIds = new Set(store.keys("o/").map((key) => key.slice(2)));
  const cohorts = new Map(store.range("c/").map(([, cohort]) => [cohort.id, cohort]));
  const findCohort = (id) => {
    let cohort = cohorts.get(id);
    if (!cohort) return null;
    while (cohort.mergedInto) cohort = cohorts.get(cohort.mergedInto);
    return cohort.id;
  };

  // Every object has metadata, and every metadata entry has an object.
  for (const id of objectIds) {
    if (!store.has(keys.metaKey(id))) problems.push(`${id} has no g/ record`);
  }
  for (const key of store.keys("g/")) {
    if (!objectIds.has(key.slice(2))) problems.push(`g/ record for missing object ${key.slice(2)}`);
  }

  // Tree edges: t/ keys match treeParent, and every tree edge is a real strong edge.
  const treeEdges = new Set(store.keys("t/").map((key) => key.slice(2)));
  for (const id of objectIds) {
    const meta = store.get(keys.metaKey(id));
    if (!meta) continue;
    if (meta.treeParent !== null) {
      if (meta.cohort !== null) problems.push(`${id} is unstable but has tree parent ${meta.treeParent}`);
      if (!treeEdges.has(`${meta.treeParent}/${id}`)) problems.push(`${id}: no t/ key for tree parent ${meta.treeParent}`);
      const parentRecord = store.get(keys.objectKey(meta.treeParent));
      if (!parentRecord) problems.push(`${id}: tree parent ${meta.treeParent} does not exist`);
      else if (!strongReferences(parentRecord).has(id)) problems.push(`${id}: tree parent ${meta.treeParent} does not reference it`);
    } else if (meta.cohort === null && id !== ROOT && !meta.deferred) {
      problems.push(`T3: ${id} is stable, not deferred, but has no tree parent`);
    }
    // F1: deferred ⇔ stable with a null tree parent and a deadline key.
    if (meta.deferred) {
      if (meta.cohort !== null || meta.treeParent !== null) problems.push(`F1: deferred ${id} is unstable or has a tree parent`);
      if (!store.has(keys.deferralKey(meta.deferred, id))) problems.push(`F1: deferred ${id} has no deadline key`);
    }
    if (meta.cohort !== null) {
      const root = findCohort(meta.cohort);
      if (root === null) problems.push(`${id} is in missing cohort ${meta.cohort}`);
      if (!store.has(keys.memberKey(meta.cohort, id))) problems.push(`${id}: no membership key in ${meta.cohort}`);
    }
  }
  for (const edge of treeEdges) {
    const [parent, child] = edge.split("/");
    const meta = store.get(keys.metaKey(child));
    if (!meta || meta.treeParent !== parent) problems.push(`stale t/ key ${edge}`);
  }

  // F1: every deadline key (d/ or h/) belongs to a deferred object with that deadline.
  for (const key of [...store.keys("d/"), ...store.keys("h/")]) {
    const [, , id] = key.split("/");
    const meta = store.get(keys.metaKey(id));
    if (!meta?.deferred || keys.deferralKey(meta.deferred, id) !== key) problems.push(`F1: stale deferral key ${key}`);
  }

  // Clusters (§6.9). H1: every cluster has a level; a cluster with a container is a member of
  // it, one level down; one without is at the top level (R/ key), and all top-level clusters
  // are at the same level, so every level-0 region has a chain of containers of the same length.
  const clusters = new Map(store.range("r/").map(([key, record]) => [key.slice(2), record]));
  const chainOf = (cluster) => {
    const chain = [];
    for (let id = cluster; id !== null && id !== undefined && clusters.has(id) && chain.length <= clusters.size; id = clusters.get(id).container) chain.push(id);
    return chain;
  };
  const topLevels = new Set();
  for (const [id, record] of clusters) {
    if (typeof record.level !== "number") problems.push(`H1: cluster ${id} has no level`);
    if (record.container === null) {
      topLevels.add(record.level);
      if (!store.has(keys.topKey(id))) problems.push(`H1: top-level cluster ${id} has no R/ key`);
    } else {
      const container = clusters.get(record.container);
      if (!container) problems.push(`H1: cluster ${id} is in missing cluster ${record.container}`);
      else if (container.level !== record.level + 1) problems.push(`H1: cluster ${id} at level ${record.level} is in ${record.container} at level ${container.level}`);
      if (!store.has(keys.regionMemberKey(record.container, id))) problems.push(`H1: cluster ${id} has no membership key in ${record.container}`);
    }
  }
  if (topLevels.size > 1) problems.push(`H1: top-level clusters at levels ${[...topLevels].join(", ")}`);
  for (const key of store.keys("R/")) {
    if (clusters.get(key.slice(2))?.container !== null) problems.push(`H1: stale top-level key ${key}`);
  }

  // G1: every object is in exactly one level-0 region, with a membership key and a region record.
  const regionMembers = new Map();
  for (const key of store.keys("m/")) {
    const [, cluster, id] = key.split("/");
    const level = clusters.get(cluster)?.level;
    if (level === undefined) problems.push(`G1: membership key ${key} of a missing cluster`);
    else if (level === 0 ? store.get(keys.metaKey(id))?.region !== cluster : clusters.get(id)?.container !== cluster) {
      problems.push(`G1: stale membership key ${key}`);
    }
    if (!regionMembers.has(cluster)) regionMembers.set(cluster, 0);
    regionMembers.set(cluster, regionMembers.get(cluster) + 1);
  }
  for (const id of objectIds) {
    const region = store.get(keys.metaKey(id))?.region;
    if (!region) problems.push(`G1: ${id} has no region`);
    else if (!store.has(keys.regionMemberKey(region, id))) problems.push(`G1: ${id} has no membership key in ${region}`);
    else if (!clusters.has(region)) problems.push(`G1: ${id} is in missing region ${region}`);
    else if (clusters.get(region).level !== 0) problems.push(`G1: ${id} is in meta-region ${region}`);
  }

  // G3: an empty cluster (other than the root region) has a pending structure task, unless it
  // is inside a suspended or expanding cluster: ending that schedules everything inside it.
  for (const cluster of clusters.keys()) {
    const waiting = chainOf(cluster).some((id) => clusters.get(id).suspended || clusters.get(id).expanding);
    if (cluster !== ROOT_REGION && !waiting && !regionMembers.has(cluster) && !store.has(keys.structureKey(cluster))) {
      problems.push(`G3: empty cluster ${cluster} has no structure task`);
    }
  }

  // A1: the aggregated counters of every cluster equal a recount over the objects in it.
  const recount = new Map([...clusters.keys()].map((id) => [id, { objects: 0, deferred: 0, explicit: {} }]));
  for (const id of objectIds) {
    const meta = store.get(keys.metaKey(id));
    if (!meta) continue;
    for (const cluster of chainOf(meta.region)) {
      const counts = recount.get(cluster);
      counts.objects++;
      if (meta.deferred) counts.deferred++;
      if (meta.cohort) counts.explicit[meta.cohort] = (counts.explicit[meta.cohort] ?? 0) + 1;
    }
  }
  for (const [id, counts] of recount) {
    const record = clusters.get(id);
    const explicit = (map) => JSON.stringify(Object.entries(map ?? {}).sort());
    if (record.objects !== counts.objects || record.deferred !== counts.deferred || explicit(record.explicit) !== explicit(counts.explicit)) {
      problems.push(`A1: counters of ${id} are ${JSON.stringify([record.objects, record.deferred, record.explicit])}, recount ${JSON.stringify([counts.objects, counts.deferred, counts.explicit])}`);
    }
  }

  // A2: T/ and P/ keys count the tree edges between clusters at every level where they differ.
  const treeCounts = new Map();
  for (const edge of store.keys("t/")) {
    const [, parent, child] = edge.split("/");
    const from = chainOf(store.get(keys.metaKey(parent))?.region);
    const to = chainOf(store.get(keys.metaKey(child))?.region);
    for (let level = 0; level < Math.min(from.length, to.length) && from[level] !== to[level]; level++) {
      const key = `${from[level]}/${to[level]}`;
      treeCounts.set(key, (treeCounts.get(key) ?? 0) + 1);
    }
  }
  for (const [key, count] of store.range("T/")) {
    const [, from, to] = key.split("/");
    if (treeCounts.get(`${from}/${to}`) !== count) problems.push(`A2: ${key} is ${count}, recount ${treeCounts.get(`${from}/${to}`) ?? 0}`);
    if (store.get(keys.treeInKey(to, from)) !== count) problems.push(`A2: ${key} has no matching P/ key`);
  }
  for (const [key, count] of treeCounts) {
    const [from, to] = key.split("/");
    if (!store.has(keys.treeOutKey(from, to))) problems.push(`A2: no T/${key} for ${count} tree edges`);
  }
  for (const key of store.keys("P/")) {
    const [, to, from] = key.split("/");
    if (!store.has(keys.treeOutKey(from, to))) problems.push(`A2: stale ${key}`);
  }

  // G2: every strong edge is covered by an entry flag at every level where the clusters of its
  // ends differ: the target's cluster at that level has a flag naming the source's cluster at
  // that level, or one of its containers.
  for (const source of objectIds) {
    const from = chainOf(store.get(keys.metaKey(source))?.region);
    for (const target of strongReferences(store.get(keys.objectKey(source)) ?? {}).keys()) {
      const to = chainOf(store.get(keys.metaKey(target))?.region);
      for (let level = 0; level < Math.min(from.length, to.length) && from[level] !== to[level]; level++) {
        if (!from.slice(level).some((cluster) => store.has(keys.flagKey(to[level], cluster)))) {
          problems.push(`G2: edge ${source} → ${target} from ${from[level]} into ${to[level]} (level ${level}) has no flag`);
        }
      }
    }
  }

  // G5: a flag whose source is a meta-region has its E/ mirror, and every mirror its flag.
  for (const key of store.keys("e/")) {
    const [, target, source] = key.split("/");
    if (clusters.get(source)?.level > 0 && !store.has(keys.mirrorKey(source, target))) problems.push(`G5: flag ${key} has no mirror`);
  }
  for (const key of store.keys("E/")) {
    const [, source, target] = key.split("/");
    if (!store.has(keys.flagKey(target, source))) problems.push(`G5: stale mirror ${key}`);
  }

  // W2: an object with more than one strong referrer has the shared bit.
  const referrerCount = new Map();
  for (const id of objectIds) {
    for (const target of strongReferences(store.get(keys.objectKey(id)) ?? {}).keys()) {
      referrerCount.set(target, (referrerCount.get(target) ?? 0) + 1);
    }
  }
  for (const [id, count] of referrerCount) {
    if (count > 1 && !store.get(keys.metaKey(id))?.shared) problems.push(`W2: ${id} has ${count} referrers but no shared bit`);
  }

  // Membership keys belong to unstable objects.
  for (const key of store.keys("C/")) {
    const [, cohortId, id] = key.split("/");
    const meta = store.get(keys.metaKey(id));
    if (!meta || meta.cohort !== cohortId) problems.push(`stale membership key ${key}`);
  }

  // Suspension (§8, invariants U1–U3, U5), at every level.
  const suspendedIn = new Map(); // cluster → root cohort
  for (const [region, record] of clusters) {
    if (!record.suspended) continue;
    const root = findCohort(record.suspended.cohort);
    if (root === null) {
      problems.push(`U1: cluster ${region} is suspended in missing cohort ${record.suspended.cohort}`);
      continue;
    }
    suspendedIn.set(region, root);
    if (!store.has(keys.suspendedKey(record.suspended.cohort, region))) problems.push(`U1: suspended cluster ${region} has no S/ key`);
    if (chainOf(store.get(keys.metaKey(ROOT))?.region).includes(region)) problems.push(`U1: cluster ${region}, which holds ROOT, is suspended`);
    if (chainOf(region).slice(1).some((id) => suspendedIn.has(id) || clusters.get(id).suspended)) problems.push(`U5: suspended cluster ${region} is inside another`);
  }
  // The suspended cluster covering a region, or undefined.
  const coveringSuspension = (region) => chainOf(region).find((id) => suspendedIn.has(id));
  for (const key of store.keys("S/")) {
    const [, cohortId, region] = key.split("/");
    if (store.get(keys.regionKey(region))?.suspended?.cohort !== cohortId) problems.push(`U1: stale suspension key ${key}`);
  }
  const inCluster = (id, cluster) => chainOf(store.get(keys.metaKey(id))?.region).includes(cluster);
  for (const id of objectIds) {
    const meta = store.get(keys.metaKey(id));
    const region = meta && coveringSuspension(meta.region);
    if (region === undefined) continue;
    const root = suspendedIn.get(region);
    if (meta.cohort !== null) {
      if (findCohort(meta.cohort) !== root) problems.push(`U2: ${id} in cluster ${region}, suspended in ${root}, is in cohort ${meta.cohort}`);
    } else if (meta.deferred || meta.treeParent === null || !inCluster(meta.treeParent, region)) {
      problems.push(`U2: implicit member ${id} of suspended ${region} does not hang from inside it`);
    }
  }
  for (const edge of treeEdges) {
    const [parent, child] = edge.split("/");
    const parentRegion = store.get(keys.metaKey(parent))?.region;
    const region = parentRegion && coveringSuspension(parentRegion);
    if (region !== undefined && clusters.get(region).suspended.marked && !inCluster(child, region)) {
      problems.push(`U3: marked suspended ${region} has the tree exit ${edge}`);
    }
  }
  if (quiescent && suspendedIn.size > 0) problems.push(`${suspendedIn.size} clusters are still suspended`);

  // Invariant M1: every unmarked unstable object (one that still has tree children) is on its
  // root cohort's mark list, unless it is an anchor of a region suspended in that cohort: the
  // region item stands for it.
  const hasTreeChildren = new Set([...treeEdges].map((edge) => edge.split("/")[0]));
  for (const id of hasTreeChildren) {
    const meta = store.get(keys.metaKey(id));
    if (!meta || meta.cohort === null) continue;
    const root = cohorts.get(findCohort(meta.cohort));
    if (root && suspendedIn.get(coveringSuspension(meta.region)) === root.id) continue;
    if (root && !root.mark.includes(id)) problems.push(`M1: unmarked ${id} is not on the mark list of ${root.id}`);
  }

  // Invariant M2: an explicitly unstable object with tree children has its check pending, unless
  // it is an anchor of a region suspended in its cohort. Rescues skip unmarked objects and rely
  // on that check (§7.3).
  for (const id of hasTreeChildren) {
    const meta = store.get(keys.metaKey(id));
    if (!meta || meta.cohort === null) continue;
    const root = cohorts.get(findCohort(meta.cohort));
    if (root && suspendedIn.get(coveringSuspension(meta.region)) === root.id) continue;
    if (root && !root.check.includes(id)) problems.push(`M2: unmarked ${id} is not on the check list of ${root.id}`);
  }

  // Invariant T4: following tree parents from any object terminates, at ROOT, at an unmarked
  // unstable object, or at a deferred object. When idle (quiescent), it must end at ROOT.
  for (const id of objectIds) {
    const seen = new Set();
    let current = id;
    while (current !== ROOT) {
      if (seen.has(current)) {
        problems.push(`T4: tree cycle through ${id}`);
        break;
      }
      seen.add(current);
      const meta = store.get(keys.metaKey(current));
      if (!meta) break; // reported above
      if (meta.treeParent !== null) {
        current = meta.treeParent;
        continue;
      }
      if (quiescent) {
        problems.push(`T4: ${id} does not reach ROOT through tree parents (stops at ${current})`);
      } else if (meta.cohort === null && !meta.deferred) {
        problems.push(`T4: ${id} has a tree path ending at stable ${current}, which has no tree parent`);
      } else if (current !== id && !hasTreeChildren.has(current)) {
        problems.push(`T4: ${id} has a tree path ending at marked ${current}`);
      }
      break;
    }
  }

  // Invariant M3: a stable object that references an unstable one has its expansion pending, or
  // the target has its check pending (for an implicit member: its region's mark or check item).
  // Otherwise nothing would ever find that the target is referenced from outside its cohort.
  const stateOf = (id) => {
    const meta = store.get(keys.metaKey(id));
    if (!meta) return null;
    if (meta.cohort !== null) return findCohort(meta.cohort);
    return suspendedIn.get(coveringSuspension(meta.region)) ?? STABLE;
  };
  const expanding = new Set();
  for (const cohort of cohorts.values()) for (const item of cohort.expand) expanding.add(item);
  for (const source of objectIds) {
    if (stateOf(source) !== STABLE) continue;
    const sourceRegion = store.get(keys.metaKey(source))?.region;
    if (expanding.has(source) || chainOf(sourceRegion).some((id) => expanding.has(`@${id}`))) continue;
    for (const target of strongReferences(store.get(keys.objectKey(source)) ?? {}).keys()) {
      const targetState = stateOf(target);
      if (targetState === null || targetState === STABLE) continue;
      const cohort = cohorts.get(targetState);
      const meta = store.get(keys.metaKey(target));
      const pending = meta.cohort !== null
        ? cohort.check.includes(target)
        : cohort.check.includes(`@${coveringSuspension(meta.region)}`) || cohort.mark.includes(`@${coveringSuspension(meta.region)}`);
      if (!pending) problems.push(`M3: stable ${source} references ${target}, unstable in ${targetState}, with no check or expansion pending`);
    }
  }

  if (quiescent && cohorts.size > 0) problems.push(`${cohorts.size} cohort records remain`);

  return problems;
}

export { STABLE };

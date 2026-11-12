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

  // G1: every object is in exactly one region, with a membership key and a region record.
  const regionMembers = new Map();
  for (const key of store.keys("m/")) {
    const [, region, id] = key.split("/");
    if (store.get(keys.metaKey(id))?.region !== region) problems.push(`G1: stale membership key ${key}`);
    if (!regionMembers.has(region)) regionMembers.set(region, 0);
    regionMembers.set(region, regionMembers.get(region) + 1);
  }
  for (const id of objectIds) {
    const region = store.get(keys.metaKey(id))?.region;
    if (!region) problems.push(`G1: ${id} has no region`);
    else if (!store.has(keys.regionMemberKey(region, id))) problems.push(`G1: ${id} has no membership key in ${region}`);
    else if (!store.has(keys.regionKey(region))) problems.push(`G1: ${id} is in missing region ${region}`);
  }

  // G3: an empty region (other than the root region) has a pending structure task.
  for (const key of store.keys("r/")) {
    const region = key.slice(2);
    if (region !== ROOT_REGION && !regionMembers.has(region) && !store.has(keys.structureKey(region))) {
      problems.push(`G3: empty region ${region} has no structure task`);
    }
  }

  // G2: every cross-region strong edge is covered by an entry flag.
  for (const source of objectIds) {
    const sourceRegion = store.get(keys.metaKey(source))?.region;
    for (const target of strongReferences(store.get(keys.objectKey(source)) ?? {}).keys()) {
      const targetRegion = store.get(keys.metaKey(target))?.region;
      if (sourceRegion && targetRegion && sourceRegion !== targetRegion && !store.has(keys.flagKey(targetRegion, sourceRegion))) {
        problems.push(`G2: edge ${source} → ${target} from ${sourceRegion} into ${targetRegion} has no flag`);
      }
    }
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

  // Suspension (§8, invariants U1–U3).
  const suspendedIn = new Map(); // region → root cohort
  for (const [key, record] of store.range("r/")) {
    if (!record.suspended) continue;
    const region = key.slice(2);
    const root = findCohort(record.suspended.cohort);
    if (root === null) {
      problems.push(`U1: region ${region} is suspended in missing cohort ${record.suspended.cohort}`);
      continue;
    }
    suspendedIn.set(region, root);
    if (!store.has(keys.suspendedKey(record.suspended.cohort, region))) problems.push(`U1: suspended region ${region} has no S/ key`);
  }
  for (const key of store.keys("S/")) {
    const [, cohortId, region] = key.split("/");
    if (store.get(keys.regionKey(region))?.suspended?.cohort !== cohortId) problems.push(`U1: stale suspension key ${key}`);
  }
  const membersOf = new Map();
  for (const key of store.keys("m/")) {
    const [, region, id] = key.split("/");
    if (!membersOf.has(region)) membersOf.set(region, []);
    membersOf.get(region).push(id);
  }
  for (const [region, root] of suspendedIn) {
    const marked = store.get(keys.regionKey(region)).suspended.marked;
    const members = new Set(membersOf.get(region) ?? []);
    for (const id of members) {
      const meta = store.get(keys.metaKey(id));
      if (meta.cohort !== null) {
        if (findCohort(meta.cohort) !== root) problems.push(`U2: ${id} in region ${region}, suspended in ${root}, is in cohort ${meta.cohort}`);
      } else if (meta.deferred || meta.treeParent === null || !members.has(meta.treeParent)) {
        problems.push(`U2: implicit member ${id} of suspended ${region} does not hang from inside it`);
      }
      if (marked) {
        for (const edge of treeEdges) {
          const [parent, child] = edge.split("/");
          if (parent === id && !members.has(child)) problems.push(`U3: marked suspended ${region} has the tree exit ${edge}`);
        }
      }
    }
  }
  if (quiescent && suspendedIn.size > 0) problems.push(`${suspendedIn.size} regions are still suspended`);

  // Invariant M1: every unmarked unstable object (one that still has tree children) is on its
  // root cohort's mark list, unless it is an anchor of a region suspended in that cohort: the
  // region item stands for it.
  const hasTreeChildren = new Set([...treeEdges].map((edge) => edge.split("/")[0]));
  for (const id of hasTreeChildren) {
    const meta = store.get(keys.metaKey(id));
    if (!meta || meta.cohort === null) continue;
    const root = cohorts.get(findCohort(meta.cohort));
    if (root && suspendedIn.get(meta.region) === root.id) continue;
    if (root && !root.mark.includes(id)) problems.push(`M1: unmarked ${id} is not on the mark list of ${root.id}`);
  }

  // Invariant M2: an explicitly unstable object with tree children has its check pending, unless
  // it is an anchor of a region suspended in its cohort. Rescues skip unmarked objects and rely
  // on that check (§7.3).
  for (const id of hasTreeChildren) {
    const meta = store.get(keys.metaKey(id));
    if (!meta || meta.cohort === null) continue;
    const root = cohorts.get(findCohort(meta.cohort));
    if (root && suspendedIn.get(meta.region) === root.id) continue;
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
    return suspendedIn.get(meta.region) ?? STABLE;
  };
  const expanding = new Set();
  for (const cohort of cohorts.values()) for (const item of cohort.expand) expanding.add(item);
  for (const source of objectIds) {
    if (stateOf(source) !== STABLE) continue;
    const sourceRegion = store.get(keys.metaKey(source))?.region;
    if (expanding.has(source) || expanding.has(`@${sourceRegion}`)) continue;
    for (const target of strongReferences(store.get(keys.objectKey(source)) ?? {}).keys()) {
      const targetState = stateOf(target);
      if (targetState === null || targetState === STABLE) continue;
      const cohort = cohorts.get(targetState);
      const meta = store.get(keys.metaKey(target));
      const pending = meta.cohort !== null
        ? cohort.check.includes(target)
        : cohort.check.includes(`@${meta.region}`) || cohort.mark.includes(`@${meta.region}`);
      if (!pending) problems.push(`M3: stable ${source} references ${target}, unstable in ${targetState}, with no check or expansion pending`);
    }
  }

  if (quiescent && cohorts.size > 0) problems.push(`${cohorts.size} cohort records remain`);

  return problems;
}

export { STABLE };

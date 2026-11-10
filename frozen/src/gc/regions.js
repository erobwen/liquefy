/**
 * Structure tasks for level-0 regions (documents/persistent-garbage-collection.md §6.3–6.5):
 * split a region that is too heavy, merge one that is too light, delete one that is empty.
 *
 * A structure task runs as one collector step. It only moves membership and maintains entry
 * flags (invariants G1, G2, G4): it never changes a tree parent, a cohort or a deferral.
 */

import { ROOT_REGION, keys } from "./GcState.js";
import { strongReferences } from "../model.js";

/** Re-evaluates a region whose membership or edges changed (invariant G3). */
export function runStructureTask(gc, region) {
  gc.tx.delete(keys.structureKey(region));
  if (!gc.regionExists(region)) return "gone";
  const members = gc.regionMembers(region);
  if (members.length === 0 && region !== ROOT_REGION) {
    deleteRegion(gc, region);
    return "deleted";
  }
  const weight = gc.regionWeight(region);
  const cap = gc.options.regionCap;
  if (weight > cap) return split(gc, region) ? "split" : "unsplittable";
  if (weight < cap / 4 && region !== ROOT_REGION) return merge(gc, region, weight) ? "merged" : "kept";
  return "kept";
}

function deleteRegion(gc, region) {
  gc.tx.delete(keys.regionKey(region));
  for (const source of gc.flagSources(region)) gc.tx.delete(keys.flagKey(region, source));
  // Flags elsewhere that name this region are now stale; referrer lookups delete them (G2).
}

/** The members of a region with their records' edges, weights and in-region tree structure. */
function loadRegion(gc, region) {
  const members = gc.regionMembers(region);
  const memberSet = new Set(members);
  const targets = new Map(); // id → strong targets
  const weight = new Map();
  const children = new Map(members.map((id) => [id, []]));
  const anchors = [];
  for (const id of members) {
    const outgoing = [...strongReferences(gc.record(id)).keys()];
    targets.set(id, outgoing);
    weight.set(id, 1 + outgoing.length);
    const parent = gc.meta(id).treeParent;
    if (parent !== null && memberSet.has(parent)) children.get(parent).push(id);
    else anchors.push(id); // tree parent outside the region, or none (unstable, deferred, ROOT)
  }
  return { members, memberSet, targets, weight, children, anchors };
}

/**
 * Splits a region at the centroid of its internal spanning forest (§6.4): moves a group of
 * whole subtrees, between a third and two thirds of the weight, into a new region. Returns
 * false if no such group exists (a single object heavier than the cap).
 */
function split(gc, region) {
  const loaded = loadRegion(gc, region);
  const { members, children, anchors, weight } = loaded;

  // Subtree weights, iteratively (post-order over the forest rooted at the anchors).
  const subtree = new Map();
  const order = [];
  const stack = [...anchors];
  while (stack.length > 0) {
    const id = stack.pop();
    order.push(id);
    stack.push(...children.get(id));
  }
  if (order.length !== members.length) throw new Error(`Region ${region}: internal tree does not cover its members`);
  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i];
    subtree.set(id, weight.get(id) + children.get(id).reduce((sum, child) => sum + subtree.get(child), 0));
  }
  const total = anchors.reduce((sum, id) => sum + subtree.get(id), 0);

  // Walk down from a virtual root to the centroid: the node whose child subtrees are all ≤ half.
  let kids = anchors;
  for (;;) {
    const heavy = kids.find((id) => subtree.get(id) > total / 2);
    if (heavy === undefined) break;
    kids = children.get(heavy);
  }

  // A group of the centroid's child subtrees, between a third and two thirds of the weight.
  const sorted = [...kids].sort((a, b) => subtree.get(b) - subtree.get(a));
  const group = [];
  let groupWeight = 0;
  for (const id of sorted) {
    if (groupWeight >= total / 3) break;
    group.push(id);
    groupWeight += subtree.get(id);
    if (subtree.get(id) >= total / 3) break; // one big enough child alone
  }
  if (group.length === 0 || groupWeight >= total) return false;

  const moved = new Set();
  const collect = [...group];
  while (collect.length > 0) {
    const id = collect.pop();
    moved.add(id);
    collect.push(...children.get(id));
  }

  moveMembers(gc, loaded, moved, gc.newRegion(), region);
  return true;
}

/**
 * Merges a light region into the region its anchors hang from, if the result stays at most
 * two thirds of the cap (§6.5). Returns false if there is no such region or no room.
 */
function merge(gc, region, weight) {
  const loaded = loadRegion(gc, region);
  const parentRegion = loaded.anchors
    .map((id) => gc.meta(id).treeParent)
    .filter((parent) => parent !== null && gc.meta(parent))
    .map((parent) => gc.regionOf(parent))
    .find((candidate) => candidate !== region && gc.regionExists(candidate));
  if (parentRegion === undefined) return false;
  if (weight + gc.regionWeight(parentRegion) > (2 * gc.options.regionCap) / 3) return false;

  moveMembers(gc, loaded, new Set(loaded.members), parentRegion, region);
  deleteRegion(gc, region);
  return true;
}

/**
 * Moves `moved` (a subset of the loaded region `from`) into region `to`, keeping flag coverage
 * (invariant G2):
 *   - target side: edges into the moved objects from other regions were covered by flags on
 *     `from`; `to` gets copies of all of them (conservative);
 *   - edges between the moved objects and the rest of `from` become cross-region;
 *   - the moved objects' edges to other regions now come from `to`.
 */
function moveMembers(gc, loaded, moved, to, from) {
  for (const source of gc.flagSources(from)) gc.ensureFlag(to, source);

  for (const id of moved) gc.setRegion(id, to);

  for (const id of loaded.members) {
    for (const target of loaded.targets.get(id)) {
      const targetMeta = gc.meta(target);
      if (!targetMeta) continue;
      gc.ensureFlag(targetMeta.region, gc.regionOf(id));
    }
  }
}

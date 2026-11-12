/**
 * What the visualizer shows at one frame, computed from the store contents alone.
 *
 * Everything here reads the store's keys (frozen/src/gc/GcState.js documents them), never the
 * collector, so the same function works for a recorded timeline and, later, for a live
 * database that sends its store changes.
 */

const ROOT = "root";

/** References inside a field value, with the path they were found at. */
function references(fields) {
  const found = [];
  const visit = (value, path) => {
    if (value === null || typeof value !== "object") return;
    if (typeof value.$ref === "string") found.push({ target: value.$ref, kind: "strong", path });
    else if (typeof value.$weak === "string") found.push({ target: value.$weak, kind: "weak", path });
    else if (Array.isArray(value)) value.forEach((item, i) => visit(item, `${path}[${i}]`));
    else for (const [key, item] of Object.entries(value)) visit(item, path ? `${path}.${key}` : key);
  };
  visit(fields, "");
  return found;
}

/** A short text for an object: its first plain string or number field. */
function caption(fields) {
  for (const key of ["title", "text", "name", "value"]) {
    if (typeof fields[key] === "string" || typeof fields[key] === "number") return String(fields[key]);
  }
  return "";
}

const after = (key, prefix) => key.slice(prefix.length);

function entries(state, prefix) {
  const result = [];
  for (const [key, value] of state) if (key.startsWith(prefix)) result.push([after(key, prefix), value]);
  return result;
}

/** The cohort records, and a function from any cohort id to its root (merged-into) cohort. */
function cohortsOf(state) {
  const cohorts = new Map(entries(state, "c/").map(([id, cohort]) => [id, cohort]));
  const rootOf = (id) => {
    let cohort = cohorts.get(id);
    if (!cohort) return id;
    while (cohort.mergedInto && cohorts.has(cohort.mergedInto)) cohort = cohorts.get(cohort.mergedInto);
    return cohort.id;
  };
  return { cohorts, rootOf };
}

/** Suspended clusters (regions or meta-regions): id → { cohort (root), marked }. */
function suspensionsOf(state, rootOf) {
  const suspended = new Map();
  for (const [id, record] of entries(state, "r/")) {
    if (record.suspended) suspended.set(id, { cohort: rootOf(record.suspended.cohort), marked: record.suspended.marked });
  }
  return suspended;
}

/**
 * The suspended cluster covering a region: the region itself or a meta-region above it, or
 * null (design §7.1: an object is implicitly unstable if any cluster in its chain is suspended).
 */
function coveringOf(state, suspended) {
  return (region) => {
    for (let id = region; id; id = state.get(`r/${id}`)?.container ?? null) if (suspended.has(id)) return id;
    return null;
  };
}

/** "region" for a level-0 cluster, "meta-region" above. */
function kindOf(state, id) {
  return (state.get(`r/${id}`)?.level ?? 0) > 0 ? "meta-region" : "region";
}

/**
 * The objects of a store state, with their GC metadata and a display state:
 *   root, stable, deferred, held;
 *   unstable  explicitly unstable, not yet marked: it still has tree children;
 *   marked    explicitly unstable, marked: no tree children;
 *   suspended implicitly unstable: its region, or a meta-region above it, is suspended in a
 *             cohort (design §8.1).
 */
function objectsOf(state) {
  const { rootOf } = cohortsOf(state);
  const suspended = suspensionsOf(state, rootOf);
  const covering = coveringOf(state, suspended);
  const parents = new Set();
  for (const key of state.keys()) if (key.startsWith("t/")) parents.add(key.split("/")[1]);
  const objects = new Map();
  for (const [id, fields] of entries(state, "o/")) {
    const meta = state.get(`g/${id}`) ?? {};
    const cover = meta.cohort ? null : covering(meta.region);
    const implicit = cover !== null;
    const cohort = meta.cohort ? rootOf(meta.cohort) : implicit ? suspended.get(cover).cohort : null;
    let display = "stable";
    if (id === ROOT) display = "root";
    else if (implicit) display = "suspended";
    else if (cohort !== null) display = parents.has(id) ? "unstable" : "marked";
    else if (meta.deferred) display = meta.deferred.kind === "ms" ? "held" : "deferred";
    objects.set(id, {
      id,
      fields,
      caption: caption(fields),
      region: meta.region ?? null,
      treeParent: meta.treeParent ?? null,
      cohort,
      shared: !!meta.shared,
      deferred: meta.deferred ?? null,
      implicit,
      display,
    });
  }
  return objects;
}

function edgesOf(objects) {
  const edges = [];
  for (const object of objects.values()) {
    const byTarget = new Map();
    for (const { target, kind, path } of references(object.fields)) {
      if (!objects.has(target)) continue; // a dangling weak reference
      const key = `${kind}:${target}`;
      if (!byTarget.has(key)) byTarget.set(key, { target, kind, paths: [] });
      byTarget.get(key).paths.push(path);
    }
    for (const { target, kind, paths } of byTarget.values()) {
      const tree = kind === "strong" && objects.get(target).treeParent === object.id;
      edges.push({
        id: `${object.id}>${kind}>${target}`,
        source: object.id,
        target,
        kind: tree ? "tree" : kind,
        label: paths.join(", "),
      });
    }
  }
  return edges;
}

const STRUCTURE_OUTCOMES = {
  split: "split: a group of subtrees (or of member clusters) moved to a new cluster in the same container",
  merged: "light, so it merged into the cluster it hangs from",
  "level added": "the top level has more clusters than the cluster cap, so a meta-region one level up now holds them all",
  "level removed": "the top level is a single meta-region, so it was dissolved and its members are the top level",
  "re-homed": "re-homed: the part of it that hangs from another cluster moved there, so that each cluster stays one branch of the spanning tree",
  "at home": "checked where it hangs from: all of it hangs from one place (or what does not cannot move now)",
  "re-home skipped": "re-home skipped: it is inside a suspended or expanding cluster",
  suspended: "skipped: it is inside a suspended cluster",
  expanding: "skipped: it is inside a resumed cluster whose expansion is pending",
  deleted: "empty, so it was deleted",
  kept: "within bounds, kept as it is",
  unsplittable: "over the cap, but no group of subtrees has between a third and two thirds of its weight",
  gone: "already gone",
};

/** One sentence for what a frame did. */
function summarize(frame, state, previous) {
  const deleted = frame.writes.filter(([key, value]) => key.startsWith("o/") && value === null).length;
  switch (frame.kind) {
    case "start":
    case "transaction":
      return frame.label;
    case "deferral": {
      if (frame.outcome === "swapped") return `The deferral of ${frame.id} is due. Quick swap found another verified referrer: it is re-parented.`;
      const cohort = state.get(`g/${frame.id}`)?.cohort;
      return `The deferral of ${frame.id} is due. No verified referrer, so it starts cohort ${cohort ?? "?"}.`;
    }
    case "structure":
      return `Structure task of ${kindOf(state.has(`r/${frame.region}`) ? state : previous, frame.region)} ${frame.region}: ${STRUCTURE_OUTCOMES[frame.outcome] ?? frame.outcome}.`;
    case "expand":
      if (frame.region) return `Expand ${kindOf(state, frame.region)} ${frame.region} (${frame.cohort}): it was resumed, so every object in it follows its references and rescues the unstable objects it finds.`;
      return `Expand ${frame.ids[0]} (${frame.cohort}): it is stable again, so the unstable objects it references are rescued.`;
    case "mark":
      if (frame.region) {
        const meta = kindOf(state, frame.region) === "meta-region";
        return `Mark ${kindOf(state, frame.region)} ${frame.region} (${frame.cohort}): the tree edges that leave it are cut, as marking its objects one by one would have done. The edges inside it stay.${meta ? " They are found from its tree-edge counts, descending only into members with edges that leave it." : ""}`;
      }
      if (frame.suspended) {
        if (kindOf(state, frame.suspended) === "meta-region") return `Mark ${frame.ids[0]} (${frame.cohort}): everything in the meta-region ${frame.suspended} around it is condemned to this cohort (its counters say so: no tree edge enters it, nothing in it is deferred or in another cohort), so the whole meta-region is suspended at once, with every region in it.`;
        return `Mark ${frame.ids[0]} (${frame.cohort}): everything in its region ${frame.suspended} is condemned to this cohort, so the whole region is suspended at once instead of marked object by object.`;
      }
      return `Mark ${frame.ids[0]} (${frame.cohort}): its tree children become unstable, unless a shared child finds a replacement parent.`;
    case "check": {
      const items = [];
      if (frame.ids.length) items.push(`${frame.ids.length} object${frame.ids.length === 1 ? "" : "s"}`);
      if (frame.regions?.length) items.push(`suspended cluster${frame.regions.length === 1 ? "" : "s"} ${frame.regions.join(", ")}`);
      const what = `Check ${items.join(" and ")} of ${frame.cohort}: look for a stable referrer of each, in its region and the regions flagged on it (for a suspended cluster: only from outside it, through the flags at its own level).`;
      if (!frame.reclaimed) return what;
      return `${what} None found and nothing left to do, so the cohort is closed under "is referenced by": ${reclaimedText(deleted, frame)} in the same step.`;
    }
    case "reclaim":
      return `Reclaim ${frame.cohort}: closed under "is referenced by", so ${reclaimedText(deleted, frame)}.`;
    default:
      return frame.label ?? frame.kind;
  }
}

function reclaimedText(deleted, frame) {
  const objects = `its ${deleted} object${deleted === 1 ? " is" : "s are"} reclaimed`;
  const regions = frame.regions?.length ? `, with cluster${frame.regions.length === 1 ? "" : "s"} ${frame.regions.join(", ")} deleted whole` : "";
  return objects + regions;
}

/** What changed between two states, as short sentences. */
function changesBetween(previousObjects, objects, previous, state) {
  const changes = [];
  const moves = new Map();
  for (const [id, now] of objects) {
    const before = previousObjects.get(id);
    if (!before) {
      changes.push(`${id} created in ${now.region}${now.treeParent ? `, tree parent ${now.treeParent}` : ""}`);
      continue;
    }
    // Implicit members change with their region; that is reported per region below.
    if (before.implicit || now.implicit) {
      if (before.implicit && now.cohort === null && before.treeParent !== now.treeParent) changes.push(`${id} re-parented from ${before.treeParent} to ${now.treeParent}`);
      if (before.implicit && !now.implicit && now.cohort !== null) changes.push(`${id} became unstable in ${now.cohort}`);
      continue;
    }
    if (before.cohort === null && now.cohort !== null) changes.push(`${id} became unstable in ${now.cohort}`);
    if (before.cohort !== null && now.cohort === null) changes.push(`${id} rescued, tree parent ${now.treeParent}`);
    if (before.cohort !== null && now.cohort !== null && before.cohort !== now.cohort) changes.push(`${id} moved to cohort ${now.cohort} (merge)`);
    if (before.cohort !== null && now.cohort !== null && before.display === "unstable" && now.display === "marked") changes.push(`${id} marked`);
    if (!before.deferred && now.deferred) changes.push(`${id} deferred until ${deadline(now.deferred)}`);
    if (before.deferred && !now.deferred && now.treeParent) changes.push(`${id}'s deferral ended, tree parent ${now.treeParent}`);
    if (before.treeParent && now.treeParent && before.treeParent !== now.treeParent) changes.push(`${id} re-parented from ${before.treeParent} to ${now.treeParent}`);
    if (!before.shared && now.shared) changes.push(`${id} is now shared (it has had two referrers)`);
    if (before.region !== now.region) {
      const key = `${before.region} → ${now.region}`;
      moves.set(key, (moves.get(key) ?? 0) + 1);
    }
  }
  for (const [key, count] of moves) changes.push(`${count} object${count === 1 ? "" : "s"} moved region ${key}`);
  for (const [key, record] of state) {
    if (!key.startsWith("r/")) continue;
    const region = after(key, "r/");
    const was = previous.get(key)?.suspended ?? null;
    const is = record.suspended ?? null;
    const kind = kindOf(state, region);
    const members = record.objects ?? [...objects.values()].filter((o) => o.region === region).length;
    if (!was && is) changes.push(`${kind} ${region} suspended in ${is.cohort}: its ${members} objects are unstable as a unit`);
    if (was && is && !was.marked && is.marked) changes.push(`${kind} ${region}: tree edges leaving it cut`);
    if (was && !is && !record.suspended) {
      // A resume marks the cluster as expanding (GcState.resume); a materialize sets
      // materializedIn; a cluster suspended around this one takes its suspension over.
      if (record.expanding) changes.push(`${kind} ${region} resumed: its anchor is rescued, and its internal tree is valid again`);
      else if (record.materializedIn && record.materializedIn !== previous.get(key)?.materializedIn) changes.push(`${kind} ${region} materialized: its objects are marked object by object from now on`);
      else changes.push(`${kind} ${region}: its suspension is now part of the cluster suspended around it`);
    }
    const container = record.container ?? null;
    const wasContainer = previous.get(key)?.container ?? null;
    if (previous.has(key) && container !== wasContainer) changes.push(`${kind} ${region} moved ${wasContainer ? `from ${wasContainer} ` : ""}${container ? `into ${container}` : "to the top level"}`);
  }
  for (const id of previousObjects.keys()) if (!objects.has(id)) changes.push(`${id} reclaimed`);
  for (const key of state.keys()) {
    if (key.startsWith("r/") && !previous.has(key)) {
      const record = state.get(key);
      changes.push(record.level > 0 ? `meta-region ${after(key, "r/")} created at level ${record.level}` : `region ${after(key, "r/")} created`);
    }
    if (key.startsWith("e/") && !previous.has(key)) changes.push(`flag ${flagText(key)} added`);
  }
  for (const key of previous.keys()) {
    if (key.startsWith("r/") && !state.has(key)) changes.push(`${kindOf(previous, after(key, "r/"))} ${after(key, "r/")} deleted`);
    if (key.startsWith("e/") && !state.has(key)) changes.push(`flag ${flagText(key)} removed`);
  }
  return changes;
}

function flagText(key) {
  const [, target, source] = key.split("/");
  return `${source} → ${target}`;
}

export function deadline(deferred) {
  return deferred.kind === "ms" ? `${(deferred.at / 1000).toFixed(1)} s` : `transaction ${deferred.at}`;
}

/**
 * Describes the store at a frame.
 *
 * @param state     the store after the frame (Map key → value)
 * @param previous  the store before it (Map), for highlights and changes
 * @param frame     the frame, or null
 */
export function describe(state, previous = new Map(), frame = null) {
  const objects = objectsOf(state);
  const previousObjects = objectsOf(previous);
  const { cohorts, rootOf } = cohortsOf(state);

  // Objects deleted in this frame are shown as ghosts, as they were before.
  const reclaimed = [...previousObjects.keys()].filter((id) => !objects.has(id));
  const shown = new Map(objects);
  for (const id of reclaimed) shown.set(id, { ...previousObjects.get(id), display: "reclaimed" });

  const suspended = suspensionsOf(state, rootOf);
  // Clusters at every level: regions (level 0) hold objects, meta-regions hold clusters.
  const regions = new Map();
  for (const [id, record] of entries(state, "r/")) {
    regions.set(id, {
      id,
      level: record.level ?? 0,
      container: record.container ?? null,
      members: 0,
      objects: record.objects ?? 0,
      pending: state.has(`s/${id}`),
      ghost: false,
      suspended: suspended.get(id) ?? null,
    });
  }
  for (const object of shown.values()) {
    if (!object.region) continue;
    if (!regions.has(object.region)) {
      regions.set(object.region, { id: object.region, level: 0, container: null, members: 0, objects: 0, pending: false, ghost: true, suspended: null });
    }
    if (object.display !== "reclaimed") regions.get(object.region).members++;
  }
  for (const region of regions.values()) {
    if (region.level > 0) region.members = [...regions.values()].filter((other) => other.container === region.id).length;
  }

  const flags = entries(state, "e/").map(([key]) => {
    const [target, source] = key.split("/");
    return { id: `flag:${source}>${target}`, source, target, level: state.get(`r/${target}`)?.level ?? 0 };
  }).filter((flag) => regions.has(flag.source) && regions.has(flag.target));

  const activeCohorts = [...cohorts.values()]
    .filter((cohort) => !cohort.mergedInto)
    .map((cohort) => ({
      id: cohort.id,
      state: cohort.state,
      expand: cohort.expand,
      mark: cohort.mark,
      check: cohort.check,
      absorbed: cohort.absorbed,
      members: [...objects.values()].filter((object) => object.cohort === cohort.id).map((object) => object.id),
      regions: [...suspended].filter(([, s]) => s.cohort === cohort.id).map(([id]) => id),
    }));

  const deferrals = [...objects.values()]
    .filter((object) => object.deferred)
    .map((object) => ({ id: object.id, kind: object.deferred.kind, deadline: deadline(object.deferred) }));

  const written = new Set();
  const subject = new Set(frame?.ids ?? (frame?.id ? [frame.id] : []));
  for (const [key] of frame?.writes ?? []) {
    if (key.startsWith("o/") || key.startsWith("g/")) written.add(key.slice(2));
  }

  return {
    objects: [...shown.values()],
    edges: edgesOf(shown),
    regions: [...regions.values()],
    flags,
    cohorts: activeCohorts,
    deferrals,
    structureTasks: entries(state, "s/").map(([id]) => id),
    rehomeTasks: entries(state, "x/").map(([id]) => id),
    clock: state.get("meta/clock") ?? 0,
    highlight: {
      subject,
      read: new Set(frame?.reads ?? []),
      written,
      region: frame?.region ?? frame?.suspended ?? null,
    },
    summary: frame ? summarize(frame, state, previous) : "",
    caption: frame?.caption ?? null,
    changes: frame ? changesBetween(previousObjects, objects, previous, state) : [],
    rootOf,
  };
}

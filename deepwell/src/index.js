import getWorld from "@liquefy/cascade.reactive";
import { createDataModel } from "./dataModel.js";
import { createWellHost } from "./well.js";

export { createDataModel } from "./dataModel.js";
export { DataModelError, sameValue, ARRAY_CLASS, OBJECT_CLASS } from "./values.js";
export { Selection } from "./ruleLoad.js";
export { Well } from "./well.js";

/**
 * Deepwell's default world, and its data model. The world is made with an event hook that
 * hands Cascade's change events to every open store, which is how a property write becomes a
 * write to the database (design section 4).
 *
 * The data model alone, without Aquifer, is `@liquefy/deepwell/dataModel`, for code that runs
 * on clients too.
 */
let host = null;
export const world = getWorld({ name: "deepwell", onEventGlobal: (event) => host && host.dispatch(event) });
export const model = createDataModel(world);
host = createWellHost(model);

/**
 * Opens a store: `open({ store, classes })`, where `store` is Aquifer's MemoryStore or
 * LmdbStore, and `classes` the classes to register, by name. Returns a Well, whose `root` is
 * the database's root object.
 */
export const open = host.open;

export const { transaction, repeat, ensure, meta, untrackedMeta, innerMeta } = world;

/**
 * Holds what `selector` selects from `start` in memory, pinned, and runs `action` once it is:
 * `load(document, selectDocument, (selection) => {...})`. A selector is a table of local rules
 * by class name, or a function that fills the whole selection. Returns a handle with
 * `selection`, `loaded` and `release()` (design section 3).
 */
export function load(start, selector, ...rest) {
  const info = model.infoOf(start);
  if (!info || !info.well) throw new Error("load() starts from a stored object.");
  return info.well.load(start, selector, ...rest);
}

/**
 * The base class of indexes: a B-tree of persistent objects, ordered by `keyOf(member)`
 * (documents/indexes.md). `compareKeys` is the order of keys.
 */
export const { Index, compareKeys } = model.indexes;

export const {
  Synchronized, synchronized, isSynchronized, weak,
  registerClass, registerClasses,
  encodeValue, decodeValue, encodeRecord, decodeRecord, makeFromRecord,
} = model;
